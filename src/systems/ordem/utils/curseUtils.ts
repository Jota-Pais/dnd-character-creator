import cursesJson from '../data/curses.json'
import type { OrdemCurse, CurseElement } from '../types/curse'
import type { OrdemCharacterDraft, OrdemAttributes } from '../types/character'
import type { AttributeId } from '../types/attribute'
import type { OrdemPatenteId } from '../types/patente'
import { getAttribute } from './attributeUtils'
import type { OrdemClass } from '../types/class'
import type { OrdemEquipment } from '../types/equipment'
import type { OrdemElement, OrdemRitual } from '../types/ritual'
import {
  getEffectiveAttributes, deriveStats, getOriginHpBonus, getOriginPeBonus, getOriginSanityBonus, getOriginDefenseBonus,
  getEffectivePeLimit, getRitualDtBonusFromTrilha, hasRitualPeLimitBonusFromPresence, getChosenElementForPower,
  getTrilhaHpBonus,
} from './characterUtils'
import type { DerivedStats } from './characterUtils'
import { ELEMENT_NAMES, getRitualById } from './ritualUtils'
import { getPeLimit } from './progressionUtils'
import { getParanormalEffects, getParanormalSanityPenalty } from './paranormalPowerUtils'

export const CURSES = cursesJson as OrdemCurse[]

export function getCurse(id: string): OrdemCurse | undefined {
  return CURSES.find(c => c.id === id)
}

/**
 * Ciclo de opressão dos elementos (Cap. "O Outro Lado"): Sangue oprime Conhecimento,
 * Morte oprime Sangue, Energia oprime Morte, Conhecimento oprime Energia.
 * Um item não pode ter maldições de elementos opressores (pág. 144).
 */
const OPPRESSES: Partial<Record<OrdemElement, OrdemElement>> = {
  blood: 'knowledge',
  death: 'blood',
  energy: 'death',
  knowledge: 'energy',
}

export function areOpposingElements(a: OrdemElement | null, b: OrdemElement | null): boolean {
  if (!a || !b) return false
  return OPPRESSES[a] === b || OPPRESSES[b] === a
}

/** Chave das escolhas de parâmetro de maldição (elemento/ritual) em `equipmentCurseChoices`, por UNIDADE. */
export function curseChoiceKey(uid: string, curseId: string): string {
  return `${uid}:${curseId}`
}

/**
 * Patentes que podem requisitar itens amaldiçoados: "independentemente de suas categorias, itens
 * amaldiçoados são liberados apenas para agentes especiais, oficiais de operações e agentes de
 * elite" (pág. 144). É uma restrição SEPARADA das vagas por categoria — sem ela, um Operador
 * poderia amaldiçoar um item de categoria 0 (o escudo) e caber na sua única vaga de categoria II.
 */
export const CURSE_ALLOWED_PATENTES: OrdemPatenteId[] = ['agente-especial', 'oficial-operacoes', 'agente-elite']

export function canPatenteUseCursedItems(patenteId: OrdemPatenteId): boolean {
  return CURSE_ALLOWED_PATENTES.includes(patenteId)
}

/** Unidades do loadout que têm ao menos uma maldição aplicada. */
export function getCursedUnitIds(draft: OrdemCharacterDraft): string[] {
  return draft.equipmentChoices.filter(uid => (draft.equipmentCurses[uid] ?? []).length > 0)
}

/**
 * Itens amaldiçoados que a Patente atual não libera — vazio quando a Patente permite. Serve tanto
 * pra travar a aplicação de novas maldições quanto pra acusar um save feito antes da trava (ou com
 * a Patente rebaixada depois).
 */
export function getCursesBlockedByPatente(draft: OrdemCharacterDraft): string[] {
  return canPatenteUseCursedItems(draft.patente) ? [] : getCursedUnitIds(draft)
}

/**
 * Elemento efetivo de uma maldição aplicada a uma unidade: o da maldição, ou o escolhido
 * quando o elemento varia (Proteção Elemental). Null enquanto a escolha não foi feita.
 */
