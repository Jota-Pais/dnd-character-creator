import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemWeapon } from '../types/equipment'
import type { SkillGrade } from './characterUtils'
import { getSkillGrade } from './characterUtils'
import { getModification } from './modificationUtils'
import { getCurse, getSheetAttributes } from './curseUtils'

/** Bônus fixo por grau de treinamento (livro, Cap. 2). */
export const GRADE_BONUS: Record<SkillGrade, number> = {
  destreinado: 0,
  treinado: 5,
  veterano: 10,
  expert: 15,
}

/** Tipos de dano do Ordem (letra → nome). */
const DAMAGE_TYPE_PT: Record<string, string> = {
  B: 'balístico',
  C: 'corte',
  I: 'impacto',
  P: 'perfuração',
}

export type OrdemWeaponAttack = {
  name: string
  /** Perícia do ataque: "Luta" (corpo a corpo) ou "Pontaria" (à distância). */
  skill: string
  /** Quantos d20 se rola (pegando o melhor) — igual ao atributo-base da perícia (Força ou Agilidade). */
  rollDice: number
  /** Bônus no teste de ataque (treino + modificações). */
  attackBonus: number
  /** Dano já com a Força (corpo a corpo/arremesso) e as modificações. */
  damage: string
  /** Margem de ameaça / multiplicador de crítico, já com as modificações. */
  critical: string
  range: string
}

/** Armas corpo a corpo e de arremesso usam Luta e somam Força no dano; disparo/fogo usam Pontaria. */
function isMelee(weapon: OrdemWeapon): boolean {
  return weapon.weaponCategory === 'corpo_a_corpo' || weapon.weaponCategory === 'arremesso'
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

/** "19" → {threat 19, mult 2}; "x3" → {threat 20, mult 3}; "19/x3" → {threat 19, mult 3}. */
function parseCritical(crit: string): { threat: number; mult: number } {
  let threat = 20
  let mult = 2
  for (const part of String(crit).split('/')) {
    const p = part.trim().toLowerCase()
    if (p.startsWith('x')) {
      mult = parseInt(p.slice(1), 10) || mult
    } else {
      const n = parseInt(p, 10)
      if (!Number.isNaN(n)) threat = n
    }
  }
  return { threat, mult }
}

function formatCritical(threat: number, mult: number): string {
  const parts: string[] = []
  if (threat < 20) parts.push(`${threat}`)
  if (mult !== 2) parts.push(`x${mult}`)
  return parts.length ? parts.join('/') : 'x2'
}

/** Perícias possíveis pro teste de ataque; Ocultismo entra via Lâmina Maldita (arma amaldiçoada). */
export type AttackSkillChoice = 'fighting' | 'aim' | 'occultism'

const ATTACK_SKILLS: Record<AttackSkillChoice, { name: string; attribute: 'strength' | 'agility' | 'intellect' }> = {
  fighting: { name: 'Luta', attribute: 'strength' },
  aim: { name: 'Pontaria', attribute: 'agility' },
  occultism: { name: 'Ocultismo', attribute: 'intellect' },
}

/** Alcances em ordem crescente, pra maldição Predadora subir uma categoria (curto 9m → ... → extremo 90m). */
const RANGE_ORDER = ['Curto', 'Médio', 'Longo', 'Extremo']

function increaseRange(range: string): string {
  const idx = RANGE_ORDER.indexOf(range)
  return idx >= 0 && idx < RANGE_ORDER.length - 1 ? RANGE_ORDER[idx + 1] : range
}

/**
 * Ataque de uma arma do Ordem: perícia (Luta/Pontaria) e seu bônus de treino, número de d20
 * (atributo-base, já com bônus de acessórios amaldiçoados), dano (com Força para corpo a corpo)
 * e crítico — com as modificações de combate (Certeira/Alongada no ataque, Cruel no dano,
 * Calibre Grosso +1 dado, Perigosa/Mira Laser na margem de ameaça) e as maldições incondicionais
 * (Lancinante/Erosiva +1d8 de dano do elemento; Predadora duplica a margem de ameaça — antes dos
 * aumentos fixos, como manda o livro — e sobe o alcance em uma categoria).
 */
export function getOrdemWeaponAttack(
  weapon: OrdemWeapon,
  draft: OrdemCharacterDraft,
  modIds: string[],
  curseIds: string[] = [],
  skillOverride?: AttackSkillChoice,
): OrdemWeaponAttack {
  const attrs = getSheetAttributes(draft)
  const melee = isMelee(weapon)
  // Perícia do teste: automática pela arma (Luta/Pontaria), ou a escolhida na Personalização
  // (ex.: Ocultismo via Lâmina Maldita). O dano corpo a corpo segue somando Força.
  const skillId: AttackSkillChoice = skillOverride ?? (melee ? 'fighting' : 'aim')
  const skill = ATTACK_SKILLS[skillId].name
  const rollDice = attrs[ATTACK_SKILLS[skillId].attribute]

  const mods = modIds.map(getModification).filter((m): m is NonNullable<typeof m> => Boolean(m))
  const curses = curseIds.map(getCurse).filter((c): c is NonNullable<typeof c> => Boolean(c))
  const attackBonus = GRADE_BONUS[getSkillGrade(draft, skillId)] + mods.reduce((s, m) => s + (m.attackBonus ?? 0), 0)
  const damageBonus = (melee ? attrs.strength : 0) + mods.reduce((s, m) => s + (m.damageBonus ?? 0), 0)
  const extraDice = mods.reduce((s, m) => s + (m.damageDice ?? 0), 0)
  const threatMargin = mods.reduce((s, m) => s + (m.threatMargin ?? 0), 0)
  const curseDamage = curses.map(c => c.extraDamage).filter(Boolean).map(d => ` +${d}`).join('')

  const typePt = DAMAGE_TYPE_PT[weapon.damageType] ?? weapon.damageType
  const dmgMatch = String(weapon.damage).match(/^(\d+)d(\d+)/)
  const damage = (dmgMatch
    ? `${parseInt(dmgMatch[1], 10) + extraDice}d${dmgMatch[2]}${damageBonus !== 0 ? signed(damageBonus) : ''} ${typePt}`
    : `${weapon.damage}${damageBonus !== 0 ? ` ${signed(damageBonus)}` : ''} ${typePt}`) + curseDamage

  const { threat, mult } = parseCritical(weapon.critical)
  // Predadora: a margem (20 − início + 1) duplica ANTES dos aumentos fixos (ex.: fuzil de caça 19 → 17).
  const doubledThreat = curses.some(c => c.doublesThreat) ? 21 - 2 * (21 - threat) : threat
  const critical = formatCritical(doubledThreat - threatMargin, mult)

  const range = curses.some(c => c.rangeIncrease) ? increaseRange(weapon.range) : weapon.range

  return { name: weapon.name, skill, rollDice, attackBonus, damage, critical, range }
}
