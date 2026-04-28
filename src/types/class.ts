import type { AbilityScore } from './race'

export type SpellcastingType = 'known' | 'prepared' | 'hybrid'

export type ClassSpellcasting = {
  ability: AbilityScore
  cantripsKnown: number
  type: SpellcastingType
  spellsAtLevel1: number
  preparedFormula: string | null
  ritualCasting: boolean
  focus: string
  castingStartsAtLevel: number
}

export type SubclassExtraChoices = {
  expertiseSkills: { count: number; from: string[] } | null
  skillChoice: { count: number; from: string[] } | null
  languages: { count: number } | null
  cantripChoice: string | null
  grantedLanguages: string[]
  grantedArmorProficiencies: string[]
  grantedWeaponProficiencies: string[]
}

export type ClassSubclass = {
  id: string
  name: string
  description: string
  features: { name: string; description: string }[]
  extras: SubclassExtraChoices | null
}

export type ClassToolProficiencies = {
  granted: string[]
  choices: { count: number; from: 'musical-instrument' | 'artisan' | 'any-tool' }[]
}

export type GameClass = {
  id: string
  name: string
  description: string
  primaryAbility: AbilityScore[]
  hitDie: number
  savingThrows: AbilityScore[]
  skillChoices: { count: number; from: string[] }
  toolProficiencies: ClassToolProficiencies
  isCaster: boolean
  spellcasting: ClassSpellcasting | null
  features: { name: string; description: string }[]
  subclassLevel: number
  subclasses: ClassSubclass[]
  hasFightingStyle: boolean
  hasExpertise: boolean
}

export type SubclassChoiceSelections = {
  skills?: string[]
  languages?: string[]
  cantrip?: string
}

export type ClassChoiceSelections = {
  skills: string[]
  subclass: string | null
  fightingStyle: string | null
  expertiseItems: string[]
  tools: string[]
  subclassExtras: SubclassChoiceSelections
}

export const EMPTY_CLASS_CHOICES: ClassChoiceSelections = {
  skills: [],
  subclass: null,
  fightingStyle: null,
  expertiseItems: [],
  tools: [],
  subclassExtras: {},
}
