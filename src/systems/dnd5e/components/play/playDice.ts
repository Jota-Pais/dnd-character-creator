import { keptFaces, roll, type DieRoller, type RollRecord } from '../../../../core/dice'
import type { RollGuideEntry } from '../../utils/rollGuide'

/** Uma rolagem dos dados do app para uma jogada do guia. `natural` só no d20: o dado que valeu. */
export type GuideRoll = { record: RollRecord; natural: number | null }

/** Dá para rolar pelo app? Só jogada com dado (o dano fixo do golpe desarmado não tem o que rolar). */
export function canRollEntry(entry: RollGuideEntry): boolean {
  return entry.dice !== ''
}

/**
 * Rola a jogada pelo motor de `src/core/dice`, com a notação do guia (vantagem já vira `2d20kh1`).
 * `crit` usa os dados dobrados do acerto crítico (pág. 196), quando a jogada é de dano.
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
