export type AttributeId = 'agility' | 'strength' | 'intellect' | 'presence' | 'vigor'

export type Attribute = {
  id: AttributeId
  name: string
  description: string
}

export const ATTRIBUTE_IDS: AttributeId[] = ['agility', 'strength', 'intellect', 'presence', 'vigor']
