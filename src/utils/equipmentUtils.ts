import type {
  EquipmentPack, InventoryItem, Weapon, Armor, Tool, GeneralItem,
  WeaponFilter, ToolCategory, EquipmentChoice, EquipmentOption,
  EquipmentChoiceItem, ChoiceResolution, EquipmentDraft, ClassStartingEquipment,
} from '../types/equipment'
import packsData from '../data/equipment-packs.json'
import generalItemsData from '../data/general-items.json'
import toolsData from '../data/tools.json'
import weaponsData from '../data/weapons.json'
import armorsData from '../data/armors.json'

const ALL_PACKS = packsData as EquipmentPack[]
const ALL_GENERAL = generalItemsData as GeneralItem[]
const ALL_TOOLS = toolsData as Tool[]
const ALL_WEAPONS = weaponsData as Weapon[]
const ALL_ARMORS = armorsData as Armor[]

const GENERAL_IDS = new Set(ALL_GENERAL.map(i => i.id))
const TOOL_IDS = new Set(ALL_TOOLS.map(t => t.id))

// IDs de cada variante de foco, agrupados por tipo
export const FOCUS_GROUP_IDS: Record<'arcane' | 'druidic' | 'holy', string[]> = {
  arcane: ['rod', 'arcane-staff', 'crystal', 'orb', 'wand'],
  druidic: ['wooden-staff', 'sprig-of-mistletoe', 'totem', 'yew-wand'],
  holy: ['amulet', 'emblem', 'reliquary'],
}

/**
 * Localiza a armadura de corpo e o escudo efetivamente equipados a partir do
 * equipamento resolvido. Considera itens fixos + escolhas da classe (método
 * padrão) e itens comprados (método riqueza). Escudo é reportado à parte, pois
 * empilha com a armadura e com a Defesa sem Armadura do bárbaro.
 */
