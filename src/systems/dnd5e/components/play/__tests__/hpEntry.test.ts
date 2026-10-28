import { describe, it, expect } from 'vitest'
import { parseHpEntry, resolveHpAction, stripHpSign } from '../hpEntry'

describe('parseHpEntry', () => {
  it('lê o número com ou sem sinal', () => {
    expect(parseHpEntry('7')).toEqual({ sign: null, amount: 7 })
    expect(parseHpEntry('+5')).toEqual({ sign: 'plus', amount: 5 })
    expect(parseHpEntry('-7')).toEqual({ sign: 'minus', amount: 7 })
    expect(parseHpEntry(' − 12 ')).toEqual({ sign: 'minus', amount: 12 })
    expect(parseHpEntry('–3')).toEqual({ sign: 'minus', amount: 3 })
    expect(parseHpEntry('0')).toEqual({ sign: null, amount: 0 })
  })

  it('ainda digitando: só o sinal, ou nada', () => {
    expect(parseHpEntry('')).toEqual({ sign: null, amount: null })
    expect(parseHpEntry('-')).toEqual({ sign: 'minus', amount: null })
    expect(parseHpEntry('+')).toEqual({ sign: 'plus', amount: null })
  })

  it('o que não é número inteiro dá null', () => {
    for (const text of ['abc', '5a', '2.5', '1,5', '+-3', '--3', '3-', '5 5']) {
      expect(parseHpEntry(text)).toBeNull()
    }
  })
})

describe('resolveHpAction', () => {
  it('o sinal manda: "−" é dano e "+" é cura, sem botão escolhido', () => {
    expect(resolveHpAction(parseHpEntry('-7'), null)).toBe('damage')
    expect(resolveHpAction(parseHpEntry('+5'), null)).toBe('heal')
    // O sinal vence o botão escolhido.
    expect(resolveHpAction(parseHpEntry('+5'), 'damage')).toBe('heal')
    expect(resolveHpAction(parseHpEntry('-5'), 'heal')).toBe('damage')
    expect(resolveHpAction(parseHpEntry('-5'), 'temp')).toBe('damage')
  })

  it('sem sinal, vale o botão; sem botão, nada', () => {
    expect(resolveHpAction(parseHpEntry('7'), 'damage')).toBe('damage')
    expect(resolveHpAction(parseHpEntry('7'), 'temp')).toBe('temp')
    expect(resolveHpAction(parseHpEntry('7'), null)).toBeNull()
    expect(resolveHpAction(null, 'heal')).toBe('heal')
  })

  it('com PV temporários escolhido, o "+" continua PV temporário', () => {
    expect(resolveHpAction(parseHpEntry('+5'), 'temp')).toBe('temp')
  })
})

describe('stripHpSign', () => {
  it('tira o sinal e mantém o número', () => {
    expect(stripHpSign('-7')).toBe('7')
    expect(stripHpSign(' + 5')).toBe('5')
    expect(stripHpSign('−3')).toBe('3')
    expect(stripHpSign('9')).toBe('9')
  })
})
