import { describe, it, expect } from 'vitest'
import { isChoiceFull, toggleChoice } from '../choiceToggle'

describe('toggleChoice — escolha de 1 é rádio, de N mantém o limite (decisão de 2026-10-26)', () => {
  it('escolha de 1: outra opção troca a marcada direto', () => {
    expect(toggleChoice(['a'], 'b', 1)).toEqual(['b'])
    expect(toggleChoice([], 'b', 1)).toEqual(['b'])
  })

  it('escolha de 1: clicar na marcada desmarca', () => {
    expect(toggleChoice(['a'], 'a', 1)).toEqual([])
  })

  it('escolha de 1 com sobra (ficha antiga com duas): a nova fica sozinha', () => {
    expect(toggleChoice(['a', 'b'], 'c', 1)).toEqual(['c'])
  })

  it('escolha de N: soma até o limite e, cheia, não muda nada', () => {
    expect(toggleChoice(['a'], 'b', 2)).toEqual(['a', 'b'])
    expect(toggleChoice(['a', 'b'], 'c', 2)).toBeNull()
    expect(toggleChoice(['a', 'b'], 'a', 2)).toEqual(['b'])
  })

  it('swap explícito vence o padrão: de 1 sem rádio (slot cumulativo) respeita o limite', () => {
    expect(toggleChoice(['a'], 'b', 1, false)).toBeNull()
  })
})

describe('isChoiceFull', () => {
  it('a escolha de 1 nunca trava a opção nova; a de N trava quando cheia', () => {
    expect(isChoiceFull(1, 1)).toBe(false)
    expect(isChoiceFull(1, 2)).toBe(false)
    expect(isChoiceFull(2, 2)).toBe(true)
    expect(isChoiceFull(1, 1, false)).toBe(true)
  })
})
