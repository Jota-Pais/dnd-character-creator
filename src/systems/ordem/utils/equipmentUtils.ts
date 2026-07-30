import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemEquipment } from '../types/equipment'
import type { OrdemPatente } from '../types/patente'
import type { OrdemElement } from '../types/ritual'
import { getRitualById, getRitualSlotsCount, getSlotRitualElement, getGrantedRitualElement, ELEMENT_NAMES } from './ritualUtils'
import { PARANORMAL_ELEMENTS } from '../types/ritual'
import type { ParanormalElement } from '../types/ritual'
import equipmentsJson from '../data/equipments.json'
import { getOrdemClass } from './classUtils'
import { getPatente, getCategoryLimit } from './patenteUtils'
import { getModification, getEffectiveModIds, countApplied } from './modificationUtils'
import {
  getCurse, getCurseCategoryDelta, getItemCurses, getSheetAttributes, canApplyCurse, curseChoiceKey,
  getCursesBlockedByPatente,
} from './curseUtils'
import { hasClassPower, getFavoriteWeaponReduction, getFavoriteEquipmentReduction, getGrantedRituals, hasCarryCapacityIntellectBonus, getWorkToolBonus, hasTrilhaFeature } from './characterUtils'
import { getAffinityState } from './paranormalPowerUtils'
import { SKILLS, getSkillName } from './skillUtils'

export const EQUIPMENTS = equipmentsJson as OrdemEquipment[]

export function getEquipmentById(id: string): OrdemEquipment | undefined {
  return EQUIPMENTS.find(e => e.id === id)
}

// ── Unidades de equipamento ────────────────────────────────────────────────────
// `equipmentChoices` guarda UNIDADES, não ids únicos: a 1ª unidade de um item usa o
// próprio id ("revolver") e duplicatas ganham sufixo ("revolver#2"), permitindo dois
// revólveres com modificações/maldições diferentes. Mods, maldições e escolhas de
// parâmetro são chaveadas pela unidade — saves antigos (1 unidade por item) seguem válidos.

/** Id do item de catálogo de uma unidade ("revolver#2" → "revolver"). */
export function instanceItemId(uid: string): string {
  return uid.split('#')[0]
}

export function getEquipmentByInstance(uid: string): OrdemEquipment | undefined {
  return getEquipmentById(instanceItemId(uid))
}

/** Uid pra uma nova unidade do item: o próprio id se livre, senão o menor sufixo livre. */
export function newInstanceUid(choices: string[], itemId: string): string {
  if (!choices.includes(itemId)) return itemId
  let n = 2
  while (choices.includes(`${itemId}#${n}`)) n++
  return `${itemId}#${n}`
}

/**
 * Nome de exibição de uma unidade: "Revólver" (única) ou "Revólver #2" (duplicatas). Nos itens que
 * o livro nomeia com "(Elemento)", o placeholder é substituído pelo elemento escolhido — "Amarras
 * de (Elemento)" vira "Amarras de Sangue". Sem escolha, o placeholder fica à vista de propósito.
 */
export function getInstanceLabel(draft: OrdemCharacterDraft, uid: string): string {
  const item = getEquipmentByInstance(uid)
  if (!item) return uid
  let name = item.name
  if (item.needsElementChoice) {
    const element = draft.equipmentElementChoices[uid]
    if (element) name = name.replace(/\(Elemento\)/i, ELEMENT_NAMES[element])
  }
  const same = draft.equipmentChoices.filter(c => instanceItemId(c) === item.id)
  return same.length > 1 ? `${name} #${same.indexOf(uid) + 1}` : name
}

/** Capacidade de carga base pela Força: 5 espaços por ponto (2 se Força 0). */
export function getMaxCapacity(strength: number): number {
  return Math.max(2, strength * 5)
}

/** Bônus de capacidade de carga concedido pelas unidades escolhidas (ex.: Mochila Militar = +2). */
export function getEquipmentCarryBonus(choices: string[]): number {
  return choices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    return acc + (item?.carryBonus ?? 0)
  }, 0)
}

/**
 * Capacidade de carga total: base (5×Força da ficha, incluindo maldição Pujança — mais Intelecto
 * se Inventário Otimizado) + bônus dos itens (Mochila Militar etc.).
 */
export function getTotalCarryCapacity(draft: OrdemCharacterDraft): number {
  const sheet = getSheetAttributes(draft)
  const strength = sheet.strength + (hasCarryCapacityIntellectBonus(draft) ? sheet.intellect : 0)
  return getMaxCapacity(strength) + getEquipmentCarryBonus(draft.equipmentChoices)
}

/**
 * Estado de carga (p. 55): dentro do limite, sobrecarregado, ou impossível.
 *
 * "Se ultrapassar esse limite, fica sobrecarregado; você sofre –5 em Defesa e testes de perícia
 * afetadas por carga, e seu deslocamento é reduzido em –3m. Você não pode ultrapassar o dobro
 * desse limite." Ou seja: passar da capacidade é PERMITIDO e penalizado; só acima do dobro é que
 * a configuração deixa de existir.
 */
