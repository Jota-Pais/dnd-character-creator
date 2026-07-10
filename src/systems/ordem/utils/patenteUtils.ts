import patentesJson from '../data/patentes.json'
import type { OrdemPatente, OrdemPatenteId } from '../types/patente'

export const PATENTES = patentesJson as OrdemPatente[]

export function getPatente(id: OrdemPatenteId): OrdemPatente {
  return PATENTES.find(p => p.id === id) ?? PATENTES[0]
}

export function isValidPatente(id: unknown): id is OrdemPatenteId {
  return typeof id === 'string' && PATENTES.some(p => p.id === id)
}

/** Limite de itens de uma categoria pela patente. Categoria 0 é ilimitada (só carga a limita). */
export function getCategoryLimit(patente: OrdemPatente, category: number): number {
  if (category <= 0) return Infinity
  return patente.categoryLimits[category - 1] ?? 0
}
