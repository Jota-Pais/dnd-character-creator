import type { DiceSpec, ItemUse } from '../types/actions'
import type { CharacterDraft } from '../types/character'
import type { GeneralItemCategory } from '../types/equipment'
import type {
  CarryingCapacity, CoinId, PlaySheet, PlayState, SessionInventory, SheetInventoryItem,
} from '../types/playState'
import type { FinalScores } from './classResourceUtils'
import { getBackground } from './backgroundUtils'
import {
  formatCoins, getArmorById, getGeneralItemById, getGeneralItems, getPackById, getStartingMoney, getToolById, getWeaponById,
} from './equipmentUtils'
import { getStartingInventory } from './sheetModel'
import { getCarryingCapacityMultiplier } from './sheetEffects'

/**
 * A bolsa do jogo (Fase 2, onda `inventario`; `docs/regras-equipamentos.md`, seção 6): as moedas, a
 * munição contada por peça, os consumíveis com o "Usar" e o peso contra a capacidade de carga. A
 * base é a ficha — o inventário da Fase 0 (`getStartingInventory`, com os pacotes abertos) e o
 * dinheiro dela (`getStartingMoney`) —, e o estado de jogo guarda só os deltas
 * (`PlayState.inventory`): a ficha nunca muda em jogo. Aqui moram a base, que o `buildPlaySheet`
 * monta, e as leituras do estado; as operações (gastar, recuperar, ajustar, usar) moram em
 * `utils/playState.ts`.
 */

// ── Moedas ───────────────────────────────────────────────────────────────────

/**
 * As cinco moedas, da maior para a menor, com a sigla do livro e o valor em peças de cobre (tabela
 * "Taxas de Câmbio Padrão", pág. 145, linhas 13112-13117). O app não troca uma moeda pela outra: o
 * troco é da mesa.
 */
export const COINS: readonly { id: CoinId; abbr: string; name: string; copper: number }[] = [
  { id: 'pp', abbr: 'pl', name: 'Platina', copper: 1000 },
  { id: 'gp', abbr: 'po', name: 'Ouro', copper: 100 },
  { id: 'ep', abbr: 'pe', name: 'Electro', copper: 50 },
  { id: 'sp', abbr: 'pp', name: 'Prata', copper: 10 },
  { id: 'cp', abbr: 'pc', name: 'Cobre', copper: 1 },
]

export const COIN_IDS: readonly CoinId[] = COINS.map(c => c.id)

/** "A moeda padrão pesa cerca de 10 gramas, assim, cem moedas pesam aproximadamente um quilo" (pág. 145). */
export const COIN_WEIGHT_KG = 0.01

/** A bolsa vazia: sem nada gasto nem ganho no jogo. */
export function emptyInventory(): SessionInventory {
  return { itemDelta: {}, coinDelta: {}, ammoSpentSinceRecovery: {}, customItems: [] }
}

/**
 * O dinheiro da ficha em moedas: o total de `getStartingMoney` (a mesma linha da Revisão e do PDF)
 * em ouro, prata e cobre, como `formatCoins` o escreve — o livro dá o dinheiro em po. O gasto no jogo
 * vira delta por moeda.
 */
export function getStartingCoins(draft: CharacterDraft): Record<CoinId, number> {
  const bg = draft.background ? getBackground(draft.background) : undefined
  const copper = Math.max(0, getStartingMoney(draft.equipment, bg?.equipment.goldPo ?? 0).totalCopper)
  return { pp: 0, gp: Math.floor(copper / 100), ep: 0, sp: Math.floor((copper % 100) / 10), cp: copper % 10 }
}

/** As moedas de agora: as da ficha mais o que mudou no jogo, nunca abaixo de 0. */
export function getCoins(state: PlayState, sheet: PlaySheet): Record<CoinId, number> {
  return Object.fromEntries(COIN_IDS.map(id =>
    [id, Math.max(0, sheet.startingCoins[id] + (state.inventory.coinDelta[id] ?? 0))])) as Record<CoinId, number>
}

