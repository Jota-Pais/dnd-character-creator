import cursesJson from '../data/curses.json'
import type { OrdemCurse } from '../types/curse'
import type { OrdemCharacterDraft, OrdemAttributes } from '../types/character'
import type { OrdemClass } from '../types/class'
import type { OrdemEquipment } from '../types/equipment'
import type { OrdemElement } from '../types/ritual'
import { getEffectiveAttributes, deriveStats } from './characterUtils'
import type { DerivedStats } from './characterUtils'
import { ELEMENT_NAMES } from './ritualUtils'

export const CURSES = cursesJson as OrdemCurse[]

export function getCurse(id: string): OrdemCurse | undefined {
  return CURSES.find(c => c.id === id)
}

/**
 * Ciclo de opressão dos elementos (Cap. "O Outro Lado"): Sangue oprime Conhecimento,
 * Morte oprime Sangue, Energia oprime Morte, Conhecimento oprime Energia.
 * Um item não pode ter maldições de elementos opressores (pág. 144).
 */
const OPPRESSES: Partial<Record<OrdemElement, OrdemElement>> = {
  blood: 'knowledge',
  death: 'blood',
  energy: 'death',
  knowledge: 'energy',
}

export function areOpposingElements(a: OrdemElement | null, b: OrdemElement | null): boolean {
  if (!a || !b) return false
  return OPPRESSES[a] === b || OPPRESSES[b] === a
}

/** Chave das escolhas de parâmetro de maldição (elemento/ritual) em `equipmentCurseChoices`. */
export function curseChoiceKey(itemId: string, curseId: string): string {
  return `${itemId}:${curseId}`
}

/**
 * Elemento efetivo de uma maldição aplicada a um item: o da maldição, ou o escolhido
 * quando o elemento varia (Proteção Elemental). Null enquanto a escolha não foi feita.
 */
export function getAppliedCurseElement(
  curse: OrdemCurse,
  itemId: string,
  curseChoices: Record<string, string>,
): OrdemElement | null {
  if (curse.element !== 'varies') return curse.element
  const chosen = curseChoices[curseChoiceKey(itemId, curse.id)]
  return (chosen as OrdemElement) || null
}

/** Rótulo do elemento de uma maldição aplicada: fixo, o escolhido, ou aviso de escolha pendente. */
export function formatCurseElement(
  curse: OrdemCurse,
  itemId: string,
  curseChoices: Record<string, string>,
): string {
  const element = getAppliedCurseElement(curse, itemId, curseChoices)
  return element ? ELEMENT_NAMES[element] : 'elemento a escolher'
}

/** Uma maldição pode ser aplicada a este item? (pág. 145-148). */
export function curseAppliesTo(curse: OrdemCurse, item: OrdemEquipment): boolean {
  switch (curse.target) {
    case 'weapon-any':
      return item.type === 'weapon'
    case 'weapon-melee':
      return item.type === 'weapon' && ['corpo_a_corpo', 'arremesso'].includes(item.weaponCategory)
    case 'protection-any':
      return item.type === 'protection'
    case 'accessory-wear':
      // O livro restringe a utensílios e vestuários (kits ficam de fora).
      return item.id === 'utensilio' || item.id === 'vestimenta'
  }
}

/** Item pode receber maldições? */
export function isCursable(item: OrdemEquipment): boolean {
  return CURSES.some(c => curseAppliesTo(c, item))
}

/** Maldições disponíveis para um item. */
export function getAvailableCurses(item: OrdemEquipment): OrdemCurse[] {
  return CURSES.filter(c => curseAppliesTo(c, item))
}

/**
 * Uma maldição pode ser adicionada agora? Regras da pág. 144: maldições iguais não se
 * acumulam no item, e elementos opressores não coexistem no mesmo item.
 */
