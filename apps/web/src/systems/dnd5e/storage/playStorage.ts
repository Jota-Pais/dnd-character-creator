import type { PlayResult, PlaySheet, PlayState } from '@rpg/rules/systems/dnd5e/types/playState'
import { createPlayState, reconcileLoadedPlayState, sanitizePlayState } from '@rpg/rules/systems/dnd5e/utils/playState'
import { requestPersistentStorage } from '../../../core/pwa/persistentStorage'
import { forgetDoc, markDocChanged, playKey, updateSyncMeta } from '../../../core/sync/syncStorage'

/**
 * Persistência do estado de jogo — a camada que componentes e stores usam (nunca o localStorage
 * direto, CLAUDE.md). Chave própria, separada da biblioteca de fichas de `storage.ts`: jogar grava
 * aqui e NUNCA toca a ficha salva. Um estado por `characterId`.
 *
 * Quem apaga uma ficha da biblioteca deve chamar também `deletePlayState` com o mesmo id.
 */

export const PLAY_STATES_KEY = 'dnd-play-states'
/** Versão do contêiner. Subir quando o formato do contêiner mudar de um jeito incompatível. */
export const PLAY_STORAGE_VERSION = 1

/**
 * O número da forma do estado de jogo na sincronização (ver `DRAFT_SYNC_SCHEMA`, no `storage.ts`).
 * Aqui ele importa mais ainda: toda gravação passa pelo `sanitizePlayState`, que só mantém os
 * campos que conhece, então um app mais velho apagaria o campo novo de um estado que veio do
 * servidor. Sobe quando o estado de jogo ganha um campo (`syncSchema.test.ts`).
 */
export const PLAY_STATE_SYNC_SCHEMA = 1

type PlayStore = { version: number; states: Record<string, unknown> }

/** Lê o contêiner cru. Versão diferente ou JSON quebrado: descarta a chave, como `storage.ts`. */
function readStore(): Record<string, unknown> {
  const raw = localStorage.getItem(PLAY_STATES_KEY)
  if (!raw) return {}
  try {
    const store = JSON.parse(raw) as Partial<PlayStore> | null
    if (!store || store.version !== PLAY_STORAGE_VERSION || typeof store.states !== 'object' || store.states === null || Array.isArray(store.states)) {
      localStorage.removeItem(PLAY_STATES_KEY)
      return {}
    }
    return store.states
  } catch {
    localStorage.removeItem(PLAY_STATES_KEY)
    return {}
  }
}

function writeStore(states: Record<string, unknown>): void {
  localStorage.setItem(PLAY_STATES_KEY, JSON.stringify({ version: PLAY_STORAGE_VERSION, states } satisfies PlayStore))
  // Quem só joga fichas de antes também pede (a primeira gravação da sessão; ver storage.ts).
  requestPersistentStorage()
}

/** Estado de jogo salvo de uma ficha, já sanitizado; null se ela nunca jogou. */
export function loadPlayState(characterId: string): PlayState | null {
  const states = readStore()
  if (!Object.prototype.hasOwnProperty.call(states, characterId)) return null
  return sanitizePlayState(states[characterId], characterId)
}

/** O salvo, ou um estado novo (não gravado) para a ficha começar a jogar. */
export function loadOrCreatePlayState(characterId: string, now = Date.now()): PlayState {
  return loadPlayState(characterId) ?? createPlayState(characterId, now)
}

/**
 * O carregamento que o modo de jogo usa: o salvo (ou um novo) JÁ reconciliado com a ficha atual,
 * que pode ter mudado no criador desde a última sessão (`regras-descanso.md`, 6.1). Os avisos
 * dizem quando a mudança mexeu no PV (corte da exaustão, 1 PV mínimo). Não grava nada.
 */
export function loadPlayStateFor(characterId: string, sheet: PlaySheet, now = Date.now()): PlayResult {
  return reconcileLoadedPlayState(loadOrCreatePlayState(characterId, now), sheet)
}

export type SavePlayStateOptions = {
  /**
   * A gravação não é do jogador: é o que o app acerta sozinho ao abrir o jogo (o estado reconciliado
   * com a ficha, o retrato dela). Não marca o estado para subir ao servidor: se marcasse, só abrir
   * o jogo num aparelho desatualizado ganharia da sessão jogada em outro.
   */
  quiet?: boolean
}

/**
 * Grava o estado, carimbando `updatedAt`; devolve o estado gravado. Fica marcado para subir ao
 * servidor (o diário de `core/sync/syncStorage.ts`), salvo com `quiet`.
 */
export function savePlayState(state: PlayState, now = Date.now(), options: SavePlayStateOptions = {}): PlayState {
  const saved = { ...sanitizePlayState(state, state.characterId), updatedAt: now }
  const states = readStore()
  const key = playKey(saved.characterId)
  if (!options.quiet) {
    // Antes de gravar o estado: se a página cair entre as duas gravações, sobra um envio a mais.
    markDocChanged(key)
  } else if (!Object.prototype.hasOwnProperty.call(states, saved.characterId)) {
    // O estado nasce agora, só de abrir o jogo: entra no diário como em dia, para não subir antes
    // da primeira ação do jogador. (O que já existia sem entrada no diário é de antes da conta, e
    // continua sem ela: a varredura da sincronização o manda ao servidor.)
    updateSyncMeta(meta => {
      if (key in meta.docs) return false
      meta.docs[key] = { revision: 0, dirty: false }
    })
  }
  states[saved.characterId] = saved
  writeStore(states)
  return saved
}