export type LoadState = {
  spaces: number
  capacity: number
  /** Teto absoluto: o dobro da capacidade. */
  max: number
  overloaded: boolean
  /** Acima do dobro — configuração inválida, a única que bloqueia a etapa. */
  impossible: boolean
}

/** Penalidades da sobrecarga (p. 55). */
export const OVERLOAD_DEFENSE_PENALTY = 5
export const OVERLOAD_SKILL_PENALTY = 5
export const OVERLOAD_SPEED_PENALTY_METERS = 3

export function getLoadState(draft: OrdemCharacterDraft): LoadState {
  const capacity = getTotalCarryCapacity(draft)
  const spaces = getModifiedSpaces(draft)
  return {
    spaces,
    capacity,
    max: capacity * 2,
    overloaded: spaces > capacity && spaces <= capacity * 2,
    impossible: spaces > capacity * 2,
  }
}

export function isOverloaded(draft: OrdemCharacterDraft): boolean {
  return getLoadState(draft).overloaded
}

export function getCurrentSpaces(choices: string[]): number {
  return choices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    return acc + (item ? item.spaces : 0)
  }, 0)
}

/** Quantas unidades escolhidas são de uma dada categoria. */
export function getCategoryCount(choices: string[], category: number): number {
  return choices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    return acc + (item?.category === category ? 1 : 0)
  }, 0)
}

/** Atalho para a Categoria I (mantido por compatibilidade). */
export function getCategoryICount(choices: string[]): number {
  return getCategoryCount(choices, 1)
}

/** Soma o bônus de Defesa das proteções escolhidas (sem modificações). */
export function getEquippedDefenseBonus(choices: string[]): number {
  return choices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    return acc + (item && item.type === 'protection' ? item.defenseBonus : 0)
  }, 0)
}

// ── Efeitos das modificações (Fase B) ──────────────────────────────────────────

/**
 * Modificações EFETIVAS da unidade — já sem aplicações repetidas além do limite (ver
 * `getEffectiveModIds`). Todo cálculo que dependa de modificação passa por aqui: categoria,
 * espaços, Defesa, resistência e o bônus de perícia dos acessórios.
 */
function itemMods(draft: OrdemCharacterDraft, uid: string): string[] {
  return getEffectiveModIds(draft.equipmentModifications[uid] ?? [])
}

/**
 * Categoria efetiva de um item = base + modificações (cada uma +I) + maldições
 * (a 1ª +II, as seguintes +I — pág. 144); teto IV. Ajustes se acumulam.
 */
export function getEffectiveCategory(item: OrdemEquipment, modCount: number, curseCount = 0): number {
  return Math.min(4, item.category + modCount + getCurseCategoryDelta(curseCount))
}

/** A unidade é a escolhida da Mochila de Utilidades? (−1 categoria e −1 espaço; exceto armas) */
export function isUtilityBackpackItem(draft: OrdemCharacterDraft, uid: string): boolean {
  if (draft.utilityBackpackItem !== uid || !hasClassPower(draft, 'utility-backpack')) return false
  const item = getEquipmentByInstance(uid)
  return Boolean(item && item.type !== 'weapon' && draft.equipmentChoices.includes(uid))
}

/**
 * O item de catálogo é a Arma Favorita (trilha Aniquilador)? Ao contrário da Mochila de
 * Utilidades, vale pra qualquer unidade desse item — inclusive antes dele ser requisitado
 * (ver `getCatalogCategory`), já que "A Favorita" escolhe uma ARMA, não uma unidade específica.
 */
export function isFavoriteWeaponItem(draft: OrdemCharacterDraft, item: OrdemEquipment): boolean {
  return item.type === 'weapon' && draft.favoriteWeapon === item.id
}

/**
 * O item de catálogo é as Ferramentas Favoritas (origem Engenheiro)? Mesmo esquema da Arma
 * Favorita: vale pra qualquer unidade desse item, inclusive antes dele ser requisitado (ver
 * `getCatalogCategory`), já que o poder escolhe um ITEM, não uma unidade específica.
 */
export function isFavoriteEquipmentItem(draft: OrdemCharacterDraft, item: OrdemEquipment): boolean {
  return item.type !== 'weapon' && draft.favoriteEquipment === item.id
}

/** Categoria efetiva de uma unidade do draft, lendo modificações, maldições, Mochila de Utilidades, Ferramentas Favoritas e Arma Favorita. */
export function getDraftInstanceCategory(draft: OrdemCharacterDraft, uid: string): number {
  const item = getEquipmentByInstance(uid)
  if (!item) return 0
  const cat = getEffectiveCategory(item, itemMods(draft, uid).length, getItemCurses(draft, uid).length)
  const afterBackpack = isUtilityBackpackItem(draft, uid) ? Math.max(0, cat - 1) : cat
  const afterFavoriteEquipment = isFavoriteEquipmentItem(draft, item)
    ? Math.max(0, afterBackpack - getFavoriteEquipmentReduction(draft))
    : afterBackpack
  return isFavoriteWeaponItem(draft, item) ? Math.max(0, afterFavoriteEquipment - getFavoriteWeaponReduction(draft)) : afterFavoriteEquipment
}

