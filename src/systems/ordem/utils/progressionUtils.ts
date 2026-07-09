/**
 * Cadências de progressão por NEX — idênticas nas 3 classes (conferido nas Tabelas 1.3/1.4/1.5
 * do livro). O que varia por classe é só a contagem do Grau de Treinamento (skillGradeCount).
 */
export const NEX_STEPS: number[] = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99]

export const TRILHA_FEATURE_NEX: number[] = [10, 40, 65, 99]
export const POWER_SLOT_NEX: number[] = [15, 30, 45, 60, 75, 90]
export const ATTRIBUTE_INCREASE_NEX: number[] = [20, 50, 80, 95]
export const SKILL_GRADE_NEX: number[] = [35, 70]
export const VERSATILITY_NEX = 50
export const ATTRIBUTE_INCREASE_CAP = 5

export function getNexIndex(nex: number): number {
  return NEX_STEPS.indexOf(nex)
}

export function isValidNex(nex: number): boolean {
  return NEX_STEPS.includes(nex)
}

/** Limite de PE gastos por turno (Tabela 1.2): 1 em NEX 5%, 2 em NEX 10%... 20 em NEX 99%. */
export function getPeLimit(nex: number): number {
  return getNexIndex(nex) + 1
}

export function getReachedTrilhaSlots(nex: number): number[] {
  return TRILHA_FEATURE_NEX.filter(n => n <= nex)
}

export function getReachedPowerSlots(nex: number): number[] {
  return POWER_SLOT_NEX.filter(n => n <= nex)
}

export function getReachedAttributeIncreaseSlots(nex: number): number[] {
  return ATTRIBUTE_INCREASE_NEX.filter(n => n <= nex)
}

export function getReachedSkillGradeSlots(nex: number): number[] {
  return SKILL_GRADE_NEX.filter(n => n <= nex)
}

export function hasVersatility(nex: number): boolean {
  return nex >= VERSATILITY_NEX
}

export function hasTrilha(nex: number): boolean {
  return nex >= TRILHA_FEATURE_NEX[0]
}
