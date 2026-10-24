import type { ClassChoiceSelections, ClassEntry } from '../types/character'
import progressionChoicesData from '../data/progression-choices.json'

export type ProgressionSlot = {
  id: string
  level: number
  count: number
  cumulative: boolean
  optionsListId: string
  label: string
}

const PROGRESSION_CHOICES_BY_ID = progressionChoicesData as Record<string, ProgressionSlot[]>

/** Slots para uma classe/subclasse específica, independente de nível. */
export function getProgressionSlots(classId: string | null, subclassId: string | null): ProgressionSlot[] {
  const slots: ProgressionSlot[] = []
  if (classId && PROGRESSION_CHOICES_BY_ID[classId]) {
    slots.push(...PROGRESSION_CHOICES_BY_ID[classId])
  }
  if (subclassId && PROGRESSION_CHOICES_BY_ID[subclassId]) {
    slots.push(...PROGRESSION_CHOICES_BY_ID[subclassId])
  }
  return slots.sort((a, b) => a.level - b.level)
}

/** Slots ganhos até o nível atual do personagem. */
export function getProgressionSlotsUpToLevel(classId: string | null, subclassId: string | null, level: number): ProgressionSlot[] {
  return getProgressionSlots(classId, subclassId).filter(slot => slot.level <= level)
}

/**
 * Lista de opções que é "qualquer magia de qualquer classe": os Segredos Mágicos do bardo (10°,
 * 14°, 18°, p. 54) e os Adicionais do Colégio do Conhecimento (6°, p. 55). O que se escolhe ali
 * é magia, não opção com texto — a ficha mostra junto das magias da classe, não nas escolhas.
 */
export const SPELL_OPTIONS_LIST_ID = 'any-known-spell'

export function isSpellChoiceSlot(slot: ProgressionSlot): boolean {
  return slot.optionsListId === SPELL_OPTIONS_LIST_ID
}

/** Magias escolhidas em slots de progressão (Segredos Mágicos) da classe, até o nível que tem nela. */
export function getProgressionSpellIds(entry: ClassEntry): string[] {
  const ids = getProgressionSlotsUpToLevel(entry.classId, entry.classChoices.subclass, entry.level)
    .filter(isSpellChoiceSlot)
    .flatMap(slot => entry.classChoices.progressionChoices[slot.id] ?? [])
  return [...new Set(ids)]
}

/** Verifica se todas as escolhas de progressão necessárias até o nível foram feitas. */
export function isProgressionChoicesComplete(
  classId: string | null,
  subclassId: string | null,
  choices: ClassChoiceSelections,
  level: number
): boolean {
  if (!classId) return false
  const slots = getProgressionSlotsUpToLevel(classId, subclassId, level)
  for (const slot of slots) {
    const picked = choices.progressionChoices[slot.id] ?? []
    if (picked.length !== slot.count) return false
  }
  return true
}
