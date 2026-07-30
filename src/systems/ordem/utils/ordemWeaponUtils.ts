import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemWeapon, OrdemWeaponGrip, OrdemWeaponProficiency, OrdemWeaponCategory } from '../types/equipment'
import type { SkillGrade } from './characterUtils'
import { getSkillGrade, hasClassPower, getOriginEffects, getWorkToolBonus, getWeaponSkillOverride, hasTrilhaFeature } from './characterUtils'
import { getParanormalEffects, hasParanormalPower } from './paranormalPowerUtils'
import { getModification } from './modificationUtils'
import { getCurse, getSheetAttributes } from './curseUtils'
import { getEquipmentByInstance, getInstanceLabel, instanceItemId, usesLongBullets, hasWeaponProficiency } from './equipmentUtils'
import { getAttributeDicePenalty } from './sheetEffects'
import { getDicePool, NO_PROFICIENCY_DICE_PENALTY, type DicePool } from './attributeUtils'

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
  /** Quantos d20 se rola — do atributo-base da perícia, já com as penalidades de proficiência. */
  rollDice: number
  /** 'worst' quando vale o PIOR resultado (atributo 0, ou penalidade que zerou o pool). */
  rollMode: DicePool['mode']
  /**
   * Atributo que dá os dados e o bônus de dano deste ataque. Normalmente o da perícia (Força na
   * Luta, Agilidade na Pontaria), mas numa arma ágil pode ser Agilidade num teste de Luta (p. 59).
   */
  attributeUsed: 'agility' | 'strength' | 'intellect' | 'presence' | 'vigor'
  /** Regras próprias da arma, já resolvidas pelo personagem quando dependem dele. */
  notes: string[]
  /** Por que o pool foi penalizado, pra ficha explicar (ex.: "arma sem proficiência −ØØ"). */
  dicePenaltyNotes: string[]
  /** Bônus no teste de ataque (treino + modificações). */
  attackBonus: number
  /** Dano já com a Força (corpo a corpo/arremesso) e as modificações. */
  damage: string
  /** Margem de ameaça / multiplicador de crítico, já com as modificações. */
  critical: string
  range: string
}

/**
 * Só corpo a corpo usa **Luta**; arremesso, disparo e fogo são ataques à distância e usam
 * **Pontaria** (p. 56). Não confundir com quem soma Força no dano — ver `addsStrengthToDamage`.
 */
export function isMelee(weapon: OrdemWeapon): boolean {
  return weapon.weaponCategory === 'corpo_a_corpo'
}

/**
 * Soma o valor de Força nas rolagens de dano? Vale para corpo a corpo **e arremesso** ("Quando você
 * ataca com uma arma de arremesso, soma seu valor de Força às rolagens de dano"); disparo e fogo
 * não somam atributo nenhum (p. 56).
 */