export function canApplyCurse(
  item: OrdemEquipment,
  applied: string[],
  curseId: string,
  curseChoices: Record<string, string> = {},
): boolean {
  const curse = getCurse(curseId)
  if (!curse || !curseAppliesTo(curse, item)) return false
  if (applied.includes(curseId)) return false
  const element = getAppliedCurseElement(curse, item.id, curseChoices)
  for (const otherId of applied) {
    const other = getCurse(otherId)
    if (!other) continue
    const otherElement = getAppliedCurseElement(other, item.id, curseChoices)
    if (areOpposingElements(element, otherElement)) return false
  }
  return true
}

/** Aumento de categoria pelas maldições de um item: a 1ª sobe em II, as seguintes em I (pág. 144). */
export function getCurseCategoryDelta(curseCount: number): number {
  return curseCount === 0 ? 0 : curseCount + 1
}

// ── Efeitos das maldições nos números da ficha ─────────────────────────────────

/** Maldições dos itens de um draft (só de itens realmente equipados). */
export function getItemCurses(draft: OrdemCharacterDraft, itemId: string): string[] {
  return draft.equipmentChoices.includes(itemId) ? (draft.equipmentCurses[itemId] ?? []) : []
}

/**
 * Maldições únicas entre todos os itens equipados — "bônus de itens amaldiçoados não se
 * acumulam" (pág. 144): a mesma maldição em dois itens concede o benefício uma vez só.
 */
export function getUniqueEquippedCurses(draft: OrdemCharacterDraft): OrdemCurse[] {
  const ids = new Set<string>()
  for (const itemId of draft.equipmentChoices) {
    for (const curseId of draft.equipmentCurses[itemId] ?? []) ids.add(curseId)
  }
  return [...ids].map(getCurse).filter((c): c is OrdemCurse => Boolean(c))
}

/**
 * Atributos exibidos na ficha: efetivos (base + aumentos de NEX) + bônus de acessórios
 * amaldiçoados (Carisma, Sagacidade, Destreza, Disposição, Pujança). O teto 5 vale só
 * para Aumentos de Atributo ("desta forma") — bônus de maldição não é limitado por ele.
 */
export function getSheetAttributes(draft: OrdemCharacterDraft): OrdemAttributes {
  const attrs = { ...getEffectiveAttributes(draft) }
  for (const curse of getUniqueEquippedCurses(draft)) {
    if (curse.attributeBonus) attrs[curse.attributeBonus.attribute] += curse.attributeBonus.value
  }
  return attrs
}

/** Bônus incondicional de Defesa das maldições equipadas (Repulsora, Cinética, Letárgica, Defesa). */
export function getCurseDefenseBonus(draft: OrdemCharacterDraft): number {
  return getUniqueEquippedCurses(draft).reduce((s, c) => s + (c.defenseBonus ?? 0), 0)
}

/**
 * PV/PE/Sanidade/Defesa finais, com as maldições dobradas:
 * - Vigor de maldição (Disposição) entra no PV retroativamente, como qualquer Vigor;
 * - Presença do Carisma NÃO entra no PE (ressalva do livro), mas vale pra testes;
 * - Vitalidade +15 PV e Esforço Adicional +5 PE são fixos;
 * - Defesa usa a Agilidade da ficha (com Destreza) + bônus de Defesa das maldições.
 */
export function getCursedDerivedStats(
  draft: OrdemCharacterDraft,
  cls: OrdemClass,
  protectionBonus = 0,
): DerivedStats {
  const sheet = getSheetAttributes(draft)
  const curses = getUniqueEquippedCurses(draft)
  const noPePresence = curses.reduce(
    (s, c) => s + (c.attributeBonus?.attribute === 'presence' && c.attributeBonus.noPe ? c.attributeBonus.value : 0),
    0,
  )
  const stats = deriveStats(
    cls,
    { ...sheet, presence: sheet.presence - noPePresence },
    draft.nex,
    protectionBonus + getCurseDefenseBonus(draft),
  )
  const hpFlat = curses.reduce((s, c) => s + (c.hpBonus ?? 0), 0)
  const peFlat = curses.reduce((s, c) => s + (c.peBonus ?? 0), 0)
  return { ...stats, hp: stats.hp + hpFlat, pe: stats.pe + peFlat }
}
