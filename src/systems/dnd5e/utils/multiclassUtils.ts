import type { AbilityScore } from '../types/race'
import type { GameClass, CasterProgression } from '../types/class'

/** Mínimo de atributo para qualquer pré-requisito de multiclasse (PHB pág. 166 — sempre 13). */
export const MULTICLASS_MIN_SCORE = 13

/** Atende ao pré-requisito de atributo para ter níveis nesta classe? (usa atributos FINAIS) */
export function meetsMulticlassPrereq(
  cls: GameClass,
  finalScores: Partial<Record<AbilityScore, number>>,
): boolean {
  const { mode, abilities } = cls.multiclassPrereq
  const ok = (ab: AbilityScore) => (finalScores[ab] ?? 0) >= MULTICLASS_MIN_SCORE
  return mode === 'any' ? abilities.some(ok) : abilities.every(ok)
}

/**
 * Atributos que impedem o pré-requisito (para mensagem de UI). Vazio quando cumpre.
 * 'any' não cumprido → devolve todos (qualquer um resolveria); 'all' → só os abaixo de 13.
 */
export function getUnmetPrereqAbilities(
  cls: GameClass,
  finalScores: Partial<Record<AbilityScore, number>>,
): AbilityScore[] {
  if (meetsMulticlassPrereq(cls, finalScores)) return []
  const { mode, abilities } = cls.multiclassPrereq
  if (mode === 'any') return abilities
  return abilities.filter(ab => (finalScores[ab] ?? 0) < MULTICLASS_MIN_SCORE)
}

/**
 * Progressão de conjuração efetiva (classe + subclasse) para o nível de conjurador combinado.
 * Guerreiro e Ladino são 'none' na classe, mas 'third' via Cavaleiro Arcano / Trapaceiro Arcano.
 */
export function getCasterProgression(
  cls: GameClass,
  subclassId: string | null | undefined,
): CasterProgression {
  if (cls.casterProgression !== 'none') return cls.casterProgression
  if (subclassId) {
    const sub = cls.subclasses.find(s => s.id === subclassId)
    if (sub?.casterProgression) return sub.casterProgression
  }
  return 'none'
}
