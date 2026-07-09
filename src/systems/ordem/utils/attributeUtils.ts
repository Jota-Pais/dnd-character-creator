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

export function isValidAttributes(attributes: OrdemAttributes): boolean {
  const values = Object.values(attributes)
  const allInRange = values.every(v => v >= ATTRIBUTE_MIN && v <= ATTRIBUTE_MAX)
  const zeroedCount = values.filter(v => v === 0).length
  return allInRange && zeroedCount <= 1 && getAttributeSum(attributes) === ATTRIBUTE_POINTS_TOTAL
}
