import type { PlaySession } from './types'
import { EMPTY_RUNTIME, sessionKey } from './types'

/**
 * Persistência das sessões de jogo. Chave própria — não encosta nas bibliotecas de personagem
 * (`ordem-character-library`, `dnd-character-library`), porque a ficha é imutável durante o jogo.
 *
 * Componentes e stores nunca falam com localStorage direto: passa tudo por aqui (regra do
 * CLAUDE.md), pra migrar pra IndexedDB depois sem refatorar.
 */

const PLAY_KEY = 'play-sessions'
export const PLAY_VERSION = 1

type PlayStore = {
  version: number
  sessions: Record<string, PlaySession>
  /** Sessão aberta agora — é o que faz o app voltar pro jogo depois de um reload. */
  activeKey: string | null
}

const EMPTY: PlayStore = { version: PLAY_VERSION, sessions: {}, activeKey: null }

function isSession(value: unknown): value is PlaySession {
  if (!value || typeof value !== 'object') return false
  const s = value as Partial<PlaySession>
  return typeof s.systemId === 'string' && typeof s.characterId === 'string'
}

/** Preenche campos ausentes de uma sessão vinda do disco (compat de schema). */
function withDefaults(session: PlaySession): PlaySession {
  return {
    ...session,
    characterName: session.characterName ?? '',
    runtime: { ...EMPTY_RUNTIME, ...session.runtime },
    log: Array.isArray(session.log) ? session.log : [],
    startedAt: session.startedAt ?? 0,
    updatedAt: session.updatedAt ?? 0,
  }
}

function read(): PlayStore {
  const raw = localStorage.getItem(PLAY_KEY)
  if (!raw) return { ...EMPTY }
  try {
    const parsed = JSON.parse(raw) as Partial<PlayStore>
    if (parsed.version !== PLAY_VERSION || !parsed.sessions || typeof parsed.sessions !== 'object') {
      localStorage.removeItem(PLAY_KEY)
      return { ...EMPTY }
    }
    const sessions: Record<string, PlaySession> = {}
    for (const [key, value] of Object.entries(parsed.sessions)) {
      if (isSession(value)) sessions[key] = withDefaults(value)
    }
    const activeKey = typeof parsed.activeKey === 'string' && sessions[parsed.activeKey]
      ? parsed.activeKey
      : null
    return { version: PLAY_VERSION, sessions, activeKey }
  } catch {
    localStorage.removeItem(PLAY_KEY)
    return { ...EMPTY }
  }
}

function write(store: PlayStore): void {
  localStorage.setItem(PLAY_KEY, JSON.stringify(store))
}

export function loadActiveSession(): PlaySession | null {
  const store = read()
  return store.activeKey ? store.sessions[store.activeKey] ?? null : null
}

export function loadSession(systemId: string, characterId: string): PlaySession | null {
  return read().sessions[sessionKey(systemId, characterId)] ?? null
}

/** Grava a sessão e a marca como aberta. */
export function saveSession(session: PlaySession): void {
  const store = read()
  const key = sessionKey(session.systemId, session.characterId)
  store.sessions[key] = session
  store.activeKey = key
  write(store)
}

/** Fecha a sessão aberta sem apagá-la — voltar a jogar retoma de onde parou. */
export function clearActiveSession(): void {
  const store = read()
  store.activeKey = null
  write(store)
}

/** Apaga a sessão de vez (o "zerar sessão"). A ficha não é tocada. */
export function deleteSession(systemId: string, characterId: string): void {
  const store = read()
  const key = sessionKey(systemId, characterId)
  delete store.sessions[key]
  if (store.activeKey === key) store.activeKey = null
  write(store)
}

/** Existe sessão salva para esta ficha? Usado pela galeria pra rotular "Continuar" x "Jogar". */
export function hasSession(systemId: string, characterId: string): boolean {
  return loadSession(systemId, characterId) !== null
}