export function getAppliedCurseElement(
  curse: OrdemCurse,
  uid: string,
  curseChoices: Record<string, string>,
): OrdemElement | null {
  if (curse.element !== 'varies') return curse.element
  const chosen = curseChoices[curseChoiceKey(uid, curse.id)]
  return (chosen as OrdemElement) || null
}

/** Rótulo do elemento de uma maldição aplicada: fixo, o escolhido, ou aviso de escolha pendente. */
export function formatCurseElement(
  curse: OrdemCurse,
  uid: string,
  curseChoices: Record<string, string>,
): string {
  const element = getAppliedCurseElement(curse, uid, curseChoices)
  return element ? ELEMENT_NAMES[element] : 'elemento a escolher'
}

/**
 * Detalhe da escolha de parâmetro de uma maldição aplicada, pra exibição na ficha:
 * Antielemento → "elemento-alvo: X"; Conjuração → "ritual vinculado: X"; Proteção
 * Elemental → null (o elemento escolhido já aparece como o elemento da maldição).
 */
export function formatCurseChoiceDetail(
  curse: OrdemCurse,
  uid: string,
  curseChoices: Record<string, string>,
): string | null {
  // Ritualística: o ritual armazenado é opcional (conjurado pra dentro da arma em jogo, troca livre).
  if (curse.id === 'ritualistica') {
    const stored = curseChoices[curseChoiceKey(uid, curse.id)]
    return stored ? `ritual armazenado: ${getRitualById(stored)?.name ?? stored}` : null
  }
  if (!curse.choice) return null
  const chosen = curseChoices[curseChoiceKey(uid, curse.id)]
  if (!chosen) return 'escolha pendente'
  if (curse.choice === 'element') {
    return curse.element === 'varies' ? null : `elemento-alvo: ${ELEMENT_NAMES[chosen as OrdemElement]}`
  }
  return `ritual vinculado: ${getRitualById(chosen)?.name ?? chosen}`
}

/** Uma maldição pode ser aplicada a este item? (pág. 145-148). */
export function curseAppliesTo(curse: OrdemCurse, item: OrdemEquipment): boolean {
  switch (curse.target) {
    case 'weapon-any':
      return item.type === 'weapon'
    case 'weapon-melee':
      return item.type === 'weapon' && ['corpo_a_corpo', 'arremesso'].includes(item.weaponCategory)
    case 'protection-any':
      return item.type === 'protection'
    case 'accessory-wear':
      // O livro restringe a utensílios e vestuários (kits ficam de fora).
      return item.id === 'utensilio' || item.id === 'vestimenta'
  }
}

/** Item pode receber maldições? */
export function isCursable(item: OrdemEquipment): boolean {
  return CURSES.some(c => curseAppliesTo(c, item))
}

/** Maldições disponíveis para um item. */
export function getAvailableCurses(item: OrdemEquipment): OrdemCurse[] {
  return CURSES.filter(c => curseAppliesTo(c, item))
}

/**
 * Uma maldição pode ser adicionada agora? Regras da pág. 144: maldições iguais não se
 * acumulam no item, e elementos opressores não coexistem no mesmo item.
 * `uid` identifica a UNIDADE (padrão: o id do item), pra resolver escolhas de elemento.
 */
export function canApplyCurse(
  item: OrdemEquipment,
  applied: string[],
  curseId: string,
  curseChoices: Record<string, string> = {},
  uid: string = item.id,
): boolean {
  const curse = getCurse(curseId)
  if (!curse || !curseAppliesTo(curse, item)) return false
  if (applied.includes(curseId)) return false
  const element = getAppliedCurseElement(curse, uid, curseChoices)
  for (const otherId of applied) {
    const other = getCurse(otherId)
    if (!other) continue
    const otherElement = getAppliedCurseElement(other, uid, curseChoices)
    if (areOpposingElements(element, otherElement)) return false
  }
  return true
}

