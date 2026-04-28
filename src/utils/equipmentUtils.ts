import type { EquipmentPack, InventoryItem } from '../types/equipment'
import packsData from '../data/equipment-packs.json'
import generalItemsData from '../data/general-items.json'
import toolsData from '../data/tools.json'

const ALL_PACKS = packsData as EquipmentPack[]
const GENERAL_IDS = new Set((generalItemsData as { id: string }[]).map(i => i.id))
const TOOL_IDS = new Set((toolsData as { id: string }[]).map(t => t.id))

// IDs de cada variante de foco, agrupados por tipo
export const FOCUS_GROUP_IDS: Record<'arcane' | 'druidic' | 'holy', string[]> = {
  arcane: ['rod', 'arcane-staff', 'crystal', 'orb', 'wand'],
  druidic: ['wooden-staff', 'sprig-of-mistletoe', 'totem', 'yew-wand'],
  holy: ['amulet', 'emblem', 'reliquary'],
}

/**
 * Converte um custo canônico em peças de cobre (pc) para string legível.
 * null → '—' (item sem preço publicado no PHB)
 */
export function formatCurrency(copper: number | null): string {
  if (copper === null) return '—'
  if (copper === 0) return '0 pc'
  if (copper % 1000 === 0) return `${copper / 1000} ppt`
  if (copper % 100 === 0) return `${copper / 100} po`
  if (copper % 10 === 0) return `${copper / 10} pp`
  return `${copper} pc`
}

/**
 * Expande um packId em uma lista plana de InventoryItems.
 * Retorna [] se o pacote não for encontrado.
 */
export function resolvePackContents(
  packId: string,
  source: InventoryItem['source'] = 'class',
): InventoryItem[] {
  const pack = ALL_PACKS.find(p => p.id === packId)
  if (!pack) return []
  return pack.contents.map(item => ({
    itemId: item.ref,
    quantity: item.quantity,
    source,
  }))
}

/**
 * Valida que todos os refs nos pacotes apontam para itens conhecidos.
 * Retorna lista de erros (vazia = tudo certo). Uso em dev/testes.
 */
export function validatePackRefs(): { packId: string; invalidRefs: string[] }[] {
  return ALL_PACKS.flatMap(pack => {
    const invalidRefs = pack.contents
      .map(item => item.ref)
      .filter(ref => !GENERAL_IDS.has(ref) && !TOOL_IDS.has(ref))
    return invalidRefs.length > 0 ? [{ packId: pack.id, invalidRefs }] : []
  })
}
