import type { Trilha } from '../types/trilha'
import type { OrdemClassId } from '../types/class'
import trilhasData from '../data/trilhas.json'

export const TRILHAS: Trilha[] = trilhasData as Trilha[]

export function getTrilha(id: string): Trilha | undefined {
  return TRILHAS.find(t => t.id === id)
}

export function getTrilhasByClass(classId: OrdemClassId): Trilha[] {
  return TRILHAS.filter(t => t.classId === classId)
}
