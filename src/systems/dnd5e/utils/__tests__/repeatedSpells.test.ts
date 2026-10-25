import { describe, it, expect } from 'vitest'
import {
  getSpellSources,
  getRepeatedSpells,
  formatRepeatedSpell,
  getRepeatedSpellNotes,
} from '../spellUtils'
import { isStepComplete } from '../draftValidation'
import { collectStepReasons } from '../pendingReasons'
import { EMPTY_DRAFT, type CharacterDraft, type ClassEntry } from '../../types/character'

// Decisão do usuário (2026-10-25): a mesma magia em duas fontes (duas classes, Segredo Mágico
// igual a magia de outra classe, truque da raça igual ao da classe) é permitida pela regra, mas
// quase sempre é engano — a ficha avisa, não bloqueia nem apaga.

function extra(classId: string, level: number, over: Partial<ClassEntry> = {}): ClassEntry {
  return {
    classId, level,
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), ...over.classChoices },
    spellChoices: { cantrips: [], spells: [] },
    asiChoices: [], hpRolls: [],
    ...over,
  }
}

/** Mago 5 / Guerreiro (Cavaleiro Arcano) 3. */
function wizardEldritchKnight(wizard: { cantrips: string[]; spells: string[] }, knight: { cantrips: string[]; spells: string[] }): CharacterDraft {
  return {
    ...structuredClone(EMPTY_DRAFT),
    class: 'wizard', level: 8, multiclass: true,
    abilityScores: { STR: 13, DEX: 14, CON: 12, INT: 16, WIS: 10, CHA: 8 },
    spellChoices: wizard,
    additionalClasses: [extra('fighter', 3, {
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'eldritch-knight' },
      spellChoices: knight,
    })],
  }
}

describe('getRepeatedSpells', () => {
  it('mago + Cavaleiro Arcano com Mísseis Mágicos nos dois: avisa, com as duas fontes', () => {
    const d = wizardEldritchKnight(
      { cantrips: ['fire-bolt'], spells: ['magic-missile', 'shield'] },
      { cantrips: ['light'], spells: ['magic-missile'] },
    )
    const repeated = getRepeatedSpells(d)
    expect(repeated.map(r => r.spellId)).toEqual(['magic-missile'])
    expect(repeated[0].sources.map(s => s.label)).toEqual(['Mago', 'Guerreiro (Cavaleiro Arcano)'])
    expect(formatRepeatedSpell(repeated[0])).toBe(
      'Mísseis Mágicos aparece em Mago e Guerreiro (Cavaleiro Arcano). '
      + 'Repetir não é proibido, mas gasta uma escolha à toa — provavelmente foi engano: troque uma delas.',
    )
  })

  it('truque repetido entre as classes também avisa', () => {
    const d = wizardEldritchKnight(
      { cantrips: ['fire-bolt'], spells: [] },
      { cantrips: ['fire-bolt'], spells: [] },
    )
    expect(getRepeatedSpells(d).map(r => r.spellId)).toEqual(['fire-bolt'])
  })

  it('sem magia em comum, nada a avisar', () => {
    const d = wizardEldritchKnight(
      { cantrips: ['fire-bolt'], spells: ['magic-missile'] },
      { cantrips: ['light'], spells: ['shield'] },
    )
    expect(getRepeatedSpells(d)).toEqual([])
  })

  it('mãos mágicas que o Trapaceiro Arcano já ganha, escolhida de novo no mago, avisa', () => {
    const d: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'wizard', level: 6, multiclass: true,
      spellChoices: { cantrips: ['mage-hand'], spells: [] },
      additionalClasses: [extra('rogue', 3, {
        classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'arcane-trickster' },
      })],
    }
    const [r] = getRepeatedSpells(d)
    expect(r.spellId).toBe('mage-hand')
    expect(r.sources.map(s => s.key)).toEqual(['class:wizard', 'class:rogue'])
  })

  it('Segredo Mágico igual a magia de outra classe da multiclasse avisa, com o nome do slot', () => {
    const d: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'bard', level: 12, multiclass: true,
      classChoices: {
        ...structuredClone(EMPTY_DRAFT.classChoices),
        subclass: 'college-of-valor',
        progressionChoices: { 'bard-magical-secrets-10': ['magic-missile', 'cure-wounds'] },
      },
      additionalClasses: [extra('wizard', 2, { spellChoices: { cantrips: [], spells: ['magic-missile'] } })],
    }
    // Bardo 10 / Mago 2.
    const [r] = getRepeatedSpells(d)
    expect(r.spellId).toBe('magic-missile')
    expect(r.sources.map(s => s.label)).toEqual(['Bardo — Segredos Mágicos', 'Mago'])
  })

  it('truque do Alto Elfo igual ao truque do mago avisa; o truque inato do tiefling igual ao do clérigo também', () => {
    const elf: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'wizard', level: 1, race: 'elf', subrace: 'high-elf',
      raceChoices: { cantrip: 'fire-bolt' },
      spellChoices: { cantrips: ['fire-bolt', 'light'], spells: [] },
    }
    const [r] = getRepeatedSpells(elf)
    expect(r.spellId).toBe('fire-bolt')
    expect(r.sources.map(s => s.key)).toEqual(['class:wizard', 'race-cantrip'])

    const tiefling: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'cleric', level: 1, race: 'tiefling',
      spellChoices: { cantrips: ['thaumaturgy', 'guidance', 'sacred-flame'], spells: [] },
    }
    expect(getRepeatedSpells(tiefling).map(r => [r.spellId, r.sources.map(s => s.key)]))
      .toEqual([['thaumaturgy', ['class:cleric', 'race-innate']]])
  })

  it('magia inata de 1º nível ou mais não conta: é um uso sem espaço, que a da classe não repete', () => {
    const d: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'warlock', level: 3, race: 'tiefling',
      spellChoices: { cantrips: ['eldritch-blast', 'minor-illusion'], spells: ['hellish-rebuke'] },
    }
    expect(getSpellSources(d).find(s => s.key === 'race-innate')?.spellIds).toEqual(['thaumaturgy'])
    expect(getRepeatedSpells(d)).toEqual([])
  })

  it('truque gravado de uma raça que não tem a escolha (trocou de raça) não conta', () => {
    const d: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'wizard', level: 1, race: 'human',
      raceChoices: { cantrip: 'fire-bolt' },
      spellChoices: { cantrips: ['fire-bolt'], spells: [] },
    }
    expect(getRepeatedSpells(d)).toEqual([])
  })

  it('classe que ainda não conjura não é fonte (Guerreiro 2 sem arquétipo)', () => {
    const d: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'wizard', level: 4, multiclass: true,
      spellChoices: { cantrips: [], spells: ['magic-missile'] },
      additionalClasses: [extra('fighter', 2, { spellChoices: { cantrips: [], spells: ['magic-missile'] } })],
    }
    expect(getRepeatedSpells(d)).toEqual([])
  })
})

