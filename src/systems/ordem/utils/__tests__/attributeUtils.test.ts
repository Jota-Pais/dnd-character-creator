import { describe, it, expect } from 'vitest'
import { getAttributeSum, isValidAttributes, ATTRIBUTES } from '../attributeUtils'
import { EMPTY_ATTRIBUTES } from '../../types/character'

describe('ATTRIBUTES', () => {
  it('tem os 5 atributos do livro', () => {
    expect(ATTRIBUTES.map(a => a.id).sort()).toEqual(
      ['agility', 'intellect', 'presence', 'strength', 'vigor'].sort(),
    )
  })
})

describe('getAttributeSum', () => {
  it('soma padrão (todos em 1) é 5', () => {
    expect(getAttributeSum(EMPTY_ATTRIBUTES)).toBe(5)
  })
  it('soma o exemplo do livro (Bianca): Agi2 For0 Int3 Pre3 Vig1', () => {
    expect(getAttributeSum({ agility: 2, strength: 0, intellect: 3, presence: 3, vigor: 1 })).toBe(9)
  })
})

describe('isValidAttributes', () => {
  it('rejeita a distribuição padrão (nenhum ponto gasto)', () => {
    expect(isValidAttributes(EMPTY_ATTRIBUTES)).toBe(false)
  })

  it('aceita uma distribuição válida sem zerar nada (soma 9, sem zeros)', () => {
    expect(isValidAttributes({ agility: 2, strength: 2, intellect: 2, presence: 2, vigor: 1 })).toBe(true)
  })

  it('aceita o exemplo do livro (Bianca), que zera Força pra ganhar +1 ponto', () => {
    expect(isValidAttributes({ agility: 2, strength: 0, intellect: 3, presence: 3, vigor: 1 })).toBe(true)
  })

  it('rejeita zerar mais de um atributo', () => {
    // soma ainda dá 9 (3+0+3+3+0=9), mas dois atributos zerados não é permitido
    expect(isValidAttributes({ agility: 3, strength: 0, intellect: 3, presence: 3, vigor: 0 })).toBe(false)
  })

  it('rejeita atributo acima do teto inicial (3)', () => {
    expect(isValidAttributes({ agility: 4, strength: 1, intellect: 1, presence: 1, vigor: 2 })).toBe(false)
  })

  it('rejeita atributo negativo', () => {
    expect(isValidAttributes({ agility: -1, strength: 3, intellect: 3, presence: 3, vigor: 1 })).toBe(false)
  })

  it('rejeita soma diferente de 9 (pontos não gastos)', () => {
    expect(isValidAttributes({ agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 2 })).toBe(false)
  })

  it('rejeita soma diferente de 9 (gasto acima do permitido)', () => {
    expect(isValidAttributes({ agility: 3, strength: 3, intellect: 3, presence: 3, vigor: 3 })).toBe(false)
  })
})
