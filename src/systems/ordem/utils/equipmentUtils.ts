import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemEquipment } from '../types/equipment'
import type { OrdemPatente } from '../types/patente'
import type { OrdemElement } from '../types/ritual'
import { getRitualById, getRitualSlotsCount } from './ritualUtils'
import equipmentsJson from '../data/equipments.json'
import { getOrdemClass } from './classUtils'
import { getPatente, getCategoryLimit } from './patenteUtils'
import { getModification } from './modificationUtils'
import { getCurse, getCurseCategoryDelta, getItemCurses, getSheetAttributes, canApplyCurse, curseChoiceKey } from './curseUtils'
import { hasClassPower } from './characterUtils'

export const EQUIPMENTS = equipmentsJson as OrdemEquipment[]

export function getEquipmentById(id: string): OrdemEquipment | undefined {
  return EQUIPMENTS.find(e => e.id === id)
}

// ── Unidades de equipamento ────────────────────────────────────────────────────
// `equipmentChoices` guarda UNIDADES, não ids únicos: a 1ª unidade de um item usa o
// próprio id ("revolver") e duplicatas ganham sufixo ("revolver#2"), permitindo dois
// revólveres com modificações/maldições diferentes. Mods, maldições e escolhas de
// parâmetro são chaveadas pela unidade — saves antigos (1 unidade por item) seguem válidos.

/** Id do item de catálogo de uma unidade ("revolver#2" → "revolver"). */
export function instanceItemId(uid: string): string {
  return uid.split('#')[0]
}

export function getEquipmentByInstance(uid: string): OrdemEquipment | undefined {
  return getEquipmentById(instanceItemId(uid))
}

/** Uid pra uma nova unidade do item: o próprio id se livre, senão o menor sufixo livre. */
export function newInstanceUid(choices: string[], itemId: string): string {
  if (!choices.includes(itemId)) return itemId
  let n = 2
  while (choices.includes(`${itemId}#${n}`)) n++
  return `${itemId}#${n}`
}

/** Nome de exibição de uma unidade: "Revólver" (única) ou "Revólver #2" (duplicatas). */
export function getInstanceLabel(draft: OrdemCharacterDraft, uid: string): string {
  const item = getEquipmentByInstance(uid)
  if (!item) return uid
  const same = draft.equipmentChoices.filter(c => instanceItemId(c) === item.id)
  return same.length > 1 ? `${item.name} #${same.indexOf(uid) + 1}` : item.name
}

/** Capacidade de carga base pela Força: 5 espaços por ponto (2 se Força 0). */
export function getMaxCapacity(strength: number): number {
  return Math.max(2, strength * 5)
}

/** Bônus de capacidade de carga concedido pelas unidades escolhidas (ex.: Mochila Militar = +2). */
export function getEquipmentCarryBonus(choices: string[]): number {
  return choices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    return acc + (item?.carryBonus ?? 0)
  }, 0)
}

/** Capacidade de carga total: base (5×Força da ficha, incluindo maldição Pujança) + bônus dos itens (Mochila Militar etc.). */
export function getTotalCarryCapacity(draft: OrdemCharacterDraft): number {
  return getMaxCapacity(getSheetAttributes(draft).strength) + getEquipmentCarryBonus(draft.equipmentChoices)
}

export function getCurrentSpaces(choices: string[]): number {
  return choices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    return acc + (item ? item.spaces : 0)
  }, 0)
}

/** Quantas unidades escolhidas são de uma dada categoria. */
export function getCategoryCount(choices: string[], category: number): number {
  return choices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    return acc + (item?.category === category ? 1 : 0)
  }, 0)
}

/** Atalho para a Categoria I (mantido por compatibilidade). */
export function getCategoryICount(choices: string[]): number {
  return getCategoryCount(choices, 1)
}

/** Soma o bônus de Defesa das proteções escolhidas (sem modificações). */
export function getEquippedDefenseBonus(choices: string[]): number {
  return choices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    return acc + (item && item.type === 'protection' ? item.defenseBonus : 0)
  }, 0)
}

// ── Efeitos das modificações (Fase B) ──────────────────────────────────────────

function itemMods(draft: OrdemCharacterDraft, uid: string): string[] {
  return draft.equipmentModifications[uid] ?? []
}

/**
 * Categoria efetiva de um item = base + modificações (cada uma +I) + maldições
 * (a 1ª +II, as seguintes +I — pág. 144); teto IV. Ajustes se acumulam.
 */
export function getEffectiveCategory(item: OrdemEquipment, modCount: number, curseCount = 0): number {
  return Math.min(4, item.category + modCount + getCurseCategoryDelta(curseCount))
}

/** Categoria efetiva de uma unidade do draft, lendo as modificações e maldições dela. */
export function getDraftInstanceCategory(draft: OrdemCharacterDraft, uid: string): number {
  const item = getEquipmentByInstance(uid)
  if (!item) return 0
  return getEffectiveCategory(item, itemMods(draft, uid).length, getItemCurses(draft, uid).length)
}

