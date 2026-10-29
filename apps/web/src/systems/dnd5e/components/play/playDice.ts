import { keptFaces, roll, type DieRoller, type RollRecord } from '@rpg/rules/core/dice'
import { formatGuideFormula, formatGuideNotation, type RollGuideEntry } from '@rpg/rules/systems/dnd5e/utils/rollGuide'
import { normalizeMinus } from './hpEntry'

/** Uma rolagem dos dados do app para uma jogada do guia. `natural` só no d20: o dado que valeu. */
export type GuideRoll = { record: RollRecord; natural: number | null }

/** Dá para rolar pelo app? Só jogada com dado (o dano fixo do golpe desarmado não tem o que rolar). */
export function canRollEntry(entry: RollGuideEntry): boolean {
  return entry.dice !== ''
}

/**
 * Rola a jogada pelo motor de `src/core/dice`, com a notação do guia (vantagem já vira `2d20kh1`).
 * `crit` usa os dados dobrados do acerto crítico (pág. 198), quando a jogada é de dano.
 */
export function rollGuideEntry(
  entry: RollGuideEntry,
  options: { crit?: boolean; roller?: DieRoller; at?: number } = {},
): GuideRoll {
  const crit = options.crit && entry.crit ? entry.crit : null
  const record = roll(crit ? crit.notation : entry.notation, {
    label: crit ? `${entry.label} (crítico)` : entry.label,
    ...(options.roller ? { roller: options.roller } : {}),
    ...(options.at !== undefined ? { at: options.at } : {}),
  })
  const first = record.terms[0]
  const natural = entry.kind === 'd20' && first ? keptFaces(first)[0] ?? null : null
  return { record, natural }
}

/** Os dados do rolador livre, na ordem da tela. */
export const FREE_ROLL_DICE = [4, 6, 8, 10, 12, 20, 100] as const

/** Teto (para mais e para menos) do modificador do rolador livre: cobre qualquer bônus da ficha. */
export const FREE_ROLL_MAX_MODIFIER = 99

/** Uma rolagem do rolador livre: quantos dados, de quantos lados, e o que somar. */
export type FreeRoll = { count: number; sides: number; modifier: number }

/**
 * Lê um inteiro digitado no rolador livre ("3", "-2", "+1"; o menos é o do campo de PV,
 * `normalizeMinus`), preso entre `min` e `max`. Vazio ou texto que não é número dá `fallback`.
 */
export function readFreeRollNumber(text: string, min: number, max: number, fallback: number): number {
  const trimmed = normalizeMinus(text.trim())
  if (!/^[+-]?\d+$/.test(trimmed)) return fallback
  return Math.min(max, Math.max(min, Number(trimmed)))
}

/** "2d6 + 3": a fórmula do rolador livre, escrita como as receitas. */
export function formatFreeRoll({ count, sides, modifier }: FreeRoll): string {
  return formatGuideFormula(`${count}d${sides}`, modifier)
}

/**
 * Rola pelo motor a rolagem livre, que vai ao histórico como "Rolagem livre: 2d6 + 3". Só um d20
 * sozinho tem `natural` (o destaque do 20 e do 1); a rolagem livre não é jogada de regra nenhuma.
 */
export function rollFree(free: FreeRoll, options: { roller?: DieRoller; at?: number } = {}): GuideRoll {
  const record = roll(formatGuideNotation(`${free.count}d${free.sides}`, free.modifier), {
    label: `Rolagem livre: ${formatFreeRoll(free)}`,
    ...(options.roller ? { roller: options.roller } : {}),
    ...(options.at !== undefined ? { at: options.at } : {}),
  })
  const natural = free.count === 1 && free.sides === 20 ? record.terms[0]?.dice[0]?.value ?? null : null
  return { record, natural }
}

/** "1d20 + 5, com vantagem": a fórmula da jogada que foi rolada, com o modo, para o texto copiado. */
export function describeRolledFormula(entry: RollGuideEntry, crit = false): string {
  const formula = crit && entry.crit ? entry.crit.formula : entry.formula
  if (entry.mode === 'advantage') return `${formula}, com vantagem`
  if (entry.mode === 'disadvantage') return `${formula}, com desvantagem`
  return formula
}

/**
 * O texto do "Copiar resultado": rótulo, total, fórmula e faces, com o d20 descartado dito por
 * extenso — "Atletismo: 17 (1d20 + 5, com vantagem; dados: 12, 4 descartado)". Texto puro, sem
 * marcação, para colar em qualquer conversa.
 */
export function formatRollCopyText({ label, formula, record }: { label: string; formula: string; record: RollRecord }): string {
  const faces = record.terms.flatMap(t => t.dice).map(d => (d.kept ? String(d.value) : `${d.value} descartado`))
  return `${label}: ${record.total} (${formula}; dados: ${faces.join(', ')})`
}

/**
 * Joga de novo o 1 natural de uma rolagem d20 (Sortudo, pág. 28): um d20 só, no lugar do dado que
 * saiu 1. Com vantagem ou desvantagem, o outro dado do par fica e vale o maior/menor dos dois
 * (pág. 175) — "só um dos dois dados". A nova rolagem vai para o histórico como registro próprio;
 * `natural` é o d20 que vale agora.
 */
export function rerollNaturalOne(
  entry: RollGuideEntry,
  previous: GuideRoll,
  options: { roller?: DieRoller; at?: number; source?: string } = {},
): GuideRoll {
  const record = roll('1d20', {
    label: `${entry.label} — de novo${options.source ? ` (${options.source})` : ''}`,
    ...(options.roller ? { roller: options.roller } : {}),
    ...(options.at !== undefined ? { at: options.at } : {}),
  })
  const face = record.terms[0]?.dice[0]?.value ?? null
  const dice = previous.record.terms[0]?.dice ?? []
  const one = dice.findIndex(d => d.kept && d.value === 1)
  const others = dice.filter((_, i) => i !== one).map(d => d.value)
  if (face === null || others.length === 0 || entry.mode === 'normal') return { record, natural: face }
  const natural = entry.mode === 'advantage' ? Math.max(face, ...others) : Math.min(face, ...others)
  return { record, natural }
}
