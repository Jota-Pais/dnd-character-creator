export type OrdemAttributes = {
  agility: number
  strength: number
  intellect: number
  presence: number
  vigor: number
}

export type WizardStep = 'name' | 'attributes' | 'origin' | 'class' | 'skills' | 'review'

export const WIZARD_STEPS: WizardStep[] = ['name', 'attributes', 'origin', 'class', 'skills', 'review']

export const STEP_LABELS: Record<WizardStep, string> = {
  name: 'Nome',
  attributes: 'Atributos',
  origin: 'Origem',
  class: 'Classe',
  skills: 'Perícias',
  review: 'Revisão',
}

export type OrdemCharacterDraft = {
  name: string
  concept: string
  attributes: OrdemAttributes
  origin: string | null
  /** Só usado quando a origem é "amnesiac" (2 perícias "à escolha do mestre") — o jogador escolhe no lugar do mestre. */
  originGmSkillChoices: string[]
  class: 'combatant' | 'specialist' | 'occultist' | null
  /** Uma perícia escolhida por grupo de escolha da classe, na mesma ordem de `OrdemClass.skills.choiceGroups`. */
  classChoiceGroupPicks: (string | null)[]
  /** Perícias de escolha livre da classe (quantidade = freeChoiceBase + Intelecto). */
  classFreeSkillChoices: string[]
}

export const EMPTY_ATTRIBUTES: OrdemAttributes = {
  agility: 1,
  strength: 1,
  intellect: 1,
  presence: 1,
  vigor: 1,
}

export const EMPTY_DRAFT: OrdemCharacterDraft = {
  name: '',
  concept: '',
  attributes: { ...EMPTY_ATTRIBUTES },
  origin: null,
  originGmSkillChoices: [],
  class: null,
  classChoiceGroupPicks: [],
  classFreeSkillChoices: [],
}