/**
 * Categoria "de catálogo" de um item pra decidir se cabe na Patente ANTES de ter unidade —
 * já reduzida se for a Arma Favorita ou as Ferramentas Favoritas. Sem isso, um item de
 * categoria acima do limite (ex.: lança-chamas Cat III pra um Operador) nunca fica
 * requisitável mesmo depois de marcado como favorito, porque a marcação em si exige que a
 * unidade já exista (ver `EquipmentStep`).
 */
export function getCatalogCategory(draft: OrdemCharacterDraft, item: OrdemEquipment): number {
  const afterFavoriteEquipment = isFavoriteEquipmentItem(draft, item)
    ? Math.max(0, item.category - getFavoriteEquipmentReduction(draft))
    : item.category
  return isFavoriteWeaponItem(draft, item) ? Math.max(0, afterFavoriteEquipment - getFavoriteWeaponReduction(draft)) : afterFavoriteEquipment
}

/** Espaços de um item já com as variações das modificações (Discreta −1, Reforçada/Blindada +1...). */
function itemModifiedSpaces(item: OrdemEquipment, modIds: string[]): number {
  const delta = modIds.reduce((acc, id) => acc + (getModification(id)?.spaceDelta ?? 0), 0)
  return Math.max(0, item.spaces + delta)
}

/** Total de espaços ocupados, considerando modificações e Mochila de Utilidades (−1 espaço). */
export function getModifiedSpaces(draft: OrdemCharacterDraft): number {
  return draft.equipmentChoices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    if (!item) return acc
    const spaces = itemModifiedSpaces(item, itemMods(draft, uid))
    return acc + (isUtilityBackpackItem(draft, uid) ? Math.max(0, spaces - 1) : spaces)
  }, 0)
}

/**
 * Contribuição do EQUIPAMENTO para a Defesa: proteções com suas modificações (Reforçada +2) e
 * poderes (Tanque de Guerra), menos a penalidade de sobrecarga (−5, p. 55) — que também é
 * consequência do que se carrega, e por isso mora aqui em vez de em `getCursedDerivedStats`
 * (evita um ciclo entre `curseUtils` e este módulo).
 */
export function getModifiedDefenseBonus(draft: OrdemCharacterDraft): number {
  const overload = isOverloaded(draft) ? -OVERLOAD_DEFENSE_PENALTY : 0
  return overload + draft.equipmentChoices.reduce((acc, uid) => {
    const item = getEquipmentByInstance(uid)
    if (!item || item.type !== 'protection') return acc
    const modDef = itemMods(draft, uid).reduce((s, mid) => s + (getModification(mid)?.defenseBonus ?? 0), 0)
    // Tanque de Guerra: a Defesa (e a RD) da proteção pesada aumenta em +2.
    const warTank = item.id === 'protecao-pesada' && hasClassPower(draft, 'war-tank') ? 2 : 0
    return acc + item.defenseBonus + modDef + warTank
  }, 0)
}

export type EquipmentDamageResistanceEntry = { source: string; label: string; value: number }

/**
 * Resistências a dano concedidas por itens de equipamento (Proteção Pesada, Traje Hazmat) e pela
 * maldição Cinética em proteções — uma entrada por fonte, sem somar tipos de dano diferentes
 * entre si (balístico ≠ químico). Inclui a substituição da Blindada (RD → 5, não soma) e o +2 do
 * Tanque de Guerra na proteção pesada.
 */
export function getEquipmentDamageResistances(draft: OrdemCharacterDraft): EquipmentDamageResistanceEntry[] {
  const entries: EquipmentDamageResistanceEntry[] = []
  for (const uid of draft.equipmentChoices) {
    const item = getEquipmentByInstance(uid)
    if (!item) continue
    if (item.damageResistance) {
      let value = item.damageResistance
      if (item.type === 'protection') {
        const override = itemMods(draft, uid).reduce((max, mid) => Math.max(max, getModification(mid)?.damageResistanceOverride ?? 0), 0)
        if (override > 0) value = override
        if (item.id === 'protecao-pesada' && hasClassPower(draft, 'war-tank')) value += 2
      }
      entries.push({ source: getInstanceLabel(draft, uid), label: item.damageResistanceLabel ?? 'geral', value })
    }
    if (item.type === 'protection') {
      const cinetica = getItemCurses(draft, uid).map(getCurse).find(c => c?.damageResistanceByWeight)
      if (cinetica?.damageResistanceByWeight) {
        const value = item.id === 'protecao-pesada' ? cinetica.damageResistanceByWeight.heavy : cinetica.damageResistanceByWeight.light
        entries.push({ source: `${getInstanceLabel(draft, uid)} — maldição Cinética`, label: 'geral', value })
      }
    }
  }
  return entries
}

/** Quantas unidades escolhidas têm a categoria EFETIVA (base + modificações + maldições) igual a `category`. */
export function getEffectiveCategoryCount(draft: OrdemCharacterDraft, category: number): number {
  return draft.equipmentChoices.reduce((acc, uid) => {
    return acc + (getEquipmentByInstance(uid) && getDraftInstanceCategory(draft, uid) === category ? 1 : 0)
  }, 0)
}

