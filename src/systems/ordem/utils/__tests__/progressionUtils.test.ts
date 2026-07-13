import { describe, it, expect } from 'vitest'
import {
  NEX_STEPS,
  getNexIndex,
  getPeLimit,
  getReachedTrilhaSlots,
  getReachedPowerSlots,
  getReachedAttributeIncreaseSlots,
  getReachedSkillGradeSlots,
  hasTrilha,
  hasVersatility,
} from '../progressionUtils'

describe('NEX_STEPS', () => {
  it('tem 21 degraus, de 0% a 99% (não 100%)', () => {
    expect(NEX_STEPS).toHaveLength(21)
    expect(NEX_STEPS[0]).toBe(0)
    expect(NEX_STEPS[1]).toBe(5)
    expect(NEX_STEPS[NEX_STEPS.length - 1]).toBe(99)
    expect(NEX_STEPS).not.toContain(100)
  })
})

describe('getPeLimit — Tabela 1.2', () => {
  it('NEX 0% dá limite 1 (mínimo)', () => expect(getPeLimit(0)).toBe(1))
  it('NEX 5% dá limite 1', () => expect(getPeLimit(5)).toBe(1))
  it('NEX 10% dá limite 2', () => expect(getPeLimit(10)).toBe(2))
  it('NEX 99% dá limite 20', () => expect(getPeLimit(99)).toBe(20))
})

describe('getNexIndex', () => {
  it('NEX 0% é o índice 0 (valores iniciais)', () => expect(getNexIndex(0)).toBe(0))
  it('NEX 5% é o índice 1 (1º nível de exposição)', () => expect(getNexIndex(5)).toBe(1))
  it('NEX 99% é o índice 20', () => expect(getNexIndex(99)).toBe(20))
})

describe('getReachedTrilhaSlots — NEX 10/40/65/99', () => {
  it('NEX 5% não alcançou nenhum', () => expect(getReachedTrilhaSlots(5)).toEqual([]))
  it('NEX 10% alcançou o primeiro', () => expect(getReachedTrilhaSlots(10)).toEqual([10]))
  it('NEX 65% alcançou 3', () => expect(getReachedTrilhaSlots(65)).toEqual([10, 40, 65]))
  it('NEX 99% alcançou os 4', () => expect(getReachedTrilhaSlots(99)).toEqual([10, 40, 65, 99]))
})

describe('getReachedPowerSlots — NEX 15/30/45/60/75/90', () => {
  it('NEX 5% não alcançou nenhum', () => expect(getReachedPowerSlots(5)).toEqual([]))
  it('NEX 15% alcançou o primeiro', () => expect(getReachedPowerSlots(15)).toEqual([15]))
  it('NEX 99% alcançou os 6', () => expect(getReachedPowerSlots(99)).toEqual([15, 30, 45, 60, 75, 90]))
})

describe('getReachedAttributeIncreaseSlots — NEX 20/50/80/95', () => {
  it('NEX 20% alcançou 1', () => expect(getReachedAttributeIncreaseSlots(20)).toEqual([20]))
  it('NEX 99% alcançou os 4', () => expect(getReachedAttributeIncreaseSlots(99)).toEqual([20, 50, 80, 95]))
})

describe('getReachedSkillGradeSlots — NEX 35/70', () => {
  it('NEX 35% alcançou 1', () => expect(getReachedSkillGradeSlots(35)).toEqual([35]))
  it('NEX 70% alcançou os 2', () => expect(getReachedSkillGradeSlots(70)).toEqual([35, 70]))
})

describe('hasTrilha / hasVersatility', () => {
  it('trilha só a partir de NEX 10%', () => {
    expect(hasTrilha(5)).toBe(false)
    expect(hasTrilha(10)).toBe(true)
  })
  it('versatilidade só a partir de NEX 50%', () => {
    expect(hasVersatility(45)).toBe(false)
    expect(hasVersatility(50)).toBe(true)
  })
})
