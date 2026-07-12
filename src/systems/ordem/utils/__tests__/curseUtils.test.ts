import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'
import type { OrdemWeapon } from '../../types/equipment'
import {
  CURSES,
  getCurse,
  curseAppliesTo,
  canApplyCurse,
  getCurseCategoryDelta,
  getSheetAttributes,
  getCurseDefenseBonus,
  getCursedDerivedStats,
  areOpposingElements,
} from '../curseUtils'
import { getEquipmentById, getEffectiveCategory, isEquipmentStepComplete, areCursesValid, getDraftItemCategory } from '../equipmentUtils'
import { getOrdemWeaponAttack } from '../ordemWeaponUtils'
import { getOrdemClass } from '../classUtils'

function makeDraft(over: Partial<OrdemCharacterDraft>): OrdemCharacterDraft {
  return { ...EMPTY_DRAFT, attributes: { ...EMPTY_DRAFT.attributes }, ...over }
}

const revolver = getEquipmentById('revolver')!       // arma de fogo, Cat I
const faca = getEquipmentById('faca')!               // arma corpo a corpo, Cat 0
const protecaoLeve = getEquipmentById('protecao-leve')!
const utensilio = getEquipmentById('utensilio')!
const kitPericia = getEquipmentById('kit-pericia')!

describe('dados das maldições', () => {
  it('tem as 34 maldições do livro (12 de armas, 10 de proteções, 12 de acessórios)', () => {
    expect(CURSES).toHaveLength(34)
    expect(CURSES.filter(c => c.target.startsWith('weapon'))).toHaveLength(12)
    expect(CURSES.filter(c => c.target === 'protection-any')).toHaveLength(10)
    expect(CURSES.filter(c => c.target === 'accessory-wear')).toHaveLength(12)
  })
})

describe('curseAppliesTo', () => {
  it('maldição de arma não aplica em proteção nem acessório', () => {
    const senciente = getCurse('senciente')!
    expect(curseAppliesTo(senciente, revolver)).toBe(true)
    expect(curseAppliesTo(senciente, protecaoLeve)).toBe(false)
    expect(curseAppliesTo(senciente, utensilio)).toBe(false)
  })

  it('Empuxo só aplica em arma corpo a corpo', () => {
    const empuxo = getCurse('empuxo')!
    expect(curseAppliesTo(empuxo, faca)).toBe(true)
    expect(curseAppliesTo(empuxo, revolver)).toBe(false)
  })

  it('maldição de acessório vale pra utensílio/vestimenta, mas não pra kit (livro: "utensílios e vestuários")', () => {
    const carisma = getCurse('carisma')!
    expect(curseAppliesTo(carisma, utensilio)).toBe(true)
    expect(curseAppliesTo(carisma, getEquipmentById('vestimenta')!)).toBe(true)
    expect(curseAppliesTo(carisma, kitPericia)).toBe(false)
  })
})

describe('canApplyCurse — regras da pág. 144', () => {
  it('maldições iguais não se acumulam no mesmo item', () => {
    expect(canApplyCurse(revolver, ['senciente'], 'senciente')).toBe(false)
  })

  it('elementos opressores não coexistem: Ritualística (Conhecimento) × Energética (Energia)', () => {
    expect(areOpposingElements('knowledge', 'energy')).toBe(true)
    expect(canApplyCurse(revolver, ['ritualistica'], 'energetica')).toBe(false)
    expect(canApplyCurse(revolver, ['energetica'], 'ritualistica')).toBe(false)
  })

  it('elementos não opressores coexistem: Ritualística (Conhecimento) + Consumidora (Morte)', () => {
    expect(areOpposingElements('knowledge', 'death')).toBe(false)
    expect(canApplyCurse(revolver, ['ritualistica'], 'consumidora')).toBe(true)
  })

  it('Proteção Elemental usa o elemento escolhido na checagem de oposição', () => {
    // Sangue oprime Conhecimento: Proteção Elemental (Sangue) bloqueia Carisma (Conhecimento).
    const choices = { 'utensilio:protecao-elemental': 'blood' }
    expect(canApplyCurse(utensilio, ['protecao-elemental'], 'carisma', choices)).toBe(false)
    // Com Medo escolhido não há oposição.
    const fearChoice = { 'utensilio:protecao-elemental': 'fear' }
    expect(canApplyCurse(utensilio, ['protecao-elemental'], 'carisma', fearChoice)).toBe(true)
  })
})