// ── Vagas de requisição da Patente (F21) ───────────────────────────────────────
// Decisão de mesa: um item de categoria MENOR pode ocupar uma vaga de categoria MAIOR
// (quem pode requisitar um item Cat II pode requisitar um Cat I no lugar). A Tabela 3.1
// continua sendo o total de vagas; só a alocação é flexível pra baixo.

/** Contagem de unidades por categoria efetiva (índices 1..4; Categoria 0 não consome vaga). */
export function getEffectiveCategoryCounts(draft: OrdemCharacterDraft): number[] {
  const counts = [0, 0, 0, 0, 0]
  for (const uid of draft.equipmentChoices) {
    if (!getEquipmentByInstance(uid)) continue
    const cat = getDraftInstanceCategory(draft, uid)
    if (cat >= 1) counts[cat]++
  }
  return counts
}

/**
 * As unidades cabem nas vagas da Patente? Como item menor desce em vaga maior,
 * a condição é: para todo k (1..4), nº de itens com cat ≥ k ≤ nº de vagas com cat ≥ k.
 */
export function fitsPatenteSlots(counts: number[], patente: OrdemPatente): boolean {
  let items = 0
  let slots = 0
  for (let k = 4; k >= 1; k--) {
    items += counts[k] ?? 0
    slots += getCategoryLimit(patente, k)
    if (items > slots) return false
  }
  return true
}

/** Simula ajustes de contagem (ex.: +1 item Cat I, ou mover um item de Cat I→II) e testa se cabe. */
export function fitsWithAdjustedCounts(
  draft: OrdemCharacterDraft,
  patente: OrdemPatente,
  adjust: Record<number, number>,
): boolean {
  const counts = getEffectiveCategoryCounts(draft)
  for (const [cat, delta] of Object.entries(adjust)) {
    const c = Number(cat)
    if (c >= 1 && c <= 4) counts[c] += delta
  }
  return fitsPatenteSlots(counts, patente)
}

export type CategorySlotInfo = {
  category: number
  /** Unidades cuja categoria efetiva é esta. */
  items: number
  /** Vagas desta categoria ocupadas (próprias + emprestadas de categorias menores). */
  usedSlots: number
  /** Quantas dessas vagas estão ocupadas por itens de categoria MENOR. */
  spillIn: number
  limit: number
  /** Estouro real neste nível (itens de cat ≥ k além das vagas de cat ≥ k) — inválido. */
  overflow: boolean
}

/**
 * Alocação das unidades nas vagas da Patente, pra exibição nos contadores:
 * itens de categoria maior alocam primeiro; cada item usa a menor vaga livre ≥ à sua categoria.
 */
export function getCategorySlotAllocation(draft: OrdemCharacterDraft, patente: OrdemPatente): CategorySlotInfo[] {
  const counts = getEffectiveCategoryCounts(draft)
  const free = [0, 1, 2, 3, 4].map(k => (k === 0 ? 0 : getCategoryLimit(patente, k)))
  const used = [0, 0, 0, 0, 0]
  const spillIn = [0, 0, 0, 0, 0]
  for (let c = 4; c >= 1; c--) {
    let remaining = counts[c]
    for (let k = c; k <= 4 && remaining > 0; k++) {
      const take = Math.min(remaining, free[k])
      free[k] -= take
      used[k] += take
      if (k > c) spillIn[k] += take
      remaining -= take
    }
    // `remaining > 0` = configuração inválida; a validação bloqueia, aqui só exibimos.
  }
  return [1, 2, 3, 4].map(k => {
    let items = 0
    let slots = 0
    for (let c = k; c <= 4; c++) {
      items += counts[c]
      slots += getCategoryLimit(patente, c)
    }
    return { category: k, items: counts[k], usedSlots: used[k], spillIn: spillIn[k], limit: getCategoryLimit(patente, k), overflow: items > slots }
  })
}

/**
 * As maldições aplicadas são estruturalmente válidas? (alvo certo, sem duplicatas, sem
 * elementos opressores no mesmo item, com o parâmetro escolhido quando exigido, e com a Patente
 * que o livro exige para requisitar item amaldiçoado).
 */
export function areCursesValid(draft: OrdemCharacterDraft): boolean {
  // "Independentemente de suas categorias, itens amaldiçoados são liberados apenas para agentes
  // especiais, oficiais de operações e agentes de elite" (pág. 144).
  if (getCursesBlockedByPatente(draft).length > 0) return false
  for (const uid of draft.equipmentChoices) {
    const item = getEquipmentByInstance(uid)
    const curses = getItemCurses(draft, uid)
    if (curses.length === 0) continue
    if (!item) return false
    for (let i = 0; i < curses.length; i++) {
      // Cada maldição precisa ser aplicável considerando as demais da unidade.
      const others = curses.filter((_, j) => j !== i)
      if (!canApplyCurse(item, others, curses[i], draft.equipmentCurseChoices, uid)) return false
      const curse = getCurse(curses[i])
      if (curse?.choice && !draft.equipmentCurseChoices[curseChoiceKey(uid, curse.id)]) return false
    }
  }
  return true
}