/**
 * Apaga o estado de jogo de uma ficha (ex.: ficha removida, "recomeçar do zero"). No servidor ele
 * não tem lápide própria: some com a ficha, e aqui o diário só o esquece.
 */
export function deletePlayState(characterId: string): void {
  forgetDoc(playKey(characterId))
  const states = readStore()
  if (!Object.prototype.hasOwnProperty.call(states, characterId)) return
  delete states[characterId]
  writeStore(states)
}

// ── O que só a sincronização usa ─────────────────────────────────────────────
// Gravar e apagar SEM marcar nada no diário (ver o `storage.ts`). Só o adaptador de features/sync
// importa estas funções.

/**
 * Grava o estado de jogo que veio do servidor, sanitizado como todo estado que se lê do aparelho, e
 * com a data que veio (não a de agora): é ela que diz qual versão é a mais nova.
 */
export function putSyncedPlayState(state: PlayState): PlayState {
  const saved = { ...sanitizePlayState(state, state.characterId), updatedAt: state.updatedAt }
  const states = readStore()
  states[saved.characterId] = saved
  writeStore(states)
  return saved
}

/** Tira o estado de jogo de uma ficha que foi apagada em outro aparelho. */
export function removeSyncedPlayState(characterId: string): void {
  const states = readStore()
  if (!Object.prototype.hasOwnProperty.call(states, characterId)) return
  delete states[characterId]
  writeStore(states)
}

/**
 * Apaga os estados de jogo deste aparelho e a marca da ficha aberta no jogo (ao sair da conta). As
 * preferências do jogo ficam: são do aparelho, não da conta.
 */
export function clearPlayStorage(): void {
  localStorage.removeItem(PLAY_STATES_KEY)
  localStorage.removeItem(PLAY_OPEN_KEY)
}

/** Ids das fichas que têm estado de jogo salvo. */
export function listPlayStateIds(): string[] {
  return Object.keys(readStore())
}

// ── Ficha aberta no modo de jogo ────────────────────────────────────────────

export const PLAY_OPEN_KEY = 'dnd-play-open'

/**
 * A ficha aberta no modo de jogo, para recarregar a página (ou o celular descartar a aba) voltar
 * a ela. Gravada ao entrar no jogo; null ao sair ou apagar a ficha. O desfazer não vai junto: ele
 * é só da sessão de tela.
 */
export function saveOpenPlayId(id: string | null): void {
  if (id === null) localStorage.removeItem(PLAY_OPEN_KEY)
  else localStorage.setItem(PLAY_OPEN_KEY, id)
}

/** O id gravado por `saveOpenPlayId`, ou null. Quem lê confere se a ficha ainda existe. */
export function loadOpenPlayId(): string | null {
  const id = localStorage.getItem(PLAY_OPEN_KEY)
  return id && id.trim() ? id : null
}

// ── Preferências do modo de jogo ────────────────────────────────────────────

export const PLAY_PREFERENCES_KEY = 'dnd-play-preferences'

/**
 * Preferências do modo de jogo, do aparelho e não da ficha. `appDice`: usar os dados do app (o
 * motor de `src/core/dice`) — desligado por padrão, porque o jogador rola os próprios dados
 * (decisão de 2026-10-25). `keepScreenOn`: manter a tela acesa enquanto o jogo está aberto
 * (Screen Wake Lock) — ligado por padrão (decisão 10.2.22).
 */
export type PlayPreferences = { appDice: boolean; keepScreenOn: boolean }

export const DEFAULT_PLAY_PREFERENCES: PlayPreferences = { appDice: false, keepScreenOn: true }

/** Cada campo pelo seu padrão: só o valor contrário ao padrão, exatamente, o muda. */
function toPreferences(raw: Partial<Record<keyof PlayPreferences, unknown>> | null | undefined): PlayPreferences {
  return { appDice: raw?.appDice === true, keepScreenOn: raw?.keepScreenOn !== false }
}

/** As preferências salvas, campo a campo; JSON quebrado ou campo estranho cai no padrão. */
export function loadPlayPreferences(): PlayPreferences {
  const raw = localStorage.getItem(PLAY_PREFERENCES_KEY)
  if (!raw) return { ...DEFAULT_PLAY_PREFERENCES }
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof PlayPreferences, unknown>> | null
    return toPreferences(parsed)
  } catch {
    return { ...DEFAULT_PLAY_PREFERENCES }
  }
}

/** Grava as preferências; devolve o que foi gravado. */
export function savePlayPreferences(prefs: PlayPreferences): PlayPreferences {
  const saved = toPreferences(prefs)
  localStorage.setItem(PLAY_PREFERENCES_KEY, JSON.stringify(saved))
  return saved
}
