import type { ClassChoiceSelections, ClassEntry } from '../types/character'
import progressionChoicesData from '../data/progression-choices.json'

export type ProgressionSlot = {
  id: string
  level: number
  count: number
  cumulative: boolean
  optionsListId: string
  label: string
  /**
   * Slot de magia cujas escolhas "já estão incluídas no número da coluna Magias Conhecidas"
   * (Segredos Mágicos do bardo, p. 54): ocupam vaga da tabela em vez de somar por cima. Os
   * Adicionais do Colégio do Conhecimento (p. 55) não têm o campo — contam por fora.
   */
  countsAsKnownSpell?: boolean
  /**
   * Slot que só existe com uma opção escolhida em outro slot da mesma classe: os truques do Livro
   * das Sombras só com o Pacto do Tomo (p. 59). É o id da opção exigida.
   */
  requiresPick?: string
  /**
   * Teto de nível das magias de um slot de magia, abaixo do que a classe conjura: 0 = só truques
   * (Livro das Sombras, p. 59). Omitido = o que a tabela da classe deixa (Segredos Mágicos).
   */
  maxSpellLevel?: number
  /** Explicação do slot na etapa Classe, quando não é um slot de Segredos Mágicos do bardo. */
  hint?: string
  /**
   * A escolha qualifica a subclasse (Ancestral Dracônico da Linhagem Dracônica, p. 80): sai junto
   * do nome dela no cabeçalho da ficha ("Linhagem Dracônica, ancestral Vermelho") — o valor é a
   * palavra que a antecede — e nas características que a usam (`showsPick`), não nas Escolhas de
   * Progressão.
   */
  subclassDetail?: string
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

/**
 * Slots ganhos até o nível na classe. Os que dependem de uma opção (`requiresPick`: truques do
 * Livro das Sombras) só entram com ela marcada num slot já liberado — por isso as escolhas vêm
 * junto. Sem as escolhas, ficam de fora.
 */
export function getProgressionSlotsUpToLevel(
  classId: string | null,
  subclassId: string | null,
  level: number,
  progressionChoices: Record<string, string[]> = {},
): ProgressionSlot[] {
  const reached = getProgressionSlots(classId, subclassId).filter(slot => slot.level <= level)
  const picks = collectPicks(reached.filter(slot => !slot.requiresPick), progressionChoices)
  return reached.filter(slot => !slot.requiresPick || picks.has(slot.requiresPick))
}

function collectPicks(slots: ProgressionSlot[], progressionChoices: Record<string, string[]>): Set<string> {
  return new Set(slots.flatMap(slot => progressionChoices[slot.id] ?? []))
}

/**
 * As opções que a classe tem escolhidas nos slots que o nível nela já liberou (o pacto, as
 * invocações...): contra elas se confere o pré-requisito de opção (`requiresPick` da opção).
 */
export function getActivePicks(
  classId: string | null,
  subclassId: string | null,
  level: number,
  progressionChoices: Record<string, string[]>,
): Set<string> {
  return collectPicks(getProgressionSlotsUpToLevel(classId, subclassId, level, progressionChoices), progressionChoices)
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

/**
 * Magias escolhidas em slots de progressão da classe (Segredos Mágicos, truques do Livro das
 * Sombras), até o nível que tem nela.
 */
export function getProgressionSpellIds(entry: ClassEntry): string[] {
  const ids = getProgressionSlotsUpToLevel(entry.classId, entry.classChoices.subclass, entry.level, entry.classChoices.progressionChoices)
    .filter(isSpellChoiceSlot)
    .flatMap(slot => entry.classChoices.progressionChoices[slot.id] ?? [])
  return [...new Set(ids)]
}

/**
 * Magias escolhidas nos slots com `countsAsKnownSpell` (Segredos Mágicos do bardo), até o nível na
 * classe: as que ocupam vaga das colunas de conhecidas. Truque e magia ainda misturados — quem
 * separa é getKnownColumnSecrets (spellUtils), que conhece o nível de cada magia.
 */
export function getKnownColumnSecretIds(
  classId: string,
  subclassId: string | null,
  classLevel: number,
  progressionChoices: Record<string, string[]>,
): string[] {
  const ids = getProgressionSlotsUpToLevel(classId, subclassId, classLevel, progressionChoices)
    .filter(slot => isSpellChoiceSlot(slot) && slot.countsAsKnownSpell)
    .flatMap(slot => progressionChoices[slot.id] ?? [])
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
  const slots = getProgressionSlotsUpToLevel(classId, subclassId, level, choices.progressionChoices)
  for (const slot of slots) {
    const picked = choices.progressionChoices[slot.id] ?? []
    if (picked.length !== slot.count) return false
  }
  return true
}