/** "15 po · 3 pp · 7 pc"; sem moeda nenhuma, "nenhuma moeda". A sigla é a do livro. */
export function formatCoinPurse(coins: Record<CoinId, number>): string {
  const parts = COINS.filter(c => coins[c.id] > 0).map(c => `${coins[c.id]} ${c.abbr}`)
  return parts.length > 0 ? parts.join(' · ') : 'nenhuma moeda'
}

/** O valor das moedas em po, para ler ao lado ("vale 15 po 3 pp"), pela tabela de câmbio. */
export function formatCoinValue(coins: Record<CoinId, number>): string {
  return formatCoins(COINS.reduce((sum, c) => sum + coins[c.id] * c.copper, 0))
}

// ── Os itens: o catálogo ─────────────────────────────────────────────────────

/** De que catálogo o item vem: arma e armadura mudam pelo criador (decisão de 2026-10-30). */
export type BagItemKind = 'weapon' | 'armor' | 'tool' | 'general'

/** Um item da bolsa como o catálogo o diz: o nome da peça, o peso de cada uma e o "Usar". */
export type BagItemInfo = {
  id: string
  /** O nome da peça: "Flechas", não "Flechas (20)"; o do catálogo nos outros. */
  name: string
  kind: BagItemKind
  /** A categoria do equipamento geral (a munição, os consumíveis); ausente nos outros catálogos. */
  category?: GeneralItemCategory
  /** Peças por unidade do catálogo (`GeneralItem.piecesPerUnit`); 1 sem ele. */
  piecesPerUnit: number
  /** Em kg; 0 no item sem peso no livro ("–"). O da unidade dividido pelas peças. */
  weightPerPiece: number
  use?: ItemUse
}

/**
 * Um item do catálogo pelo id: arma, armadura, ferramenta ou equipamento geral; null fora deles (o
 * pacote, que a ficha abre no que ele tem). O nome da munição perde o "(20)" da unidade: a bolsa conta
 * peças.
 */
export function getBagItemInfo(id: string): BagItemInfo | null {
  const general = getGeneralItemById(id)
  if (general) {
    const pieces = general.piecesPerUnit ?? 1
    const suffix = ` (${pieces})`
    return {
      id,
      name: pieces > 1 && general.name.endsWith(suffix) ? general.name.slice(0, -suffix.length) : general.name,
      kind: 'general',
      category: general.category,
      piecesPerUnit: pieces,
      weightPerPiece: (general.weight ?? 0) / pieces,
      ...(general.use ? { use: general.use } : {}),
    }
  }
  const weapon = getWeaponById(id)
  if (weapon) return { id, name: weapon.name, kind: 'weapon', piecesPerUnit: 1, weightPerPiece: weapon.weight ?? 0 }
  const armor = getArmorById(id)
  if (armor) return { id, name: armor.name, kind: 'armor', piecesPerUnit: 1, weightPerPiece: armor.weight ?? 0 }
  const tool = getToolById(id)
  if (tool) return { id, name: tool.name, kind: 'tool', piecesPerUnit: 1, weightPerPiece: tool.weight ?? 0 }
  return null
}

/** "2d4 + 2", "1d4": os dados de um uso de item (`DiceSpec`). */
export function formatDiceSpec(dice: DiceSpec): string {
  return `${dice.count}d${dice.sides}${dice.bonus ? ` + ${dice.bonus}` : ''}`
}

/**
 * Quantos de um item, como a bolsa escreve: a munição só o número ("18"); o que conta usos (o Kit
 * de Primeiros-Socorros), "9 usos"; o resto, "×2".
 */
export function formatBagQuantity(info: BagItemInfo, quantity: number): string {
  if (info.category === 'ammunition') return `${quantity}`
  if (info.piecesPerUnit > 1) return quantity === 1 ? '1 uso' : `${quantity} usos`
  return `×${quantity}`
}

