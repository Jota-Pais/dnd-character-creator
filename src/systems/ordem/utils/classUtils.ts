import type { OrdemClass, OrdemClassId } from '../types/class'
import classesData from '../data/classes.json'

export const ORDEM_CLASSES: OrdemClass[] = classesData as OrdemClass[]

export function getOrdemClass(id: OrdemClassId): OrdemClass | undefined {
  return ORDEM_CLASSES.find(c => c.id === id)
}

/** Quantidade de perícias treinadas de escolha livre (além das fixas/grupos de escolha), somando o bônus de Intelecto. */
export function getFreeSkillChoiceCount(cls: OrdemClass, intellect: number): number {
  return cls.skills.freeChoiceBase + intellect
}
