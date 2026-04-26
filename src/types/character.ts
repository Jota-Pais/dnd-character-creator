import type { AbilityScore } from './race'

export type WizardStep = 'name' | 'race' | 'class' | 'abilities' | 'background' | 'equipment' | 'review'

export const WIZARD_STEPS: WizardStep[] = [
  'name',
  'race',
  'class',
  'abilities',
  'background',
  'equipment',
  'review',
]

export const STEP_LABELS: Record<WizardStep, string> = {
  name: 'Nome',
  race: 'Raça',
  class: 'Classe',
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

export type CharacterDraft = {
  name: string
  race: string | null
  subrace: string | null
  raceChoices: RaceChoiceSelections
}

export const EMPTY_DRAFT: CharacterDraft = {
  name: '',
  race: null,
  subrace: null,
  raceChoices: {},
}
