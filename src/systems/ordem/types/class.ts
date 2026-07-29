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
  /**
   * Habilidade da classe. `scalingByNex` traz o patamar de cada degrau em texto curto, pra ficha
   * mostrar só o alcançado em vez da tabela inteira (ex.: Ataque Especial "3 PE para +10").
   */
  classAbility: {
    name: string
    description: string
    scalingByNex?: { nex: number; note: string }[]
  }
  /** Base da fórmula do Grau de Treinamento (NEX 35%/70%): quantidade = skillGradeCount + Intelecto. */
  skillGradeCount: number
}
