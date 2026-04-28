import { describe, it, expect } from 'vitest'
import {
  calculateModifier,
  formatModifier,
  formatBonus,
  formatSpeed,
  getPointBuyCost,
  getTotalPointsSpent,
  getRemainingPoints,
  rollAbilityScore,
  isAbilitiesStepComplete,
} from '../abilityScoreUtils'
import type { AbilityScore } from '../../types/race'

describe('calculateModifier', () => {
  it('retorna 0 para atributo 10', () => expect(calculateModifier(10)).toBe(0))
  it('retorna 0 para atributo 11', () => expect(calculateModifier(11)).toBe(0))
  it('retorna +1 para atributo 12', () => expect(calculateModifier(12)).toBe(1))
  it('retorna +1 para atributo 13', () => expect(calculateModifier(13)).toBe(1))
  it('retorna +4 para atributo 18', () => expect(calculateModifier(18)).toBe(4))
  it('retorna -1 para atributo 8', () => expect(calculateModifier(8)).toBe(-1))
  it('retorna -1 para atributo 9', () => expect(calculateModifier(9)).toBe(-1))
  it('retorna -4 para atributo 3', () => expect(calculateModifier(3)).toBe(-4))
  it('retorna +5 para atributo 20', () => expect(calculateModifier(20)).toBe(5))
})

describe('formatModifier', () => {
  it('formata modificador positivo com sinal +', () => expect(formatModifier(3)).toBe('+3'))
  it('formata modificador zero com sinal +', () => expect(formatModifier(0)).toBe('+0'))
  it('formata modificador negativo sem sinal +', () => expect(formatModifier(-1)).toBe('-1'))
  it('formata modificador -4', () => expect(formatModifier(-4)).toBe('-4'))
})

describe('formatBonus', () => {
  it('formata bônus positivo', () => expect(formatBonus(2)).toBe('+2'))
  it('formata bônus zero', () => expect(formatBonus(0)).toBe('+0'))
  it('formata bônus negativo', () => expect(formatBonus(-1)).toBe('-1'))
})

describe('formatSpeed', () => {
  it('30 pés → 9 m (6 quad.)', () => expect(formatSpeed(30)).toBe('9 m (6 quad.)'))
  it('25 pés → 7,5 m (5 quad.)', () => expect(formatSpeed(25)).toBe('7,5 m (5 quad.)'))
  it('35 pés → 10,5 m (7 quad.)', () => expect(formatSpeed(35)).toBe('10,5 m (7 quad.)'))
  it('60 pés → 18 m (12 quad.)', () => expect(formatSpeed(60)).toBe('18 m (12 quad.)'))
})

describe('getPointBuyCost', () => {
  it('custo de 8 é 0', () => expect(getPointBuyCost(8)).toBe(0))
  it('custo de 9 é 1', () => expect(getPointBuyCost(9)).toBe(1))
  it('custo de 12 é 4', () => expect(getPointBuyCost(12)).toBe(4))
  it('custo de 13 é 5', () => expect(getPointBuyCost(13)).toBe(5))
  it('custo de 14 é 7', () => expect(getPointBuyCost(14)).toBe(7))
  it('custo de 15 é 9', () => expect(getPointBuyCost(15)).toBe(9))
})

describe('getTotalPointsSpent', () => {
  const allEight: Record<AbilityScore, number> = { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 }

  it('tudo em 8 gasta 0 pontos', () => expect(getTotalPointsSpent(allEight)).toBe(0))

  it('array padrão equivalente gasta 27 pontos', () => {
    const scores: Record<AbilityScore, number> = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 }
    expect(getTotalPointsSpent(scores)).toBe(27)
  })

  it('calcula corretamente pontos parciais', () => {
    const scores: Record<AbilityScore, number> = { STR: 13, DEX: 13, CON: 13, INT: 12, WIS: 12, CHA: 12 }
    expect(getTotalPointsSpent(scores)).toBe(27)
  })
})

