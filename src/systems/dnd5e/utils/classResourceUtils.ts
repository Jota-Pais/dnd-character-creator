import type { AbilityScore } from '../types/race'
import type {
  LevelStep, ResourceAmountUnit, ResourceEffect, ResourceQuantity, ResourceRecharge, ResourceUnit,
} from '../types/effects'
import { calculateModifier } from './abilityScoreUtils'

/**
 * Recursos da ficha: a CONTA e o TEXTO de um recurso declarado nos dados (`effects.resources` nas
 * features de classe de `class-progression-features.json`, nos talentos de `feats.json` e nos
 * traços de `races.json`). Quem junta os recursos do personagem é `getSheetResources`, em
 * `sheetEffects` — aqui fica só o que é puro: avaliar uma declaração num nível com os atributos
 * finais, e escrever o resultado do jeito que a Revisão e a ficha imprimível mostram (as duas leem
 * `describeResource`, pra não divergirem).
 */

export type FinalScores = Record<AbilityScore, number>

/** Valor do degrau alcançado no nível dado; `undefined` antes do primeiro degrau. */
export function stepValue<T>(steps: LevelStep<T>[], level: number): T | undefined {
  let value: T | undefined
  for (const step of [...steps].sort((a, b) => a.from - b.from)) {
    if (step.from <= level) value = step.value
  }
  return value
}

/**
 * Avalia uma quantidade declarada: soma das parcelas presentes, depois o mínimo. `level` é o nível
 * na classe dona (feature de classe) ou o de personagem (traço racial, talento).
 */
export function evaluateQuantity(
  q: ResourceQuantity,
  level: number,
  scores: FinalScores,
  proficiencyBonus = 0,
): number {
  if (typeof q === 'number') return q
  let total = 0
  if (q.byLevel) total += stepValue(q.byLevel, level) ?? 0
  if (q.perClassLevel) total += q.perClassLevel * level
  if (q.halfClassLevel) {
    total += q.halfClassLevel === 'up' ? Math.ceil(level / 2) : Math.floor(level / 2)
  }
  if (q.ability) total += calculateModifier(scores[q.ability])
  if (q.proficiency) total += proficiencyBonus
  if (q.plus) total += q.plus
  return q.min !== undefined ? Math.max(q.min, total) : total
}

/**
 * De onde o recurso vem — é o cabeçalho do bloco na ficha. `name` já vem resolvido ("Bardo",
 * "Sortudo", "Draconato Vermelho") pra o texto não precisar consultar catálogo.
 */
export type ResourceSource = {
  kind: 'class' | 'feat' | 'race'
  id: string
  name: string
}

/** Um recurso já calculado para o personagem. */
export type SheetResource = {
  id: string
  name: string
  /** Quem dá o recurso (e, se for classe, cujo nível alimentou a conta). */
  source: ResourceSource
  /** "d6", "3d6", "1d10+5". */
  die?: string
  uses?: number | 'unlimited'
  unit: ResourceUnit
  amount?: { value: number; unit: ResourceAmountUnit }
  recharge?: ResourceRecharge
  note?: string
  /**
   * Outras fontes que também dão este recurso. O livro não soma os usos (p. 166) — fica o maior,
   * e a ficha avisa que é um poço só.
   */
  sharedWith: ResourceSource[]
  /**
   * Fontes cujos usos FORAM somados a este (`addsToExisting`): o dado a mais do Adepto Marcial no
   * poço do Mestre de Batalha. A ficha diz de onde veio a parcela.
   */
  addedFrom: { source: ResourceSource; uses: number }[]
}

/**
 * Calcula uma declaração de recurso no nível que conta para ela: o nível NA classe dona (feature
 * de classe) ou o de personagem (traço racial, talento). `proficiencyBonus` é o do personagem.
 */