export function addsStrengthToDamage(weapon: OrdemWeapon): boolean {
  if (weapon.addsStrengthDamage) return true // exceção do Arco Composto (p. 58)
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
  // Propriedades que mudam como a arma é usada, visíveis já na escolha do equipamento.
  if (weapon.agile) parts.push('ágil')
  if (weapon.automatic) parts.push('automática')
  return parts.join(' · ')
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
  ammoModIds: string[] = [],
): OrdemWeaponAttack {
  const attrs = getSheetAttributes(draft)
  const melee = isMelee(weapon)
  // Perícia do teste: automática pela arma (Luta/Pontaria), ou a escolhida na Personalização
  // (ex.: Ocultismo via Lâmina Maldita). O dano corpo a corpo segue somando Força.
  const skillId: AttackSkillChoice = skillOverride ?? (melee ? 'fighting' : 'aim')
  const skill = ATTACK_SKILLS[skillId].name
  // Arma ágil (p. 59): pode aplicar Agilidade em vez de Força — no teste de ataque E no dano. Como
  // as duas trocam juntas, o maior atributo é sempre a escolha ótima (não há trade-off a decidir),
  // então a ficha usa o melhor e informa qual em `attributeUsed`. Só vale quando o teste é de Luta:
  // o ataque por Ocultismo (Lâmina Maldita) usa Intelecto e não entra nessa troca.
  const canUseAgility = Boolean(weapon.agile) && skillId === 'fighting'
  const attackAttribute = canUseAgility && attrs.agility > attrs.strength
    ? 'agility'
    : ATTACK_SKILLS[skillId].attribute
  // Penalidades em DADOS que valem para o teste de ataque, somadas antes de resolver o pool:
  // arma sem proficiência (–ØØ no ataque, p. 56) e proteção sem proficiência (–ØØ em testes de
  // Força/Agilidade, p. 62 — não atinge o ataque por Ocultismo, que é Intelecto).
  const dicePenaltyNotes: string[] = []
  let dicePenalty = 0
  if (!hasWeaponProficiency(draft, weapon)) {
    dicePenalty += NO_PROFICIENCY_DICE_PENALTY
    dicePenaltyNotes.push('arma sem proficiência −ØØ')
  }
  const armorPenalty = getAttributeDicePenalty(draft, attackAttribute)
  if (armorPenalty > 0) {
    dicePenalty += armorPenalty
    dicePenaltyNotes.push('proteção sem proficiência −ØØ')
  }
  const pool = getDicePool(attrs[attackAttribute], dicePenalty)

  // Modificações da ARMA e da MUNIÇÃO usada entram no mesmo bolo de números: a munição só chega
  // aqui se for do tipo que a arma consome (ver `getWeaponAmmoVariants`).
  const mods = [...modIds, ...ammoModIds].map(getModification).filter((m): m is NonNullable<typeof m> => Boolean(m))
  const curses = curseIds.map(getCurse).filter((c): c is NonNullable<typeof c> => Boolean(c))
  // Ferramenta de Trabalho (origem Operário): +1 em ataque/dano/margem de ameaça, só com a arma escolhida.
  const workToolBonus = draft.workToolWeapon === weapon.id ? getWorkToolBonus(draft) : 0
  // Penalidade fixa da própria arma (motosserra −2, por ser desajeitada — p. 59).
  const attackBonus = GRADE_BONUS[getSkillGrade(draft, skillId)] + workToolBonus
    - (weapon.attackPenalty ?? 0)
    + mods.reduce((s, m) => s + (m.attackBonus ?? 0), 0)
  // Poderes de classe com efeito incondicional no dano (F25): Tiro Certeiro (+AGI em armas de
  // disparo), Balística Avançada/Ninja Urbano (+2 em táticas de fogo/corpo a corpo),
  // Golpe Pesado (+1 dado corpo a corpo). E poderes de origem: Mão Pesada (+2 corpo a corpo),
  // Para Bellum (+2 armas de fogo). Da trilha: Mira de Elite (+INT nas armas de balas longas).
  const originEffects = getOriginEffects(draft)
  const powerDamage =
    (hasClassPower(draft, 'sure-shot') && weapon.weaponCategory === 'disparo' ? attrs.agility : 0) +
    (hasClassPower(draft, 'advanced-ballistics') && weapon.proficiency === 'tactical' && weapon.weaponCategory === 'fogo' ? 2 : 0) +
    (hasClassPower(draft, 'urban-ninja') && weapon.proficiency === 'tactical' && weapon.weaponCategory === 'corpo_a_corpo' ? 2 : 0) +
    (usesLongBullets(weapon) && hasTrilhaFeature(draft, 'elite-marksman', 10) ? attrs.intellect : 0) +
    (weapon.weaponCategory === 'corpo_a_corpo' ? (originEffects.meleeDamageBonus ?? 0) : 0) +
    (weapon.weaponCategory === 'fogo' ? (originEffects.firearmDamageBonus ?? 0) : 0)
  // Força entra no dano de corpo a corpo E de arremesso (p. 56) — mas o TESTE do arremesso é
  // Pontaria. Numa arma ágil, o atributo do dano é o mesmo do ataque (`attackAttribute`).
  const strengthLikeDamage = addsStrengthToDamage(weapon)
    ? attrs[canUseAgility ? attackAttribute : 'strength']
    : 0
  const damageBonus = strengthLikeDamage + powerDamage + workToolBonus + (weapon.flatDamageBonus ?? 0)
    + mods.reduce((s, m) => s + (m.damageBonus ?? 0), 0)
  // Máquina de Matar (Aniquilador NEX 99%): "o dano aumenta em um passo" — ruling do usuário
  // (2026-07-29): um passo = mais um dado do mesmo tipo, igual a Golpe Pesado e Calibre Grosso.
  const extraDice = mods.reduce((s, m) => s + (m.damageDice ?? 0), 0) +
    (hasClassPower(draft, 'heavy-blow') && weapon.weaponCategory === 'corpo_a_corpo' ? 1 : 0) +
    (hasTrilhaFeature(draft, 'annihilator', 99) && draft.favoriteWeapon === weapon.id ? 1 : 0)

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

  return {
    name: weapon.name, skill, rollDice: pool.dice, rollMode: pool.mode, attributeUsed: attackAttribute,
    dicePenaltyNotes, notes: getWeaponRuleNotes(weapon, draft),
    attackBonus, damage, critical, range,
  }
}

