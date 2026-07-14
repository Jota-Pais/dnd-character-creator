import type { GameClass, ClassSubclass, ClassChoiceSelections, LevelFeature } from '../types/class'
import { SKILLS } from './raceUtils'
import classesData from '../data/classes.json'
import progressionFeatures from '../data/class-progression-features.json'
import { isProgressionChoicesComplete } from './progressionChoiceUtils'

const CLASS_FEATURES_BY_LEVEL = progressionFeatures.classes as Record<string, LevelFeature[]>
const SUBCLASS_FEATURES_BY_LEVEL = progressionFeatures.subclasses as Record<string, LevelFeature[]>

/** Uma classe tem tabela de features por nível digitada (fase 3)? */
export function hasFeaturesByLevel(classId: string): boolean {
  return Array.isArray(CLASS_FEATURES_BY_LEVEL[classId])
}

export const CLASSES: GameClass[] = classesData as GameClass[]

/** Papéis de combate, para o iniciante escolher pelo que quer fazer (não pelo jargão). */
export type RoleId = 'tank' | 'damage' | 'ranged' | 'caster' | 'support' | 'stealth'

export const ROLES: Record<RoleId, { label: string; emoji: string }> = {
  tank:    { label: 'Tanque',    emoji: '🛡️' },
  damage:  { label: 'Dano',      emoji: '⚔️' },
  ranged:  { label: 'Distância', emoji: '🏹' },
  caster:  { label: 'Mágico',    emoji: '✨' },
  support: { label: 'Suporte',   emoji: '🎭' },
  stealth: { label: 'Furtivo',   emoji: '🗡️' },
}

export type ClassPresentation = {
  emoji: string
  accent: string
  roles: RoleId[]
  beginnerFriendly?: boolean
  beginnerNote?: string
}

export const CLASS_PRESENTATION: Record<string, ClassPresentation> = {
  barbarian: { emoji: '🪓', accent: '#c0392b', roles: ['tank', 'damage'], beginnerFriendly: true, beginnerNote: 'Simples e durável: corre pra briga, aguenta dano e bate forte.' },
  bard:      { emoji: '🎶', accent: '#8e44ad', roles: ['support', 'caster'] },
  warlock:   { emoji: '🌑', accent: '#7d3c98', roles: ['caster'] },
  cleric:    { emoji: '⚜️', accent: '#b7770d', roles: ['support', 'caster'] },
  druid:     { emoji: '🌿', accent: '#1e8449', roles: ['caster', 'support'] },
  sorcerer:  { emoji: '✨', accent: '#2874a6', roles: ['caster'] },
  fighter:   { emoji: '🛡️', accent: '#2e86c1', roles: ['damage', 'tank'], beginnerFriendly: true, beginnerNote: 'O mais direto: ataca bem e aguenta porrada, sem magias para gerenciar.' },
  rogue:     { emoji: '🗡️', accent: '#717d7e', roles: ['stealth', 'damage'], beginnerFriendly: true, beginnerNote: 'Furtivo e certeiro; gira em torno de uma mecânica só (ataque furtivo).' },
  wizard:    { emoji: '📖', accent: '#1f618d', roles: ['caster'] },
  monk:      { emoji: '👊', accent: '#d35400', roles: ['damage'] },
  paladin:   { emoji: '🌟', accent: '#d4ac0d', roles: ['tank', 'support'], beginnerFriendly: true, beginnerNote: 'Resistente e versátil; no nível 1 é puro combate, sem magias.' },
  ranger:    { emoji: '🏹', accent: '#196f3d', roles: ['ranged', 'damage'] },
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

/** Nome da categoria de subclasse por classe, conforme o PHB (para o rótulo do seletor). */
export const SUBCLASS_LABEL: Record<string, string> = {
  barbarian: 'Caminho Primordial',
  bard: 'Colégio de Bardo',
  cleric: 'Domínio Divino',
  druid: 'Círculo Druídico',
  fighter: 'Arquétipo Marcial',
  monk: 'Tradição Monástica',
  paladin: 'Juramento Sagrado',
  ranger: 'Conclave do Patrulheiro',
  rogue: 'Arquétipo Ladino',
  sorcerer: 'Origem de Feitiçaria',
  warlock: 'Patrono Transcendental',
  wizard: 'Tradição Arcana',
}

export function getClass(id: string): GameClass | undefined {
  return CLASSES.find(c => c.id === id)
}

export function getSubclass(cls: GameClass, subclassId: string): ClassSubclass | undefined {
  return cls.subclasses.find(s => s.id === subclassId)
}

/**
 * Features de classe + subclasse disponíveis até o nível dado, agrupadas por nível.
 * Usa a tabela por nível de `class-progression-features.json` quando existe (fase 3);
 * senão cai no formato atual (`features` da classe = nível 1; `features` da subclasse
 * = nível de escolha).
 */
export function getClassFeaturesUpToLevel(
  cls: GameClass,
  subclass: ClassSubclass | null | undefined,
  level: number,
): LevelFeature[] {
  const out: LevelFeature[] = []

  const clsByLevel = CLASS_FEATURES_BY_LEVEL[cls.id]
  if (clsByLevel) {
    out.push(...clsByLevel.filter(f => f.level <= level))
  } else {
    out.push(...cls.features.map(f => ({ ...f, level: 1 })))
  }

  if (subclass) {
    const subByLevel = SUBCLASS_FEATURES_BY_LEVEL[subclass.id]
    if (subByLevel) {
      out.push(...subByLevel.filter(f => f.level <= level))
    } else if (cls.subclassLevel <= level) {
      out.push(...subclass.features.map(f => ({ ...f, level: cls.subclassLevel })))
    }
  }

  return out.sort((a, b) => a.level - b.level)
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
  multiclass = false,
): boolean {
  if (!cls) return false

  // Ao multiclassar, a classe concede só o subconjunto de perícias da Tabela de Proficiências
  // de Multiclasse (0, ou 1 para bardo/ladino/patrulheiro) — não a lista completa da 1ª classe.
  const skillCount = multiclass ? (cls.multiclassProficiencies.skills?.count ?? 0) : cls.skillChoices.count
  if (choices.skills.length !== skillCount) return false

  // Escolhas de ferramenta/instrumento só valem para a 1ª classe; as adicionais recebem as
  // proficiências de multiclasse já concedidas (sem seletor nesta fase).
  const requiredTools = multiclass ? 0 : cls.toolProficiencies.choices.reduce((sum, c) => sum + c.count, 0)
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

  if (!isProgressionChoicesComplete(cls.id, choices.subclass, choices, currentLevel)) return false

  return true
}