export function evaluateResource(
  effect: ResourceEffect,
  source: ResourceSource,
  level: number,
  scores: FinalScores,
  proficiencyBonus = 0,
): SheetResource {
  const q = (v: ResourceQuantity) => evaluateQuantity(v, level, scores, proficiencyBonus)

  let die: string | undefined
  if (effect.die) {
    const size = q(effect.die.size)
    const count = effect.die.count !== undefined ? q(effect.die.count) : undefined
    const bonus = effect.die.bonus !== undefined ? q(effect.die.bonus) : 0
    die = `${count ?? ''}d${size}${bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : ''}`
  }

  const unlimited = effect.unlimitedFrom !== undefined && level >= effect.unlimitedFrom
  const recharge = typeof effect.recharge === 'string'
    ? effect.recharge
    : effect.recharge ? stepValue(effect.recharge, level) : undefined

  return {
    id: effect.id,
    name: effect.name,
    source,
    ...(die ? { die } : {}),
    // Usos nunca ficam negativos: Sentido Divino (1 + CAR, sem mínimo no livro) com CAR 6 dá 0, não −1.
    ...(unlimited
      ? { uses: 'unlimited' as const }
      : effect.uses !== undefined ? { uses: Math.max(0, q(effect.uses)) } : {}),
    unit: effect.unit ?? 'uses',
    ...(effect.amount ? { amount: { value: q(effect.amount.value), unit: effect.amount.unit } } : {}),
    ...(recharge && !unlimited ? { recharge } : {}),
    ...(effect.note ? { note: effect.note } : {}),
    sharedWith: [],
    addedFrom: [],
  }
}

// ── Texto ──────────────────────────────────────────────────────────────────────

/** Como a ficha mostra um recurso. Os pedaços vazios ficam de fora. */
export type ResourceDisplay = {
  name: string
  /** "d6", "3d6". */
  die?: string
  /** A grandeza que não se gasta: "+2", "+3 m", "cura 18 PV", "até 2 níveis de espaço", "CD 13". */
  amount?: string
  /** Os usos: "4 usos", "20 PV", "5 pontos", "usos ilimitados". */
  quantity?: string
  /**
   * Como marcar na mesa: N círculos (○), uma linha "___ restantes" (poço grande ou de PV) ou nada
   * (recurso que é só dado, ou ilimitado).
   */
  track: { kind: 'circles'; count: number } | { kind: 'remaining' } | null
  /** "recupera em descanso longo". */
  recharge?: string
  notes: string[]
}

/** Acima disso, círculos viram linha de "restantes" — 20 bolinhas não cabem nem ajudam. */
const MAX_CIRCLES = 12

const UNIT_LABEL: Record<Exclude<ResourceUnit, 'hp'>, [string, string]> = {
  uses: ['uso', 'usos'],
  points: ['ponto', 'pontos'],
  dice: ['dado', 'dados'],
}

const RECHARGE_LABEL: Record<ResourceRecharge, string> = {
  short: 'recupera em descanso curto ou longo',
  long: 'recupera em descanso longo',
  day: 'uma vez por dia',
}

function formatFeet(ft: number): string {
  const m = ft * 0.3
  return Number.isInteger(m) ? `+${m} m` : `+${m.toFixed(1).replace('.', ',')} m`
}

function formatAmount(amount: NonNullable<SheetResource['amount']>): string {
  switch (amount.unit) {
    case 'bonus': return amount.value >= 0 ? `+${amount.value}` : `${amount.value}`
    case 'feet': return formatFeet(amount.value)
    case 'hp': return `cura ${amount.value} PV`
    case 'slotLevels':
      return `até ${amount.value} ${amount.value === 1 ? 'nível' : 'níveis'} de espaço`
    case 'saveDc': return `CD ${amount.value}`
  }
}

function formatCount(n: number, unit: ResourceUnit): string {
  if (unit === 'hp') return `${n} PV`
  const [one, many] = UNIT_LABEL[unit]
  return `${n} ${n === 1 ? one : many}`
}

