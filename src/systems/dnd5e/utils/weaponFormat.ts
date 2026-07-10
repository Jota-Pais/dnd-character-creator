import type { DamageRoll, DamageType, Weapon, WeaponProperty } from '../types/equipment'

/** Nomes em português dos tipos de dano (padrão do PHB pt-BR, como usado em classes.json). */
export const DAMAGE_TYPE_PT: Record<DamageType, string> = {
  bludgeoning: 'concussão',
  piercing: 'perfurante',
  slashing: 'cortante',
}

/** "1d8", "2d6", "1" (dano fixo) ou "—" (sem dano). */
export function formatDamageRoll(damage: DamageRoll | null): string {
  if (!damage) return '—'
  if ('dice' in damage && damage.dice) {
    const base = `${damage.dice}d${damage.sides}`
    return damage.flat ? `${base}+${damage.flat}` : base
  }
  return String(damage.flat)
}

/** "1d8 perfurante" (dano + tipo). */
export function formatWeaponDamage(weapon: Weapon): string {
  if (!weapon.damage) return '—'
  const type = weapon.damageType ? ` ${DAMAGE_TYPE_PT[weapon.damageType]}` : ''
  return `${formatDamageRoll(weapon.damage)}${type}`
}

/** Rótulo em português de uma propriedade de arma (com os detalhes: alcance, dado versátil...). */
export function formatWeaponProperty(p: WeaponProperty): string {
  switch (p.kind) {
    case 'finesse': return 'acuidade'
    case 'heavy': return 'pesada'
    case 'light': return 'leve'
    case 'loading': return 'recarga'
    case 'reach': return 'alcance'
    case 'special': return 'especial'
    case 'two-handed': return 'duas mãos'
    case 'versatile': return `versátil (${formatDamageRoll(p.alternateDamage)})`
    case 'thrown': return `arremesso (${p.normalRange}/${p.longRange} m)`
    case 'ammunition': return `munição (${p.normalRange}/${p.longRange} m)`
    case 'range': return `alcance (${p.normalRange}/${p.longRange} m)`
  }
}

/** Lista de propriedades em português, separadas por vírgula (vazia se não houver). */
export function formatWeaponProperties(properties: WeaponProperty[]): string {
  return properties.map(formatWeaponProperty).join(', ')
}

/** Resumo compacto de uma arma: "1d8 perfurante · acuidade, leve". */
export function formatWeaponSummary(weapon: Weapon): string {
  const props = formatWeaponProperties(weapon.properties)
  const damage = formatWeaponDamage(weapon)
  return props ? `${damage} · ${props}` : damage
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

export type WeaponAttack = {
  name: string
  /** Atributo usado no ataque: "Força" ou "Destreza". */
  ability: string
  /** Bônus de ataque já com sinal (ex.: "+5"). */
  attackBonus: string
  /** Dano com o modificador e o tipo (ex.: "1d8+3 perfurante"). */
  damage: string
}

/**
 * Ataque de uma arma: escolhe o atributo (Destreza para armas à distância ou de acuidade quando
 * a Destreza é melhor; Força caso contrário), soma proficiência no ataque e o modificador no dano.
 */
export function getWeaponAttack(weapon: Weapon, strMod: number, dexMod: number, proficiency: number): WeaponAttack {
  const hasFinesse = weapon.properties.some(p => p.kind === 'finesse')
  const useDex = weapon.weaponType === 'ranged' || (hasFinesse && dexMod >= strMod)
  const ability = useDex ? 'Destreza' : 'Força'
  const mod = useDex ? dexMod : strMod
  const type = weapon.damageType ? ` ${DAMAGE_TYPE_PT[weapon.damageType]}` : ''
  const damage = weapon.damage
    ? `${formatDamageRoll(weapon.damage)}${mod !== 0 ? signed(mod) : ''}${type}`
    : '—'
  return { name: weapon.name, ability, attackBonus: signed(proficiency + mod), damage }
}
