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
import mountsVehiclesData from '../data/mounts-vehicles.json'

const ALL_PACKS = packsData as EquipmentPack[]
const ALL_GENERAL = generalItemsData as GeneralItem[]
const ALL_TOOLS = toolsData as Tool[]
export const ALL_WEAPONS = weaponsData as Weapon[]
const ALL_ARMORS = armorsData as Armor[]
const ALL_MOUNTS_VEHICLES = mountsVehiclesData as { id: string, name: string, cost: number | null, weight: number | null }[]

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
 * padrão) e itens comprados (só no método riqueza, `getActivePurchases`). Escudo é reportado à parte, pois
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

  // Itens comprados: só valem no método riqueza (p. 145: o equipamento inicial OU a compra)
  for (const item of getActivePurchases(equipment)) {
    const a = getArmor(item.itemId)
    if (a) armors.push(a)
  }

  const bodyArmor = armors.find(a => a.category !== 'shield')
  const hasShield = armors.some(a => a.category === 'shield')
  return { bodyArmor, hasShield }
}

/**
 * Ferramentas e instrumentos que o personagem carrega pelo equipamento de classe (itens fixos e
 * opções escolhidas, inclusive os escolhidos num `tool-filter` e o conteúdo dos pacotes — o de
 * Artista traz um kit de disfarce, p. 153) e pelas compras do método riqueza. Irmã de
 * `getEquippedArmor`; o equipamento do antecedente entra em `getUnproficientTools`
 * (proficiencyUtils), que tem o resolvedor dele.
 */
export function getCarriedToolIds(
  equipment: EquipmentDraft,
  classEquipment: ClassStartingEquipment | undefined,
): string[] {
  const ids: string[] = []
  const addItem = (id: string) => {
    const pack = getPackById(id)
    if (pack) ids.push(...pack.contents.map(c => c.ref))
    else ids.push(id)
  }

  if (equipment.method === 'standard' && classEquipment) {
    for (const item of classEquipment.fixed) addItem(item.id)
    for (let i = 0; i < classEquipment.choices.length; i++) {
      const res = equipment.classResolutions[i]
      if (!res || res.optionIndex < 0) continue
      const option = classEquipment.choices[i]?.options[res.optionIndex]
      if (!option) continue
      // Mesmo fatiamento de `describeResolvedOption`: cada filtro consome os seus `picks`.
      let pickIdx = 0
      for (const item of option) {
        if (item.kind === 'specific') {
          addItem(item.id)
        } else {
          res.pickedIds.slice(pickIdx, pickIdx + item.picks).forEach(addItem)
          pickIdx += item.picks
        }
      }
    }
  }

  for (const item of getActivePurchases(equipment)) addItem(item.itemId)

  return [...new Set(ids.filter(id => TOOL_IDS.has(id)))]
}

/**
 * As compras que valem: só as do método riqueza. O livro (p. 145) dá o equipamento de classe e
 * antecedente OU a compra com o ouro, nunca os dois. Trocar de método não apaga o carrinho (o
 * jogador volta à riqueza e o reencontra), então toda leitura de compra passa por aqui — CA,
 * deslocamento, Artes Marciais, avisos de proficiência, ataques, inventário e dinheiro.
 */
export function getActivePurchases(equipment: EquipmentDraft): InventoryItem[] {
  return equipment.method === 'wealth' ? equipment.purchasedItems : []
}

/** Ferramenta (inclui instrumentos e kits de jogo) pelo id, ou undefined. */
export function getToolById(id: string): Tool | undefined {
  return ALL_TOOLS.find(t => t.id === id)
}

/**
 * A ferramenta que um item carregado é para a regra: ele mesmo, se for ferramenta; ou a que o
 * item declara em `countsAsTool` (dados de osso → conjunto de dados, p. 142). Undefined se não
 * for ferramenta nenhuma.
 */
