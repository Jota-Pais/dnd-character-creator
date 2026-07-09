export type OrdemClassId = 'combatant' | 'specialist' | 'occultist'

export type SkillChoiceGroup = {
  count: number
  from: string[]
}

export type OrdemClass = {
  id: OrdemClassId
  name: string
  description: string
  hp: {
    initialFlat: number
    perNexFlat: number
  }
  pe: {
    initialFlat: number
    perNexFlat: number
  }
  sanity: {
    initialFlat: number
    perNex: number
  }
  skills: {
    fixed: string[]
    choiceGroups: SkillChoiceGroup[]
    freeChoiceBase: number
  }
  weaponProficiencies: ('simple' | 'tactical' | 'heavy')[]
  armorProficiencies: ('light' | 'heavy')[]
}