export function getEquippedArmor(
  equipment: EquipmentDraft,
  classEquipment: ClassStartingEquipment | undefined,
): { bodyArmor?: Armor; hasShield: boolean } {
  const armors: Armor[] = []

  if (equipment.method === 'standard' && classEquipment) {
    for (const item of classEquipment.fixed) {
      if (item.itemType === 'armor') {
        const a = getArmor(item.id)
        if (a) armors.push(a)
      }
    }
    for (let i = 0; i < classEquipment.choices.length; i++) {
      const res = equipment.classResolutions[i]
      if (!res || res.optionIndex < 0) continue
      const option = classEquipment.choices[i]?.options[res.optionIndex]
      if (!option) continue
      for (const choiceItem of option) {
        if (choiceItem.kind === 'specific' && choiceItem.itemType === 'armor') {
          const a = getArmor(choiceItem.id)
          if (a) armors.push(a)
        }
      }
    }
  }

  // Itens comprados (método riqueza) — vazio até a loja da fase 5, mas mantém a CA correta
  for (const item of equipment.purchasedItems) {
    const a = getArmor(item.itemId)
    if (a) armors.push(a)
  }

  const bodyArmor = armors.find(a => a.category !== 'shield')
  const hasShield = armors.some(a => a.category === 'shield')
  return { bodyArmor, hasShield }
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

export function getArmor(id: string): Armor | undefined {
  return ALL_ARMORS.find(a => a.id === id)
}

export function getItemName(id: string): string {
  return (
    ALL_WEAPONS.find(w => w.id === id)?.name ??
    ALL_ARMORS.find(a => a.id === id)?.name ??
    ALL_TOOLS.find(t => t.id === id)?.name ??
    ALL_GENERAL.find(g => g.id === id)?.name ??
    ALL_PACKS.find(p => p.id === id)?.name ??
    id
  )
}

// ── Loja (método riqueza) ───────────────────────────────────────────────────

export type ShopCategory = 'Armas' | 'Armaduras' | 'Ferramentas' | 'Pacotes' | 'Equipamento'

export type ShopItem = {
  id: string
  name: string
  costCopper: number
  category: ShopCategory
}

/** Catálogo unificado de itens compráveis (só os que têm preço no PHB), ordenado por nome. */
export function getShopCatalog(): ShopItem[] {
  const items: ShopItem[] = []
  for (const w of ALL_WEAPONS) if (w.cost != null) items.push({ id: w.id, name: w.name, costCopper: w.cost, category: 'Armas' })
  for (const a of ALL_ARMORS) if (a.cost != null) items.push({ id: a.id, name: a.name, costCopper: a.cost, category: 'Armaduras' })
  for (const t of ALL_TOOLS) if (t.cost != null) items.push({ id: t.id, name: t.name, costCopper: t.cost, category: 'Ferramentas' })
  for (const p of ALL_PACKS) if (p.cost != null) items.push({ id: p.id, name: p.name, costCopper: p.cost, category: 'Pacotes' })
  for (const g of ALL_GENERAL) {
    // itens de antecedente (bugigangas de sabor, custo 0) não são mercadoria da loja
    if (g.cost != null && g.cost > 0 && g.category !== 'background-item') {
      items.push({ id: g.id, name: g.name, costCopper: g.cost, category: 'Equipamento' })
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

const CATALOG_COST = new Map(getShopCatalog().map(i => [i.id, i.costCopper]))

/** Custo em cobre de um item comprável (null se não tem preço/existe). */
export function getItemCostCopper(id: string): number | null {
  return CATALOG_COST.get(id) ?? null
}

/** Total gasto (em cobre) numa lista de itens comprados. */
export function getPurchasesTotalCopper(items: InventoryItem[]): number {
  return items.reduce((sum, it) => sum + (CATALOG_COST.get(it.itemId) ?? 0) * it.quantity, 0)
}

export function getWeaponsForFilter(filter: WeaponFilter): Weapon[] {
  return ALL_WEAPONS.filter(w => {
    if (filter.category && w.category !== filter.category) return false
    if (filter.weaponType && w.weaponType !== filter.weaponType) return false
    return true
  })
}

export function getToolsForCategory(category: ToolCategory): Tool[] {
  return ALL_TOOLS.filter(t => t.category === category)
}

export function getFocusGroupItems(group: 'arcane' | 'druidic' | 'holy'): GeneralItem[] {
  const ids = FOCUS_GROUP_IDS[group]
  return ALL_GENERAL.filter(g => ids.includes(g.id))
}

const WEAPON_CAT_LABEL: Record<string, string> = {
  simple: 'simples',
  martial: 'marcial',
}
const WEAPON_TYPE_LABEL: Record<string, string> = {
  melee: 'corpo a corpo',
  ranged: 'à distância',
}
const TOOL_CAT_LABEL: Record<string, string> = {
  artisan: 'ferramenta de artesão',
  'musical-instrument': 'instrumento musical',
  'gaming-set': 'conjunto de jogos',
  other: 'outra ferramenta',
  vehicle: 'veículo',
}
const FOCUS_GROUP_LABEL: Record<string, string> = {
  arcane: 'Foco Arcano',
  druidic: 'Foco Druídico',
  holy: 'Símbolo Sagrado',
}

export function describeEquipmentOption(option: EquipmentChoiceItem[]): string {
  return option.map(item => {
    switch (item.kind) {
      case 'specific': {
        const name = getItemName(item.id)
        return item.quantity > 1 ? `${item.quantity}× ${name}` : name
      }
      case 'weapon-filter': {
        const cat = item.filter.category ? `arma ${WEAPON_CAT_LABEL[item.filter.category]}` : 'qualquer arma'
        const type = item.filter.weaponType ? ` ${WEAPON_TYPE_LABEL[item.filter.weaponType]}` : ''
        return `Qualquer ${cat}${type}`
      }
      case 'tool-filter':
        return `Qualquer ${TOOL_CAT_LABEL[item.category] ?? item.category}`
      case 'focus-group':
        return `${FOCUS_GROUP_LABEL[item.group] ?? item.group} (à sua escolha)`
    }
  }).join(' + ')
}

function countRequiredPicks(option: EquipmentOption): number {
  return option.reduce((sum, item) => {
    if (item.kind === 'weapon-filter') return sum + item.picks
    if (item.kind === 'tool-filter') return sum + item.picks
    if (item.kind === 'focus-group') return sum + item.picks
    return sum
  }, 0)
}

export function isChoiceResolved(
  choice: EquipmentChoice,
  resolution: ChoiceResolution | undefined,
): boolean {
  // Single-option choices with no sub-picks are always resolved (nothing to select)
  if (choice.options.length === 1 && countRequiredPicks(choice.options[0]) === 0) return true
  if (!resolution || resolution.optionIndex < 0) return false
  const option = choice.options[resolution.optionIndex]
  if (!option) return false
  return resolution.pickedIds.length >= countRequiredPicks(option)
}

export function isEquipmentStepComplete(
  equipment: EquipmentDraft,
  classEquipment?: ClassStartingEquipment,
): boolean {
  if (!equipment.method) return false
  if (equipment.method === 'wealth') return equipment.rolledGold !== null
  if (!classEquipment) return false
  return classEquipment.choices.every((choice, idx) =>
    isChoiceResolved(choice, equipment.classResolutions[idx]),
  )
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