export function getToolEquivalent(id: string): Tool | undefined {
  const tool = getToolById(id)
  if (tool) return tool
  const alias = ALL_GENERAL.find(g => g.id === id)?.countsAsTool
  return alias ? getToolById(alias) : undefined
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
 * Dinheiro em moedas, na forma da algibeira: "15 po", "7 po 5 pp", "3 pc". Diferente de
 * `formatCurrency` (preço de item), não troca 10 po por "1 ppt" — o livro dá o dinheiro do
 * antecedente e da riqueza em po, e é assim que o jogador o anota.
 */
export function formatCoins(copper: number): string {
  if (copper === 0) return '0 po'
  const sign = copper < 0 ? '−' : ''
  const abs = Math.abs(copper)
  const parts: string[] = []
  const gp = Math.floor(abs / 100)
  const sp = Math.floor((abs % 100) / 10)
  const cp = abs % 10
  if (gp > 0) parts.push(`${gp} po`)
  if (sp > 0) parts.push(`${sp} pp`)
  if (cp > 0) parts.push(`${cp} pc`)
  return sign + parts.join(' ')
}

export function getArmor(id: string): Armor | undefined {
  return ALL_ARMORS.find(a => a.id === id)
}

/** Arma pelo id, ou undefined se o id não for de uma arma. */
export function getWeaponById(id: string): Weapon | undefined {
  return ALL_WEAPONS.find(w => w.id === id)
}

/** Armadura/escudo pelo id, ou undefined. */
export function getArmorById(id: string): Armor | undefined {
  return ALL_ARMORS.find(a => a.id === id)
}

/** Pacote de equipamento pelo id, ou undefined. */
export function getPackById(id: string): EquipmentPack | undefined {
  return ALL_PACKS.find(p => p.id === id)
}

/** Conteúdo de um pacote como texto: "Mochila, Saco de Dormir, 2× Fantasia, 5× Vela...". */
export function formatPackContents(pack: EquipmentPack): string {
  return pack.contents
    .map(i => (i.quantity > 1 ? `${i.quantity}× ${getItemName(i.ref)}` : getItemName(i.ref)))
    .join(', ')
}

/**
 * Rótulo de inventário (ficha imprimível e Revisão): "2× Adaga". Pacote vai com o conteúdo —
 * "Pacote de Artista (Mochila, Saco de Dormir, 2× Fantasia...)" —, porque na mesa ninguém lembra
 * que o pacote tem rações, velas e cantil (p. 153).
 */
export function formatInventoryItem(id: string, quantity = 1): string {
  const pack = getPackById(id)
  const name = pack ? `${pack.name} (${formatPackContents(pack)})` : getItemName(id)
  return quantity > 1 ? `${quantity}× ${name}` : name
}

/**
 * Itens de uma opção de equipamento já escolhida, como rótulos de inventário: os específicos com
 * a quantidade, e os escolhidos em filtros (arma/ferramenta/foco) na ordem dos `pickedIds`.
 */
export function describeResolvedOption(option: EquipmentOption, pickedIds: string[]): string[] {
  const result: string[] = []
  let pickIdx = 0
  for (const item of option) {
    if (item.kind === 'specific') {
      result.push(formatInventoryItem(item.id, item.quantity))
    } else {
      result.push(...pickedIds.slice(pickIdx, pickIdx + item.picks).map(id => formatInventoryItem(id)))
      pickIdx += item.picks
    }
  }
  return result
}

export function getItemName(id: string): string {
  return (
    ALL_WEAPONS.find(w => w.id === id)?.name ??
    ALL_ARMORS.find(a => a.id === id)?.name ??
    ALL_TOOLS.find(t => t.id === id)?.name ??
    ALL_GENERAL.find(g => g.id === id)?.name ??
    ALL_PACKS.find(p => p.id === id)?.name ??
    ALL_MOUNTS_VEHICLES.find(m => m.id === id)?.name ??
    id
  )
}

// ── Loja (método riqueza) ───────────────────────────────────────────────────

export type ShopCategory = 'Armas' | 'Armaduras' | 'Ferramentas' | 'Pacotes' | 'Equipamento' | 'Montarias'

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
  for (const m of ALL_MOUNTS_VEHICLES) {
    if (m.cost != null) items.push({ id: m.id, name: m.name, costCopper: m.cost, category: 'Montarias' })
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

// ── Dinheiro inicial ────────────────────────────────────────────────────────

export type StartingMoney = {
  /** Total em cobre: o que vai na linha "Dinheiro" da ficha. */
  totalCopper: number
  /** A algibeira do antecedente (goldPo), em cobre. */
  backgroundCopper: number
  /** Riqueza rolada (método riqueza), em cobre; null fora desse método ou antes de rolar. */
  wealthCopper: number | null
  /** Gasto na loja (método riqueza), em cobre. */
  spentCopper: number
}

/**
 * Quanto dinheiro o personagem tem ao começar: a algibeira do antecedente (cap. 4) e, no
 * método riqueza (p. 145), o rolado menos o que foi comprado. Segue a leitura do app de que no
 * método riqueza o equipamento — e o dinheiro — do antecedente continuam valendo.
 *
 * Fonte única do número da Revisão e da ficha imprimível.
 */
export function getStartingMoney(equipment: EquipmentDraft, backgroundGoldPo: number): StartingMoney {
  const backgroundCopper = backgroundGoldPo * 100
  const isWealth = equipment.method === 'wealth'
  const wealthCopper = isWealth && equipment.rolledGold !== null ? equipment.rolledGold * 100 : null
  const spentCopper = getPurchasesTotalCopper(getActivePurchases(equipment))
  return {
    totalCopper: backgroundCopper + (wealthCopper ?? 0) - spentCopper,
    backgroundCopper,
    wealthCopper,
    spentCopper,
  }
}

/**
 * De onde veio o dinheiro, para ler ao lado do total: "antecedente" ou
 * "riqueza 120 po − 37 po em compras + 15 po do antecedente". null quando não há o que explicar.
 */
export function describeStartingMoneySource(money: StartingMoney): string | null {
  if (money.wealthCopper === null) return money.backgroundCopper > 0 ? 'antecedente' : null
  const parts = [`riqueza ${formatCoins(money.wealthCopper)}`]
  if (money.spentCopper > 0) parts.push(`− ${formatCoins(money.spentCopper)} em compras`)
  if (money.backgroundCopper > 0) parts.push(`+ ${formatCoins(money.backgroundCopper)} do antecedente`)
  return parts.join(' ')
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
export const FOCUS_GROUP_LABEL: Record<'arcane' | 'druidic' | 'holy', string> = {
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
