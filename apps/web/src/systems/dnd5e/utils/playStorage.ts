import type { PlayResult, PlaySheet, PlayState } from '@rpg/rules/systems/dnd5e/types/playState'
import { createPlayState, reconcileLoadedPlayState, sanitizePlayState } from '@rpg/rules/systems/dnd5e/utils/playState'

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
