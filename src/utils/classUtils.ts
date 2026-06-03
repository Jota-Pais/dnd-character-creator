import type { GameClass, ClassSubclass, ClassChoiceSelections } from '../types/class'
import { SKILLS } from './raceUtils'
import classesData from '../data/classes.json'

export const CLASSES: GameClass[] = classesData as GameClass[]

export type ClassPresentation = {
  emoji: string
  accent: string
}

export const CLASS_PRESENTATION: Record<string, ClassPresentation> = {
  barbarian: { emoji: '🪓', accent: '#c0392b' },
  bard:      { emoji: '🎶', accent: '#8e44ad' },
  warlock:   { emoji: '🌑', accent: '#7d3c98' },
  cleric:    { emoji: '⚜️', accent: '#b7770d' },
  druid:     { emoji: '🌿', accent: '#1e8449' },
  sorcerer:  { emoji: '✨', accent: '#2874a6' },
  fighter:   { emoji: '🛡️', accent: '#2e86c1' },
  rogue:     { emoji: '🗡️', accent: '#717d7e' },
  wizard:    { emoji: '📖', accent: '#1f618d' },
  monk:      { emoji: '👊', accent: '#d35400' },
  paladin:   { emoji: '🌟', accent: '#d4ac0d' },
  ranger:    { emoji: '🏹', accent: '#196f3d' },
}

export const FIGHTING_STYLES: { id: string; name: string; description: string }[] = [
  {
    id: 'archery',
    name: 'Arquearia',
    description: '+2 nas jogadas de ataque com armas de ataque à distância.',
  },
  {
    id: 'defense',
    name: 'Defesa',
    description: 'Enquanto vestindo armadura, ganhe +1 na CA.',
  },
  {
    id: 'dueling',
    name: 'Duelismo',
    description: 'Empunhando uma arma corpo a corpo numa mão e nenhuma outra arma, receba +2 de bônus de dano com ela.',
  },
  {
    id: 'great-weapon-fighting',
    name: 'Combate com Armas Grandes',
    description: 'Ao rolar 1 ou 2 no dado de dano de uma arma pesada empunhada com as duas mãos, role novamente.',
  },
  {
    id: 'protection',
    name: 'Proteção',
    description: 'Quando uma criatura atacar um aliado a 1,5 m, use sua reação para impor desvantagem. Requer escudo.',
  },
  {
    id: 'two-weapon-fighting',
    name: 'Combate com Duas Armas',
    description: 'Adicione seu modificador de habilidade ao dano da segunda arma no combate com duas armas.',
  },
]

export function getClass(id: string): GameClass | undefined {
  return CLASSES.find(c => c.id === id)
}

export function getSubclass(cls: GameClass, subclassId: string): ClassSubclass | undefined {
  return cls.subclasses.find(s => s.id === subclassId)
}

export function isActiveCaster(cls: GameClass, level = 1): boolean {
  return cls.isCaster && level >= (cls.spellcasting?.castingStartsAtLevel ?? 1)
}

export function getHpAtLevel1(cls: GameClass, conModifier: number): number {
  return cls.hitDie + conModifier
}

/** Average HP gain per level above 1 (floor(hitDie/2) + 1). */
export function getAverageHpPerLevel(cls: GameClass): number {
  return Math.floor(cls.hitDie / 2) + 1
}

/** Total HP using average rolls for all levels above 1. */
export function getAverageHpAtLevel(cls: GameClass, conModifier: number, level: number): number {
  const level1Hp = getHpAtLevel1(cls, conModifier)
  if (level <= 1) return level1Hp
  return level1Hp + (getAverageHpPerLevel(cls) + conModifier) * (level - 1)
}

/** Total HP using manual rolls for levels 2+. hpRolls[i] is the die roll for level i+2. */
export function getRolledHpAtLevel(
  cls: GameClass,
  conModifier: number,
  level: number,
  hpRolls: number[],
): number {
  const level1Hp = getHpAtLevel1(cls, conModifier)
  if (level <= 1) return level1Hp
  let total = level1Hp
  for (let lvl = 2; lvl <= level; lvl++) {
    const roll = hpRolls[lvl - 2]
    const gain = roll !== undefined ? roll : getAverageHpPerLevel(cls)
    total += gain + conModifier
  }
  return total
}

export function getHpFormula(cls: GameClass): string {
  return `d${cls.hitDie} + mod. de CON`
}

export function getSkillOptions(cls: GameClass): { id: string; name: string }[] {
  if (cls.skillChoices.from.includes('any')) {
    return SKILLS.map(s => ({ id: s.id, name: s.name }))
  }
  return SKILLS
    .filter(s => cls.skillChoices.from.includes(s.id))
    .map(s => ({ id: s.id, name: s.name }))
}

export function getExpertiseOptions(choices: ClassChoiceSelections): { id: string; name: string }[] {
  const skillLookup = Object.fromEntries(SKILLS.map(s => [s.id, s.name]))
  const fromSkills = choices.skills.map(id => ({ id, name: skillLookup[id] ?? id }))
  return [...fromSkills, { id: 'thieves-tools', name: 'Ferramentas de Ladrão' }]
}

export function isClassStepComplete(
  cls: GameClass | null,
  choices: ClassChoiceSelections,
  currentLevel = 1,
): boolean {
  if (!cls) return false

  if (choices.skills.length !== cls.skillChoices.count) return false

  const requiredTools = cls.toolProficiencies.choices.reduce((sum, c) => sum + c.count, 0)
  if (choices.tools.length < requiredTools) return false

  if (cls.hasFightingStyle && !choices.fightingStyle) return false

  if (cls.subclassLevel <= currentLevel) {
    if (!choices.subclass) return false
    const subclass = cls.subclasses.find(s => s.id === choices.subclass)
    if (subclass?.extras) {
      const { extras } = subclass
      const skillsNeeded = (extras.expertiseSkills?.count ?? 0) + (extras.skillChoice?.count ?? 0)
      if (skillsNeeded > 0 && (choices.subclassExtras.skills ?? []).length < skillsNeeded) return false
      if (extras.languages && (choices.subclassExtras.languages ?? []).length < extras.languages.count) return false
      if (extras.cantripChoice && !choices.subclassExtras.cantrip) return false
    }
  }

  if (cls.hasExpertise && choices.expertiseItems.length < 2) return false

  return true
}
