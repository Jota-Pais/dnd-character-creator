import type { AbilityScore } from '../types/race'
import type { CharacterDraft, AsiChoice } from '../types/character'
import { getRace, getSubrace, getEffectiveAbilityBonuses } from './raceUtils'
import { ALL_ABILITY_SCORES } from './abilityScoreUtils'
import { getFeat } from './featUtils'

/**
 * Níveis em que cada classe ganha um Incremento no Valor de Habilidade (ASI),
 * conforme o PHB 2014. Todas ganham nos níveis 4/8/12/16/19; guerreiro ganha
 * dois extras (6 e 14) e ladino um extra (10).
 */
const BASE_ASI_LEVELS = [4, 8, 12, 16, 19]
const EXTRA_ASI_LEVELS: Record<string, number[]> = {
  fighter: [6, 14],
  rogue: [10],
}

export function getAsiLevels(classId: string | null | undefined): number[] {
  if (!classId) return []
  const extra = EXTRA_ASI_LEVELS[classId] ?? []
  return [...BASE_ASI_LEVELS, ...extra].sort((a, b) => a - b)
}

/** Quantos espaços de ASI o personagem já ganhou no nível informado. */
export function getAsiSlotCount(classId: string | null | undefined, level: number): number {
  return getAsiLevels(classId).filter(l => l <= level).length
}

/** Os níveis de ASI que o personagem já alcançou (para rotular cada espaço). */
export function getReachedAsiLevels(classId: string | null | undefined, level: number): number[] {
  return getAsiLevels(classId).filter(l => l <= level)
}

/**
 * Soma dos aumentos de atributo por atributo: +1 por entrada de um ASI e +1 pelo
 * atributo escolhido de um meio-talento (kind: 'feat' com abilities).
 */
export function getAsiBonuses(asiChoices: AsiChoice[]): Record<AbilityScore, number> {
  const bonuses: Record<AbilityScore, number> = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
  for (const choice of asiChoices) {
    const abilities = choice.kind === 'asi' ? choice.abilities : (choice.abilities ?? [])
    for (const ability of abilities) {
      bonuses[ability] += 1
    }
  }
  return bonuses
}

/** Bônus raciais de atributo (fixos + escolhidos), por atributo. */
export function getRacialBonuses(draft: CharacterDraft): Record<AbilityScore, number> {
  const bonuses: Record<AbilityScore, number> = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
  const race = draft.race ? getRace(draft.race) : undefined
  if (!race) return bonuses
  const subrace = draft.subrace ? (getSubrace(race, draft.subrace) ?? null) : null
  for (const b of getEffectiveAbilityBonuses(race, subrace, draft.raceChoices)) {
    bonuses[b.ability] += b.value
  }
  return bonuses
}

/**
 * Atributos finais = base + bônus racial + ASIs, com os ASIs limitados a um
 * teto de 20 por atributo (regra do PHB: ASI não eleva um atributo acima de 20).
 */
export function getFinalAbilityScores(draft: CharacterDraft): Record<AbilityScore, number> {
  const racial = getRacialBonuses(draft)
  const asi = getAsiBonuses(draft.asiChoices ?? [])
  const final = {} as Record<AbilityScore, number>
  for (const ab of ALL_ABILITY_SCORES) {
    const baseWithRacial = (draft.abilityScores[ab] ?? 10) + racial[ab]
    const capped = Math.min(baseWithRacial + asi[ab], Math.max(20, baseWithRacial))
    final[ab] = capped
  }
  return final
}

/**
 * Um espaço de ASI está preenchido de forma válida? Modelamos o incremento como
 * duas entradas de atributo: [a, a] = +2 em a; [a, b] = +1 em a e +1 em b.
 * Cada entrada vale +1 (ver getAsiBonuses), somando sempre +2 no total.
 */
export function isAsiChoiceComplete(choice: AsiChoice | undefined): boolean {
  if (!choice) return false
  if (choice.kind === 'feat') {
    if (!choice.featId) return false
    // meio-talento: exige escolher exatamente 1 atributo dentre os elegíveis
    const options = getFeat(choice.featId)?.abilityIncrease
    if (options && options.length > 0) {
      return (choice.abilities?.length === 1) && options.includes(choice.abilities[0])
    }
    return true
  }
  return (
    choice.abilities.length === 2 &&
    choice.abilities.every(a => (ALL_ABILITY_SCORES as AbilityScore[]).includes(a))
  )
}

/**
 * Passo de Aprimoramentos completo: todos os espaços de ASI já alcançados estão
 * preenchidos de forma válida (respeitando o teto 20). Sem espaços, está completo.
 */
export function isImprovementsStepComplete(draft: CharacterDraft): boolean {
  const slots = getAsiSlotCount(draft.class, draft.level ?? 1)
  const choices = draft.asiChoices ?? []
  if (choices.length < slots) return false
  for (let i = 0; i < slots; i++) {
    if (!isAsiChoiceComplete(choices[i])) return false
  }
  // valida o teto de 20 considerando o conjunto de escolhas
  const racial = getRacialBonuses(draft)
  for (const ab of ALL_ABILITY_SCORES) {
    const asi = getAsiBonuses(choices.slice(0, slots))
    const baseWithRacial = (draft.abilityScores[ab] ?? 10) + racial[ab]
    if (baseWithRacial + asi[ab] > Math.max(20, baseWithRacial)) return false
  }
  return true
}
