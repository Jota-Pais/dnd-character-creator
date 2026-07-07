import { describe, it, expect } from 'vitest'
import { getClassResourceValue, getClassResources } from '../classResourceUtils'

describe('getClassResourceValue', () => {
  it('fúrias do bárbaro (2 no nv1, 3 no nv3, 6 no nv17, ilimitadas -1 no nv20)', () => {
    expect(getClassResourceValue('barbarian', 'rages', 1)).toBe(2)
    expect(getClassResourceValue('barbarian', 'rages', 3)).toBe(3)
    expect(getClassResourceValue('barbarian', 'rages', 12)).toBe(5)
    expect(getClassResourceValue('barbarian', 'rages', 17)).toBe(6)
    expect(getClassResourceValue('barbarian', 'rages', 20)).toBe(-1)
  })
  it('dano de fúria (+2 até nv8, +3 nv9-15, +4 nv16+)', () => {
    expect(getClassResourceValue('barbarian', 'rageDamage', 8)).toBe(2)
    expect(getClassResourceValue('barbarian', 'rageDamage', 9)).toBe(3)
    expect(getClassResourceValue('barbarian', 'rageDamage', 16)).toBe(4)
  })
  it('ki do monge = nível (a partir do nv2)', () => {
    expect(getClassResourceValue('monk', 'kiPoints', 1)).toBe(0)
    expect(getClassResourceValue('monk', 'kiPoints', 2)).toBe(2)
    expect(getClassResourceValue('monk', 'kiPoints', 20)).toBe(20)
  })
  it('dado de artes marciais do monge (d4→d6 nv5→d8 nv11→d10 nv17)', () => {
    expect(getClassResourceValue('monk', 'martialArtsDie', 4)).toBe(4)
    expect(getClassResourceValue('monk', 'martialArtsDie', 5)).toBe(6)
    expect(getClassResourceValue('monk', 'martialArtsDie', 11)).toBe(8)
    expect(getClassResourceValue('monk', 'martialArtsDie', 17)).toBe(10)
  })
  it('ataque furtivo do ladino = ceil(nível/2) d6', () => {
    expect(getClassResourceValue('rogue', 'sneakAttackDice', 1)).toBe(1)
    expect(getClassResourceValue('rogue', 'sneakAttackDice', 5)).toBe(3)
    expect(getClassResourceValue('rogue', 'sneakAttackDice', 20)).toBe(10)
  })
  it('invocações do bruxo (0 no nv1, 2 no nv2, 8 no nv18)', () => {
    expect(getClassResourceValue('warlock', 'invocationsKnown', 1)).toBe(0)
    expect(getClassResourceValue('warlock', 'invocationsKnown', 2)).toBe(2)
    expect(getClassResourceValue('warlock', 'invocationsKnown', 18)).toBe(8)
  })
  it('canalizar divindade do clérigo (1 no nv2, 2 no nv6, 3 no nv18)', () => {
    expect(getClassResourceValue('cleric', 'channelDivinityUses', 2)).toBe(1)
    expect(getClassResourceValue('cleric', 'channelDivinityUses', 6)).toBe(2)
    expect(getClassResourceValue('cleric', 'channelDivinityUses', 18)).toBe(3)
  })
  it('clampa o nível a 1–20', () => {
    expect(getClassResourceValue('barbarian', 'rages', 0)).toBe(2)
    expect(getClassResourceValue('barbarian', 'rages', 99)).toBe(-1)
  })
  it('retorna undefined para classe/recurso inexistente', () => {
    expect(getClassResourceValue('fighter', 'rages', 5)).toBeUndefined()
    expect(getClassResourceValue('barbarian', 'kiPoints', 5)).toBeUndefined()
  })
})

describe('getClassResources', () => {
  it('bárbaro nv1 lista fúrias e dano de fúria', () => {
    const r = getClassResources('barbarian', 1)
    expect(r.map(x => x.label)).toEqual(['Fúrias', 'Dano de Fúria'])
    expect(r[0].value).toBe('2')
    expect(r[1].value).toBe('+2')
  })
  it('bárbaro nv20 mostra fúrias ilimitadas', () => {
    const r = getClassResources('barbarian', 20)
    expect(r.find(x => x.key === 'rages')?.value).toBe('Ilimitadas')
  })
  it('monge nv1 mostra só o dado de artes marciais (ki=0 é omitido)', () => {
    const r = getClassResources('monk', 1)
    expect(r.map(x => x.key)).toEqual(['martialArtsDie'])
    expect(r[0].value).toBe('d4')
  })
  it('monge nv6 mostra ki, artes marciais e movimento em metros', () => {
    const r = getClassResources('monk', 6)
    const mov = r.find(x => x.key === 'unarmoredMovementFt')
    expect(mov?.value).toBe('+4,5 m')
  })
  it('ladino nv5 mostra 3d6 de ataque furtivo', () => {
    expect(getClassResources('rogue', 5).find(x => x.key === 'sneakAttackDice')?.value).toBe('3d6')
  })
  it('classe sem recursos tabelados retorna vazio', () => {
    expect(getClassResources('fighter', 5)).toEqual([])
    expect(getClassResources('wizard', 5)).toEqual([])
  })
})