/** Espaços de um item já com as variações das modificações (Discreta −1, Reforçada/Blindada +1...). */
function itemModifiedSpaces(item: OrdemEquipment, modIds: string[]): number {
  const delta = modIds.reduce((acc, id) => acc + (getModification(id)?.spaceDelta ?? 0), 0)
  return Math.max(0, item.spaces + delta)
}

/** Total de espaços ocupados, considerando as modificações. */
export function getModifiedSpaces(draft: OrdemCharacterDraft): number {
  return draft.equipmentChoices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    return acc + (item ? itemModifiedSpaces(item, itemMods(draft, uid)) : 0)
  }, 0)
}

/** Bônus de Defesa total das proteções, incluindo modificações (Reforçada +2) e poderes (Tanque de Guerra). */
export function getModifiedDefenseBonus(draft: OrdemCharacterDraft): number {
  return draft.equipmentChoices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    if (!item || item.type !== 'protection') return acc
    const modDef = itemMods(draft, uid).reduce((s, mid) => s + (getModification(mid)?.defenseBonus ?? 0), 0)
    // Tanque de Guerra: a Defesa (e a RD) da proteção pesada aumenta em +2.
    const warTank = item.id === 'protecao-pesada' && hasClassPower(draft, 'war-tank') ? 2 : 0
    return acc + item.defenseBonus + modDef + warTank
  }, 0)
}

/** Quantas unidades escolhidas têm a categoria EFETIVA (base + modificações + maldições) igual a `category`. */
export function getEffectiveCategoryCount(draft: OrdemCharacterDraft, category: number): number {
  return draft.equipmentChoices.reduce((acc, uid) => {
    return acc + (getEquipmentByInstance(uid) && getDraftInstanceCategory(draft, uid) === category ? 1 : 0)
  }, 0)
}

// ── Vagas de requisição da Patente (F21) ───────────────────────────────────────
// Decisão de mesa: um item de categoria MENOR pode ocupar uma vaga de categoria MAIOR
// (quem pode requisitar um item Cat II pode requisitar um Cat I no lugar). A Tabela 3.1
// continua sendo o total de vagas; só a alocação é flexível pra baixo.

/** Contagem de unidades por categoria efetiva (índices 1..4; Categoria 0 não consome vaga). */
export function getEffectiveCategoryCounts(draft: OrdemCharacterDraft): number[] {
  const counts = [0, 0, 0, 0, 0]
  for (const uid of draft.equipmentChoices) {
    if (!getEquipmentByInstance(uid)) continue
    const cat = getDraftInstanceCategory(draft, uid)
    if (cat >= 1) counts[cat]++
  }
  return counts
}

/**
 * As unidades cabem nas vagas da Patente? Como item menor desce em vaga maior,
 * a condição é: para todo k (1..4), nº de itens com cat ≥ k ≤ nº de vagas com cat ≥ k.
 */
export function fitsPatenteSlots(counts: number[], patente: OrdemPatente): boolean {
  let items = 0
  let slots = 0
  for (let k = 4; k >= 1; k--) {
    items += counts[k] ?? 0
    slots += getCategoryLimit(patente, k)
    if (items > slots) return false
  }
  return true
}

/** Simula ajustes de contagem (ex.: +1 item Cat I, ou mover um item de Cat I→II) e testa se cabe. */
export function fitsWithAdjustedCounts(
  draft: OrdemCharacterDraft,
  patente: OrdemPatente,
  adjust: Record<number, number>,
): boolean {
  const counts = getEffectiveCategoryCounts(draft)
  for (const [cat, delta] of Object.entries(adjust)) {
    const c = Number(cat)
    if (c >= 1 && c <= 4) counts[c] += delta
  }
  return fitsPatenteSlots(counts, patente)
}

export type CategorySlotInfo = {
  category: number
  /** Unidades cuja categoria efetiva é esta. */
  items: number
  /** Vagas desta categoria ocupadas (próprias + emprestadas de categorias menores). */
  usedSlots: number
  /** Quantas dessas vagas estão ocupadas por itens de categoria MENOR. */
  spillIn: number
  limit: number
  /** Estouro real neste nível (itens de cat ≥ k além das vagas de cat ≥ k) — inválido. */
  overflow: boolean
}

/**
 * Alocação das unidades nas vagas da Patente, pra exibição nos contadores:
 * itens de categoria maior alocam primeiro; cada item usa a menor vaga livre ≥ à sua categoria.
 */
