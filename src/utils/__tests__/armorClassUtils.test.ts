import { describe, it, expect } from 'vitest'
import { calculateArmorClass, getUnarmoredDefense } from '../armorClassUtils'
import type { Armor } from '../../types/equipment'

const leather: Armor = {
  id: 'leather', name: 'Couro', category: 'light', cost: 1000,
  acBase: 11, dexModifier: 'full', strengthRequirement: null, stealthDisadvantage: false, weight: 5,
}
const scaleMail: Armor = {
  id: 'scale-mail', name: 'Brunea', category: 'medium', cost: 5000,
  acBase: 14, dexModifier: 'max-2', strengthRequirement: null, stealthDisadvantage: true, weight: 22.5,
}
const plate: Armor = {
  id: 'plate', name: 'Placas', category: 'heavy', cost: 150000,
  acBase: 18, dexModifier: 'none', strengthRequirement: 15, stealthDisadvantage: true, weight: 32.5,
}

describe('getUnarmoredDefense', () => {
  it('mapeia bárbaro e monge', () => {
    expect(getUnarmoredDefense('barbarian')).toBe('barbarian')
    expect(getUnarmoredDefense('monk')).toBe('monk')
  })
  it('demais classes e vazios retornam null', () => {
    expect(getUnarmoredDefense('fighter')).toBeNull()
    expect(getUnarmoredDefense(null)).toBeNull()
    expect(getUnarmoredDefense(undefined)).toBeNull()
  })
})

describe('calculateArmorClass — sem armadura', () => {
  it('padrão é 10 + DES', () => {
    expect(calculateArmorClass({ dexMod: 3, conMod: 0, wisMod: 0 }).value).toBe(13)
  })

  it('DES negativa reduz a CA', () => {
    expect(calculateArmorClass({ dexMod: -1, conMod: 0, wisMod: 0 }).value).toBe(9)
  })

  it('Defesa sem Armadura do bárbaro soma CON', () => {
    const r = calculateArmorClass({ dexMod: 2, conMod: 3, wisMod: 0, unarmoredDefense: 'barbarian' })
    expect(r.value).toBe(15) // 10 + 2 + 3
  })

  it('bárbaro sem armadura pode usar escudo (empilha)', () => {
    const r = calculateArmorClass({ dexMod: 2, conMod: 3, wisMod: 0, unarmoredDefense: 'barbarian', hasShield: true })
    expect(r.value).toBe(17) // 10 + 2 + 3 + 2
  })

  it('Defesa sem Armadura do monge soma SAB', () => {
    const r = calculateArmorClass({ dexMod: 3, conMod: 0, wisMod: 2, unarmoredDefense: 'monk' })
    expect(r.value).toBe(15) // 10 + 3 + 2
  })

  it('monge com escudo perde a Defesa sem Armadura (só 10 + DES + escudo)', () => {
    const r = calculateArmorClass({ dexMod: 3, conMod: 0, wisMod: 2, unarmoredDefense: 'monk', hasShield: true })
    expect(r.value).toBe(15) // 10 + 3 + 2 (escudo), sem SAB
  })
})

describe('calculateArmorClass — com armadura', () => {
  it('armadura leve soma toda a DES', () => {
    const r = calculateArmorClass({ dexMod: 4, conMod: 0, wisMod: 0, bodyArmor: leather })
    expect(r.value).toBe(15) // 11 + 4
    expect(r.stealthDisadvantage).toBe(false)
  })

  it('armadura média limita a DES a +2', () => {
    const r = calculateArmorClass({ dexMod: 4, conMod: 0, wisMod: 0, bodyArmor: scaleMail })
    expect(r.value).toBe(16) // 14 + min(4,2)
    expect(r.stealthDisadvantage).toBe(true)
  })

  it('armadura pesada ignora a DES', () => {
    const r = calculateArmorClass({ dexMod: 4, conMod: 0, wisMod: 0, bodyArmor: plate })
    expect(r.value).toBe(18)
  })

  it('escudo soma +2 sobre a armadura', () => {
    const r = calculateArmorClass({ dexMod: 4, conMod: 0, wisMod: 0, bodyArmor: plate, hasShield: true })
    expect(r.value).toBe(20)
  })

  it('Estilo de Luta Defesa soma +1 vestindo armadura', () => {
    const r = calculateArmorClass({ dexMod: 2, conMod: 0, wisMod: 0, bodyArmor: leather, hasDefenseFightingStyle: true })
    expect(r.value).toBe(14) // 11 + 2 + 1
  })

  it('Estilo de Luta Defesa NÃO se aplica sem armadura', () => {
    const r = calculateArmorClass({ dexMod: 2, conMod: 0, wisMod: 0, hasDefenseFightingStyle: true })
    expect(r.value).toBe(12) // 10 + 2, sem +1
  })

  it('armadura tem precedência sobre a Defesa sem Armadura do bárbaro', () => {
    const r = calculateArmorClass({ dexMod: 1, conMod: 4, wisMod: 0, bodyArmor: plate, unarmoredDefense: 'barbarian' })
    expect(r.value).toBe(18) // usa a armadura, ignora CON
  })

  it('decomposição soma exatamente o valor final', () => {
    const r = calculateArmorClass({ dexMod: 2, conMod: 0, wisMod: 0, bodyArmor: scaleMail, hasShield: true, hasDefenseFightingStyle: true })
    const soma = r.components.reduce((s, c) => s + c.value, 0)
    expect(soma).toBe(r.value)
    expect(r.value).toBe(19) // 14 + 2 + 1(defesa) + 2(escudo)
  })
})
