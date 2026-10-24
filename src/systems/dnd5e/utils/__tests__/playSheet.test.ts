import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import { buildPlaySheet } from '../playSheet'
import { getTotalHp, getSheetResources } from '../sheetEffects'
import { getFinalAbilityScores } from '../asiUtils'
import { getCombinedSpellSlots, getPactSlots } from '../spellUtils'
import { getHitDicePool } from '../multiclassUtils'
import { calculateModifier } from '../abilityScoreUtils'

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), ...overrides }
}

const SCORES = { STR: 15, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 }

const fighter = draft({ class: 'fighter', race: 'human', level: 1, abilityScores: SCORES })

const warlockWizard = draft({
  class: 'warlock',
  level: 5,
  abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 15, WIS: 10, CHA: 15 },
  additionalClasses: [{
    classId: 'wizard', level: 2, classChoices: structuredClone(EMPTY_DRAFT.classChoices),
    spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
  }],
})

describe('buildPlaySheet', () => {
  it('usa as funções da ficha, sem refazer conta', () => {
    const sheet = buildPlaySheet(fighter)
    const scores = getFinalAbilityScores(fighter)
    const con = calculateModifier(scores.CON)
    expect(sheet.abilityScores).toEqual(scores)
    expect(sheet.conModifier).toBe(con)
    expect(sheet.maxHp).toBe(getTotalHp(fighter, con))
    expect(sheet.hitDice).toEqual(getHitDicePool(fighter))
    expect(sheet.spellSlots).toEqual(getCombinedSpellSlots(fighter))
    expect(sheet.pactSlots).toBeNull()
    expect(sheet.resources).toEqual(getSheetResources(fighter, scores))
    expect(sheet.proficiencyBonus).toBe(2)
  })

  it('guerreiro 1: d10, Retomar o Fôlego curto, TR de FOR e CON com proficiência, deslocamento do humano', () => {
    const sheet = buildPlaySheet(fighter)
    expect(sheet.hitDice).toEqual([{ die: 10, count: 1 }])
    expect(sheet.maxHp).toBe(10 + sheet.conModifier)
    expect(sheet.resources.find(r => r.id === 'second-wind')?.recharge).toBe('short')
    expect(sheet.savingThrows.STR).toEqual({ bonus: sheet.abilityModifiers.STR + 2, proficient: true })
    expect(sheet.savingThrows.CON.proficient).toBe(true)
    expect(sheet.savingThrows.DEX).toEqual({ bonus: sheet.abilityModifiers.DEX, proficient: false })
    expect(sheet.speed).toBe(30)
    expect(sheet.initiativeBonus).toBe(sheet.abilityModifiers.DEX)
    expect(sheet.spellSlots.every(n => n === 0)).toBe(true)
  })

  it('bruxo 3 / mago 2: Pacto separado do pool, poço com dois tipos de dado', () => {
    const sheet = buildPlaySheet(warlockWizard)
    expect(sheet.pactSlots).toEqual(getPactSlots(warlockWizard))
    expect(sheet.pactSlots).toEqual({ slots: 2, slotLevel: 2 })
    expect(sheet.spellSlots).toEqual(getCombinedSpellSlots(warlockWizard))
    expect(sheet.spellSlots[0]).toBe(3)
    expect(sheet.hitDice).toEqual([{ die: 8, count: 3 }, { die: 6, count: 2 }])
    expect(sheet.resources.find(r => r.id === 'arcane-recovery')?.recharge).toBe('day')
  })

  it('sem classe: PV 0 e poço vazio', () => {
    const sheet = buildPlaySheet(draft({}))
    expect(sheet.maxHp).toBe(0)
    expect(sheet.hitDice).toEqual([])
    expect(sheet.speed).toBe(0)
  })

  it('é cópia: mexer no snapshot não alcança o draft nem as tabelas do app', () => {
    const before = structuredClone(warlockWizard)
    const sheet = buildPlaySheet(warlockWizard)
    sheet.spellSlots[0] = 99
    sheet.pactSlots!.slots = 99
    sheet.hitDice[0].count = 99
    sheet.resources[0].name = 'mexido'
    expect(warlockWizard).toEqual(before)
    expect(getCombinedSpellSlots(warlockWizard)[0]).toBe(3)
    expect(getPactSlots(warlockWizard)?.slots).toBe(2)
    expect(buildPlaySheet(warlockWizard).resources[0].name).not.toBe('mexido')
  })
})
