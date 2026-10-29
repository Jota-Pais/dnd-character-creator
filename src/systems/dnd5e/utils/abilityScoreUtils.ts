import type { AbilityScore } from '../types/race'
import type { AbilityMethod, BaseAbilityScores } from '../types/character'
import progressionData from '../data/progression.json'
import { roll, type DieRoller } from '../../../core/dice'

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

/**
 * Método "Personalizado": o jogador digita cada atributo livremente, dentro da faixa
 * que os dados permitem na criação (3 a 18 — 4d6 descartando o menor). Sem limite de soma.
 */
export const CUSTOM_MIN = 3
export const CUSTOM_MAX = 18

/** Restringe um valor à faixa do método Personalizado (3 a 18). */
export function clampCustomScore(value: number): number {
  return Math.max(CUSTOM_MIN, Math.min(CUSTOM_MAX, Math.round(value)))
}

export function getProficiencyBonus(level: number): number {
  return PROFICIENCY_BY_LEVEL[Math.max(1, Math.min(20, level)) - 1]
}

/** Pontos de experiência a partir dos quais se está em cada nível (tabela Avanço de Personagem, p. 15). */
const XP_BY_LEVEL: number[] = progressionData.xpThresholds

/** XP mínimo do nível (p. 15). Nível fora de 1–20 é limitado à faixa. */
export function getXpThreshold(level: number): number {
  return XP_BY_LEVEL[Math.max(1, Math.min(20, level)) - 1]
}

/** XP com que se chega ao nível seguinte; `null` no nível 20, que é o último. */
export function getNextXpThreshold(level: number): number | null {
  return level >= 20 ? null : getXpThreshold(level + 1)
}

/** Número com separador de milhar do pt-BR (2.700), sem depender do ICU do ambiente. */
function formatThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Onde o nível fica na tabela de XP, pra ficha e Revisão:
 * "nível 4 a partir de 2.700 XP · próximo nível em 6.500 XP" (no 20, sem o "próximo").
 */
export function formatXpProgress(level: number): string {
  const lvl = Math.max(1, Math.min(20, level))
  const next = getNextXpThreshold(lvl)
  const base = `nível ${lvl} a partir de ${formatThousands(getXpThreshold(lvl))} XP`
  return next === null ? base : `${base} · próximo nível em ${formatThousands(next)} XP`
}

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`
}

export function formatBonus(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

/**
 * Distância em pés (a unidade dos dados) escrita em metros, como o PHB em português: 5 pés = 1,5 m.
 * Fonte única do texto em metros — deslocamento, visão no escuro, bônus de deslocamento.
 */
export function formatMeters(feet: number): string {
  // Arredonda pra 1 casa antes de testar o inteiro: 40 × 0,3 dá 12.000000000000002.
  const meters = Math.round(feet * 3) / 10
  return Number.isInteger(meters) ? `${meters} m` : `${meters.toFixed(1).replace('.', ',')} m`
}

export function formatSpeed(feet: number): string {
  return `${formatMeters(feet)} (${feet / 5} quad.)`
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

/**
 * Um valor de habilidade rolado (p. 13): 4d6, somando os três maiores. `rolls` são os quatro
 * dados na ordem em que saíram. O sorteio é do motor de dados; os testes passam o `roller`.
 */
export function rollAbilityScore(roller?: DieRoller): { rolls: number[]; result: number } {
  const record = roll('4d6kh3', { roller })
  return { rolls: record.terms[0].dice.map(d => d.value), result: record.total }
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

  if (method === 'custom') {
    // Cada atributo é um valor livre dentro da faixa dos dados (3 a 18); sem limite de soma.
    return nums.every(s => s >= CUSTOM_MIN && s <= CUSTOM_MAX)
  }

  return false
}
