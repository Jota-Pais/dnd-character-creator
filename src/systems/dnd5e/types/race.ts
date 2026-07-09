export type AbilityScore = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
export type Size = 'Small' | 'Medium' | 'Large'

export type AbilityBonus = {
  ability: AbilityScore
  value: number
}

export type AbilityChoice = {
  kind: 'ability'
  count: number
  from: AbilityScore[] | 'any' | 'any-except-charisma'
  value: number
}

export type SkillChoice = {
  kind: 'skill'
  count: number
  from: string[] | 'any'
}

export type LanguageChoice = {
  kind: 'language'
  count: number
  from: string[] | 'any'
}

export type ToolChoice = {
  kind: 'tool'
  count: number
  from: string[]
}

export type CantripChoice = {
  kind: 'cantrip'
  count: number
  from: 'wizard-list' | string[]
  spellcastingAbility: AbilityScore
}

export type FeatChoice = {
  kind: 'feat'
  count: number
}

export type RaceChoice =
  | AbilityChoice
  | SkillChoice
  | LanguageChoice
  | ToolChoice
  | CantripChoice
  | FeatChoice

export type GrantedProficiency =
  | { type: 'weapon'; value: string }
  | { type: 'armor'; value: string }
  | { type: 'skill'; value: string }
  | { type: 'tool'; value: string }

/** Magia inata concedida pela raça (ex.: Magia Drow, Legado Infernal do tiefling). */
export type InnateSpell = {
  spellId: string
  minLevel: number       // nível de personagem em que a magia passa a poder ser conjurada
  ability: AbilityScore  // atributo de conjuração
}

export type RacialTrait = {
  name: string
  description: string
}

export type SubraceOverrides = {
  speed?: number
  darkvision?: number
  replacesParentTraits?: boolean
}

export type Subrace = {
  id: string
  name: string
  description: string
  abilityBonuses: AbilityBonus[]
  choices: RaceChoice[]
  grantedProficiencies: GrantedProficiency[]
  innateSpells?: InnateSpell[]
  traits: RacialTrait[]
  overrides: SubraceOverrides
}

export type Race = {
  id: string
  name: string
  description: string
  abilityBonuses: AbilityBonus[]
  choices: RaceChoice[]
  age: string
  size: Size
  speed: number
  darkvision: number
  grantedLanguages: string[]
  grantedProficiencies: GrantedProficiency[]
  innateSpells?: InnateSpell[]
  traits: RacialTrait[]
  subraces: Subrace[]
}
