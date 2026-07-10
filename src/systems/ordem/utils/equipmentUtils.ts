import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemEquipment } from '../types/equipment'
import equipmentsJson from '../data/equipments.json'
import { getOrdemClass } from './classUtils'
import { getEffectiveAttributes } from './characterUtils'
import { getPatente, getCategoryLimit } from './patenteUtils'

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

/** Capacidade de carga total: base (5×Força efetiva) + bônus dos itens equipados (Mochila Militar etc.). */
export function getTotalCarryCapacity(draft: OrdemCharacterDraft): number {
  return getMaxCapacity(getEffectiveAttributes(draft).strength) + getEquipmentCarryBonus(draft.equipmentChoices)
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

/** Soma o bônus de Defesa das proteções escolhidas (Defesa = 10 + Agilidade + este bônus; livro pág. 43). */
export function getEquippedDefenseBonus(choices: string[]): number {
  return choices.reduce((acc, id) => {
    const item = getEquipmentById(id)
    return acc + (item && item.type === 'protection' ? item.defenseBonus : 0)
  }, 0)
}

export function isEquipmentStepComplete(draft: OrdemCharacterDraft): boolean {
  // A carga é limitada pela capacidade (5×Força efetiva + bônus de itens). Um loadout vazio é válido.
  const capacity = getTotalCarryCapacity(draft)
  if (getCurrentSpaces(draft.equipmentChoices) > capacity) return false

  // Cada categoria (I–IV) é limitada pela Patente do agente (Tabela 3.1); Categoria 0 é ilimitada.
  const patente = getPatente(draft.patente)
  for (let cat = 1; cat <= 4; cat++) {
    if (getCategoryCount(draft.equipmentChoices, cat) > getCategoryLimit(patente, cat)) return false
  }

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
