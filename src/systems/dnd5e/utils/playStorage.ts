import type { PlayResult, PlaySheet, PlayState } from '../types/playState'
import { createPlayState, reconcileLoadedPlayState, sanitizePlayState } from './playState'

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

/** Grava o estado, carimbando `updatedAt`; devolve o estado gravado. */
export function savePlayState(state: PlayState, now = Date.now()): PlayState {
  const saved = { ...sanitizePlayState(state, state.characterId), updatedAt: now }
  const states = readStore()
  states[saved.characterId] = saved
  writeStore(states)
  return saved
}

/** Apaga o estado de jogo de uma ficha (ex.: ficha removida, "recomeçar do zero"). */
export function deletePlayState(characterId: string): void {
  const states = readStore()
  if (!Object.prototype.hasOwnProperty.call(states, characterId)) return
  delete states[characterId]
  writeStore(states)
}

/** Ids das fichas que têm estado de jogo salvo. */
export function listPlayStateIds(): string[] {
  return Object.keys(readStore())
}
