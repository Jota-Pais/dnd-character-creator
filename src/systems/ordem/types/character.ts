export type OrdemAttributes = {
  agility: number
  strength: number
  intellect: number
  presence: number
  vigor: number
}

export type WizardStep = 'name' | 'attributes' | 'origin' | 'class' | 'skills' | 'progression' | 'review'

export const WIZARD_STEPS: WizardStep[] = ['name', 'attributes', 'origin', 'class', 'skills', 'progression', 'review']

export const STEP_LABELS: Record<WizardStep, string> = {
  name: 'Nome',
  attributes: 'Atributos',
  origin: 'Origem',
  class: 'Classe',
  skills: 'Perícias',
  progression: 'Progressão',
  review: 'Revisão',
}

export type VersatilityChoice =
  | { kind: 'power'; powerId: string }
  | { kind: 'trilha'; trilhaId: string }

export type OrdemCharacterDraft = {
  name: string
  concept: string
  /** Nível de Exposição Paranormal — 5 a 99, em passos de 5 (exceto o último, 95→99). */
  nex: number
  attributes: OrdemAttributes
  origin: string | null
  /** Só usado quando a origem é "amnesiac" (2 perícias "à escolha do mestre") — o jogador escolhe no lugar do mestre. */
  originGmSkillChoices: string[]
  class: 'combatant' | 'specialist' | 'occultist' | null
  /** Uma perícia escolhida por grupo de escolha da classe, na mesma ordem de `OrdemClass.skills.choiceGroups`. */
  classChoiceGroupPicks: (string | null)[]
  /** Perícias de escolha livre da classe (quantidade = freeChoiceBase + Intelecto). */
  classFreeSkillChoices: string[]
  /** Trilha escolhida em NEX 10% (uma das 5 trilhas da classe). */
  trilha: string | null
  /** Poderes de classe escolhidos, um por slot alcançado (Tabela 1.3/1.4/1.5: NEX 15/30/45/60/75/90). */
  powerChoices: (string | null)[]
  /** Atributo aumentado em cada slot alcançado (NEX 20/50/80/95), teto 5. */
  attributeIncreaseChoices: (keyof OrdemAttributes | null)[]
  /** Um array de perícias por slot de Grau de Treinamento alcançado (NEX 35/70). */
  skillGradeChoices: string[][]
  /** Versatilidade (NEX 50%): poder de classe extra, ou 1º poder de uma trilha diferente da sua. */
  versatilityChoice: VersatilityChoice | null
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
  nex: 5,
  attributes: { ...EMPTY_ATTRIBUTES },
  origin: null,
  originGmSkillChoices: [],
  class: null,
  classChoiceGroupPicks: [],
  classFreeSkillChoices: [],
  trilha: null,
  powerChoices: [],
  attributeIncreaseChoices: [],
  skillGradeChoices: [],
  versatilityChoice: null,
}
