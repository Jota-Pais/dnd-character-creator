import type { HitDiceAvailability } from '../../utils/playState'
import { countLabel } from '../../utils/textUtils'

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

/** Quanto tempo (ms) o número de PV fica vermelho ou verde depois de mudar. */
export const HP_FLASH_MS = 900

/** O retorno visual de uma mudança de PV: vermelho no dano, verde na cura. */
export type HpFlash = 'damage' | 'heal'

/**
 * O que o retorno compara entre um desenho e o seguinte. `longRestAt` é o `lastLongRestAt` do
 * estado: muda no descanso longo e no desfazer dele.
 */
export type HpReading = { current: number; tempHp: number; longRestAt?: number }

/**
 * Vermelho quando o PV cai, ou quando os PV temporários absorvem o golpe inteiro (o PV fica, mas o
 * dano veio); verde quando o PV sobe. Ganhar PV temporários não é cura: sem cor. O descanso longo
 * (ou o desfazer dele) só pisca verde: o que ele tira — os temporários, o ajuste do PV máximo — não
 * é dano.
 */
export function getHpFlash(before: HpReading, after: HpReading): HpFlash | null {
  if (after.current > before.current) return 'heal'
  if (after.longRestAt !== before.longRestAt) return null
  if (after.current < before.current) return 'damage'
  if (after.tempHp < before.tempHp) return 'damage'
  return null
}

/**
 * O PV por extenso que o leitor de tela ouve quando ele muda (a região viva dos vitais): "PV 9 de
 * 14", "PV 14 de 14, mais 5 temporários".
 */
export function describeHpForAnnouncement(current: number, max: number, tempHp: number): string {
  const temp = tempHp > 0 ? `, mais ${countLabel(tempHp, 'temporário', 'temporários')}` : ''
  return `PV ${current} de ${max}${temp}`
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
