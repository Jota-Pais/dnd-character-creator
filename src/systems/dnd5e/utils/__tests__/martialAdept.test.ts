import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { isStepComplete, sanitizeImportedDraft } from '../draftValidation'
import { getStepPendingReasons } from '../pendingReasons'
import {
  getFeatChoiceSlots, getFeatManeuverBlock, getFeatManeuvers, getRepeatedFeatManeuvers, isFeatChoiceComplete,
} from '../sheetEffects'
import {
  formatManeuverSaveDc, getClassManeuvers, getManeuverOptions, getManeuverSaveDc,
} from '../maneuverUtils'
import { getFinalAbilityScores } from '../asiUtils'

// Talento Adepto Marcial (p. 167): duas manobras da lista do Mestre de Batalha e a CD delas.

const FEAT = 'adepto-marcial'

/** Bárbaro 4 com o Adepto Marcial no espaço de ASI do 4º nível. */
function barbarian(maneuvers?: string[]): CharacterDraft {
  return {
    ...structuredClone(COMPLETE_DRAFT),
    level: 4,
    asiChoices: [{ kind: 'feat', featId: FEAT }],
    featSelections: maneuvers ? { [FEAT]: { maneuvers } } : {},
  }
}

/** Guerreiro Mestre de Batalha 4 (Aparar, Derrubar, Inspirar no 3º) com o Adepto Marcial no 4º. */
function battleMaster(maneuvers?: string[], subclass = 'battle-master'): CharacterDraft {
  return {
    ...structuredClone(COMPLETE_DRAFT),
    class: 'fighter',
    level: 4,
    classChoices: {
      ...structuredClone(EMPTY_DRAFT.classChoices),
      skills: ['acrobatics', 'history'],
      fightingStyle: 'defense',
      subclass,
      progressionChoices: { 'battle-master-maneuvers-3': ['aparar', 'derrubar', 'inspirar'] },
    },
    asiChoices: [{ kind: 'feat', featId: FEAT }],
    featSelections: maneuvers ? { [FEAT]: { maneuvers } } : {},
  }
}

describe('Adepto Marcial — escolha das manobras', () => {
  it('abre um slot de duas manobras, sem nada tomado para quem não é Mestre de Batalha', () => {
    const [slot] = getFeatChoiceSlots(barbarian())
    expect(slot.feat.id).toBe(FEAT)
    expect(slot.choices.maneuverChoice).toEqual({ count: 2 })
    expect(slot.takenManeuvers).toEqual([])
    expect(isFeatChoiceComplete(slot)).toBe(false)
  })

  it('a lista é a do Mestre de Batalha (16 manobras)', () => {
    expect(getManeuverOptions()).toHaveLength(16)
  })

  it('duas manobras completam o talento', () => {
    const d = barbarian(['ataque-de-precisao', 'aparar'])
    expect(isFeatChoiceComplete(getFeatChoiceSlots(d)[0])).toBe(true)
    expect(getFeatManeuvers(d)).toEqual(['ataque-de-precisao', 'aparar'])
    expect(isStepComplete(d, 'improvements')).toBe(true)
  })

  it('faltando manobra, a etapa dona do talento fica pendente e diz quantas', () => {
    const d = barbarian(['aparar'])
    expect(isStepComplete(d, 'improvements')).toBe(false)
    expect(getStepPendingReasons(d, 'improvements')).toEqual([
      expect.stringMatching(/talento Adepto Marcial: escolha mais 1 manobra$/),
    ])
  })

  it('pelo Humano Variante, a pendência fica na etapa Raça', () => {
    const d: CharacterDraft = {
      ...structuredClone(COMPLETE_DRAFT),
      race: 'human', subrace: 'variant-human',
      raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['insight'], languages: ['elvish'], feat: FEAT },
    }
    expect(isStepComplete(d, 'race')).toBe(false)
    expect(getStepPendingReasons(d, 'race')).toEqual(['Humano (Variante), talento Adepto Marcial: escolha mais 2 manobras'])
  })
})