export function getCategorySlotAllocation(draft: OrdemCharacterDraft, patente: OrdemPatente): CategorySlotInfo[] {
  const counts = getEffectiveCategoryCounts(draft)
  const free = [0, 1, 2, 3, 4].map(k => (k === 0 ? 0 : getCategoryLimit(patente, k)))
  const used = [0, 0, 0, 0, 0]
  const spillIn = [0, 0, 0, 0, 0]
  for (let c = 4; c >= 1; c--) {
    let remaining = counts[c]
    for (let k = c; k <= 4 && remaining > 0; k++) {
      const take = Math.min(remaining, free[k])
      free[k] -= take
      used[k] += take
      if (k > c) spillIn[k] += take
      remaining -= take
    }
    // `remaining > 0` = configuração inválida; a validação bloqueia, aqui só exibimos.
  }
  return [1, 2, 3, 4].map(k => {
    let items = 0
    let slots = 0
    for (let c = k; c <= 4; c++) {
      items += counts[c]
      slots += getCategoryLimit(patente, c)
    }
    return { category: k, items: counts[k], usedSlots: used[k], spillIn: spillIn[k], limit: getCategoryLimit(patente, k), overflow: items > slots }
  })
}

/**
 * As maldições aplicadas são estruturalmente válidas? (alvo certo, sem duplicatas, sem
 * elementos opressores no mesmo item, e com o parâmetro escolhido quando exigido).
 */
export function areCursesValid(draft: OrdemCharacterDraft): boolean {
  for (const uid of draft.equipmentChoices) {
    const item = getEquipmentByInstance(uid)
    const curses = getItemCurses(draft, uid)
    if (curses.length === 0) continue
    if (!item) return false
    for (let i = 0; i < curses.length; i++) {
      // Cada maldição precisa ser aplicável considerando as demais da unidade.
      const others = curses.filter((_, j) => j !== i)
      if (!canApplyCurse(item, others, curses[i], draft.equipmentCurseChoices, uid)) return false
      const curse = getCurse(curses[i])
      if (curse?.choice && !draft.equipmentCurseChoices[curseChoiceKey(uid, curse.id)]) return false
    }
  }
  return true
}

export function isEquipmentStepComplete(draft: OrdemCharacterDraft): boolean {
  // A carga (já com as variações das modificações) é limitada pela capacidade (5×Força + bônus). Loadout vazio é válido.
  const capacity = getTotalCarryCapacity(draft)
  if (getModifiedSpaces(draft) > capacity) return false

  // As vagas da Tabela 3.1 limitam as unidades pela categoria EFETIVA (base + mods + maldições);
  // Categoria 0 é ilimitada, e item de categoria menor pode ocupar vaga de categoria maior (F21).
  const patente = getPatente(draft.patente)
  if (!fitsPatenteSlots(getEffectiveCategoryCounts(draft), patente)) return false

  // Maldições precisam ser válidas (alvo, oposição de elementos, parâmetros escolhidos).
  if (!areCursesValid(draft)) return false

  // Proficiência de arma NÃO bloqueia: o livro permite possuir uma arma sem proficiência (com
  // penalidade ao usá-la). A UI apenas sinaliza "Sem Proficiência" — ver `hasWeaponProficiency`.
  return true
}

/** Se o agente tem proficiência com a arma — pela classe ou por poderes (apenas informativo, não bloqueia). */
export function hasWeaponProficiency(draft: OrdemCharacterDraft, item: OrdemEquipment): boolean {
  if (item.type !== 'weapon' || !draft.class) return true
  const cls = getOrdemClass(draft.class)
  if (cls?.weaponProficiencies.includes(item.proficiency)) return true
  // Poderes que concedem proficiência: Armamento Pesado, Balística Avançada, Ninja Urbano.
  if (item.proficiency === 'heavy' && hasClassPower(draft, 'heavy-weapons')) return true
  if (item.proficiency === 'tactical' && item.weaponCategory === 'fogo' && hasClassPower(draft, 'advanced-ballistics')) return true
  if (item.proficiency === 'tactical' && item.weaponCategory === 'corpo_a_corpo' && hasClassPower(draft, 'urban-ninja')) return true
  return false
}

/**
 * Elementos dos rituais conhecidos SEM os componentes ritualísticos correspondentes no loadout.
 * Conjurar exige manipular componentes do elemento (exceto Medo) — sem eles, o ritual não sai
 * (pág. 119). Não bloqueia a ficha; alimenta o aviso no Equipamento/Revisão.
 */
export function getMissingRitualComponentElements(draft: OrdemCharacterDraft): OrdemElement[] {
  if (draft.class !== 'occultist') return []
  const needed = new Set<OrdemElement>()
  for (const id of draft.ritualChoices.slice(0, getRitualSlotsCount(draft.nex))) {
    if (!id) continue
    const ritual = getRitualById(id)
    if (!ritual) continue
    // Ritual multi-elemento vale pelo elemento escolhido ao aprender (ex.: Amaldiçoar Arma).
    const element = ritual.elements.length > 1 ? draft.ritualElementChoices[ritual.id] : ritual.elements[0]
    if (element && element !== 'fear') needed.add(element)
  }
  const owned = new Set(draft.equipmentChoices.map(uid => getEquipmentByInstance(uid)?.ritualComponentFor))
  return [...needed].filter(el => !owned.has(el))
}
