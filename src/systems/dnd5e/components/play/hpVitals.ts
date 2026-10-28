import type { HitDiceAvailability } from '../../utils/playState'

/**
 * PV baixo: PV atual acima de 0 e até esta fração do máximo efetivo. Decisão de produto do ciclo
 * de 2026-10-28 (aviso visual, não regra do livro); a 0 PV quem assume são os testes contra a morte.
 */
export const LOW_HP_FRACTION = 1 / 4

/** Da metade do máximo efetivo para baixo (e acima do PV baixo), a barra fica âmbar. */
export const WOUNDED_HP_FRACTION = 1 / 2

/** A faixa da barra de PV: cheia de saúde, ferida, PV baixo, ou a 0 PV. */
export type HpBand = 'healthy' | 'wounded' | 'low' | 'zero'

/** A faixa do PV atual sobre o máximo efetivo (`getEffectiveMaxHp`). */
export function getHpBand(current: number, max: number): HpBand {
  if (current <= 0 || max <= 0) return 'zero'
  if (current <= max * LOW_HP_FRACTION) return 'low'
  if (current <= max * WOUNDED_HP_FRACTION) return 'wounded'
  return 'healthy'
}

/** Quanto da barra está cheio, de 0 a 100. */
export function getHpBarPercent(current: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, (current / max) * 100))
}

/** Os Dados de Vida que ainda dá para gastar, um por tipo, como a ficha escreve: "1d12", "2d8". */
export function formatHitDiceAvailable(hitDice: HitDiceAvailability[]): string[] {
  return hitDice.map(h => `${h.available}d${h.die}`)
}

/** O mesmo resumo por extenso, para o nome acessível: "1 de 1 d12", "2 de 3 d8 e 0 de 2 d6". */
export function describeHitDiceAvailable(hitDice: HitDiceAvailability[]): string {
  const parts = hitDice.map(h => `${h.available} de ${h.total} d${h.die}`)
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}` : parts.join('')
}
