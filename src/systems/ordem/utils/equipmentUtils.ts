import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemEquipment } from '../types/equipment'
import equipmentsJson from '../data/equipments.json'
import { getOrdemClass } from './classUtils'
import { getPatente, getCategoryLimit } from './patenteUtils'
import { getModification } from './modificationUtils'
import { getCurse, getCurseCategoryDelta, getItemCurses, getSheetAttributes, canApplyCurse, curseChoiceKey } from './curseUtils'

export const EQUIPMENTS = equipmentsJson as OrdemEquipment[]

export function getEquipmentById(id: string): OrdemEquipment | undefined {
  return EQUIPMENTS.find(e => e.id === id)
}

/** Capacidade de carga base pela Força: 5 espaços por ponto (2 se Força 0). */
export function getMaxCapacity(strength: number): number {
  return Math.max(2, strength * 5)
}

/** Bônus de capacidade de carga concedido pelos itens escolhidos (ex.: Mochila Militar = +2). */
export function getEquipmentCarryBonus(choices: string[]): number {
  return choices.reduce((acc, id) => {
    const item = getEquipmentById(id)
    return acc + (item?.carryBonus ?? 0)
  }, 0)
}

/** Capacidade de carga total: base (5×Força da ficha, incluindo maldição Pujança) + bônus dos itens (Mochila Militar etc.). */
export function getTotalCarryCapacity(draft: OrdemCharacterDraft): number {
  return getMaxCapacity(getSheetAttributes(draft).strength) + getEquipmentCarryBonus(draft.equipmentChoices)
}

export function getCurrentSpaces(choices: string[]): number {
  return choices.reduce((acc, id) => {
    const item = getEquipmentById(id)
    return acc + (item ? item.spaces : 0)
  }, 0)
}

/** Quantos itens escolhidos são de uma dada categoria. */
export function getCategoryCount(choices: string[], category: number): number {
  return choices.reduce((acc, id) => {
    const item = getEquipmentById(id)
    return acc + (item?.category === category ? 1 : 0)
  }, 0)
}

/** Atalho para a Categoria I (mantido por compatibilidade). */
export function getCategoryICount(choices: string[]): number {
  return getCategoryCount(choices, 1)
}

/** Soma o bônus de Defesa das proteções escolhidas (sem modificações). */
export function getEquippedDefenseBonus(choices: string[]): number {
  return choices.reduce((acc, id) => {
    const item = getEquipmentById(id)
    return acc + (item && item.type === 'protection' ? item.defenseBonus : 0)
  }, 0)
}

// ── Efeitos das modificações (Fase B) ──────────────────────────────────────────

function itemMods(draft: OrdemCharacterDraft, itemId: string): string[] {
  return draft.equipmentModifications[itemId] ?? []
}

/**
 * Categoria efetiva de um item = base + modificações (cada uma +I) + maldições
 * (a 1ª +II, as seguintes +I — pág. 144); teto IV. Ajustes se acumulam.
 */
export function getEffectiveCategory(item: OrdemEquipment, modCount: number, curseCount = 0): number {
  return Math.min(4, item.category + modCount + getCurseCategoryDelta(curseCount))
}

/** Categoria efetiva de um item do draft, lendo modificações e maldições aplicadas. */
export function getDraftItemCategory(draft: OrdemCharacterDraft, item: OrdemEquipment): number {
  return getEffectiveCategory(item, itemMods(draft, item.id).length, getItemCurses(draft, item.id).length)
}

/** Espaços de um item já com as variações das modificações (Discreta −1, Reforçada/Blindada +1...). */
function itemModifiedSpaces(item: OrdemEquipment, modIds: string[]): number {
  const delta = modIds.reduce((acc, id) => acc + (getModification(id)?.spaceDelta ?? 0), 0)
  return Math.max(0, item.spaces + delta)
}

/** Total de espaços ocupados, considerando as modificações. */
export function getModifiedSpaces(draft: OrdemCharacterDraft): number {
  return draft.equipmentChoices.reduce((acc, id) => {
    const item = getEquipmentById(id)
    return acc + (item ? itemModifiedSpaces(item, itemMods(draft, id)) : 0)
  }, 0)
}

/** Bônus de Defesa total das proteções, incluindo modificações (Reforçada +2). */
export function getModifiedDefenseBonus(draft: OrdemCharacterDraft): number {
  return draft.equipmentChoices.reduce((acc, id) => {
    const item = getEquipmentById(id)
    if (!item || item.type !== 'protection') return acc
    const modDef = itemMods(draft, id).reduce((s, mid) => s + (getModification(mid)?.defenseBonus ?? 0), 0)
    return acc + item.defenseBonus + modDef
  }, 0)
}

/** Quantos itens escolhidos têm a categoria EFETIVA (base + modificações + maldições) igual a `category`. */
export function getEffectiveCategoryCount(draft: OrdemCharacterDraft, category: number): number {
  return draft.equipmentChoices.reduce((acc, id) => {
    const item = getEquipmentById(id)
    if (!item) return acc
    return acc + (getDraftItemCategory(draft, item) === category ? 1 : 0)
  }, 0)
}

/**
 * As maldições aplicadas são estruturalmente válidas? (alvo certo, sem duplicatas, sem
 * elementos opressores no mesmo item, e com o parâmetro escolhido quando exigido).
 */
export function areCursesValid(draft: OrdemCharacterDraft): boolean {
  for (const itemId of draft.equipmentChoices) {
    const item = getEquipmentById(itemId)
    const curses = getItemCurses(draft, itemId)
    if (curses.length === 0) continue
    if (!item) return false
    for (let i = 0; i < curses.length; i++) {
      // Cada maldição precisa ser aplicável considerando as demais do item.
      const others = curses.filter((_, j) => j !== i)
      if (!canApplyCurse(item, others, curses[i], draft.equipmentCurseChoices)) return false
      const curse = getCurse(curses[i])
      if (curse?.choice && !draft.equipmentCurseChoices[curseChoiceKey(itemId, curse.id)]) return false
    }
  }
  return true
}

export function isEquipmentStepComplete(draft: OrdemCharacterDraft): boolean {
  // A carga (já com as variações das modificações) é limitada pela capacidade (5×Força + bônus). Loadout vazio é válido.
  const capacity = getTotalCarryCapacity(draft)
  if (getModifiedSpaces(draft) > capacity) return false

  // Cada categoria EFETIVA (base + modificações + maldições) é limitada pela Patente (Tabela 3.1); Categoria 0 é ilimitada.
  const patente = getPatente(draft.patente)
  for (let cat = 1; cat <= 4; cat++) {
    if (getEffectiveCategoryCount(draft, cat) > getCategoryLimit(patente, cat)) return false
  }

  // Maldições precisam ser válidas (alvo, oposição de elementos, parâmetros escolhidos).
  if (!areCursesValid(draft)) return false

  // Proficiência de arma NÃO bloqueia: o livro permite possuir uma arma sem proficiência (com
  // penalidade ao usá-la). A UI apenas sinaliza "Sem Proficiência" — ver `hasWeaponProficiency`.
  return true
}

/** Se a classe do agente tem proficiência com a arma (apenas informativo — não bloqueia a escolha). */
export function hasWeaponProficiency(draft: OrdemCharacterDraft, item: OrdemEquipment): boolean {
  if (item.type !== 'weapon' || !draft.class) return true
  const cls = getOrdemClass(draft.class)
  return cls ? cls.weaponProficiencies.includes(item.proficiency) : true
}