export function isEquipmentStepComplete(draft: OrdemCharacterDraft): boolean {
  // Passar da capacidade de carga é PERMITIDO (fica sobrecarregado, com penalidades); o livro só
  // proíbe passar do DOBRO. Ver `getLoadState` e o aviso no passo de Equipamento.
  if (getLoadState(draft).impossible) return false

  // As vagas da Tabela 3.1 limitam as unidades pela categoria EFETIVA (base + mods + maldições);
  // Categoria 0 é ilimitada, e item de categoria menor pode ocupar vaga de categoria maior (F21).
  const patente = getPatente(draft.patente)
  if (!fitsPatenteSlots(getEffectiveCategoryCounts(draft), patente)) return false

  // Maldições precisam ser válidas (alvo, oposição de elementos, parâmetros escolhidos).
  if (!areCursesValid(draft)) return false

  // Acessórios precisam ter a perícia definida ("definida ao adquirir") — sem ela, o bônus não
  // existe na ficha. Bônus repetido entre itens NÃO invalida: só não acumula (ver o aviso na UI).
  if (!areAccessorySkillChoicesComplete(draft)) return false

  // Kits precisam saber de qual perícia são ("existe um kit para cada perícia que exige o item").
  if (!areKitChoicesComplete(draft)) return false

  // Amarras e Scanner são "de (Elemento)": sem a escolha, o nome fica com o placeholder na ficha.
  if (!areEquipmentElementChoicesComplete(draft)) return false

  // Proficiência de arma NÃO bloqueia: o livro permite possuir uma arma sem proficiência (com
  // penalidade ao usá-la). A UI apenas sinaliza "Sem Proficiência" — ver `hasWeaponProficiency`.
  return true
}

/**
 * A arma usa balas longas (fuzis e metralhadoras)? É o recorte da Mira de Elite (Atirador de
 * Elite NEX 10%): proficiência com essas armas e +Intelecto nas rolagens de dano com elas.
 */
export function usesLongBullets(item: OrdemEquipment): boolean {
  return item.type === 'weapon' && item.ammo === 'municao-balas-longas'
}

/** Se o agente tem proficiência com a arma — pela classe ou por poderes (apenas informativo, não bloqueia). */
export function hasWeaponProficiency(draft: OrdemCharacterDraft, item: OrdemEquipment): boolean {
  if (item.type !== 'weapon' || !draft.class) return true
  const cls = getOrdemClass(draft.class)
  if (cls?.weaponProficiencies.includes(item.proficiency)) return true
  // Poderes que concedem proficiência: Armamento Pesado, Balística Avançada, Ninja Urbano.
  if (item.proficiency === 'heavy' && hasClassPower(draft, 'heavy-weapons')) return true
  if (item.proficiency === 'tactical' && item.weaponCategory === 'fogo' && hasClassPower(draft, 'advanced-ballistics')) return true
  if (item.proficiency === 'tactical' && item.weaponCategory === 'corpo_a_corpo' && hasClassPower(draft, 'urban-ninja')) return true
  // Mira de Elite (Atirador de Elite NEX 10%): armas de fogo que usam balas longas.
  if (usesLongBullets(item) && hasTrilhaFeature(draft, 'elite-marksman', 10)) return true
  // Ferramenta de Trabalho (origem Operário): "Você sabe usar a arma escolhida" — proficiência só com ela.
  if (draft.workToolWeapon === item.id && getWorkToolBonus(draft) > 0) return true
  return false
}

/**
 * Se o agente tem proficiência com a proteção. O Escudo "conta como proteção pesada para fins de
 * proficiência" (descrição do item), e o poder Proteção Pesada concede a categoria pesada.
 * Informativo, como nas armas: o livro permite vestir sem proficiência, com penalidade.
 */
export function hasProtectionProficiency(draft: OrdemCharacterDraft, item: OrdemEquipment): boolean {
  if (item.type !== 'protection' || !draft.class) return true
  const weight: 'light' | 'heavy' = item.isShield || item.id === 'protecao-pesada' ? 'heavy' : 'light'
  const cls = getOrdemClass(draft.class)
  if (cls?.armorProficiencies.includes(weight)) return true
  return weight === 'heavy' && hasClassPower(draft, 'heavy-armor-proficiency')
}

/** Proficiência com o item, seja arma ou proteção (itens gerais não exigem proficiência). */
export function hasItemProficiency(draft: OrdemCharacterDraft, item: OrdemEquipment): boolean {
  if (item.type === 'weapon') return hasWeaponProficiency(draft, item)
  if (item.type === 'protection') return hasProtectionProficiency(draft, item)
  return true
}

// ── Acessórios que concedem bônus de perícia (Utensílio / Vestimenta) ──────────

/** Itens que concedem "+2 numa perícia à escolha, definida ao adquirir" (p. 63). */
const SKILL_BONUS_ACCESSORIES = ['utensilio', 'vestimenta']

