import { describe, it, expect } from 'vitest'
import {
  formatDamageRoll,
  formatWeaponDamage,
  formatWeaponProperty,
  formatWeaponSummary,
  formatArmorSummary,
  getWeaponAttack,
} from '../weaponFormat'
import { getWeaponById, getArmorById, getPackById, formatPackContents } from '../equipmentUtils'

describe('weaponFormat', () => {
  it('formatDamageRoll cobre dados, dano fixo e ausência de dano', () => {
    expect(formatDamageRoll({ dice: 1, sides: 8 })).toBe('1d8')
    expect(formatDamageRoll({ dice: 2, sides: 6 })).toBe('2d6')
    expect(formatDamageRoll({ flat: 1 })).toBe('1')
    expect(formatDamageRoll(null)).toBe('—')
  })

  it('formatWeaponProperty traduz as propriedades para português', () => {
    expect(formatWeaponProperty({ kind: 'finesse' })).toBe('acuidade')
    expect(formatWeaponProperty({ kind: 'light' })).toBe('leve')
    expect(formatWeaponProperty({ kind: 'two-handed' })).toBe('duas mãos')
    expect(formatWeaponProperty({ kind: 'versatile', alternateDamage: { dice: 1, sides: 10 } })).toBe('versátil (1d10)')
    expect(formatWeaponProperty({ kind: 'thrown', normalRange: 6, longRange: 18 })).toBe('arremesso (6/18 m)')
  })

  it('formatWeaponDamage inclui o tipo de dano em português', () => {
    const rapier = getWeaponById('rapier')!
    expect(formatWeaponDamage(rapier)).toBe('1d8 perfurante')
  })

  it('formatWeaponSummary distingue rapieira de espada curta (o caso do playtest, F1)', () => {
    // Rapieira: 1d8 perfurante, acuidade (uma mão)
    expect(formatWeaponSummary(getWeaponById('rapier')!)).toBe('1d8 perfurante · acuidade')
    // Espada Curta: 1d6 perfurante, acuidade + leve
    expect(formatWeaponSummary(getWeaponById('shortsword')!)).toBe('1d6 perfurante · acuidade, leve')
  })

  describe('formatArmorSummary (F1 — armaduras/escudos)', () => {
    it('leve mostra CA + Des; média limita a +2; pesada é fixa', () => {
      expect(formatArmorSummary(getArmorById('leather')!)).toBe('CA 11 + Des')
      expect(formatArmorSummary(getArmorById('hide')!)).toBe('CA 12 + Des (máx. +2)')
      expect(formatArmorSummary(getArmorById('ring-mail')!)).toBe('CA 14 · desv. em Furtividade')
    })
    it('escudo mostra +2', () => {
      expect(formatArmorSummary(getArmorById('shield')!)).toBe('CA +2 (escudo)')
    })
  })

  describe('formatPackContents (F1 — pacotes)', () => {
    it('lista o conteúdo do pacote com quantidades', () => {
      const contents = formatPackContents(getPackById('entertainers-pack')!)
      expect(contents).toContain('Mochila')
      expect(contents).toMatch(/\d+×/) // tem itens com quantidade > 1
    })
  })

  describe('getWeaponAttack (F5 — linha de ataque por arma)', () => {
    it('arma de acuidade usa Destreza quando ela é melhor', () => {
      // Rapieira (acuidade), Força +1, Destreza +3, prof +2 → usa Destreza
      const atk = getWeaponAttack(getWeaponById('rapier')!, 1, 3, 2)
      expect(atk).toEqual({ name: 'Rapieira', ability: 'Destreza', attackBonus: '+5', damage: '1d8+3 perfurante' })
    })

    it('arma corpo a corpo sem acuidade usa Força', () => {
      // Espada Grande (2d6, sem acuidade), Força +3, Destreza +1, prof +2 → usa Força
      const atk = getWeaponAttack(getWeaponById('greatsword')!, 3, 1, 2)
      expect(atk).toEqual({ name: 'Espada Grande', ability: 'Força', attackBonus: '+5', damage: '2d6+3 cortante' })
    })

    it('arma à distância usa Destreza', () => {
      // Arco Longo (à distância), Força +3, Destreza +2, prof +2 → usa Destreza
      const atk = getWeaponAttack(getWeaponById('longbow')!, 3, 2, 2)
      expect(atk.ability).toBe('Destreza')
      expect(atk.attackBonus).toBe('+4')
      expect(atk.damage).toBe('1d8+2 perfurante')
    })

    it('modificador 0 não aparece no dano', () => {
      // Porrete (1d4 concussão), Força 0, Destreza 0, prof +2 → dano sem "+0"
      const atk = getWeaponAttack(getWeaponById('club')!, 0, 0, 2)
      expect(atk.damage).toBe('1d4 concussão')
      expect(atk.attackBonus).toBe('+2')
    })
  })
})