describe('categoria efetiva com maldições', () => {
  it('a 1ª maldição sobe a categoria em II, as seguintes em I', () => {
    expect(getCurseCategoryDelta(0)).toBe(0)
    expect(getCurseCategoryDelta(1)).toBe(2)
    expect(getCurseCategoryDelta(2)).toBe(3)
    // Revólver (Cat I) senciente → Cat III; com 2ª maldição → Cat IV.
    expect(getEffectiveCategory(revolver, 0, 1)).toBe(3)
    expect(getEffectiveCategory(revolver, 0, 2)).toBe(4)
  })

  it('modificações e maldições acumulam os ajustes de categoria (teto IV)', () => {
    expect(getEffectiveCategory(revolver, 1, 1)).toBe(4) // I + 1 mod + (1ª maldição +II)
    expect(getEffectiveCategory(revolver, 3, 2)).toBe(4) // passa do teto → IV
  })
})

describe('bônus das maldições na ficha', () => {
  const combatant = getOrdemClass('combatant')!

  it('Disposição (+1 Vigor) aumenta o PV retroativamente, como qualquer Vigor', () => {
    const base = makeDraft({ nex: 20, equipmentChoices: ['utensilio'] })
    const cursed = makeDraft({ nex: 20, equipmentChoices: ['utensilio'], equipmentCurses: { utensilio: ['disposicao'] } })
    // NEX 20% = 3 degraus. Vigor 1→2: 20+2 + 3×(4+2) = 40 (vs 36 sem a maldição).
    expect(getCursedDerivedStats(base, combatant).hp).toBe(36)
    expect(getCursedDerivedStats(cursed, combatant).hp).toBe(40)
  })

  it('Carisma (+1 Presença) NÃO fornece PE adicionais, mas aparece no atributo da ficha', () => {
    const base = makeDraft({ equipmentChoices: ['utensilio'] })
    const cursed = makeDraft({ equipmentChoices: ['utensilio'], equipmentCurses: { utensilio: ['carisma'] } })
    expect(getSheetAttributes(cursed).presence).toBe(2)
    expect(getCursedDerivedStats(cursed, combatant).pe).toBe(getCursedDerivedStats(base, combatant).pe)
  })

  it('Vitalidade soma +15 PV e Esforço Adicional soma +5 PE (fixos)', () => {
    const base = makeDraft({ equipmentChoices: ['utensilio', 'vestimenta'] })
    const cursed = makeDraft({
      equipmentChoices: ['utensilio', 'vestimenta'],
      equipmentCurses: { utensilio: ['vitalidade'], vestimenta: ['esforco-adicional'] },
    })
    expect(getCursedDerivedStats(cursed, combatant).hp).toBe(getCursedDerivedStats(base, combatant).hp + 15)
    expect(getCursedDerivedStats(cursed, combatant).pe).toBe(getCursedDerivedStats(base, combatant).pe + 5)
  })

  it('bônus de Defesa: Defesa (+5), Cinética/Letárgica/Repulsora (+2) somam na Defesa', () => {
    const cursed = makeDraft({
      equipmentChoices: ['utensilio', 'protecao-leve'],
      equipmentCurses: { utensilio: ['defesa'], 'protecao-leve': ['cinetica'] },
    })
    expect(getCurseDefenseBonus(cursed)).toBe(7)
    // 10 + Agi 1 + 5 (bônus da proteção, passado pelo chamador) + 7 (maldições) = 23
    expect(getCursedDerivedStats(cursed, combatant, 5).defense).toBe(23)
  })

  it('a mesma maldição em dois itens não acumula o bônus (pág. 144)', () => {
    const cursed = makeDraft({
      equipmentChoices: ['utensilio', 'vestimenta'],
      equipmentCurses: { utensilio: ['carisma'], vestimenta: ['carisma'] },
    })
    expect(getSheetAttributes(cursed).presence).toBe(2) // +1, não +2
  })

  it('maldição de item NÃO equipado não conta', () => {
    const cursed = makeDraft({ equipmentChoices: [], equipmentCurses: { utensilio: ['defesa'] } })
    expect(getCurseDefenseBonus(cursed)).toBe(0)
  })
})

