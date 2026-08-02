import { describe, it, expect } from 'vitest'
import { getDicePool, formatDicePool } from '../attributeUtils'

describe('getDicePool', () => {
  it('1 dado por ponto do atributo', () => {
    expect(getDicePool(3)).toEqual({ dice: 3 })
    expect(getDicePool(1)).toEqual({ dice: 1 })
  })

  it('atributo 0 vale 0 dados — sem o "2 pelo pior" do livro (p. 16), por decisão de produto', () => {
    expect(getDicePool(0)).toEqual({ dice: 0 })
    expect(formatDicePool(getDicePool(0))).toBe('0d20')
  })

  it('penalidade reduz os dados', () => {
    expect(getDicePool(3, 2)).toEqual({ dice: 1 })
    expect(getDicePool(5, 2)).toEqual({ dice: 3 })
  })

  it('penalidade que zera o pool para em 0 — sem o "role pelo pior" da p. 13', () => {
    // Agilidade 2 com −ØØ → 0 dados (o livro rolaria 4d20 pelo pior).
    expect(getDicePool(2, 2)).toEqual({ dice: 0 })
    // Agilidade 1 com −ØØ → o pool nunca fica negativo.
    expect(getDicePool(1, 2)).toEqual({ dice: 0 })
    expect(getDicePool(0, 2)).toEqual({ dice: 0 })
  })

  it('formatDicePool nunca escreve "pior"', () => {
    expect(formatDicePool({ dice: 3 })).toBe('3d20')
    expect(formatDicePool({ dice: 0 })).toBe('0d20')
  })
})
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