/** Perícias que um acessório nunca pode beneficiar (ressalva do livro). */
const ACCESSORY_FORBIDDEN_SKILLS = ['fighting', 'aim']

export type AccessorySkillSlot = {
  uid: string
  /** Nome da unidade pra exibição (ex.: "Utensílio #2"). */
  label: string
  /** 0 = perícia do próprio item; 1 = perícia da modificação Função Adicional. */
  index: number
  skillId: string | null
  /** Valor do bônus deste slot: +2, ou +5 quando a unidade tem a modificação Aprimorado. */
  value: number
}

/** Perícias que um acessório pode beneficiar: todas, menos Luta e Pontaria. */
export function getAccessorySkillOptions(): string[] {
  return SKILLS.map(s => s.id).filter(id => !ACCESSORY_FORBIDDEN_SKILLS.includes(id))
}

/**
 * Slots de escolha de perícia dos acessórios do loadout: um por Utensílio/Vestimenta, mais um
 * quando a unidade tem a modificação Função Adicional ("concede +2 a uma perícia adicional").
 *
 * A modificação Aprimorado sobe o bônus do item para +5. O livro permite escolhê-la uma segunda
 * vez para a Função Adicional, mas o motor de modificações não aceita a mesma modificação duas
 * vezes na mesma peça — então aqui o Aprimorado vale para o slot do próprio item.
 */
export function getAccessorySkillSlots(draft: OrdemCharacterDraft): AccessorySkillSlot[] {
  const slots: AccessorySkillSlot[] = []
  for (const uid of draft.equipmentChoices) {
    if (!SKILL_BONUS_ACCESSORIES.includes(instanceItemId(uid))) continue
    const mods = itemMods(draft, uid)
    const chosen = draft.accessorySkillChoices[uid] ?? []
    const label = getInstanceLabel(draft, uid)
    // Aprimorado sobe o bônus do slot para +5: a 1ª aplicação vale para a perícia do item, a 2ª
    // (permitida só com Função Adicional) para a perícia adicional.
    const aprimorado = countApplied(mods, 'aprimorado')
    slots.push({ uid, label, index: 0, skillId: chosen[0] ?? null, value: aprimorado >= 1 ? 5 : 2 })
    if (mods.includes('funcao-adicional')) {
      slots.push({ uid, label, index: 1, skillId: chosen[1] ?? null, value: aprimorado >= 2 ? 5 : 2 })
    }
  }
  return slots
}

/** Quantas vestimentas fornecem bônus ao mesmo tempo (p. 63). */
export const MAX_WORN_VESTIMENTAS = 2

/**
 * Quais vestimentas do loadout têm o bônus ATIVO: "você pode receber os bônus de no máximo duas
 * vestimentas ao mesmo tempo" (p. 63). Requisitar mais é permitido — vestir e despir é uma ação
 * completa, então a troca acontece na mesa —, mas a ficha só pode somar duas.
 *
 * Decisão do projeto: valem as duas de MAIOR bônus (empate pela ordem do loadout), que é o que o
 * agente naturalmente vestiria. As demais aparecem no aviso, pra ficar claro que estão inertes.
 */
export function getWornVestimentas(draft: OrdemCharacterDraft): { active: string[]; inactive: string[] } {
  const slots = getAccessorySkillSlots(draft)
  const uids = draft.equipmentChoices.filter(uid => instanceItemId(uid) === 'vestimenta')
  const ranked = uids
    .map((uid, order) => ({
      uid,
      order,
      best: slots.filter(s => s.uid === uid).reduce((max, s) => Math.max(max, s.value), 0),
    }))
    .sort((a, b) => b.best - a.best || a.order - b.order)
  return {
    active: ranked.slice(0, MAX_WORN_VESTIMENTAS).map(v => v.uid),
    inactive: ranked.slice(MAX_WORN_VESTIMENTAS).map(v => v.uid),
  }
}

/**
 * Bônus de perícia concedidos pelos acessórios do loadout. Marcados como NÃO cumulativos: "bônus
 * fornecidos por itens não são cumulativos" (p. 63) — dois itens na mesma perícia rendem o
 * benefício de um só, e a ficha usa o maior (ver `getSkillBonusTotal`).
 */
export function getAccessorySkillBonuses(
  draft: OrdemCharacterDraft,
): { skillId: string; value: number; source: string; nonCumulative: true }[] {
  // Vestimentas além do limite de duas ficam inertes e não entram na ficha (p. 63).
  const inertes = new Set(getWornVestimentas(draft).inactive)
  return getAccessorySkillSlots(draft)
    .filter((slot): slot is AccessorySkillSlot & { skillId: string } => Boolean(slot.skillId))
    .filter(slot => !inertes.has(slot.uid))
    .map(slot => ({
      skillId: slot.skillId,
      value: slot.value,
      source: slot.index === 1 ? `${slot.label} (função adicional)` : slot.label,
      nonCumulative: true as const,
    }))
}

/**
 * Bônus de perícia de uma unidade de acessório, pra exibir na linha do inventário
 * (ex.: "+5 Diplomacia, +2 Tecnologia"). String vazia quando a unidade não é acessório de perícia
 * ou ainda não teve a perícia escolhida.
 */
