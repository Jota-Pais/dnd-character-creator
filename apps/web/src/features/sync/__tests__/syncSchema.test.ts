import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT as DND_DRAFT, type CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import type { PlayState } from '@rpg/rules/systems/dnd5e/types/playState'
import { createPlayState } from '@rpg/rules/systems/dnd5e/utils/playState'
import { EMPTY_DRAFT as ORDEM_DRAFT, type OrdemCharacterDraft } from '@rpg/rules/systems/ordem/types/character'
import { DRAFT_SYNC_SCHEMA as DND_SCHEMA } from '../../../systems/dnd5e/storage/storage'
import { PLAY_STATE_SYNC_SCHEMA } from '../../../systems/dnd5e/storage/playStorage'
import { DRAFT_SYNC_SCHEMA as ORDEM_SCHEMA } from '../../../systems/ordem/storage/storage'

/**
 * A forma dos documentos que sincronizam, presa ao número que cada um manda ao servidor (o
 * `schema`). O app instalado só troca de versão na abertura seguinte, então aparelhos da mesma
 * conta rodam versões diferentes por um tempo. O mais velho que recebe um documento com número
 * maior que o seu não o aplica nem o regrava: ele ainda não conhece os campos novos, e o estado de
 * jogo, que é sanitizado a cada gravação, os perderia.
 *
 * As listas abaixo são conferidas pelo compilador contra os tipos (`Record<keyof …, true>`): campo
 * novo no draft ou no estado de jogo, opcional ou não, quebra o typecheck aqui.
 *
 * SE ESTE ARQUIVO PAROU DE COMPILAR OU O TESTE FALHOU: o draft ou o estado de jogo ganhou (ou
 * perdeu) um campo. Suba o número do documento que mudou, no storage dele, e atualize aqui a lista
 * e o número, no mesmo commit.
 */
const DND_DRAFT_FIELDS: Record<keyof CharacterDraft, true> = {
  name: true, level: true, race: true, subrace: true, raceChoices: true, class: true, classChoices: true,
  spellChoices: true, additionalClasses: true, multiclass: true, abilityMethod: true, abilityScores: true,
  rolledValues: true, asiChoices: true, featSelections: true, background: true, backgroundChoices: true,
  equipment: true, hpMethod: true, hpRolls: true,
}

const DND_CLASS_CHOICES_FIELDS: Record<keyof CharacterDraft['classChoices'], true> = {
  skills: true, subclass: true, fightingStyle: true, expertiseItems: true, tools: true, subclassExtras: true,
  progressionChoices: true,
}

const PLAY_STATE_FIELDS: Record<keyof PlayState, true> = {
  version: true, characterId: true, updatedAt: true, damageTaken: true, maxHpAdjustment: true, tempHp: true,
  lifeState: true, deathSaves: true, hitDiceSpent: true, spellSlotsSpent: true, pactSlotsSpent: true,
  resourcesSpent: true, conditions: true, conditionNotes: true, exhaustionLevel: true, concentration: true,
  activeEffects: true, turn: true, wornArmor: true, inventory: true, restCounters: true, inspiration: true,
  note: true, rolls: true, lastLongRestAt: true, sheetSnapshot: true,
}

const ORDEM_DRAFT_FIELDS: Record<keyof OrdemCharacterDraft, true> = {
  name: true, nex: true, attributes: true, origin: true, originGmSkillChoices: true, class: true,
  classChoiceGroupPicks: true, classFreeSkillChoices: true, expertSkillChoices: true, trilha: true,
  powerChoices: true, ritualChoices: true, ritualElementChoices: true, bonusRitualChoices: true,
  attributeIncreaseChoices: true, skillGradeChoices: true, versatilityChoice: true, patente: true,
  equipmentChoices: true, equipmentModifications: true, equipmentCurses: true, equipmentCurseChoices: true,
  accessorySkillChoices: true, kitSkillChoices: true, equipmentElementChoices: true, powerParams: true,
  utilityBackpackItem: true, favoriteRitual: true, weaponSkillChoices: true, favoriteWeapon: true,
  favoriteEquipment: true, workToolWeapon: true, paranormalPowerChoices: true, affinityElement: true,
}

/** O que existe no valor de exemplo está na lista (o compilador garante o sentido contrário). */
const missingFrom = (fields: Record<string, true>, value: object) => Object.keys(value).filter(key => !(key in fields))

describe('a forma dos documentos que sincronizam', () => {
  it('o draft do D&D está no schema 1', () => {
    expect(DND_SCHEMA).toBe(1)
    expect(Object.keys(DND_DRAFT_FIELDS)).toHaveLength(20)
    expect(Object.keys(DND_CLASS_CHOICES_FIELDS)).toHaveLength(7)
    expect(missingFrom(DND_DRAFT_FIELDS, DND_DRAFT)).toEqual([])
    expect(missingFrom(DND_CLASS_CHOICES_FIELDS, DND_DRAFT.classChoices)).toEqual([])
  })

  it('o estado de jogo do D&D está no schema 1', () => {
    expect(PLAY_STATE_SYNC_SCHEMA).toBe(1)
    expect(Object.keys(PLAY_STATE_FIELDS)).toHaveLength(26)
    expect(missingFrom(PLAY_STATE_FIELDS, createPlayState('k1'))).toEqual([])
  })

  it('o draft do Ordem está no schema 1', () => {
    expect(ORDEM_SCHEMA).toBe(1)
    expect(Object.keys(ORDEM_DRAFT_FIELDS)).toHaveLength(34)
    expect(missingFrom(ORDEM_DRAFT_FIELDS, ORDEM_DRAFT)).toEqual([])
  })
})