/** Aumento de categoria pelas maldições de um item: a 1ª sobe em II, as seguintes em I (pág. 144). */
export function getCurseCategoryDelta(curseCount: number): number {
  return curseCount === 0 ? 0 : curseCount + 1
}

// ── Efeitos das maldições nos números da ficha ─────────────────────────────────

/** Maldições de uma unidade do draft (só de unidades realmente equipadas). */
export function getItemCurses(draft: OrdemCharacterDraft, uid: string): string[] {
  return draft.equipmentChoices.includes(uid) ? (draft.equipmentCurses[uid] ?? []) : []
}

/**
 * Maldições únicas entre todas as unidades equipadas — "bônus de itens amaldiçoados não se
 * acumulam" (pág. 144): a mesma maldição em dois itens concede o benefício uma vez só.
 */
export function getUniqueEquippedCurses(draft: OrdemCharacterDraft): OrdemCurse[] {
  const ids = new Set<string>()
  for (const uid of draft.equipmentChoices) {
    for (const curseId of draft.equipmentCurses[uid] ?? []) ids.add(curseId)
  }
  return [...ids].map(getCurse).filter((c): c is OrdemCurse => Boolean(c))
}

// ── O preço da maldição (pág. 145) ─────────────────────────────────────────────

/**
 * "As forças que alimentam estes itens são impregnadas com um elemento específico, e impõem ao
 * usuário uma penalidade **cumulativa**": a cada falha em teste do atributo ligado ao elemento,
 * 2 pontos de Sanidade por maldição daquele elemento nos seus itens (pág. 145).
 *
 * Cumulativo é literal — ao contrário dos BÔNUS, que não se acumulam entre itens
 * (`getUniqueEquippedCurses`), o preço conta cada maldição, inclusive duas iguais em itens
 * diferentes.
 */
export const CURSE_PRICE_ATTRIBUTES: Record<Exclude<CurseElement, 'varies'>, AttributeId[]> = {
  knowledge: ['intellect'],
  energy: ['agility'],
  death: ['presence'],
  blood: ['strength', 'vigor'],
}

export const SANITY_PER_CURSE = 2

/** Nomes dos atributos afetados pelo preço de um elemento, já em texto ("Força ou Vigor"). */
export function formatCursePriceAttributes(element: Exclude<CurseElement, 'varies'>): string {
  const names = CURSE_PRICE_ATTRIBUTES[element].map(id => getAttribute(id)?.name ?? id)
  return names.join(' ou ')
}

/**
 * Preço de UMA maldição, pra acompanhar a descrição dela na ficha. Null quando o elemento ainda
 * não foi escolhido (Proteção Elemental sem escolha) — sem elemento não há preço definido.
 */
export function getCursePriceNote(
  curse: OrdemCurse,
  uid: string,
  curseChoices: Record<string, string>,
): string | null {
  const element = getAppliedCurseElement(curse, uid, curseChoices)
  if (!element || element === 'fear') return null
  return `−${SANITY_PER_CURSE} SAN a cada falha em teste de ${formatCursePriceAttributes(element)}`
}

export type CursePriceEntry = { element: Exclude<CurseElement, 'varies'>; sanity: number; attributes: string }

/** Preço acumulado de uma unidade, agrupado por elemento (duas maldições do mesmo elemento somam). */
export function getUnitCursePrice(draft: OrdemCharacterDraft, uid: string): CursePriceEntry[] {
  const perElement = new Map<Exclude<CurseElement, 'varies'>, number>()
  for (const curseId of getItemCurses(draft, uid)) {
    const curse = getCurse(curseId)
    if (!curse) continue
    const element = getAppliedCurseElement(curse, uid, draft.equipmentCurseChoices)
    if (!element || element === 'fear') continue
    perElement.set(element, (perElement.get(element) ?? 0) + SANITY_PER_CURSE)
  }
  return [...perElement].map(([element, sanity]) => ({
    element,
    sanity,
    attributes: formatCursePriceAttributes(element),
  }))
}

