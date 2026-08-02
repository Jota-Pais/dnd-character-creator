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

/** Siglas dos atributos, como aparecem na ficha. */
export const ATTRIBUTE_ABBREV: Record<AttributeId, string> = {
  agility: 'AGI',
  strength: 'FOR',
  intellect: 'INT',
  presence: 'PRE',
  vigor: 'VIG',
}

/** Quantos d20 se rola num teste. Vale sempre o MELHOR — a ficha nunca pede o pior. */
export type DicePool = { dice: number }

/** Penalidade em dados por usar item sem proficiência (–ØØ, p. 56 e 62). */
export const NO_PROFICIENCY_DICE_PENALTY = 2

/**
 * Pool de d20 de um teste: 1 dado por ponto do atributo, menos as penalidades em DADOS que valem
 * pro teste (`dicePenalty`, sempre positiva: arma/proteção sem proficiência, condições). Piso em
 * 0 — o pool nunca fica negativo.
 *
 * **As duas exceções de "role e pegue o pior" do livro ficaram de fora**, por decisão de produto
 * do usuário (2026-08-02): atributo 0 rolaria 2d20 pelo pior (p. 16), e penalidade que derruba o
 * pool abaixo de 1 rolaria como se fosse bônus, pelo pior (p. 13). Nos dois casos a ficha mostra
 * só o número — `0 AGI`. Ver `docs/ordem-auditoria-regras.md` (F8). **Não reimplementar sem
 * pedido:** já foi implementado uma vez e revertido.
 */
export function getDicePool(attributeValue: number, dicePenalty = 0): DicePool {
  return { dice: Math.max(0, attributeValue - dicePenalty) }
}

/** Rótulo do pool pra ficha: "3d20". */
export function formatDicePool(pool: DicePool): string {
  return `${pool.dice}d20`
}

export function isValidAttributes(attributes: OrdemAttributes): boolean {
  const values = Object.values(attributes)
  const allInRange = values.every(v => v >= ATTRIBUTE_MIN && v <= ATTRIBUTE_MAX)
  const zeroedCount = values.filter(v => v === 0).length
  return allInRange && zeroedCount <= 1 && getAttributeSum(attributes) === ATTRIBUTE_POINTS_TOTAL
}
