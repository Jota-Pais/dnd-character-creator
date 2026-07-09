import type { Attribute, AttributeId } from '../types/attribute'
import attributesData from '../data/attributes.json'

export const ATTRIBUTES: Attribute[] = attributesData as Attribute[]

export function getAttribute(id: AttributeId): Attribute | undefined {
  return ATTRIBUTES.find(a => a.id === id)
}
