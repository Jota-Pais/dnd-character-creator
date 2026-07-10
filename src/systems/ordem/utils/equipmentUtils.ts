import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemEquipment } from '../types/equipment'
import equipmentsJson from '../data/equipments.json'
import { getOrdemClass } from './classUtils'
import { getEffectiveAttributes } from './characterUtils'

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

export function getCategoryICount(choices: string[]): number {
  return choices.reduce((acc, id) => {
    const item = getEquipmentById(id)
    return acc + (item?.category === 1 ? 1 : 0)
  }, 0)
}

/** Soma o bônus de Defesa das proteções escolhidas (Defesa = 10 + Agilidade + este bônus; livro pág. 43). */
export function getEquippedDefenseBonus(choices: string[]): number {
  return choices.reduce((acc, id) => {
    const item = getEquipmentById(id)
    return acc + (item && item.type === 'protection' ? item.defenseBonus : 0)
  }, 0)
}

export function isEquipmentStepComplete(draft: OrdemCharacterDraft): boolean {
  // Loadout Recruta: carga limitada pela capacidade (5×Força efetiva), no máximo 2 itens
  // de Categoria I e nenhum item de Categoria II+; armas exigem proficiência da classe.
  // Um loadout vazio é válido.
  const capacity = getTotalCarryCapacity(draft)
  if (getCurrentSpaces(draft.equipmentChoices) > capacity) return false

  if (getCategoryICount(draft.equipmentChoices) > 2) return false

  // Recruta só acessa Categoria 0 e I — a UI já filtra, mas uma ficha importada/editada
  // à mão poderia trazer um item de categoria superior; rejeita defensivamente.
  for (const id of draft.equipmentChoices) {
    const item = getEquipmentById(id)
    if (item && item.category > 1) return false
  }

  if (draft.class) {
    const cls = getOrdemClass(draft.class)
    if (cls) {
      for (const id of draft.equipmentChoices) {
        const item = getEquipmentById(id)
        if (item?.type === 'weapon' && !cls.weaponProficiencies.includes(item.proficiency)) {
          return false
        }
      }
    }
  }

  return true
}
