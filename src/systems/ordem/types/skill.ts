import type { AttributeId } from './attribute'

export type Skill = {
  id: string
  name: string
  attribute: AttributeId
  trainedOnly: boolean
  loadPenalty: boolean
}
