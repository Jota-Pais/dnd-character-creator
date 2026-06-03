import type { Spell, SpellClass, SpellChoices } from '../types/spell'
import type { GameClass, ClassSpellcasting } from '../types/class'
import type { AbilityScore } from '../types/race'
import { calculateModifier, getProficiencyBonus } from './abilityScoreUtils'
import { isActiveCaster } from './classUtils'
import spellsData from '../data/spells.json'
import progressionData from '../data/progression.json'

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

// ── Progression helpers ───────────────────────────────────────────────────────

type CasterType = 'full' | 'half' | 'warlock'

const CASTER_TYPES = progressionData.casterType as Record<string, CasterType>

export function getCasterType(classId: string): CasterType | null {
  return CASTER_TYPES[classId] ?? null
}

/** Number of spell slots per spell level (9-element array, index 0 = 1st level). */
export function getSpellSlots(classId: string, charLevel: number): number[] {
  const ctype = getCasterType(classId)
  if (!ctype) return Array(9).fill(0)
  const idx = Math.max(1, Math.min(20, charLevel)) - 1

  if (ctype === 'warlock') {
    const entry = progressionData.spellSlots.warlock[idx]
    const arr = Array(9).fill(0)
    arr[entry.slotLevel - 1] = entry.slots
    return arr
  }
  if (ctype === 'half') {
    const half = progressionData.spellSlots.half[idx]
    return [...half, ...Array(9 - half.length).fill(0)]
  }
  return progressionData.spellSlots.full[idx]
}

/** Pact magic descriptor for warlocks (null for other classes). */
export function getWarlockPactSlots(charLevel: number): { slots: number; slotLevel: number } | null {
  const idx = Math.max(1, Math.min(20, charLevel)) - 1
  return progressionData.spellSlots.warlock[idx]
}

/** Highest spell level the class can access at charLevel (0 = no spells). */
export function getMaxSpellLevel(classId: string, charLevel: number): number {
  const slots = getSpellSlots(classId, charLevel)
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i] > 0) return i + 1
  }
  return 0
}

/** Number of cantrips known at a given character level (0 if class has none). */
export function getCantripsKnownCount(classId: string, charLevel: number): number {
  const table = (progressionData.cantripsKnown as Record<string, number[]>)[classId]
  if (!table) return 0
  return table[Math.max(1, Math.min(20, charLevel)) - 1]
}

/** Spells known for "known"-type casters at a given character level. */
export function getSpellsKnownCount(classId: string, charLevel: number): number {
  const table = (progressionData.spellsKnown as Record<string, number[]>)[classId]
  if (!table) return 0
  return table[Math.max(1, Math.min(20, charLevel)) - 1]
}

/** Wizard spellbook size at a given level (6 at level 1, +2 per level). */
export function getWizardSpellbookSize(charLevel: number): number {
  return 6 + 2 * (Math.max(1, charLevel) - 1)
}

// ── Spell casting stats ───────────────────────────────────────────────────────

export function getSpellSaveDC(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
  level = 1,
): number {
  const score = abilityScores[spellcasting.ability] ?? 10
  return 8 + getProficiencyBonus(level) + calculateModifier(score)
}

export function getSpellAttackBonus(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
  level = 1,
): number {
  const score = abilityScores[spellcasting.ability] ?? 10
  return getProficiencyBonus(level) + calculateModifier(score)
}

export function formatSpellAttackBonus(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
  level = 1,
): string {
  const bonus = getSpellAttackBonus(spellcasting, abilityScores, level)
  return bonus >= 0 ? `+${bonus}` : `${bonus}`
}

export function getMaxPreparedSpells(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
  level = 1,
): number {
  const score = abilityScores[spellcasting.ability] ?? 10
  const modifier = calculateModifier(score)
  if (spellcasting.preparedFormula?.includes('metade')) {
    // Paladin: floor(level/2) + modifier
    return Math.max(1, Math.floor(level / 2) + modifier)
  }
  return Math.max(1, modifier + level)
}

export function isSpellStepComplete(
  cls: GameClass | null,
  choices: SpellChoices,
  level = 1,
): boolean {
  if (!cls || !cls.spellcasting) return true
  if (!isActiveCaster(cls, level)) return true

  const sc = cls.spellcasting
  const cantripsNeeded = getCantripsKnownCount(cls.id, level) || sc.cantripsKnown

  if (cantripsNeeded > 0 && choices.cantrips.length < cantripsNeeded) return false

  if (sc.type === 'known') {
    const needed = getSpellsKnownCount(cls.id, level) || sc.spellsAtLevel1
    if (needed > 0 && choices.spells.length < needed) return false
  }

  if (sc.type === 'hybrid') {
    const needed = getWizardSpellbookSize(level)
    if (choices.spells.length < needed) return false
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
