import type { Spell, SpellClass, SpellChoices } from '../types/spell'
import type { GameClass, ClassSpellcasting } from '../types/class'
import type { AbilityScore } from '../types/race'
import { calculateModifier } from './abilityScoreUtils'
import spellsData from '../data/spells.json'

export const SPELLS: Spell[] = spellsData as Spell[]

const BY_ID = new Map(SPELLS.map(s => [s.id, s]))

export function getSpell(id: string): Spell | undefined {
  return BY_ID.get(id)
}

export function getSpellsByClass(classId: SpellClass | string): Spell[] {
  return SPELLS.filter(s => s.classes.includes(classId as SpellClass))
}

export function getCantrips(classId: SpellClass | string): Spell[] {
  return SPELLS.filter(s => s.level === 0 && s.classes.includes(classId as SpellClass))
}

export function getSpellsByLevel(classId: SpellClass | string, level: number): Spell[] {
  return SPELLS.filter(
    s => s.level === level && s.classes.includes(classId as SpellClass),
  )
}

export function getSpellSaveDC(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
): number {
  const score = abilityScores[spellcasting.ability] ?? 10
  return 8 + 2 + calculateModifier(score) // 8 + proficiency (2 at level 1) + modifier
}

export function getSpellAttackBonus(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
): number {
  const score = abilityScores[spellcasting.ability] ?? 10
  return 2 + calculateModifier(score) // proficiency (2 at level 1) + modifier
}

export function formatSpellAttackBonus(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
): string {
  const bonus = getSpellAttackBonus(spellcasting, abilityScores)
  return bonus >= 0 ? `+${bonus}` : `${bonus}`
}

export function getMaxPreparedSpells(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
  level = 1,
): number {
  const score = abilityScores[spellcasting.ability] ?? 10
  const modifier = calculateModifier(score)
  // Formula: modifier + level (minimum 1)
  return Math.max(1, modifier + level)
}

export function getLevel1SlotCount(cls: GameClass): number {
  if (!cls.spellcasting || cls.spellcasting.castingStartsAtLevel > 1) return 0
  // PHB 2014 level-1 spell slots:
  // Full casters (bard, cleric, druid, sorcerer, wizard): 2
  // Warlock: 1 (pact magic, regains on short rest)
  return cls.id === 'warlock' ? 1 : 2
}

export function isSpellStepComplete(cls: GameClass | null, choices: SpellChoices): boolean {
  if (!cls || !cls.spellcasting) return true
  if (cls.spellcasting.castingStartsAtLevel > 1) return true

  const sc = cls.spellcasting

  if (sc.cantripsKnown > 0 && choices.cantrips.length < sc.cantripsKnown) return false

  if (sc.type === 'known' || sc.type === 'hybrid') {
    if (sc.spellsAtLevel1 > 0 && choices.spells.length < sc.spellsAtLevel1) return false
  }

  return true
}

export const SCHOOL_COLORS: Record<string, string> = {
  abjuração:   '#2e86c1',
  adivinhação: '#8e44ad',
  conjuração:  '#1e8449',
  encantamento:'#c0392b',
  evocação:    '#d35400',
  ilusão:      '#7d3c98',
  necromancia: '#2c3e50',
  transmutação:'#b7770d',
}

export const SCHOOL_EMOJI: Record<string, string> = {
  abjuração:   '🛡️',
  adivinhação: '🔮',
  conjuração:  '🌀',
  encantamento:'💫',
  evocação:    '✨',
  ilusão:      '👁️',
  necromancia: '💀',
  transmutação:'⚗️',
}