/** Cabeçalho do bloco de recursos de uma fonte: "Bardo", "Sortudo (talento)", "Draconato Vermelho (raça)". */
export function resourceSourceLabel(source: ResourceSource): string {
  switch (source.kind) {
    case 'class': return source.name
    case 'feat': return `${source.name} (talento)`
    case 'race': return `${source.name} (raça)`
  }
}

export function describeResource(r: SheetResource): ResourceDisplay {
  let quantity: string | undefined
  let track: ResourceDisplay['track'] = null
  if (r.uses === 'unlimited') {
    quantity = 'usos ilimitados'
  } else if (r.uses !== undefined) {
    quantity = formatCount(r.uses, r.unit)
    // PV se gastam aos poucos (5 numa cura, 2 noutra): círculo não serve, só o que sobrou.
    if (r.unit === 'hp' || r.uses > MAX_CIRCLES) track = { kind: 'remaining' }
    else if (r.uses > 0) track = { kind: 'circles', count: r.uses }
  }

  const notes: string[] = []
  if (r.note) notes.push(r.note)
  for (const { source, uses } of r.addedFrom) {
    notes.push(`inclui ${formatCount(uses, r.unit)} de ${resourceSourceLabel(source)}`)
  }
  if (r.sharedWith.length > 0) {
    const names = r.sharedWith.map(s => s.name).join(', ')
    notes.push(`um só recurso com o de ${names} — os usos não se somam (p. 166)`)
  }

  return {
    name: r.name,
    ...(r.die ? { die: r.die } : {}),
    ...(r.amount ? { amount: formatAmount(r.amount) } : {}),
    ...(quantity ? { quantity } : {}),
    track,
    ...(r.recharge ? { recharge: RECHARGE_LABEL[r.recharge] } : {}),
    notes,
  }
}

/** Círculos vazios (○) pra marcar a lápis. */
export function formatTrackCircles(count: number): string {
  return Array(Math.max(0, count)).fill('○').join(' ')
}

/**
 * A linha do recurso na ficha imprimível, inteira:
 * "Inspiração de Bardo d6 — 4 usos ○ ○ ○ ○ (recupera em descanso longo)"
 * "Cura pelas Mãos — 20 PV, ___ restantes (recupera em descanso longo)"
 */
export function formatResourceLine(r: SheetResource): string {
  const d = describeResource(r)
  const head = d.die ? `${d.name} ${d.die}` : d.name
  let body = [d.amount, d.quantity].filter(Boolean).join(' · ')
  if (d.track?.kind === 'circles') body += ` ${formatTrackCircles(d.track.count)}`
  if (d.track?.kind === 'remaining') body += ', ___ restantes'
  const tail = [d.recharge, ...d.notes].filter(Boolean).join('; ')
  return `${head}${body ? ` — ${body}` : ''}${tail ? ` (${tail})` : ''}`
}

/**
 * Agrupa os recursos pela fonte (cada classe da multiclasse, a raça, cada talento), na ordem em
 * que aparecem — a ficha e a Revisão mostram um bloco por fonte, com o cabeçalho de
 * `resourceSourceLabel`.
 */
export function groupResourcesBySource(
  resources: SheetResource[],
): { source: ResourceSource; resources: SheetResource[] }[] {
  const groups: { source: ResourceSource; resources: SheetResource[] }[] = []
  for (const r of resources) {
    const g = groups.find(x => x.source.kind === r.source.kind && x.source.id === r.source.id)
    if (g) g.resources.push(r)
    else groups.push({ source: r.source, resources: [r] })
  }
  return groups
}

/**
 * Os blocos precisam de cabeçalho? Só quando há mais de uma fonte, ou a única não é a classe — um
 * bardo puro não precisa ler "Bardo" em cima da Inspiração, mas o Sortudo precisa dizer de onde vem.
 */
export function resourceGroupsNeedLabels(groups: { source: ResourceSource }[]): boolean {
  return groups.length > 1 || groups.some(g => g.source.kind !== 'class')
}