describe('Adepto Marcial × Mestre de Batalha — sem repetir manobra', () => {
  it('as manobras do arquétipo ficam tomadas para o talento', () => {
    expect(getClassManeuvers(battleMaster())).toEqual(['aparar', 'derrubar', 'inspirar'])
    expect(getFeatChoiceSlots(battleMaster())[0].takenManeuvers).toEqual(['aparar', 'derrubar', 'inspirar'])
  })

  it('manobra repetida (ficha antiga) trava o talento com o motivo', () => {
    const d = battleMaster(['aparar', 'ataque-de-precisao'])
    const [slot] = getFeatChoiceSlots(d)
    expect(getRepeatedFeatManeuvers(slot)).toEqual(['aparar'])
    expect(isFeatChoiceComplete(slot)).toBe(false)
    expect(isStepComplete(d, 'improvements')).toBe(false)
    expect(getStepPendingReasons(d, 'improvements')).toEqual([
      expect.stringMatching(/talento Adepto Marcial: a manobra Aparar já vem do Mestre de Batalha — troque por outra$/),
    ])
  })

  it('manobras diferentes das do arquétipo completam o talento', () => {
    const d = battleMaster(['ataque-de-precisao', 'contra-atacar'])
    expect(isStepComplete(d, 'improvements')).toBe(true)
  })

  it('escolha guardada de quando era Mestre de Batalha não conta em outra subclasse', () => {
    const d = battleMaster(['aparar', 'ataque-de-precisao'], 'champion')
    expect(getClassManeuvers(d)).toEqual([])
    expect(isStepComplete(d, 'improvements')).toBe(true)
  })
})

describe('Adepto Marcial — CD das manobras na ficha', () => {
  it('8 + proficiência + FOR ou DES, com os atributos finais', () => {
    // Meio-orc: FOR 15 + 2 = 17 (+3), DES 14 (+2); proficiência +2 no 4º.
    const d = barbarian(['ataque-de-precisao', 'aparar'])
    expect(getManeuverSaveDc(4, getFinalAbilityScores(d))).toEqual({ strength: 13, dexterity: 12 })
    const block = getFeatManeuverBlock(d, FEAT, getFinalAbilityScores(d))!
    expect(block.saveDc).toBe('CD das manobras: 13 (Força) ou 12 (Destreza), à sua escolha')
    expect(block.maneuvers.map(m => [m.name, m.repeated])).toEqual([['Ataque de Precisão', false], ['Aparar', false]])
    expect(block.maneuvers[0].text).toMatch(/dado de superioridade/)
  })

  it('FOR e DES com o mesmo modificador viram um valor só', () => {
    expect(formatManeuverSaveDc({ strength: 13, dexterity: 13 })).toBe('CD das manobras: 13 (Força ou Destreza)')
  })

  it('sem manobra escolhida, nada sai na ficha', () => {
    const d = barbarian()
    expect(getFeatManeuverBlock(d, FEAT, getFinalAbilityScores(d))).toBeNull()
  })

  it('a repetida sai marcada', () => {
    const d = battleMaster(['aparar', 'ataque-de-precisao'])
    const block = getFeatManeuverBlock(d, FEAT, getFinalAbilityScores(d))!
    expect(block.maneuvers.find(m => m.id === 'aparar')?.repeated).toBe(true)
  })
})

describe('Adepto Marcial — importação', () => {
  it('só manobra conhecida, sem repetir, até duas', () => {
    const raw = JSON.parse(JSON.stringify(barbarian()))
    raw.featSelections = { [FEAT]: { maneuvers: ['aparar', 'aparar', 'golpe-inexistente', 'derrubar', 'inspirar', 7] } }
    expect(sanitizeImportedDraft(raw)!.featSelections[FEAT]).toEqual({ maneuvers: ['aparar', 'derrubar'] })
  })

  it('ficha antiga sem a escolha carrega e fica pendente', () => {
    const raw = JSON.parse(JSON.stringify(barbarian()))
    delete raw.featSelections
    const d = sanitizeImportedDraft(raw)!
    expect(d.featSelections).toEqual({})
    expect(isStepComplete(d, 'improvements')).toBe(false)
  })
})
