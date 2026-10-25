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
