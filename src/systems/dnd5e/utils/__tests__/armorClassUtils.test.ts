import { describe, it, expect } from 'vitest'
import {
  calculateArmorClass, formatArmorClassBreakdown, type UnarmoredAcOption,
} from '../armorClassUtils'
import type { Armor } from '../../types/equipment'
import type { AbilityScore } from '../../types/race'

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

/** Modificadores com 0 no que não for informado. */
function mods(m: Partial<Record<AbilityScore, number>>): Record<AbilityScore, number> {
  return { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0, ...m }
}

// As mesmas fórmulas dos dados (class-progression-features.json).
const barbarian: UnarmoredAcOption = {
  id: 'unarmored-defense', base: 10, abilities: ['DEX', 'CON'], source: 'Defesa sem Armadura',
}
const monk: UnarmoredAcOption = {
  id: 'unarmored-defense', base: 10, abilities: ['DEX', 'WIS'], noShield: true, source: 'Defesa sem Armadura',
}
const draconic: UnarmoredAcOption = {
  id: 'draconic-resilience', base: 13, abilities: ['DEX'], source: 'Resiliência Dracônica',
}

describe('calculateArmorClass — sem armadura', () => {
  it('padrão é 10 + DES', () => {
    expect(calculateArmorClass({ mods: mods({ DEX: 3 }) }).value).toBe(13)
  })

  it('DES negativa reduz a CA', () => {
    expect(calculateArmorClass({ mods: mods({ DEX: -1 }) }).value).toBe(9)
  })

  it('Defesa sem Armadura do bárbaro soma CON', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 2, CON: 3 }), unarmoredAc: [barbarian] })
    expect(r.value).toBe(15) // 10 + 2 + 3
  })

  it('bárbaro sem armadura pode usar escudo (empilha)', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 2, CON: 3 }), unarmoredAc: [barbarian], hasShield: true })
    expect(r.value).toBe(17) // 10 + 2 + 3 + 2
  })

  it('Defesa sem Armadura do monge soma SAB', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 3, WIS: 2 }), unarmoredAc: [monk] })
    expect(r.value).toBe(15) // 10 + 3 + 2
  })

  it('monge com escudo perde a Defesa sem Armadura (só 10 + DES + escudo)', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 3, WIS: 2 }), unarmoredAc: [monk], hasShield: true })
    expect(r.value).toBe(15) // 10 + 3 + 2 (escudo), sem SAB
  })

  it('Resiliência Dracônica: 13 + DES', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 2 }), unarmoredAc: [draconic] })
    expect(r.value).toBe(15)
    expect(formatArmorClassBreakdown(r)).toBe('13 (Resiliência Dracônica) + 2 (DES)')
  })

  it('Resiliência Dracônica com escudo: o escudo soma +2 por cima (p. 146)', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 2 }), unarmoredAc: [draconic], hasShield: true })
    expect(r.value).toBe(17)
    expect(formatArmorClassBreakdown(r)).toBe('13 (Resiliência Dracônica) + 2 (DES) + 2 (Escudo)')
  })

  it('Resiliência Dracônica com DES negativa ainda ganha do 10 + DES', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: -1 }), unarmoredAc: [draconic] })
    expect(r.value).toBe(12)
  })
})

// p. 14: com várias formas de calcular a CA, você escolhe qual usar — nunca se somam.
describe('calculateArmorClass — várias fórmulas sem armadura', () => {
  it('bárbaro / dracônico com CON alta usa a do bárbaro', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 2, CON: 4 }), unarmoredAc: [barbarian, draconic] })
    expect(r.value).toBe(16) // 10 + 2 + 4, não 13 + 2 nem a soma das duas
    expect(r.components[0].label).toBe('Defesa sem Armadura')
  })

  it('bárbaro / dracônico com CON baixa usa a dracônica', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 2, CON: 1 }), unarmoredAc: [barbarian, draconic] })
    expect(r.value).toBe(15) // 13 + 2 > 10 + 2 + 1
    expect(r.components[0].label).toBe('Resiliência Dracônica')
  })

  it('monge / dracônico com escudo cai na dracônica, que aceita escudo', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 3, WIS: 5 }), unarmoredAc: [monk, draconic], hasShield: true })
    expect(r.value).toBe(18) // 13 + 3 + 2
    expect(formatArmorClassBreakdown(r)).toBe('13 (Resiliência Dracônica) + 3 (DES) + 2 (Escudo)')
  })

  it('monge / dracônico sem escudo e SAB alta usa a do monge', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 3, WIS: 4 }), unarmoredAc: [monk, draconic] })
    expect(r.value).toBe(17) // 10 + 3 + 4 > 13 + 3
    expect(r.components.map(c => c.label)).toEqual(['Defesa sem Armadura', 'DES', 'SAB'])
  })

  it('no empate mostra a característica, não o 10 + DES', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 2, CON: 0 }), unarmoredAc: [barbarian] })
    expect(r.value).toBe(12)
    expect(r.components[0].label).toBe('Defesa sem Armadura')
  })
})

describe('calculateArmorClass — com armadura', () => {
  it('armadura leve soma toda a DES', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 4 }), bodyArmor: leather })
    expect(r.value).toBe(15) // 11 + 4
    expect(r.stealthDisadvantage).toBe(false)
  })

  it('armadura média limita a DES a +2', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 4 }), bodyArmor: scaleMail })
    expect(r.value).toBe(16) // 14 + min(4,2)
    expect(r.stealthDisadvantage).toBe(true)
  })

  it('armadura pesada ignora a DES', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 4 }), bodyArmor: plate })
    expect(r.value).toBe(18)
  })

  it('escudo soma +2 sobre a armadura', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 4 }), bodyArmor: plate, hasShield: true })
    expect(r.value).toBe(20)
  })

  it('Estilo de Luta Defesa soma +1 vestindo armadura', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 2 }), bodyArmor: leather, hasDefenseFightingStyle: true })
    expect(r.value).toBe(14) // 11 + 2 + 1
  })

  it('Estilo de Luta Defesa NÃO se aplica sem armadura', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 2 }), hasDefenseFightingStyle: true })
    expect(r.value).toBe(12) // 10 + 2, sem +1
  })

  it('armadura tem precedência sobre a Defesa sem Armadura do bárbaro', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 1, CON: 4 }), bodyArmor: plate, unarmoredAc: [barbarian] })
    expect(r.value).toBe(18) // usa a armadura, ignora CON
  })

  it('vestindo armadura a Resiliência Dracônica não vale', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 3 }), bodyArmor: leather, unarmoredAc: [draconic] })
    expect(r.value).toBe(14) // 11 + 3, não 13 + 3
  })

  it('decomposição soma exatamente o valor final', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: 2 }), bodyArmor: scaleMail, hasShield: true, hasDefenseFightingStyle: true })
    const soma = r.components.reduce((s, c) => s + c.value, 0)
    expect(soma).toBe(r.value)
    expect(r.value).toBe(19) // 14 + 2 + 1(defesa) + 2(escudo)
    expect(formatArmorClassBreakdown(r)).toBe('14 (Brunea) + 2 (DES) + 1 (Estilo Defesa) + 2 (Escudo)')
  })
})

describe('formatArmorClassBreakdown', () => {
  it('a base padrão sai sem rótulo e o negativo com sinal de menos', () => {
    const r = calculateArmorClass({ mods: mods({ DEX: -1 }) })
    expect(formatArmorClassBreakdown(r)).toBe('10 − 1 (DES)')
  })
})