describe('maldições de arma nos ataques', () => {
  const AGI3_FOR2 = makeDraft({ attributes: { agility: 3, strength: 2, intellect: 1, presence: 1, vigor: 1 } })

  it('Lancinante adiciona +1d8 Sangue ao dano', () => {
    const a = getOrdemWeaponAttack(faca as OrdemWeapon, AGI3_FOR2, [], ['lancinante'])
    expect(a.damage).toBe('1d4+2 corte +1d8 Sangue')
  })

  it('Predadora duplica a margem de ameaça (fuzil de caça 19 → 17, exemplo do livro) e sobe o alcance', () => {
    const fuzil = getEquipmentById('fuzil-de-caca') as OrdemWeapon // crít 19/x3, alcance Médio
    const a = getOrdemWeaponAttack(fuzil, AGI3_FOR2, [], ['predadora'])
    expect(a.critical).toBe('17/x3')
    expect(a.range).toBe('Longo')
  })

  it('Destreza (+1 Agilidade de acessório amaldiçoado) entra nos d20 de Pontaria', () => {
    const cursed = makeDraft({
      attributes: { agility: 3, strength: 2, intellect: 1, presence: 1, vigor: 1 },
      equipmentChoices: ['utensilio'],
      equipmentCurses: { utensilio: ['destreza'] },
    })
    const a = getOrdemWeaponAttack(getEquipmentById('pistola') as OrdemWeapon, cursed, [])
    expect(a.rollDice).toBe(4)
  })
})

describe('validação de equipamento com maldições', () => {
  it('revólver senciente vira Cat III: bloqueado pra Recruta, liberado pra Agente Especial', () => {
    const base = {
      equipmentChoices: ['revolver'],
      equipmentCurses: { revolver: ['senciente'] },
    }
    expect(getDraftItemCategory(makeDraft(base), revolver)).toBe(3)
    expect(isEquipmentStepComplete(makeDraft({ ...base, patente: 'recruta' }))).toBe(false)
    expect(isEquipmentStepComplete(makeDraft({ ...base, patente: 'agente-especial' }))).toBe(true)
  })

  it('maldições de elementos opressores no mesmo item invalidam o passo', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: ['revolver'],
      equipmentCurses: { revolver: ['ritualistica', 'energetica'] },
    })
    expect(areCursesValid(draft)).toBe(false)
    expect(isEquipmentStepComplete(draft)).toBe(false)
  })

  it('maldição com escolha pendente (Antielemento sem elemento) invalida; escolhida, valida', () => {
    const semEscolha = makeDraft({
      patente: 'agente-especial',
      equipmentChoices: ['revolver'],
      equipmentCurses: { revolver: ['antielemento'] },
    })
    expect(areCursesValid(semEscolha)).toBe(false)
    const comEscolha = makeDraft({
      patente: 'agente-especial',
      equipmentChoices: ['revolver'],
      equipmentCurses: { revolver: ['antielemento'] },
      equipmentCurseChoices: { 'revolver:antielemento': 'energy' },
    })
    expect(areCursesValid(comEscolha)).toBe(true)
    expect(isEquipmentStepComplete(comEscolha)).toBe(true)
  })
})