/**
 * Regras próprias da arma para a ficha: o texto fixo de `weapon.rules` mais as que dependem do
 * personagem e por isso só podem ser resolvidas aqui (p. 58-59):
 *
 * - **Metralhadora**: exige Força 4 ou apoiar em tripé; sem isso, −5 nos ataques.
 * - **Fuzil de Precisão**: +5 na margem de ameaça ao mirar, se veterano em Pontaria.
 * - **Katana**: pode ser empunhada com uma mão, se veterano em Luta.
 * - **Arma automática**: pode disparar rajada (−Ø no ataque por +1 dado de dano) — a rajada é
 *   decisão de jogo, a ficha só avisa que a arma é automática.
 */
export function getWeaponRuleNotes(weapon: OrdemWeapon, draft: OrdemCharacterDraft): string[] {
  const notes = [...(weapon.rules ?? [])]
  const attrs = getSheetAttributes(draft)

  if (weapon.automatic) {
    notes.push('Automática: pode disparar rajada (−Ø no ataque para +1 dado de dano).')
  }
  if (weapon.id === 'metralhadora' && attrs.strength < 4) {
    notes.push(`Com Força ${attrs.strength} (menos de 4), exige apoiar em tripé com uma ação de movimento — sem isso, −5 nos ataques.`)
  }
  if (weapon.id === 'fuzil-precisao' && isVeteranOrBetter(getSkillGrade(draft, 'aim'))) {
    notes.push('Veterano em Pontaria: ao mirar, +5 na margem de ameaça deste ataque.')
  }
  if (weapon.id === 'katana' && isVeteranOrBetter(getSkillGrade(draft, 'fighting'))) {
    notes.push('Veterano em Luta: pode empunhar a katana com uma mão.')
  }
  return notes
}

function isVeteranOrBetter(grade: SkillGrade): boolean {
  return grade === 'veterano' || grade === 'expert'
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
    } else {
      for (const variant of variants) {
        attacks.push({
          ...getOrdemWeaponAttack(item, draft, modIds, curseIds, skillOverride, variant.modIds),
          name: `${name} (${variant.label})`,
        })
      }
    }
    // Faca, Lança e Machadinha têm alcance: rendem também a linha de arremesso (Pontaria).
    if (canBeThrown(item)) attacks.push(getThrownAttack(item, draft, modIds, curseIds, name))
  }
  const coronhada = getCoronhadaAttack(draft)
  if (coronhada) attacks.push(coronhada)
  const bloodWeapon = getBloodWeaponAttack(draft)
  if (bloodWeapon) attacks.push(bloodWeapon)
  attacks.push(getUnarmedAttack(draft))
  return attacks
}

/**
 * A arma corpo a corpo pode ser arremessada? O livro lista Faca, Lança e Machadinha como corpo a
 * corpo COM alcance — arremessá-las é um ataque à distância, então o teste vira Pontaria (p. 56).
 * O dano continua somando Força, porque armas de arremesso somam Força (ao contrário de
 * disparo/fogo).
 */
export function canBeThrown(weapon: OrdemWeapon): boolean {
  return weapon.weaponCategory === 'corpo_a_corpo' && weapon.range !== '-' && Boolean(weapon.range)
}

/**
 * Linha de ataque de ARREMESSO de uma arma corpo a corpo que tem alcance. Modelada trocando a
 * categoria para 'arremesso', o que já faz o motor usar Pontaria e manter a Força no dano.
 */
function getThrownAttack(
  weapon: OrdemWeapon,
  draft: OrdemCharacterDraft,
  modIds: string[],
  curseIds: string[],
  label: string,
): OrdemWeaponAttack {
  const thrown: OrdemWeapon = { ...weapon, weaponCategory: 'arremesso' }
  return { ...getOrdemWeaponAttack(thrown, draft, modIds, curseIds), name: `${label} (arremesso)` }
}

/**
 * Coronhada (Tabela 3.3): golpear com a própria arma de fogo, 1d4 de impacto (1d6 se a arma é de
 * duas mãos, notação "1d4/1d6"). Não é o ataque desarmado — este causa 1d3 NÃO letal —, e não é
 * item de inventário: é um modo de ataque de quem está com uma arma de fogo na mão. A ficha mostra
 * uma linha só, a melhor disponível, pra não repetir por arma.
 */
