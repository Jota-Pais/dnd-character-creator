import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemWeapon, OrdemWeaponGrip, OrdemWeaponProficiency, OrdemWeaponCategory } from '../types/equipment'
import type { SkillGrade } from './characterUtils'
import { getSkillGrade, hasClassPower, getOriginEffects, getWorkToolBonus, getWeaponSkillOverride } from './characterUtils'
import { getParanormalEffects } from './paranormalPowerUtils'
import { getModification } from './modificationUtils'
import { getCurse, getSheetAttributes } from './curseUtils'
import { getEquipmentByInstance, getInstanceLabel, instanceItemId } from './equipmentUtils'

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
export function isMelee(weapon: OrdemWeapon): boolean {
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

/** Perícia padrão do teste de ataque da arma (Luta corpo a corpo/arremesso, Pontaria à distância). */
export function getWeaponSkillName(weapon: OrdemWeapon): string {
  return ATTACK_SKILLS[isMelee(weapon) ? 'fighting' : 'aim'].name
}

const GRIP_PT: Record<OrdemWeaponGrip, string> = {
  leve: 'leve',
  uma_mao: 'uma mão',
  duas_maos: 'duas mãos',
}

const PROFICIENCY_PT: Record<OrdemWeaponProficiency, string> = {
  simple: 'simples',
  tactical: 'tática',
  heavy: 'pesada',
}

const WEAPON_CATEGORY_PT: Record<OrdemWeaponCategory, string> = {
  corpo_a_corpo: 'corpo a corpo',
  arremesso: 'arremesso',
  disparo: 'disparo',
  fogo: 'arma de fogo',
}

/** Resumo compacto pro card de escolha: "Luta · corpo a corpo · uma mão · tática". */
export function formatWeaponSummary(weapon: OrdemWeapon): string {
  const parts = [getWeaponSkillName(weapon), WEAPON_CATEGORY_PT[weapon.weaponCategory]]
  if (weapon.range !== '-') parts.push(`alcance ${weapon.range}`)
  parts.push(GRIP_PT[weapon.grip], `proficiência ${PROFICIENCY_PT[weapon.proficiency]}`)
  return parts.join(' · ')
}

/** Alcances em ordem crescente, pra maldição Predadora subir uma categoria (curto 9m → ... → extremo 90m). */
const RANGE_ORDER = ['Curto', 'Médio', 'Longo', 'Extremo']

function increaseRange(range: string): string {
  const idx = RANGE_ORDER.indexOf(range)
  return idx >= 0 && idx < RANGE_ORDER.length - 1 ? RANGE_ORDER[idx + 1] : range
}

function hasTrilhaFeature(draft: OrdemCharacterDraft, trilhaId: string, nex: number): boolean {
  if (draft.trilha === trilhaId && draft.nex >= nex) return true
  if (nex === 10 && draft.versatilityChoice?.kind === 'trilha' && draft.versatilityChoice.trilhaId === trilhaId) return true
  return false
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
  ammoModIds: string[] = [],
): OrdemWeaponAttack {
  const attrs = getSheetAttributes(draft)
  const melee = isMelee(weapon)
  // Perícia do teste: automática pela arma (Luta/Pontaria), ou a escolhida na Personalização
  // (ex.: Ocultismo via Lâmina Maldita). O dano corpo a corpo segue somando Força.
  const skillId: AttackSkillChoice = skillOverride ?? (melee ? 'fighting' : 'aim')
  const skill = ATTACK_SKILLS[skillId].name
  const rollDice = attrs[ATTACK_SKILLS[skillId].attribute]

  // Modificações da ARMA e da MUNIÇÃO usada entram no mesmo bolo de números: a munição só chega
  // aqui se for do tipo que a arma consome (ver `getWeaponAmmoVariants`).
  const mods = [...modIds, ...ammoModIds].map(getModification).filter((m): m is NonNullable<typeof m> => Boolean(m))
  const curses = curseIds.map(getCurse).filter((c): c is NonNullable<typeof c> => Boolean(c))
  // Ferramenta de Trabalho (origem Operário): +1 em ataque/dano/margem de ameaça, só com a arma escolhida.
  const workToolBonus = draft.workToolWeapon === weapon.id ? getWorkToolBonus(draft) : 0
  const attackBonus = GRADE_BONUS[getSkillGrade(draft, skillId)] + workToolBonus + mods.reduce((s, m) => s + (m.attackBonus ?? 0), 0)
  // Poderes de classe com efeito incondicional no dano (F25): Tiro Certeiro (+AGI em armas de
  // disparo), Balística Avançada/Ninja Urbano (+2 em táticas de fogo/corpo a corpo),
  // Golpe Pesado (+1 dado corpo a corpo). E poderes de origem: Mão Pesada (+2 corpo a corpo),
  // Para Bellum (+2 armas de fogo).
  const originEffects = getOriginEffects(draft)
  const powerDamage =
    (hasClassPower(draft, 'sure-shot') && weapon.weaponCategory === 'disparo' ? attrs.agility : 0) +
    (hasClassPower(draft, 'advanced-ballistics') && weapon.proficiency === 'tactical' && weapon.weaponCategory === 'fogo' ? 2 : 0) +
    (hasClassPower(draft, 'urban-ninja') && weapon.proficiency === 'tactical' && weapon.weaponCategory === 'corpo_a_corpo' ? 2 : 0) +
    (weapon.weaponCategory === 'corpo_a_corpo' ? (originEffects.meleeDamageBonus ?? 0) : 0) +
    (weapon.weaponCategory === 'fogo' ? (originEffects.firearmDamageBonus ?? 0) : 0)
  const damageBonus = (melee ? attrs.strength : 0) + powerDamage + workToolBonus + mods.reduce((s, m) => s + (m.damageBonus ?? 0), 0)
  const extraDice = mods.reduce((s, m) => s + (m.damageDice ?? 0), 0) +
    (hasClassPower(draft, 'heavy-blow') && weapon.weaponCategory === 'corpo_a_corpo' ? 1 : 0)

  const trilhaThreatMargin =
    (hasTrilhaFeature(draft, 'warrior', 10) && melee ? 2 : 0) +
    (hasTrilhaFeature(draft, 'annihilator', 99) && draft.favoriteWeapon === weapon.id ? 2 : 0)

  // Golpe de Sorte (poder paranormal): +1 na margem de ameaça em TODOS os ataques
  // (+1 no multiplicador de crítico com a 2ª escolha por afinidade).
  const paranormal = getParanormalEffects(draft)
  const threatMargin = workToolBonus + trilhaThreatMargin + paranormal.threatMarginBonus
    + mods.reduce((s, m) => s + (m.threatMargin ?? 0), 0)
  // Dano extra com dado próprio: munição Explosiva (+2d6) e maldições (Lancinante/Erosiva +1d8).
  const extraDamage = [...mods, ...curses].map(m => m.extraDamage).filter(Boolean).map(d => ` +${d}`).join('')

  const typePt = DAMAGE_TYPE_PT[weapon.damageType] ?? weapon.damageType
  const dmgMatch = String(weapon.damage).match(/^(\d+)d(\d+)/)
  const damage = (dmgMatch
    ? `${parseInt(dmgMatch[1], 10) + extraDice}d${dmgMatch[2]}${damageBonus !== 0 ? signed(damageBonus) : ''} ${typePt}`
    : `${weapon.damage}${damageBonus !== 0 ? ` ${signed(damageBonus)}` : ''} ${typePt}`) + extraDamage

  const { threat, mult } = parseCritical(weapon.critical)
  // Predadora: a margem (20 − início + 1) duplica ANTES dos aumentos fixos (ex.: fuzil de caça 19 → 17).
  const doubledThreat = curses.some(c => c.doublesThreat) ? 21 - 2 * (21 - threat) : threat
  // Multiplicador de crítico: Golpe de Sorte com afinidade (+1) e munição Dum dum (+2).
  const multBonus = paranormal.critMultiplierBonus + mods.reduce((s, m) => s + (m.critMultiplierBonus ?? 0), 0)
  const critical = formatCritical(doubledThreat - threatMargin, mult + multBonus)

  const range = curses.some(c => c.rangeIncrease) ? increaseRange(weapon.range) : weapon.range

  return { name: weapon.name, skill, rollDice, attackBonus, damage, critical, range }
}

// ── Munição: uma linha de ataque por variante carregada ────────────────────────

export type WeaponAmmoVariant = {
  /** Unidade de munição representante da variante (a 1ª do loadout com essa combinação de mods). */
  uid: string
  /** Ids das modificações desta munição (vazio = munição comum). */
  modIds: string[]
  /** Rótulo pro nome do ataque (ex.: "Balas Curtas" ou "Balas Curtas — Dum dum"). */
  label: string
}

/**
 * Variantes de munição do loadout que ESTA arma pode disparar — a compatibilidade é pelo tipo
 * (`weapon.ammo`, Tabela 3.4), então uma espingarda nunca herda o Dum dum de balas curtas.
 * Duas unidades da mesma munição com modificações diferentes viram duas variantes (e duas linhas
 * de ataque); unidades com a mesma combinação de mods são deduplicadas. Munição comum vem
 * primeiro, pra o ataque "normal" abrir a lista.
 *
 * Devolve vazio quando a arma não usa munição (corpo a corpo/arremesso) ou quando o agente não
 * requisitou munição compatível — nesse caso a ficha mostra a linha única da arma, sem rótulo.
 */
export function getWeaponAmmoVariants(draft: OrdemCharacterDraft, weapon: OrdemWeapon): WeaponAmmoVariant[] {
  if (!weapon.ammo) return []
  const bySignature = new Map<string, WeaponAmmoVariant>()
  for (const uid of draft.equipmentChoices) {
    if (instanceItemId(uid) !== weapon.ammo) continue
    const ammo = getEquipmentByInstance(uid)
    if (!ammo) continue
    const modIds = draft.equipmentModifications[uid] ?? []
    const signature = [...modIds].sort().join('|')
    if (bySignature.has(signature)) continue
    const modNames = modIds.map(id => getModification(id)?.name).filter(Boolean)
    bySignature.set(signature, {
      uid,
      modIds,
      label: modNames.length > 0 ? `${ammo.name} — ${modNames.join(', ')}` : ammo.name,
    })
  }
  return [...bySignature.values()].sort((a, b) => a.modIds.length - b.modIds.length)
}

/**
 * Todas as linhas de ataque da ficha, na ordem em que aparecem na Revisão e no PDF: uma por
 * arma requisitada (ou uma por variante de munição compatível, quando o agente carrega munições
 * diferentes) e o ataque desarmado no fim. Fonte única pra Revisão e PDF não divergirem.
 */
export function getSheetWeaponAttacks(draft: OrdemCharacterDraft): OrdemWeaponAttack[] {
  const attacks: OrdemWeaponAttack[] = []
  for (const uid of draft.equipmentChoices) {
    const item = getEquipmentByInstance(uid)
    if (!item || item.type !== 'weapon') continue
    const name = getInstanceLabel(draft, uid)
    const modIds = draft.equipmentModifications[uid] ?? []
    const curseIds = draft.equipmentCurses[uid] ?? []
    const skillOverride = getWeaponSkillOverride(draft, uid)
    const variants = getWeaponAmmoVariants(draft, item)
    if (variants.length === 0) {
      attacks.push({ ...getOrdemWeaponAttack(item, draft, modIds, curseIds, skillOverride), name })
      continue
    }
    for (const variant of variants) {
      attacks.push({
        ...getOrdemWeaponAttack(item, draft, modIds, curseIds, skillOverride, variant.modIds),
        name: `${name} (${variant.label})`,
      })
    }
  }
  attacks.push(getUnarmedAttack(draft))
  return attacks
}

/**
 * Ataque desarmado: 1d3 não letal na base. Artista Marcial sobe para 1d6 (1d8 em NEX 35%+,
 * 1d10 em NEX 70%+), letal, e "conta como arma" — por isso é modelado como uma arma corpo a corpo
 * sintética (sem categoria/espaço, não é item de inventário) e passa pelo mesmo `getOrdemWeaponAttack`,
 * herdando corretamente bônus condicionados a "armas corpo a corpo" (Golpe Pesado, Mão Pesada etc.).
 * O tipo de dano (impacto) é inferido; não modela "conta como arma ágil" (nenhuma regra já
 * implementada depende de uma arma ser "ágil").
 */
export function getUnarmedAttack(draft: OrdemCharacterDraft): OrdemWeaponAttack {
  const isMartialArtist = hasClassPower(draft, 'martial-artist')
  let damage = '1d3'
  let damageType = 'I (não letal)'
  if (isMartialArtist) {
    damageType = 'I'
    damage = draft.nex >= 70 ? '1d10' : draft.nex >= 35 ? '1d8' : '1d6'
  }
  const unarmedWeapon: OrdemWeapon = {
    id: 'desarmado', name: 'Desarmado', category: 0, spaces: 0, type: 'weapon',
    proficiency: 'simple', weaponCategory: 'corpo_a_corpo', grip: 'leve',
    damage, critical: 'x2', range: '-', damageType,
  }
  return { ...getOrdemWeaponAttack(unarmedWeapon, draft, []), name: 'Desarmado' }
}