export function formatAccessorySkills(draft: OrdemCharacterDraft, uid: string): string {
  const bonuses = getAccessorySkillSlots(draft)
    .filter(slot => slot.uid === uid && slot.skillId)
    .map(slot => `+${slot.value} ${getSkillName(slot.skillId as string)}`)
    .join(', ')
  if (!bonuses) return ''
  // Vestimenta além do limite de duas: o bônus existe no item, mas não está ativo.
  const inert = getWornVestimentas(draft).inactive.includes(uid)
  return inert ? `${bonuses} (inativo — só duas vestimentas por vez)` : bonuses
}

/** Todos os acessórios do loadout já têm a perícia escolhida? */
export function areAccessorySkillChoicesComplete(draft: OrdemCharacterDraft): boolean {
  return getAccessorySkillSlots(draft).every(slot => Boolean(slot.skillId))
}

/**
 * Perícias em que DOIS OU MAIS itens concedem bônus — o jogador pode fazer isso (nada no livro
 * proíbe), mas os bônus não somam: só o maior vale. Alimenta o aviso do passo de Equipamento.
 */
export function getNonCumulativeSkillConflicts(
  draft: OrdemCharacterDraft,
): { skillId: string; sources: string[]; applied: number }[] {
  const bySkill = new Map<string, { sources: string[]; applied: number }>()
  for (const bonus of getAccessorySkillBonuses(draft)) {
    const entry = bySkill.get(bonus.skillId)
    if (entry) {
      entry.sources.push(bonus.source)
      entry.applied = Math.max(entry.applied, bonus.value)
    } else {
      bySkill.set(bonus.skillId, { sources: [bonus.source], applied: bonus.value })
    }
  }
  return [...bySkill.entries()]
    .filter(([, entry]) => entry.sources.length > 1)
    .map(([skillId, entry]) => ({ skillId, sources: entry.sources, applied: entry.applied }))
}

// ── Itens paranormais com elemento à escolha ("(Elemento)") ────────────────────

export type ElementChoiceSlot = {
  uid: string
  /** Nome já com o elemento resolvido, ou com o placeholder quando ainda não escolhido. */
  label: string
  element: ParanormalElement | null
}

/** Elementos disponíveis: os 4 paranormais — o livro não tem versão de Medo desses itens. */
export function getEquipmentElementOptions(): ParanormalElement[] {
  return [...PARANORMAL_ELEMENTS]
}

/**
 * Unidades do loadout que precisam de um elemento escolhido — hoje Amarras de (Elemento) e Scanner
 * de Manifestação Paranormal de (Elemento). Mesmo esquema do elemento de um ritual multi-elemento:
 * a escolha é por UNIDADE, então dá pra carregar Amarras de Sangue e Amarras de Morte.
 */
export function getElementChoiceSlots(draft: OrdemCharacterDraft): ElementChoiceSlot[] {
  return draft.equipmentChoices
    .filter(uid => getEquipmentByInstance(uid)?.needsElementChoice)
    .map(uid => ({
      uid,
      label: getInstanceLabel(draft, uid),
      element: draft.equipmentElementChoices[uid] ?? null,
    }))
}

/** Todos os itens que exigem elemento já têm o seu? */
export function areEquipmentElementChoicesComplete(draft: OrdemCharacterDraft): boolean {
  return getElementChoiceSlots(draft).every(slot => slot.element !== null)
}

// ── Kits de perícia ────────────────────────────────────────────────────────────

export type KitSlot = {
  uid: string
  /** Nome da unidade pra exibição (ex.: "Kit de Perícia #2"). */
  label: string
  /** 'kit' = unidade de Kit de Perícia; 'instrumental' = acessório com a modificação Instrumental. */
  kind: 'kit' | 'instrumental'
  skillId: string | null
}

/** Perícias que exigem kit (p. 40): as únicas que fazem sentido como escolha de kit. */
export function getKitSkillOptions(): string[] {
  return SKILLS.filter(s => s.kit).map(s => s.id)
}

/**
 * Kits que o agente carrega, um slot por unidade: cada Kit de Perícia requisitado e cada acessório
 * com a modificação Instrumental ("o acessório pode ser usado como um kit de perícia específico,
 * escolhido ao aplicar esta modificação", p. 64).
 *
 * A escolha do kit é INDEPENDENTE da perícia que o acessório bonifica — um utensílio pode dar +2
 * em Atualidades e funcionar como kit de eletrônica (o exemplo do "smartphone hacker" do livro).
 */
export function getKitSlots(draft: OrdemCharacterDraft): KitSlot[] {
  const slots: KitSlot[] = []
  for (const uid of draft.equipmentChoices) {
    const isKit = instanceItemId(uid) === 'kit-pericia'
    const isInstrumental = itemMods(draft, uid).includes('instrumental')
    if (!isKit && !isInstrumental) continue
    slots.push({
      uid,
      label: getInstanceLabel(draft, uid),
      kind: isKit ? 'kit' : 'instrumental',
      skillId: draft.kitSkillChoices[uid] ?? null,
    })
  }
  return slots
}