export function getCoronhadaAttack(draft: OrdemCharacterDraft): OrdemWeaponAttack | null {
  const firearms = draft.equipmentChoices
    .map(getEquipmentByInstance)
    .filter((item): item is OrdemWeapon => item?.type === 'weapon' && item.weaponCategory === 'fogo')
  if (firearms.length === 0) return null
  // "1d4/1d6": o dado maior vale para a arma de duas mãos.
  const twoHanded = firearms.some(w => w.grip === 'duas_maos')
  const weapon: OrdemWeapon = {
    id: 'coronhada', name: 'Coronhada', category: 0, spaces: 0, type: 'weapon',
    proficiency: 'simple', weaponCategory: 'corpo_a_corpo', grip: twoHanded ? 'duas_maos' : 'uma_mao',
    damage: twoHanded ? '1d6' : '1d4', critical: 'x2', range: '-', damageType: 'I',
  }
  return { ...getOrdemWeaponAttack(weapon, draft, []), name: 'Coronhada' }
}

/**
 * Arma de Sangue (poder paranormal): garras/chifres/lâmina de sangue cristalizado que contam como
 * "arma simples leve que você não precisa empunhar" e causam 1d6 de dano de Sangue. É modelada
 * como arma sintética (igual ao Desarmado do Artista Marcial), então herda os bônus de arma
 * corpo a corpo da ficha. Não é item de inventário — não ocupa espaço nem vaga de Patente.
 *
 * Custa 2 PE e uma ação de movimento pra manifestar (dura a cena); com a afinidade ela se torna
 * permanente. Em ambos os casos a linha de ataque é a mesma, então a ficha sempre a mostra.
 */
export function getBloodWeaponAttack(draft: OrdemCharacterDraft): OrdemWeaponAttack | null {
  if (!hasParanormalPower(draft, 'blood-weapon')) return null
  const weapon: OrdemWeapon = {
    id: 'arma-de-sangue', name: 'Arma de Sangue', category: 0, spaces: 0, type: 'weapon',
    proficiency: 'simple', weaponCategory: 'corpo_a_corpo', grip: 'leve',
    damage: '1d6', critical: 'x2', range: '-', damageType: 'Sangue',
  }
  return { ...getOrdemWeaponAttack(weapon, draft, []), name: 'Arma de Sangue' }
}

/**
 * Ataque desarmado: 1d3 não letal na base. Artista Marcial sobe para 1d6 (1d8 em NEX 35%+,
 * 1d10 em NEX 70%+), letal, e "conta como arma" — por isso é modelado como uma arma corpo a corpo
 * sintética (sem categoria/espaço, não é item de inventário) e passa pelo mesmo `getOrdemWeaponAttack`,
 * herdando corretamente bônus condicionados a "armas corpo a corpo" (Golpe Pesado, Mão Pesada etc.).
 *
 * A **Soqueira** (p. 66) entra aqui: "fornece +1 em rolagens de dano desarmado. Uma soqueira pode
 * receber modificações de armas corpo a corpo e aplica os efeitos de suas modificações em seus
 * ataques desarmados" — então o item também empresta as próprias modificações a esta linha.
 */
export function getUnarmedAttack(draft: OrdemCharacterDraft): OrdemWeaponAttack {
  const isMartialArtist = hasClassPower(draft, 'martial-artist')
  let damage = '1d3'
  let damageType = 'I (não letal)'
  if (isMartialArtist) {
    damageType = 'I'
    damage = draft.nex >= 70 ? '1d10' : draft.nex >= 35 ? '1d8' : '1d6'
  }
  // Só a primeira soqueira conta: o bônus é do ataque desarmado, não por unidade carregada.
  const knuckleUid = draft.equipmentChoices.find(uid => getEquipmentByInstance(uid)?.id === 'soqueira')
  const knuckleMods = knuckleUid ? (draft.equipmentModifications[knuckleUid] ?? []) : []
  const unarmedWeapon: OrdemWeapon = {
    id: 'desarmado', name: 'Desarmado', category: 0, spaces: 0, type: 'weapon',
    proficiency: 'simple', weaponCategory: 'corpo_a_corpo', grip: 'leve',
    damage, critical: 'x2', range: '-', damageType,
    // "Contam como armas ágeis": com Artista Marcial o desarmado pode usar Agilidade (p. 26/29).
    agile: isMartialArtist,
    flatDamageBonus: knuckleUid ? 1 : 0,
  }
  const attack = getOrdemWeaponAttack(unarmedWeapon, draft, knuckleMods)
  return {
    ...attack,
    name: 'Desarmado',
    notes: knuckleUid ? [...attack.notes, 'com Soqueira: +1 no dano e as modificações dela valem aqui'] : attack.notes,
  }
}
