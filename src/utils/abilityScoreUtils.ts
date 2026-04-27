import type { AbilityScore } from '../types/race'

export const ABILITY_LABELS: Record<AbilityScore, { short: string; long: string }> = {
  STR: { short: 'FOR', long: 'Força' },
  DEX: { short: 'DES', long: 'Destreza' },
  CON: { short: 'CON', long: 'Constituição' },
  INT: { short: 'INT', long: 'Inteligência' },
  WIS: { short: 'SAB', long: 'Sabedoria' },
  CHA: { short: 'CAR', long: 'Carisma' },
}

export const ALL_ABILITY_SCORES: AbilityScore[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2)
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
