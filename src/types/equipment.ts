// Custo armazenado canonicamente em peças de cobre (pc).
// null  = sem preço publicado no PHB (item não vendido individualmente)
// 0     = item narrativo de antecedente (concedido gratuitamente)
// Apresentação via formatCurrency() em src/utils/equipmentUtils.ts

// --- Dano ---
// { dice:1, sides:6 } = 1d6  |  { dice:2, sides:6 } = 2d6
// { flat:1 }          = zarabatana (1 fixo)
export type DamageRoll =
  | { dice: number; sides: number; flat?: number }
  | { flat: number }

// --- Armas ---
export type DamageType = 'bludgeoning' | 'piercing' | 'slashing'
export type WeaponCategory = 'simple' | 'martial'
export type WeaponType = 'melee' | 'ranged'

export type WeaponProperty =
  | { kind: 'ammunition'; normalRange: number; longRange: number }
  | { kind: 'finesse' }
  | { kind: 'heavy' }
  | { kind: 'light' }
  | { kind: 'loading' }
  | { kind: 'range'; normalRange: number; longRange: number }
  | { kind: 'reach' }
  | { kind: 'special' }
  | { kind: 'thrown'; normalRange: number; longRange: number }
  | { kind: 'two-handed' }
  | { kind: 'versatile'; alternateDamage: DamageRoll }

export type Weapon = {
  id: string
  name: string
  category: WeaponCategory
  weaponType: WeaponType
  cost: number | null
  damage: DamageRoll | null  // null = sem dano (ex: rede)
  damageType: DamageType | null
  weight: number | null      // kg
  properties: WeaponProperty[]
}

// --- Armaduras ---
export type ArmorCategory = 'light' | 'medium' | 'heavy' | 'shield'
export type DexModifier = 'full' | 'max-2' | 'none'

export type Armor = {
  id: string
  name: string
  category: ArmorCategory
  cost: number
  acBase: number
  dexModifier: DexModifier
  strengthRequirement: number | null
  stealthDisadvantage: boolean
  weight: number | null
}

// --- Ferramentas ---
// Campos omitidos no WeaponFilter = sem restrição nessa dimensão.
// 'vehicle' = proficiência em veículos (sem item físico, cost/weight null)
export type ToolCategory = 'artisan' | 'musical-instrument' | 'gaming-set' | 'other' | 'vehicle'

export type Tool = {
  id: string
  name: string
  category: ToolCategory
  cost: number | null
  weight: number | null
}

// --- Equipamento Geral ---
export type GeneralItemCategory =
  | 'container'
  | 'light-source'
  | 'food'
  | 'clothing'
  | 'focus'
  | 'ammunition'
  | 'religious'
  | 'tool-related'
  | 'consumable'
  | 'survival'
  | 'general'
  | 'background-item'

export type GeneralItem = {
  id: string
  name: string
  category: GeneralItemCategory
  cost: number | null
  weight: number | null
}

// --- Pacotes de Equipamento ---
export type PackItem = {
  ref: string    // ID em tools.json ou general-items.json
  quantity: number
}

export type EquipmentPack = {
  id: string
  name: string
  cost: number   // pc
  contents: PackItem[]
}

// --- Choices de Equipamento de Classe ---
export type ItemType = 'weapon' | 'armor' | 'tool' | 'general' | 'pack'

// Campos omitidos = sem restrição nessa dimensão. {} = qualquer arma.
export type WeaponFilter = {
  category?: WeaponCategory
  weaponType?: WeaponType
}

// Unidade atômica de uma opção de equipamento, resolvível pela UI
export type EquipmentChoiceItem =
  | { kind: 'specific'; id: string; itemType: ItemType; quantity: number }
  | { kind: 'weapon-filter'; filter: WeaponFilter; picks: number }
  | { kind: 'tool-filter'; category: ToolCategory; picks: number }
  | { kind: 'focus-group'; group: 'arcane' | 'druidic' | 'holy'; picks: number }

// Grupo de itens que vêm juntos quando uma opção é escolhida
export type EquipmentOption = EquipmentChoiceItem[]

export type EquipmentChoice = {
  options: EquipmentOption[]  // jogador escolhe exatamente 1
}

// Somente itens 100% determinados — nenhuma sub-seleção pendente
export type FixedItem = {
  kind: 'specific'
  id: string
  itemType: ItemType
  quantity: number
}

export type ClassStartingEquipment = {
  fixed: FixedItem[]
  choices: EquipmentChoice[]
  wealthDice: string        // ex: "2d4", "5d4"
  wealthMultiplier: number  // 10 para quase todas; 1 para Monge
  wealthUnit: 'po'
}

// --- Equipamento de Antecedente ---
export type BackgroundEquipmentItem =
  | { kind: 'specific'; id: string; itemType: 'weapon' | 'armor' | 'tool' | 'general'; quantity: number }
  | { kind: 'chosen-tool' }  // a ferramenta escolhida na proficiência do antecedente
  | { kind: 'focus-group'; group: 'holy' | 'arcane' | 'druidic' }

export type BackgroundEquipment = {
  items: BackgroundEquipmentItem[]
  goldPo: number
}

// --- Inventário (resultado do Passo 6) ---
export type InventoryItemSource = 'class' | 'background' | 'purchased'

export type InventoryItem = {
  itemId: string
  quantity: number
  source: InventoryItemSource
}

export type CharacterInventory = {
  weapons: InventoryItem[]
  armors: InventoryItem[]
  tools: InventoryItem[]
  generalItems: InventoryItem[]
  packs: InventoryItem[]
  remainingGold: number
}

// --- Rascunho do Passo 6 (persistido no CharacterDraft) ---

// Resolução de uma EquipmentChoice: qual opção foi escolhida e quais IDs
// foram selecionados para itens que requerem sub-seleção (filtros/focus)
export type ChoiceResolution = {
  optionIndex: number  // -1 = ainda não escolhido
  pickedIds: string[]  // IDs selecionados para weapon-filter / tool-filter / focus-group
}

export type EquipmentDraft = {
  method: 'standard' | 'wealth' | null
  // Alinhado com classStartingEquipment.choices (um por choice)
  classResolutions: ChoiceResolution[]
  rolledGold: number | null    // em po, apenas para método 'wealth'
  purchasedItems: InventoryItem[]
}

export const EMPTY_EQUIPMENT_DRAFT: EquipmentDraft = {
  method: null,
  classResolutions: [],
  rolledGold: null,
  purchasedItems: [],
}