/** Preço de uma unidade em uma linha ("−2 SAN a cada falha em teste de Intelecto"). */
export function formatUnitCursePrice(draft: OrdemCharacterDraft, uid: string): string | null {
  const entries = getUnitCursePrice(draft, uid)
  if (!entries.length) return null
  return entries.map(e => `−${e.sanity} SAN a cada falha em teste de ${e.attributes}`).join('; ')
}

// ── Resistências concedidas por maldições ──────────────────────────────────────

export type CurseResistanceEntry = { label: string; value: number; source: string }

/**
 * Resistências a dano das maldições equipadas: elemental (Profética, Voltaica, Repulsiva,
 * Regenerativa e Proteção Elemental — 10 contra o elemento da maldição) e mental (Escudo Mental).
 * Entram como fontes próprias, ao lado das do poder paranormal Resistir a Elemento, seguindo a
 * regra de que resistências de fontes diferentes acumulam (ver `getOriginMentalDamageResistance`).
 *
 * Usa `getUniqueEquippedCurses` por item, porque aqui são BÔNUS — "bônus de itens amaldiçoados não
 * se acumulam" (pág. 144): a mesma maldição em dois itens vale uma vez.
 */
export function getCurseResistances(draft: OrdemCharacterDraft): CurseResistanceEntry[] {
  const out: CurseResistanceEntry[] = []
  const seen = new Set<string>()
  for (const uid of draft.equipmentChoices) {
    for (const curseId of getItemCurses(draft, uid)) {
      const curse = getCurse(curseId)
      if (!curse) continue
      const element = getAppliedCurseElement(curse, uid, draft.equipmentCurseChoices)
      // A chave inclui o elemento: Proteção Elemental de Sangue e de Morte são bônus distintos.
      const key = `${curseId}:${element ?? '-'}`
      if (seen.has(key)) continue
      // Aqui o Medo entra: a Proteção Elemental protege contra "um elemento", e o livro não o
      // exclui (ao contrário do preço da maldição, que a p. 145 define só para os quatro).
      if (curse.elementResistance && element) {
        seen.add(key)
        out.push({
          label: ELEMENT_NAMES[element],
          value: curse.elementResistance,
          source: `maldição ${curse.name}`,
        })
      } else if (curse.mentalResistance) {
        seen.add(key)
        out.push({ label: 'mental', value: curse.mentalResistance, source: `maldição ${curse.name}` })
      }
    }
  }
  return out
}

/**
 * Atributos exibidos na ficha: efetivos (base + aumentos de NEX) + bônus de acessórios
 * amaldiçoados (Carisma, Sagacidade, Destreza, Disposição, Pujança). O teto 5 vale só
 * para Aumentos de Atributo ("desta forma") — bônus de maldição não é limitado por ele.
 */
export function getSheetAttributes(draft: OrdemCharacterDraft): OrdemAttributes {
  const attrs = { ...getEffectiveAttributes(draft) }
  for (const curse of getUniqueEquippedCurses(draft)) {
    if (curse.attributeBonus) attrs[curse.attributeBonus.attribute] += curse.attributeBonus.value
  }
  return attrs
}

/** Bônus incondicional de Defesa das maldições equipadas (Repulsora, Cinética, Letárgica, Defesa). */
export function getCurseDefenseBonus(draft: OrdemCharacterDraft): number {
  return getUniqueEquippedCurses(draft).reduce((s, c) => s + (c.defenseBonus ?? 0), 0)
}

/**
 * PV/PE/Sanidade/Defesa finais, com as maldições dobradas:
 * - Vigor de maldição (Disposição) entra no PV retroativamente, como qualquer Vigor;
 * - Presença do Carisma NÃO entra no PE (ressalva do livro), mas vale pra testes;
 * - Vitalidade +15 PV e Esforço Adicional +5 PE são fixos;
 * - Defesa usa a Agilidade da ficha (com Destreza) + bônus de Defesa das maldições.
 */