/**
 * O item que se pode tirar ou pôr pela bolsa: os do equipamento geral (consumíveis, munição e itens
 * gerais do catálogo, decisão de 2026-10-30) e o que a ficha já carrega; arma e armadura, nunca —
 * entram e saem pelo criador, que muda as linhas de ataque e a CA. Os itens de antecedente (as
 * bugigangas, que não se compram) e as ferramentas só se já estão na ficha.
 */
export function isBagAdjustable(sheet: PlaySheet, id: string): boolean {
  const info = getBagItemInfo(id)
  if (!info || info.kind === 'weapon' || info.kind === 'armor') return false
  if (sheet.inventory.some(i => i.id === id)) return true
  return info.kind === 'general' && info.category !== 'background-item'
}

/** Os itens do equipamento geral que entram na bolsa pela busca (`isBagAdjustable`), pelo nome. */
export function getBagCatalog(): BagItemInfo[] {
  return getGeneralItems()
    .flatMap(item => {
      const info = getBagItemInfo(item.id)
      return info && info.category !== 'background-item' ? [info] : []
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

// ── Os itens: a ficha ────────────────────────────────────────────────────────

/**
 * O inventário da ficha em peças: o de `getStartingInventory` (o mesmo da Revisão, do PDF e das
 * linhas de ataque), com cada pacote aberto no que ele tem (o Pacote de Explorador são 10 tochas e
 * 10 rações, que se gastam uma a uma), cada item uma vez — duas fontes do mesmo item somam —, na
 * ordem da ficha. O item do antecedente ainda a escolher fica de fora.
 */
export function getSheetInventory(draft: CharacterDraft): SheetInventoryItem[] {
  const out: SheetInventoryItem[] = []
  const add = (id: string, units: number) => {
    const info = getBagItemInfo(id)
    if (!info || units <= 0) return
    const pieces = units * info.piecesPerUnit
    const found = out.find(i => i.id === id)
    if (found) found.quantity += pieces
    else out.push({ id, quantity: pieces })
  }
  for (const entry of getStartingInventory(draft)) {
    if (!entry.id) continue
    const pack = getPackById(entry.id)
    if (pack) for (const item of pack.contents) add(item.ref, item.quantity * entry.quantity)
    else add(entry.id, entry.quantity)
  }
  return out
}

/** Um item da bolsa agora: o do catálogo, quantos há, quantos a ficha tem e a munição gasta. */
export type BagEntry = BagItemInfo & {
  quantity: number
  sheetQuantity: number
  /** A munição gasta desde a última recuperação (`ammoSpentSinceRecovery`); 0 nos outros. */
  spent: number
}

/** Quantas peças de um item há agora: as da ficha mais o delta do jogo, nunca abaixo de 0. */
export function getItemQuantity(state: PlayState, sheet: PlaySheet, id: string): number {
  const base = sheet.inventory.find(i => i.id === id)?.quantity ?? 0
  return Math.max(0, base + (state.inventory.itemDelta[id] ?? 0))
}

/**
 * Os itens da bolsa agora: os da ficha, na ordem dela (com 0 também: a ficha os tem, e o "+" os
 * devolve), e depois os que entraram no jogo, na ordem em que entraram.
 */
export function getBagItems(state: PlayState, sheet: PlaySheet): BagEntry[] {
  const ids = [
    ...sheet.inventory.map(i => i.id),
    ...Object.keys(state.inventory.itemDelta).filter(id => !sheet.inventory.some(i => i.id === id)),
  ]
  return ids.flatMap(id => {
    const info = getBagItemInfo(id)
    if (!info) return []
    return [{
      ...info,
      quantity: getItemQuantity(state, sheet, id),
      sheetQuantity: sheet.inventory.find(i => i.id === id)?.quantity ?? 0,
      spent: state.inventory.ammoSpentSinceRecovery[id] ?? 0,
    }]
  })
}

/**
 * A munição de uma arma agora (`Weapon.ammunition`), para o cartão de ataque: quantas peças há, as
 * gastas desde a última recuperação e quantas voltam ao recuperar (a metade, para baixo, pág. 149).
 * Null na arma sem munição.
 */
export function getWeaponAmmo(state: PlayState, sheet: PlaySheet, weaponId: string):
  { ammoId: string; name: string; quantity: number; spent: number; recoverable: number } | null {
  const ammoId = getWeaponById(weaponId)?.ammunition
  const info = ammoId ? getBagItemInfo(ammoId) : null
  if (!ammoId || !info) return null
  const spent = state.inventory.ammoSpentSinceRecovery[ammoId] ?? 0
  return { ammoId, name: info.name, quantity: getItemQuantity(state, sheet, ammoId), spent, recoverable: Math.floor(spent / 2) }
}

// ── Carga ────────────────────────────────────────────────────────────────────

/** "Sua capacidade de carga máxima é igual a 7,5 vezes o seu valor de Força" (pág. 178), em kg. */
export const CARRYING_CAPACITY_PER_STRENGTH = 7.5

/**
 * A capacidade de carga da ficha: 7,5 × a Força final, em kg (pág. 178, linhas 15817-15821), vezes o
 * que a multiplica (o Aspecto da Besta do Urso dobra, pág. 50). Pela regra padrão, sem a variante
 * Sobrecarga (decisão de 2026-10-29); o tamanho não muda a conta das raças do livro (Médias ou
 * Pequenas).
 */
export function getCarryingCapacity(draft: CharacterDraft, scores: FinalScores): CarryingCapacity {
  const multiplier = getCarryingCapacityMultiplier(draft)
  const strength = scores.STR
  return {
    kg: CARRYING_CAPACITY_PER_STRENGTH * strength * (multiplier?.value ?? 1),
    strength,
    multiplier: multiplier ? { value: multiplier.value, source: multiplier.source } : null,
  }
}

/**
 * O peso que o personagem carrega agora, em kg: cada item da bolsa (armas e armaduras também, a
 * vestida inclusive) e as moedas (100 pesam 1 kg, pág. 145). O item de texto livre não tem peso: é
 * sem mecânica.
 */
export function getCarriedWeight(state: PlayState, sheet: PlaySheet): number {
  const items = getBagItems(state, sheet).reduce((sum, i) => sum + i.quantity * i.weightPerPiece, 0)
  const coins = Object.values(getCoins(state, sheet)).reduce((sum, n) => sum + n, 0)
  return Math.round((items + coins * COIN_WEIGHT_KG) * 100) / 100
}

/** "62,5 kg", "0,25 kg", "60 kg". */
export function formatKg(kg: number): string {
  return `${String(Math.round(kg * 100) / 100).replace('.', ',')} kg`
}

/** "75 kg (7,5 × Força 10)"; com o Urso, "150 kg (7,5 × Força 10, × 2 pelo Aspecto da Besta — Urso)". */
export function describeCarryingCapacity(capacity: CarryingCapacity): string {
  const times = capacity.multiplier ? `, × ${capacity.multiplier.value} pelo ${capacity.multiplier.source}` : ''
  return `${formatKg(capacity.kg)} (7,5 × Força ${capacity.strength}${times})`
}

/**
 * O aviso da carga, só acima da capacidade (a regra padrão só tem penalidade para empurrar e
 * arrastar, que é situação da mesa, pág. 178): null dentro dela.
 */
export function describeOverload(state: PlayState, sheet: PlaySheet): string | null {
  const weight = getCarriedWeight(state, sheet)
  const { kg } = sheet.carryingCapacity
  if (weight <= kg) return null
  return `Você carrega ${formatKg(weight)}, acima da sua capacidade de carga, ${describeCarryingCapacity(sheet.carryingCapacity)}: `
    + `é o máximo que você carrega. Acima dela, você só arrasta, empurra ou ergue o peso, até ${formatKg(kg * 2)}, `
    + 'e o deslocamento cai para 1,5 metro ao empurrar ou arrastar (pág. 178).'
}
