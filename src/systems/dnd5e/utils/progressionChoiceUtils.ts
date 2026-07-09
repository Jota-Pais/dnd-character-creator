import type { ClassChoiceSelections } from '../types/character'
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