export function getCursedDerivedStats(
  draft: OrdemCharacterDraft,
  cls: OrdemClass,
  protectionBonus = 0,
): DerivedStats {
  const sheet = getSheetAttributes(draft)
  const curses = getUniqueEquippedCurses(draft)
  const noPePresence = curses.reduce(
    (s, c) => s + (c.attributeBonus?.attribute === 'presence' && c.attributeBonus.noPe ? c.attributeBonus.value : 0),
    0,
  )
  const paranormal = getParanormalEffects(draft)
  const stats = deriveStats(
    cls,
    { ...sheet, presence: sheet.presence - noPePresence },
    draft.nex,
    protectionBonus + getCurseDefenseBonus(draft) + getOriginDefenseBonus(draft) + paranormal.defenseBonus,
  )
  // Bônus flat somados sobre a fórmula da classe: maldições + poder de origem (Calejado/
  // Cicatrizes/Dedicação) + poderes paranormais (Sangue de Ferro/Potencial Aprimorado, retroativos)
  // + features de trilha (Casca Grossa, também retroativa).
  const hpFlat = curses.reduce((s, c) => s + (c.hpBonus ?? 0), 0) + getOriginHpBonus(draft)
    + paranormal.hpBonus + getTrilhaHpBonus(draft)
  const peFlat = curses.reduce((s, c) => s + (c.peBonus ?? 0), 0) + getOriginPeBonus(draft) + paranormal.peBonus
  // Transcender suprime o ganho de SAN dos NEX em que foi escolhido; Cultista Arrependido corta
  // metade da SAN inicial. Clamp em 0 (ocultista cultista com muitos transcends em NEX baixo).
  return {
    ...stats,
    hp: stats.hp + hpFlat,
    pe: stats.pe + peFlat,
    sanity: Math.max(0, stats.sanity + getOriginSanityBonus(draft) - getParanormalSanityPenalty(draft, cls)),
  }
}

/**
 * DT para resistir a um ritual conhecido: 10 + limite de PE por rodada + Presença (livro, pág.
 * 121), com os bônus determinísticos: Rituais Eficientes (+5 em TODOS) e Especialista em
 * Elemento (+2 nos rituais do elemento escolhido; multi-elemento usa o elemento da instância).
 * Usa a Presença já com maldições (igual ao resto da ficha), mas o limite de PE BASE (sem
 * Presença Poderosa — essa soma PE por turno pra conjurar, não a dificuldade do ritual em si).
 *
 * `ritualElement` é o elemento já resolvido da INSTÂNCIA (ver `getSlotRitualElement`/
 * `getGrantedRitualElement`) — necessário pra rituais multi-elemento, que podem ser conhecidos
 * mais de uma vez (uma por elemento). Omitir só é seguro pra rituais de elemento único.
 */
export function getRitualDt(draft: OrdemCharacterDraft, ritual: OrdemRitual, ritualElement?: OrdemElement): { dt: number; notes: string[] } {
  let dt = 10 + getPeLimit(draft.nex) + getSheetAttributes(draft).presence
  const notes: string[] = []
  const trilhaBonus = getRitualDtBonusFromTrilha(draft)
  if (trilhaBonus > 0) {
    dt += trilhaBonus
    notes.push(`Rituais Eficientes +${trilhaBonus}`)
  }
  const specialistElement = getChosenElementForPower(draft, 'element-specialist')
  if (specialistElement) {
    const element = ritualElement ?? (ritual.elements.length > 1 ? undefined : ritual.elements[0])
    if (element === specialistElement) {
      dt += 2
      notes.push('Especialista em Elemento +2')
    }
  }
  return { dt, notes }
}

/**
 * Limite de PE por turno só para conjurar rituais: igual ao geral (`getEffectivePeLimit`), mas
 * com Presença somada quando o personagem tem Presença Poderosa (Intuitivo NEX 40%). Fora de
 * conjuração, vale o limite geral — por isso é um número separado, não substitui o outro.
 */
export function getRitualPeLimit(draft: OrdemCharacterDraft): number {
  const base = getEffectivePeLimit(draft)
  return hasRitualPeLimitBonusFromPresence(draft) ? base + getSheetAttributes(draft).presence : base
}
