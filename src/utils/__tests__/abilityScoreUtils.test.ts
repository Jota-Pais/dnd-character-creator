import { describe, it, expect } from 'vitest'
import { calculateModifier, formatModifier, formatBonus, formatSpeed } from '../abilityScoreUtils'

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
