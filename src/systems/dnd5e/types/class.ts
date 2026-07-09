import type { AbilityScore } from './race'
import type { ClassStartingEquipment } from './equipment'

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

export type ClassFeature = { name: string; description: string }

/** Feature ganha em um nível específico (progressão 1–20). */
export type LevelFeature = ClassFeature & { level: number }

export type ClassSubclass = {
  id: string
  name: string
  description: string
  features: ClassFeature[]
  /** Features da subclasse por nível (2–20). Preenchido na fase 3 do roadmap. */
  featuresByLevel?: LevelFeature[]
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
  features: ClassFeature[]
  /** Features da classe por nível (1–20). Preenchido na fase 3 do roadmap. */
  featuresByLevel?: LevelFeature[]
  subclassLevel: number
  subclasses: ClassSubclass[]
  hasFightingStyle: boolean
  hasExpertise: boolean
  startingEquipment: ClassStartingEquipment
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
  progressionChoices: Record<string, string[]>
}

export const EMPTY_CLASS_CHOICES: ClassChoiceSelections = {
  skills: [],
  subclass: null,
  fightingStyle: null,
  expertiseItems: [],
  tools: [],
  subclassExtras: {},
  progressionChoices: {},
}