describe('getRepeatedSpellNotes — nota do card na etapa Magias', () => {
  it('cada seção diz onde mais a magia está', () => {
    const d = wizardEldritchKnight(
      { cantrips: [], spells: ['magic-missile'] },
      { cantrips: [], spells: ['magic-missile'] },
    )
    const repeated = getRepeatedSpells(d)
    expect(getRepeatedSpellNotes(repeated, 'class:wizard')).toEqual({ 'magic-missile': 'também em Guerreiro (Cavaleiro Arcano)' })
    expect(getRepeatedSpellNotes(repeated, 'class:fighter')).toEqual({ 'magic-missile': 'também em Mago' })
    expect(getRepeatedSpellNotes(repeated, 'class:bard')).toEqual({})
  })
})

describe('magia repetida não bloqueia', () => {
  it('não muda a conclusão da etapa Magias nem gera motivo pendente', () => {
    const same = wizardEldritchKnight(
      { cantrips: ['fire-bolt', 'light', 'mage-hand', 'prestidigitation'], spells: ['magic-missile', 'shield', 'sleep', 'detect-magic', 'identify', 'burning-hands'] },
      { cantrips: ['fire-bolt', 'message'], spells: ['magic-missile', 'thunderwave', 'chromatic-orb'] },
    )
    const differ = wizardEldritchKnight(
      same.spellChoices,
      { cantrips: ['ray-of-frost', 'message'], spells: ['color-spray', 'thunderwave', 'chromatic-orb'] },
    )
    expect(getRepeatedSpells(same).length).toBe(2)
    expect(getRepeatedSpells(differ)).toEqual([])
    expect(isStepComplete(same, 'spells')).toBe(isStepComplete(differ, 'spells'))
    expect(collectStepReasons(same, 'spells')).toEqual(collectStepReasons(differ, 'spells'))
  })
})