describe('getRemainingPoints', () => {
  it('tudo em 8 tem 27 pontos restantes', () => {
    const scores: Record<AbilityScore, number> = { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 }
    expect(getRemainingPoints(scores)).toBe(27)
  })

  it('zero restante com array equivalente', () => {
    const scores: Record<AbilityScore, number> = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 }
    expect(getRemainingPoints(scores)).toBe(0)
  })
})

describe('rollAbilityScore', () => {
  it('retorna 4 dados e um resultado', () => {
    const { rolls, result } = rollAbilityScore()
    expect(rolls).toHaveLength(4)
  })

  it('cada dado está entre 1 e 6', () => {
    const { rolls } = rollAbilityScore()
    for (const die of rolls) {
      expect(die).toBeGreaterThanOrEqual(1)
      expect(die).toBeLessThanOrEqual(6)
    }
  })

  it('resultado está entre 3 e 18', () => {
    for (let i = 0; i < 100; i++) {
      const { result } = rollAbilityScore()
      expect(result).toBeGreaterThanOrEqual(3)
      expect(result).toBeLessThanOrEqual(18)
    }
  })

  it('resultado é a soma dos 3 maiores dados', () => {
    const { rolls, result } = rollAbilityScore()
    const top3 = [...rolls].sort((a, b) => b - a).slice(0, 3)
    expect(result).toBe(top3[0] + top3[1] + top3[2])
  })
})

describe('isAbilitiesStepComplete', () => {
  const nullScores = { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null }

  it('retorna false se método é null', () => {
    expect(isAbilitiesStepComplete(null, nullScores, [])).toBe(false)
  })

  describe('standard-array', () => {
    it('completo quando todos os valores do array estão distribuídos', () => {
      const scores = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 }
      expect(isAbilitiesStepComplete('standard-array', scores, [])).toBe(true)
    })

    it('incompleto se algum atributo não foi definido', () => {
      const scores = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: null }
      expect(isAbilitiesStepComplete('standard-array', scores, [])).toBe(false)
    })

    it('incompleto se valores não correspondem ao array padrão', () => {
      const scores = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 11, CHA: 8 }
      expect(isAbilitiesStepComplete('standard-array', scores, [])).toBe(false)
    })
  })

  describe('point-buy', () => {
    it('completo quando exatamente 27 pontos foram gastos', () => {
      const scores = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 }
      expect(isAbilitiesStepComplete('point-buy', scores, [])).toBe(true)
    })

    it('incompleto quando menos de 27 pontos foram gastos', () => {
      const scores = { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 }
      expect(isAbilitiesStepComplete('point-buy', scores, [])).toBe(false)
    })

    it('incompleto se algum atributo é null', () => {
      const scores = { STR: null, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 }
      expect(isAbilitiesStepComplete('point-buy', scores, [])).toBe(false)
    })
  })

  describe('roll', () => {
    it('completo quando todos os valores rolados foram distribuídos', () => {
      const rolled = [15, 14, 13, 12, 10, 8]
      const scores = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 }
      expect(isAbilitiesStepComplete('roll', scores, rolled)).toBe(true)
    })

    it('completo mesmo com valores duplicados nos dados', () => {
      const rolled = [15, 15, 12, 10, 8, 6]
      const scores = { STR: 15, DEX: 15, CON: 12, INT: 10, WIS: 8, CHA: 6 }
      expect(isAbilitiesStepComplete('roll', scores, rolled)).toBe(true)
    })

    it('incompleto se menos de 6 valores foram rolados', () => {
      const scores = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 }
      expect(isAbilitiesStepComplete('roll', scores, [15, 14, 13])).toBe(false)
    })

    it('incompleto se os valores atribuídos não batem com os rolados', () => {
      const rolled = [15, 14, 13, 12, 10, 8]
      const scores = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 11, CHA: 8 }
      expect(isAbilitiesStepComplete('roll', scores, rolled)).toBe(false)
    })
  })
})
