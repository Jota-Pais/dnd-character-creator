import type { CharacterDraft } from '../systems/dnd5e/types/character'

// Ficha completa sem escolhas pendentes além das perícias de classe:
// meio-orc (sem sub-raça/choices) + bárbaro (só 2 perícias) + marinheiro (sem choices)
export const COMPLETE_DRAFT: CharacterDraft = {
  name: 'Krusk',
  level: 1,
  race: 'half-orc',
  subrace: null,
  raceChoices: {},
  class: 'barbarian',
  classChoices: {
    skills: ['athletics', 'intimidation'],
    subclass: null,
    fightingStyle: null,
    expertiseItems: [],
    tools: [],
    subclassExtras: {},
    progressionChoices: {},
  },
  spellChoices: { cantrips: [], spells: [] },
  additionalClasses: [],
  multiclass: false,
  abilityMethod: 'standard-array',
  abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
  rolledValues: [],
  asiChoices: [],
  background: 'sailor',
  backgroundChoices: {},
  equipment: { method: 'wealth', classResolutions: [], rolledGold: 50, purchasedItems: [] },
  hpMethod: 'average',
  hpRolls: [],
}
