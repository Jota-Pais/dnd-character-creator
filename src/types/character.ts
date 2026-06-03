import type { AbilityScore } from './race'
import type { ClassChoiceSelections } from './class'
import type { BackgroundChoiceSelections } from './background'
import { type EquipmentDraft, EMPTY_EQUIPMENT_DRAFT } from './equipment'
import { type SpellChoices, EMPTY_SPELL_CHOICES } from './spell'
export type { ClassChoiceSelections, BackgroundChoiceSelections, EquipmentDraft, SpellChoices }

export type WizardStep = 'name' | 'race' | 'class' | 'spells' | 'abilities' | 'background' | 'equipment' | 'review'

export type AbilityMethod = 'standard-array' | 'point-buy' | 'roll'

export type BaseAbilityScores = Record<AbilityScore, number | null>

export const WIZARD_STEPS: WizardStep[] = [
  'name',
  'race',
  'class',
  'abilities',
  'spells',
  'background',
  'equipment',
  'review',
]

export const STEP_LABELS: Record<WizardStep, string> = {
  name: 'Nome',
  race: 'Raça',
  class: 'Classe',
  spells: 'Magias',
  abilities: 'Atributos',
  background: 'Antecedente',
  equipment: 'Equipamento',
  review: 'Revisão',
}

export type RaceChoiceSelections = {
  abilityBonuses?: AbilityScore[]
  skills?: string[]
  languages?: string[]
  tools?: string[]
  cantrip?: string
  feat?: string
}

export type HpMethod = 'average' | 'roll'

export type CharacterDraft = {
  name: string
  level: number
  race: string | null
  subrace: string | null
  raceChoices: RaceChoiceSelections
  class: string | null
  classChoices: ClassChoiceSelections
  spellChoices: SpellChoices
  abilityMethod: AbilityMethod | null
  abilityScores: BaseAbilityScores
  rolledValues: number[]
  background: string | null
  backgroundChoices: BackgroundChoiceSelections
  equipment: EquipmentDraft
  hpMethod: HpMethod
  hpRolls: number[]
}

export const EMPTY_DRAFT: CharacterDraft = {
  name: '',
  level: 1,
  race: null,
  subrace: null,
  raceChoices: {},
  class: null,
  classChoices: {
    skills: [],
    subclass: null,
    fightingStyle: null,
    expertiseItems: [],
    tools: [],
    subclassExtras: {},
  },
  spellChoices: { ...EMPTY_SPELL_CHOICES },
  abilityMethod: null,
  abilityScores: { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null },
  rolledValues: [],
  background: null,
  backgroundChoices: {},
  equipment: EMPTY_EQUIPMENT_DRAFT,
  hpMethod: 'average',
  hpRolls: [],
}
