import type { CharacterDraft } from '../types/character'

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
  },
  spellChoices: { cantrips: [], spells: [] },
  abilityMethod: 'standard-array',
  abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
  rolledValues: [],
  background: 'sailor',
  backgroundChoices: {},
  equipment: { method: 'wealth', classResolutions: [], rolledGold: 50, purchasedItems: [] },
  hpMethod: 'average',
  hpRolls: [],
}
