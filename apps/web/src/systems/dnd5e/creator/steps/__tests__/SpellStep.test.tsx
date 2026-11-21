import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { SpellStep } from '../SpellStep'
import { useCharacterStore } from '../../../stores/characterStore'
import { EMPTY_DRAFT, type CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'

// A etapa Magias vem depois de Atributos e Aprimoramentos para mostrar os modificadores FINAIS —
// os mesmos da Revisão e da ficha imprimível. Ela lia os atributos base.

function renderWith(draft: CharacterDraft) {
  useCharacterStore.setState({ draft })
  return render(<SpellStep />)
}

afterEach(() => cleanup())

describe('SpellStep: atributos finais', () => {
  it('Bardo 4 Humano Variante: Car 15 +1 racial +2 do Incremento = 18 mostra +4', () => {
    const { container } = renderWith({
      ...structuredClone(EMPTY_DRAFT),
      race: 'human', subrace: 'variant-human', class: 'bard', level: 4,
      raceChoices: { ...EMPTY_DRAFT.raceChoices, abilityBonuses: ['CHA', 'DEX'] },
      abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 15 },
      asiChoices: [{ kind: 'asi', abilities: ['CHA', 'CHA'] }],
    })
    expect(container.textContent).toContain('Carisma (+4)')
  })

  it('Clériga Anã da Colina 3 com Sab 15 (+1 = 16) prepara até 6', () => {
    const { container } = renderWith({
      ...structuredClone(EMPTY_DRAFT),
      race: 'dwarf', subrace: 'hill-dwarf', class: 'cleric', level: 3,
      abilityScores: { STR: 10, DEX: 10, CON: 14, INT: 10, WIS: 15, CHA: 10 },
      spellChoices: { cantrips: [], spells: ['bless', 'cure-wounds', 'guiding-bolt', 'healing-word', 'shield-of-faith'] },
    })
    expect(container.textContent).toContain('Sabedoria (+3)')
    expect(container.textContent).toContain('5 preparadas (máx. 6)')
    expect(container.textContent).not.toContain('a mais')
  })

  it('preparadas acima do teto (atributo baixado depois): mantém todas e avisa', () => {
    const spells = ['bless', 'cure-wounds', 'guiding-bolt', 'healing-word', 'shield-of-faith', 'sanctuary']
    const { container } = renderWith({
      ...structuredClone(EMPTY_DRAFT),
      race: 'dwarf', subrace: 'hill-dwarf', class: 'cleric', level: 3,
      abilityScores: { STR: 10, DEX: 10, CON: 14, INT: 10, WIS: 13, CHA: 10 },
      spellChoices: { cantrips: [], spells },
    })
    expect(container.textContent).toContain('6 preparadas (máx. 5)')
    expect(container.textContent).toContain('6 magias preparadas, mas o máximo é 5 — 1 a mais')
    expect(useCharacterStore.getState().draft.spellChoices.spells).toEqual(spells)
  })
})

describe('SpellStep: magia repetida entre classes (aviso, não bloqueio)', () => {
  it('Mago + Cavaleiro Arcano com Mísseis Mágicos: aviso em cada seção e nota no card', () => {
    const draft: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'wizard', level: 8, multiclass: true,
      abilityScores: { STR: 13, DEX: 14, CON: 12, INT: 16, WIS: 10, CHA: 8 },
      spellChoices: { cantrips: [], spells: ['magic-missile'] },
      additionalClasses: [{
        classId: 'fighter', level: 3,
        classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'eldritch-knight' },
        spellChoices: { cantrips: [], spells: ['magic-missile'] }, asiChoices: [], hpRolls: [],
      }],
    }
    const { container, getAllByText } = renderWith(draft)
    expect((container.textContent ?? '').split('Mísseis Mágicos aparece em Mago e Guerreiro (Cavaleiro Arcano)').length - 1).toBe(2)
    // A aba do 1º nível de cada seção ganha ⚠; aberta, o card diz onde mais a magia está.
    for (const tab of getAllByText(/1° nível/)) fireEvent.click(tab)
    const text = container.textContent ?? ''
    expect(text).toContain('também em Guerreiro (Cavaleiro Arcano)')
    expect(text).toContain('também em Mago')
    // Nada apagado.
    expect(useCharacterStore.getState().draft.spellChoices.spells).toEqual(['magic-missile'])
  })
})

describe('SpellStep: magia repetida dentro da mesma classe', () => {
  it('bruxo do Tomo com Rajada Mística nos truques e no Livro das Sombras: o card aponta para o Livro', () => {
    const { container } = renderWith({
      ...structuredClone(COMPLETE_DRAFT),
      class: 'warlock', level: 3,
      classChoices: {
        ...structuredClone(EMPTY_DRAFT.classChoices),
        skills: ['arcana', 'deception'],
        subclass: 'fiend',
        progressionChoices: {
          'warlock-invocations-2': ['armadura-de-sombras', 'visao-diabolica'],
          'warlock-pact-boon-3': ['pact-of-the-tome'],
          'warlock-pact-tome-cantrips-3': ['eldritch-blast', 'fire-bolt', 'sacred-flame'],
        },
      },
      spellChoices: { cantrips: ['eldritch-blast', 'chill-touch'], spells: [] },
    })
    const text = container.textContent ?? ''
    expect(text).toContain('Rajada Mística aparece em Bruxo e Bruxo — Truques do Livro das Sombras')
    // A nota do card não aponta para a própria classe.
    expect(text).toContain('também em Bruxo — Truques do Livro das Sombras')
    expect(text).not.toMatch(/também em Bruxo(?! —)/)
  })
})