/** Perícias cobertas por um kit que o agente carrega, com a fonte de cada uma. */
export function getKitSkills(draft: OrdemCharacterDraft): { skillId: string; source: string }[] {
  return getKitSlots(draft)
    .filter((slot): slot is KitSlot & { skillId: string } => Boolean(slot.skillId))
    .map(slot => ({ skillId: slot.skillId, source: slot.label }))
}

/** O agente tem kit para esta perícia? */
export function hasKitForSkill(draft: OrdemCharacterDraft, skillId: string): boolean {
  return getKitSkills(draft).some(k => k.skillId === skillId)
}

/**
 * Perícias que exigem kit e para as quais o agente NÃO tem um. A ficha só informa: o −5 fica a
 * critério do mestre, porque o livro amarra a exigência a usos específicos da perícia (arrombar,
 * disfarce, operar dispositivo), não à perícia inteira — exceto em Medicina.
 */
export function getSkillsMissingKit(draft: OrdemCharacterDraft): string[] {
  return getKitSkillOptions().filter(id => !hasKitForSkill(draft, id))
}

/** Todos os kits do loadout já têm a perícia definida? */
export function areKitChoicesComplete(draft: OrdemCharacterDraft): boolean {
  return getKitSlots(draft).every(slot => Boolean(slot.skillId))
}

/** Descrição do kit de uma unidade pra linha do inventário (ex.: "kit de medicina"). */
export function formatKitSkill(draft: OrdemCharacterDraft, uid: string): string {
  const slot = getKitSlots(draft).find(s => s.uid === uid && s.skillId)
  if (!slot) return ''
  const skill = SKILLS.find(s => s.id === slot.skillId)
  return skill?.kit ? `kit de ${skill.kit.name}` : ''
}

/**
 * Perícias que sofrem −5 pela penalidade de carga da Proteção Pesada equipada (descrição do
 * item; as perícias afetadas são as marcadas com `loadPenalty` em skills.json). Devolvido como
 * bônus NEGATIVO incondicional, pra entrar no total da perícia junto dos demais.
 */
export function getLoadPenaltySkillBonuses(draft: OrdemCharacterDraft): { skillId: string; value: number; source: string }[] {
  const out: { skillId: string; value: number; source: string }[] = []
  const loadSkills = SKILLS.filter(s => s.loadPenalty)
  if (draft.equipmentChoices.some(uid => instanceItemId(uid) === 'protecao-pesada')) {
    out.push(...loadSkills.map(s => ({ skillId: s.id, value: -5, source: 'Proteção Pesada' })))
  }
  // Sobrecarga: −5 nas mesmas perícias (p. 55). Acumula com a da Proteção Pesada — são fontes
  // diferentes, e o livro não as declara excludentes.
  if (isOverloaded(draft)) {
    out.push(...loadSkills.map(s => ({ skillId: s.id, value: -OVERLOAD_SKILL_PENALTY, source: 'Sobrecarregado' })))
  }
  return out
}

/**
 * Elementos dos rituais conhecidos SEM os componentes ritualísticos correspondentes no loadout.
 * Conjurar exige manipular componentes do elemento (exceto Medo) — sem eles, o ritual não sai
 * (pág. 119). Vale para QUALQUER conjurador (não-Ocultistas conhecem rituais via trilha ou o
 * poder Aprender Ritual). A afinidade dispensa os componentes do próprio elemento (pág. 116).
 * Não bloqueia a ficha; alimenta o aviso no Equipamento/Revisão.
 */
export function getMissingRitualComponentElements(draft: OrdemCharacterDraft): OrdemElement[] {
  const needed = new Set<OrdemElement>()
  // Rituais escolhidos pelo jogador (só o Ocultista tem slots) — elemento resolvido por slot
  // (rituais multi-elemento como Amaldiçoar Arma podem ter mais de uma instância, uma por elemento).
  const chosenSlots = draft.class === 'occultist' ? draft.ritualChoices.slice(0, getRitualSlotsCount(draft.nex)) : []
  chosenSlots.forEach((id, slotIndex) => {
    const ritual = id ? getRitualById(id) : undefined
    if (!ritual) return
    const element = getSlotRitualElement(ritual, slotIndex, draft.ritualElementChoices)
    if (element && element !== 'fear') needed.add(element)
  })
  // Rituais concedidos: trilha (elemento via granted:<id>) e Aprender Ritual (elemento na fonte).
  for (const { ritual, element: sourceElement } of getGrantedRituals(draft)) {
    const element = sourceElement ?? getGrantedRitualElement(ritual, draft.ritualElementChoices)
    if (element && element !== 'fear') needed.add(element)
  }
  // Afinidade ativa: rituais do elemento afim não precisam de componentes (pág. 116).
  const affinity = getAffinityState(draft)
  if (affinity.active && affinity.element) needed.delete(affinity.element)
  const owned = new Set<OrdemElement | undefined>(draft.equipmentChoices.map(uid => getEquipmentByInstance(uid)?.ritualComponentFor))
  return [...needed].filter(el => !owned.has(el))
}
