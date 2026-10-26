import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft, type ClassEntry } from '../../types/character'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { getProgressionSlotsUpToLevel } from '../progressionChoiceUtils'
import { getProgressionChoiceBlocks, getProgressionOptions, getSubclassDetails } from '../progressionOptions'
import { isStepComplete, sanitizeImportedDraft } from '../draftValidation'
import { getStepPendingReasons } from '../pendingReasons'
import { allClassEntries, formatClassLevelLabel } from '../multiclassUtils'
import { getSheetClassFeatures } from '../asiUtils'
import { getEffectiveTraits, getRace, getSubrace } from '../raceUtils'

// Ancestral Dracônico do feiticeiro da Linhagem Dracônica (1º nível, p. 80).

const SLOT = 'draconic-ancestor-1'

function sorcerer(level: number, progressionChoices: Record<string, string[]>, subclass = 'draconic-bloodline'): CharacterDraft {
  return {
    ...structuredClone(COMPLETE_DRAFT),
    class: 'sorcerer',
    level,
    classChoices: {
      ...structuredClone(EMPTY_DRAFT.classChoices),
      skills: ['arcana', 'persuasion'],
      subclass,
      progressionChoices,
    },
  }
}

function sorcererEntry(level: number, progressionChoices: Record<string, string[]>): ClassEntry {
  return {
    classId: 'sorcerer',
    level,
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'draconic-bloodline', progressionChoices },
    spellChoices: { cantrips: [], spells: [] },
    asiChoices: [],
    hpRolls: [],
  }
}

const feature = (entry: ClassEntry, name: string) => getSheetClassFeatures(entry).find(f => f.name === name)

describe('Ancestral Dracônico: o slot', () => {
  it('existe desde o 1º nível só na Linhagem Dracônica, com os dez dragões da tabela', () => {
    expect(getProgressionSlotsUpToLevel('sorcerer', 'draconic-bloodline', 1).map(s => s.id)).toContain(SLOT)
    expect(getProgressionSlotsUpToLevel('sorcerer', 'wild-magic', 20).map(s => s.id)).not.toContain(SLOT)
    const options = getProgressionOptions('dragon-ancestors')
    expect(options).toHaveLength(10)
    expect(options.find(o => o.id === 'red')).toMatchObject({ name: 'Vermelho', damageType: 'Fogo', description: 'Tipo de dano: fogo.' })
  })

  it('sem o ancestral, a etapa Classe fica pendente e diz o que falta', () => {
    const d = sorcerer(1, {})
    expect(isStepComplete(d, 'class')).toBe(false)
    expect(getStepPendingReasons(d, 'class')).toEqual(['Feiticeiro: escolha mais 1 em Ancestral Dracônico (ganho no 1º nível)'])
    const done = sorcerer(1, { [SLOT]: ['red'] })
    expect(isStepComplete(done, 'class')).toBe(true)
    expect(getStepPendingReasons(done, 'class')).toEqual([])
  })

  it('na multiclasse, o feiticeiro adicional também escolhe', () => {
    const d = (choices: Record<string, string[]>): CharacterDraft => ({
      ...structuredClone(COMPLETE_DRAFT),
      level: 2,
      abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 13 },
      abilityMethod: 'custom',
      multiclass: true,
      additionalClasses: [sorcererEntry(1, choices)],
    })
    expect(getStepPendingReasons(d({}), 'class')).toContain('Feiticeiro: escolha mais 1 em Ancestral Dracônico (ganho no 1º nível)')
    expect(isStepComplete(d({ [SLOT]: ['blue'] }), 'class')).toBe(true)
    expect(formatClassLevelLabel(d({ [SLOT]: ['blue'] }))).toBe('Bárbaro 1º / Feiticeiro 1º (Linhagem Dracônica, ancestral Azul) — nível 2')
  })

  it('ficha antiga (sem o campo) carrega e fica pendente; a escolha sobrevive a export/import', () => {
    const old = sanitizeImportedDraft(JSON.parse(JSON.stringify(sorcerer(3, {}))))!
    expect(old.classChoices.progressionChoices).toEqual({})
    expect(isStepComplete(old, 'class')).toBe(false)
    const saved = sanitizeImportedDraft(JSON.parse(JSON.stringify(sorcerer(3, { [SLOT]: ['gold'] }))))!
    expect(saved.classChoices.progressionChoices[SLOT]).toEqual(['gold'])
  })
})

describe('Ancestral Dracônico na ficha (Revisão e PDF)', () => {
  it('a característica Ancestral Dracônico mostra o dragão com o tipo de dano', () => {
    const entry = allClassEntries(sorcerer(1, { [SLOT]: ['red'] }))[0]
    expect(feature(entry, 'Ancestral Dracônico')).toMatchObject({ chosen: 'Vermelho (dano de fogo)', chosenLabel: 'Escolha' })
  })

  it('a Afinidade Elemental (6º) mostra o tipo de dano do ancestral', () => {
    const entry = allClassEntries(sorcerer(6, { [SLOT]: ['bronze'] }))[0]
    expect(feature(entry, 'Afinidade Elemental')).toMatchObject({ chosen: 'elétrico (ancestral Bronze)', chosenLabel: 'Tipo de dano' })
    expect(feature(allClassEntries(sorcerer(5, { [SLOT]: ['bronze'] }))[0], 'Afinidade Elemental')).toBeUndefined()
  })

  it('sem escolha, as características saem sem a linha (a pendência fica na etapa Classe)', () => {
    const entry = allClassEntries(sorcerer(6, {}))[0]
    expect(feature(entry, 'Afinidade Elemental')).toMatchObject({ chosen: null })
    expect(feature(entry, 'Ancestral Dracônico')).toMatchObject({ chosen: null })
  })

  it('o ancestral sai junto da subclasse no cabeçalho, e não nas Escolhas de Progressão', () => {
    const d = sorcerer(6, { [SLOT]: ['silver'] })
    expect(formatClassLevelLabel(d)).toBe('Feiticeiro 6º (Linhagem Dracônica, ancestral Prata)')
    expect(getSubclassDetails(allClassEntries(d)[0])).toEqual(['ancestral Prata'])
    expect(getProgressionChoiceBlocks(allClassEntries(d))).toEqual([])
    expect(formatClassLevelLabel(sorcerer(6, {}))).toBe('Feiticeiro 6º (Linhagem Dracônica)')
  })

  it('trocar de subclasse esconde o ancestral sem apagá-lo', () => {
    const d = sorcerer(6, { [SLOT]: ['silver'] }, 'wild-magic')
    expect(formatClassLevelLabel(d)).toBe('Feiticeiro 6º (Magia Selvagem)')
    expect(d.classChoices.progressionChoices[SLOT]).toEqual(['silver'])
  })

  it('não se confunde com o draconato: a sub-raça e o ancestral do feiticeiro são escolhas separadas', () => {
    const d = { ...sorcerer(6, { [SLOT]: ['blue'] }), race: 'dragonborn', subrace: 'red-dragonborn' }
    const race = getRace('dragonborn')!
    const raceDamage = getEffectiveTraits(race, getSubrace(race, 'red-dragonborn')!).find(t => t.name === 'Tipo de Dano')
    expect(raceDamage?.description).toBe('Fogo.')
    expect(feature(allClassEntries(d)[0], 'Afinidade Elemental')?.chosen).toBe('elétrico (ancestral Azul)')
  })
})
