export type SpellSchool =
  | 'abjuração'
  | 'adivinhação'
  | 'conjuração'
  | 'encantamento'
  | 'evocação'
  | 'ilusão'
  | 'necromancia'
  | 'transmutação'

export type SpellClass =
  | 'bard'
  | 'warlock'
  | 'cleric'
  | 'druid'
  | 'sorcerer'
  | 'wizard'
  | 'paladin'
  | 'ranger'

export type Spell = {
  id: string
  name: string
  level: number
  school: SpellSchool
  classes: SpellClass[]
  castingTime: string
  range: string
  components: string
  duration: string
  ritual: boolean
  concentration: boolean
  description: string
}

export type SpellChoices = {
  cantrips: string[]
  spells: string[]
}

export const EMPTY_SPELL_CHOICES: SpellChoices = {
  cantrips: [],
  spells: [],
}
