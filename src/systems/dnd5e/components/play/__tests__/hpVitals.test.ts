import { describe, it, expect } from 'vitest'
import { describeHpForAnnouncement, getHpBand, getHpBarPercent, getHpFlash, LOW_HP_FRACTION } from '../hpVitals'

describe('describeHpForAnnouncement', () => {
  it('o PV sobre o máximo efetivo, com os temporários quando há', () => {
    expect(describeHpForAnnouncement(9, 14, 0)).toBe('PV 9 de 14')
    expect(describeHpForAnnouncement(14, 14, 1)).toBe('PV 14 de 14, mais 1 temporário')
    expect(describeHpForAnnouncement(0, 7, 5)).toBe('PV 0 de 7, mais 5 temporários')
  })
})

describe('getHpFlash', () => {
  it('PV que cai é dano; PV que sobe é cura', () => {
    expect(getHpFlash({ current: 14, tempHp: 0 }, { current: 9, tempHp: 0 })).toBe('damage')
    expect(getHpFlash({ current: 9, tempHp: 0 }, { current: 14, tempHp: 0 })).toBe('heal')
    // O golpe que gasta os temporários e ainda tira PV: dano.
    expect(getHpFlash({ current: 14, tempHp: 3 }, { current: 12, tempHp: 0 })).toBe('damage')
  })

  it('os temporários absorvem o golpe inteiro: o PV fica, mas é dano', () => {
    expect(getHpFlash({ current: 14, tempHp: 5 }, { current: 14, tempHp: 2 })).toBe('damage')
  })

  it('ganhar PV temporários, ou nada mudar, não pisca', () => {
    expect(getHpFlash({ current: 14, tempHp: 0 }, { current: 14, tempHp: 5 })).toBeNull()
    expect(getHpFlash({ current: 9, tempHp: 0 }, { current: 9, tempHp: 0 })).toBeNull()
  })
})

describe('getHpBand', () => {
  it('PV baixo é acima de 0 e até 1/4 do máximo efetivo', () => {
    expect(LOW_HP_FRACTION).toBe(1 / 4)
    // Krusk, 14 PV: 1/4 é 3,5.
    expect(getHpBand(3, 14)).toBe('low')
    expect(getHpBand(1, 14)).toBe('low')
    expect(getHpBand(4, 14)).toBe('wounded')
    // No limite exato, já é PV baixo.
    expect(getHpBand(5, 20)).toBe('low')
    expect(getHpBand(6, 20)).toBe('wounded')
  })

  it('até a metade é ferido; acima, saudável', () => {
    expect(getHpBand(7, 14)).toBe('wounded')
    expect(getHpBand(8, 14)).toBe('healthy')
    expect(getHpBand(14, 14)).toBe('healthy')
  })

  it('a 0 PV (ou sem máximo) não é PV baixo: os testes contra a morte assumem', () => {
    expect(getHpBand(0, 14)).toBe('zero')
    expect(getHpBand(0, 0)).toBe('zero')
  })
})

describe('getHpBarPercent', () => {
  it('o PV atual sobre o máximo, preso entre 0 e 100', () => {
    expect(getHpBarPercent(7, 14)).toBe(50)
    expect(getHpBarPercent(14, 14)).toBe(100)
    expect(getHpBarPercent(20, 14)).toBe(100)
    expect(getHpBarPercent(0, 14)).toBe(0)
    expect(getHpBarPercent(3, 0)).toBe(0)
  })
})
