import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemWeapon } from '../types/equipment'
import type { SkillGrade } from './characterUtils'
import { getSkillGrade, getEffectiveAttributes } from './characterUtils'
import { getModification } from './modificationUtils'

/** Bônus fixo por grau de treinamento (livro, Cap. 2). */
const GRADE_BONUS: Record<SkillGrade, number> = {
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

/**
 * Ataque de uma arma do Ordem: perícia (Luta/Pontaria) e seu bônus de treino, número de d20
 * (atributo-base), dano (com Força para corpo a corpo) e crítico — tudo já com as modificações
 * de combate aplicadas (Certeira/Alongada no ataque, Cruel no dano, Calibre Grosso +1 dado,
 * Perigosa/Mira Laser na margem de ameaça).
 */
export function getOrdemWeaponAttack(
  weapon: OrdemWeapon,
  draft: OrdemCharacterDraft,
  modIds: string[],
): OrdemWeaponAttack {
  const attrs = getEffectiveAttributes(draft)
  const melee = isMelee(weapon)
  const skillId = melee ? 'fighting' : 'aim'
  const skill = melee ? 'Luta' : 'Pontaria'
  const rollDice = melee ? attrs.strength : attrs.agility

  const mods = modIds.map(getModification).filter((m): m is NonNullable<typeof m> => Boolean(m))
  const attackBonus = GRADE_BONUS[getSkillGrade(draft, skillId)] + mods.reduce((s, m) => s + (m.attackBonus ?? 0), 0)
  const damageBonus = (melee ? attrs.strength : 0) + mods.reduce((s, m) => s + (m.damageBonus ?? 0), 0)
  const extraDice = mods.reduce((s, m) => s + (m.damageDice ?? 0), 0)
  const threatMargin = mods.reduce((s, m) => s + (m.threatMargin ?? 0), 0)

  const typePt = DAMAGE_TYPE_PT[weapon.damageType] ?? weapon.damageType
  const dmgMatch = String(weapon.damage).match(/^(\d+)d(\d+)/)
  const damage = dmgMatch
    ? `${parseInt(dmgMatch[1], 10) + extraDice}d${dmgMatch[2]}${damageBonus !== 0 ? signed(damageBonus) : ''} ${typePt}`
    : `${weapon.damage}${damageBonus !== 0 ? ` ${signed(damageBonus)}` : ''} ${typePt}`

  const { threat, mult } = parseCritical(weapon.critical)
  const critical = formatCritical(threat - threatMargin, mult)

  return { name: weapon.name, skill, rollDice, attackBonus, damage, critical, range: weapon.range }
}
