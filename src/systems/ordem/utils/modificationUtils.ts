import modificationsJson from '../data/modifications.json'
import type { OrdemModification } from '../types/modification'
import type { OrdemEquipment } from '../types/equipment'

export const MODIFICATIONS = modificationsJson as OrdemModification[]

export function getModification(id: string): OrdemModification | undefined {
  return MODIFICATIONS.find(m => m.id === id)
}

/** Uma modificação pode ser aplicada a este item? (Tabelas 3.5/3.7/3.9). */
export function modAppliesTo(mod: OrdemModification, item: OrdemEquipment): boolean {
  switch (mod.target) {
    case 'weapon-any':
      return item.type === 'weapon'
    case 'weapon-melee-ranged':
      return item.type === 'weapon' && ['corpo_a_corpo', 'arremesso', 'disparo'].includes(item.weaponCategory)
    case 'weapon-firearm':
      return item.type === 'weapon' && item.weaponCategory === 'fogo'
    case 'ammunition':
      return item.id.startsWith('municao-')
    case 'protection-any':
      return item.type === 'protection'
    case 'protection-heavy':
      return item.type === 'protection' && item.id === 'protecao-pesada'
    case 'protection-light':
      return item.type === 'protection' && item.id === 'protecao-leve'
    case 'accessory':
      return item.type === 'accessory'
  }
}

/** Item pode receber modificações? (armas, munições, proteções e acessórios). */
export function isModifiable(item: OrdemEquipment): boolean {
  return MODIFICATIONS.some(m => modAppliesTo(m, item))
}

/** Modificações disponíveis para um item (todas as que se aplicam a ele). */
export function getAvailableModifications(item: OrdemEquipment): OrdemModification[] {
  return MODIFICATIONS.filter(m => modAppliesTo(m, item))
}

/** Uma modificação pode ser adicionada agora? (aplica-se ao item, ainda não aplicada, e não conflita). */
export function canApplyModification(item: OrdemEquipment, applied: string[], modId: string): boolean {
  const mod = getModification(modId)
  if (!mod || !modAppliesTo(mod, item)) return false
  if (applied.includes(modId)) return false // iguais não acumulam
  // conflitos mútuos (ex.: Reforçada × Discreta)
  for (const otherId of applied) {
    const other = getModification(otherId)
    if (mod.excludes?.includes(otherId) || other?.excludes?.includes(modId)) return false
  }
  return true
}
