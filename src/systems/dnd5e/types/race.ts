import type { FeatureEffects } from './effects'

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

/**
 * Magia inata concedida pela raça (ex.: Magia Drow, Legado Infernal do tiefling). Truque é à
 * vontade; as de 1º nível ou mais, uma vez cada por descanso longo (p. 24 e 43).
 */
export type InnateSpell = {
  spellId: string
  minLevel: number       // nível de personagem em que a magia passa a poder ser conjurada
  ability: AbilityScore  // atributo de conjuração
  /** Nível em que o traço a conjura, quando o livro fixa um (repreensão infernal "como uma magia de 2° nível", p. 43). */
  castLevel?: number
}

/**
 * Efeitos que um traço racial declara. Por ora os recursos (Arma de Sopro, Resistência
 * Implacável), os PV por nível (Tenacidade Anã) e o deslocamento que a armadura pesada não reduz
 * (anão): são os únicos efeitos de traço que `sheetEffects` agrega — os outros entram aqui quando
 * forem ligados, pra não declarar no dado algo que a ficha ignoraria.
 */
export type RacialTraitEffects = Pick<FeatureEffects, 'resources' | 'hpPerLevel'> & {
  /**
   * "Seu deslocamento não é reduzido quando estiver usando armadura pesada" (anão, p. 20): anula
   * os 3 m que a armadura pesada tira de quem não tem a Força da tabela (p. 146).
   */
  heavyArmorSpeedUnreduced?: boolean
}

export type RacialTrait = {
  name: string
  description: string
  /**
   * Escolha da raça/sub-raça que este traço abre (ex.: o Idioma Adicional do alto elfo abre a
   * escolha 'language'). Liga o texto do livro ao que o jogador escolheu, para a ficha dizer
   * "Escolha: Dracônico" ao lado do traço. Toda escolha da raça tem um traço com este campo.
   */
  choice?: RaceChoice['kind']
  /** Efeitos que a ficha calcula sozinha (ver `sheetEffects`). Ausente = só descritivo. */
  effects?: RacialTraitEffects
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
