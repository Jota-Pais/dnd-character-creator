import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import { buildPlaySheet } from '../playSheet'
import { getTotalHp, getSheetResources } from '../sheetEffects'
import { getFinalAbilityScores } from '../asiUtils'
import { getCombinedSpellSlots, getPactSlots } from '../spellUtils'
import { getHitDicePool } from '../multiclassUtils'
import { calculateModifier } from '../abilityScoreUtils'
import { getSavingThrowChecks } from '../proficiencyUtils'
import type { WornArmor } from '../../types/session'

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
    expect(sheet.savingThrows).toEqual(getSavingThrowChecks(fighter, scores))
  })

  it('TR pela fonte única: o Resiliente e a Alma de Diamante entram no PlaySheet', () => {
    const resilient = draft({
      class: 'fighter', level: 4, abilityScores: SCORES,
      asiChoices: [{ kind: 'feat', featId: 'resiliente', abilities: ['WIS'] }],
    })
    const sheet = buildPlaySheet(resilient)
    expect(sheet.savingThrows.WIS.proficient).toBe(true)
    expect(sheet.savingThrows).toEqual(getSavingThrowChecks(resilient, getFinalAbilityScores(resilient)))
    const monk = draft({ class: 'monk', level: 14, abilityScores: SCORES })
    const monkSheet = buildPlaySheet(monk)
    expect(monkSheet.savingThrows.CHA.proficient).toBe(true)
    expect(monkSheet.savingThrows.CHA.bonus).toBe(monkSheet.abilityModifiers.CHA + monkSheet.proficiencyBonus)
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

  it('Acostumado à Morte-Vida (mago da Necromancia 10): o PV máximo não pode ser reduzido', () => {
    const necro = (level: number) => draft({
      class: 'wizard', level, abilityScores: SCORES,
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'necromancy' },
    })
    expect(buildPlaySheet(necro(10)).hpMaxReductionImmunity).toBe('Acostumado à Morte-Vida')
    expect(buildPlaySheet(necro(9)).hpMaxReductionImmunity).toBeUndefined()
    expect(buildPlaySheet(fighter).hpMaxReductionImmunity).toBeUndefined()
  })

  it('Resistência Implacável (meio-orc): o traço e o recurso que ele gasta', () => {
    const halfOrc = draft({ class: 'barbarian', race: 'half-orc', level: 1, abilityScores: SCORES })
    const sheet = buildPlaySheet(halfOrc)
    expect(sheet.dropToOneHp).toEqual({ resourceId: 'relentless-endurance', source: 'Resistência Implacável' })
    expect(sheet.resources.some(r => r.id === 'relentless-endurance')).toBe(true)
    expect(buildPlaySheet(fighter).dropToOneHp).toBeUndefined()
  })

  it('sem classe: PV 0 e poço vazio', () => {
    const sheet = buildPlaySheet(draft({}))
    expect(sheet.maxHp).toBe(0)
    expect(sheet.hitDice).toEqual([])
    expect(sheet.speed).toBe(0)
  })

  // A armadura vestida no jogo (onda `armadura`): o sheet sai com ela, conferida com a base e com o
  // que o personagem carrega; o criador manda quando o equipamento dele mudou.
  describe('a armadura vestida', () => {
    const barbarian = draft({
      class: 'barbarian', race: 'human', level: 5, abilityScores: SCORES,
      equipment: {
        ...structuredClone(EMPTY_DRAFT.equipment), method: 'wealth',
        purchasedItems: ['hide', 'plate', 'shield'].map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const })),
      },
    })
    const basis = { bodyArmorId: 'hide', shield: true }
    const inPlate: WornArmor = { bodyArmorId: 'plate', shield: false, basis }

    it('sem troca: o equipado no criador, e o que se carrega, com a proficiência', () => {
      const sheet = buildPlaySheet(barbarian)
      expect(sheet.equippedArmor).toEqual(basis)
      expect(sheet.wornArmor).toEqual(basis)
      expect(sheet.carriedArmor).toEqual([
        { id: 'hide', name: 'Gibão de Peles', category: 'medium', proficient: true },
        { id: 'plate', name: 'Placas', category: 'heavy', proficient: false },
        { id: 'shield', name: 'Escudo', category: 'shield', proficient: true },
      ])
      expect(sheet.speed).toBe(40)
      expect(sheet.unproficientArmor).toEqual([])
    })

    it('de Placas: o Movimento Rápido sai, a Fúria fica sem os benefícios e a proficiência avisa', () => {
      const sheet = buildPlaySheet(barbarian, inPlate)
      expect(sheet.wornArmor).toEqual({ bodyArmorId: 'plate', shield: false })
      expect(sheet.speed).toBe(30)
      expect(sheet.toggles.find(t => t.id === 'rage')?.benefits[0].blockedBy).toBe('Placas')
      expect(sheet.unproficientArmor).toEqual(['Placas'])
    })

    it('a base que não bate com o criador: a troca não vale', () => {
      const sheet = buildPlaySheet(barbarian, { ...inPlate, basis: { bodyArmorId: 'hide', shield: false } })
      expect(sheet.wornArmor).toEqual(basis)
      expect(sheet).toEqual(buildPlaySheet(barbarian))
    })

    it('o que deixou de ser carregado sai do vestido', () => {
      const noPlate = { ...barbarian, equipment: { ...barbarian.equipment, purchasedItems: barbarian.equipment.purchasedItems.filter(i => i.itemId !== 'plate') } }
      expect(buildPlaySheet(noPlate, { bodyArmorId: 'plate', shield: true, basis }).wornArmor).toEqual({ bodyArmorId: null, shield: true })
    })
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
