import type { Attribute, AttributeId } from '../types/attribute'
import type { OrdemAttributes } from '../types/character'
import attributesData from '../data/attributes.json'

export const ATTRIBUTES: Attribute[] = attributesData as Attribute[]

export function getAttribute(id: AttributeId): Attribute | undefined {
  return ATTRIBUTES.find(a => a.id === id)
}

/** Todos começam em 1 (soma 5) + 4 pontos pra distribuir = soma final sempre 9, mesmo zerando um atributo (zerar "devolve" 1 ponto extra, então o total não muda). */
export const ATTRIBUTE_POINTS_TOTAL = 9
export const ATTRIBUTE_MAX = 3
export const ATTRIBUTE_MIN = 0

export function getAttributeSum(attributes: OrdemAttributes): number {
  return attributes.agility + attributes.strength + attributes.intellect + attributes.presence + attributes.vigor
}

/** Quantos d20 se rola e se vale o melhor ou o pior resultado. */
export type DicePool = { dice: number; mode: 'best' | 'worst' }

/** Penalidade em dados por usar item sem proficiência (–ØØ, p. 56 e 62). */
export const NO_PROFICIENCY_DICE_PENALTY = 2

/**
 * Pool de d20 de um teste: 1 dado por ponto do atributo, pegando o MELHOR. Duas exceções do livro,
 * ambas resolvidas com "role e pegue o PIOR":
 *
 * - **Atributo 0** (p. 16): "rola dois dados em testes daquele atributo, mas usa o pior resultado".
 * - **Penalidade que derruba o pool abaixo de 1 dado** (p. 13): "role a quantidade de dados que
 *   rolaria se essa penalidade fosse um bônus, mas escolha o pior valor" — ex.: Agilidade 2 com
 *   –ØØ rola 4d20 e pega o pior.
 *
 * `dicePenalty` é a soma das penalidades em DADOS que valem para o teste (arma/proteção sem
 *  proficiência), sempre positiva.
 */
export function getDicePool(attributeValue: number, dicePenalty = 0): DicePool {
  const net = attributeValue - dicePenalty
  if (net >= 1) return { dice: net, mode: 'best' }
  // Sem penalidade, só o atributo 0 chega aqui.
  if (dicePenalty === 0) return { dice: 2, mode: 'worst' }
  return { dice: Math.max(2, attributeValue + dicePenalty), mode: 'worst' }
}

/** Rótulo do pool pra ficha: "3d20" (melhor) ou "4d20 pior" (quando vale o pior resultado). */
export function formatDicePool(pool: DicePool): string {
  return pool.mode === 'worst' ? `${pool.dice}d20 pior` : `${pool.dice}d20`
}

export function isValidAttributes(attributes: OrdemAttributes): boolean {
  const values = Object.values(attributes)
  const allInRange = values.every(v => v >= ATTRIBUTE_MIN && v <= ATTRIBUTE_MAX)
  const zeroedCount = values.filter(v => v === 0).length
  return allInRange && zeroedCount <= 1 && getAttributeSum(attributes) === ATTRIBUTE_POINTS_TOTAL
}
