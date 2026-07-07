import type { AbilityScore } from '../types/race'
import type { AbilityMethod, BaseAbilityScores } from '../types/character'
import progressionData from '../data/progression.json'

const PROFICIENCY_BY_LEVEL: number[] = progressionData.proficiencyBonus

export const ABILITY_LABELS: Record<AbilityScore, { short: string; long: string }> = {
  STR: { short: 'FOR', long: 'Força' },
  DEX: { short: 'DES', long: 'Destreza' },
  CON: { short: 'CON', long: 'Constituição' },
  INT: { short: 'INT', long: 'Inteligência' },
  WIS: { short: 'SAB', long: 'Sabedoria' },
  CHA: { short: 'CAR', long: 'Carisma' },
}

export const ALL_ABILITY_SCORES: AbilityScore[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const

export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
}

export const POINT_BUY_TOTAL = 27

export function getProficiencyBonus(level: number): number {
  return PROFICIENCY_BY_LEVEL[Math.max(1, Math.min(20, level)) - 1]
}

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/**
 * Percepção Passiva (PHB 2014): 10 + mod. de SAB, somando o bônus de
 * proficiência se o personagem for proficiente na perícia Percepção.
 */
export function getPassivePerception(
  wisModifier: number,
  isProficient: boolean,
  proficiencyBonus: number,
): number {
  return 10 + wisModifier + (isProficient ? proficiencyBonus : 0)
}

export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`
}

export function formatBonus(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

export function formatSpeed(feet: number): string {
  const meters = feet * 0.3
  const squares = feet / 5
  const metersStr = Number.isInteger(meters)
    ? `${meters} m`
    : `${meters.toFixed(1).replace('.', ',')} m`
  return `${metersStr} (${squares} quad.)`
}

export function getPointBuyCost(score: number): number {
  return POINT_BUY_COSTS[score] ?? 0
}

export function getTotalPointsSpent(scores: Record<AbilityScore, number>): number {
  return ALL_ABILITY_SCORES.reduce((sum, ability) => sum + getPointBuyCost(scores[ability]), 0)
}

export function getRemainingPoints(scores: Record<AbilityScore, number>): number {
  return POINT_BUY_TOTAL - getTotalPointsSpent(scores)
}

export function rollAbilityScore(): { rolls: number[]; result: number } {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1)
  const sorted = [...rolls].sort((a, b) => b - a)
  const result = sorted[0] + sorted[1] + sorted[2]
  return { rolls, result }
}

export function isAbilitiesStepComplete(
  method: AbilityMethod | null,
  scores: BaseAbilityScores,
  rolledValues: number[],
): boolean {
  if (!method) return false

  const values = ALL_ABILITY_SCORES.map(a => scores[a])
  if (values.some(v => v === null)) return false
  const nums = values as number[]

  if (method === 'standard-array') {
    const sorted = [...nums].sort((a, b) => a - b)
    return JSON.stringify(sorted) === JSON.stringify([8, 10, 12, 13, 14, 15])
  }

  if (method === 'point-buy') {
    const allInRange = nums.every(s => s >= 8 && s <= 15)
    return allInRange && getTotalPointsSpent(scores as Record<AbilityScore, number>) === POINT_BUY_TOTAL
  }

  if (method === 'roll') {
    if (rolledValues.length !== 6) return false
    const sortedRolled = [...rolledValues].sort((a, b) => a - b)
    const sortedAssigned = [...nums].sort((a, b) => a - b)
    return JSON.stringify(sortedRolled) === JSON.stringify(sortedAssigned)
  }

  return false
}
