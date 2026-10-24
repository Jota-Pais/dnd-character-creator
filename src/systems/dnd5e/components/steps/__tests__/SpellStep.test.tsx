import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { SpellStep } from '../SpellStep'
import { useCharacterStore } from '../../../stores/characterStore'
import { EMPTY_DRAFT, type CharacterDraft } from '../../../types/character'

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
