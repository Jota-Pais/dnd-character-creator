import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemEquipment } from '../types/equipment'
import equipmentsJson from '../data/equipments.json'
import { getOrdemClass } from './classUtils'

export const EQUIPMENTS = equipmentsJson as OrdemEquipment[]

export function getEquipmentById(id: string): OrdemEquipment | undefined {
  return EQUIPMENTS.find(e => e.id === id)
}

export function getMaxCapacity(strength: number): number {
  return Math.max(2, strength * 5)
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

export function isEquipmentStepComplete(draft: OrdemCharacterDraft): boolean {
  const capacity = getMaxCapacity(draft.attributes.strength)
  const currentSpaces = getCurrentSpaces(draft.equipmentChoices)
  if (currentSpaces > capacity * 2) { // Cannot exceed double capacity, actually the limit is capacity for creating? The roadmap says "restrito por carga = 5×Força". Let's restrict to capacity.
    return false
  }

  const cat1Count = getCategoryICount(draft.equipmentChoices)
  if (cat1Count > 2) {
    return false
  }

  // Check proficiency (this is tricky because we only check weapons)
  if (draft.class) {
    const cls = getOrdemClass(draft.class)
    if (cls) {
      for (const id of draft.equipmentChoices) {
        const item = getEquipmentById(id)
        if (item && item.type === 'weapon') {
          if (!cls.weaponProficiencies.includes(item.proficiency)) {
            return false
          }
        }
      }
    }
  }

  return true
}
