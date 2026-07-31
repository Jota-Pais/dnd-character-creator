import { create } from 'zustand'
import type { LogEntry, LogKind, PlaySession } from './types'
import { EMPTY_RUNTIME } from './types'
import {
  clearActiveSession,
  deleteSession,
  loadActiveSession,
  loadSession,
  saveSession,
} from './playStorage'

/**
 * Store do modo de jogo. Uma sessão aberta por vez — a existência dela é o que roteia o app pra
 * tela de jogo (ver App.tsx), então não há estado de rota duplicado.
 *
 * Toda mutação persiste na hora: a sessão precisa sobreviver a um reload no meio da mesa.
 */

/** Quantas linhas do histórico ficam guardadas. Uma sessão longa não pode estourar o localStorage. */
const LOG_LIMIT = 300

type PlayStore = {
  session: PlaySession | null

  /** Abre (ou retoma) a sessão desta ficha. */
  start: (systemId: string, characterId: string, characterName: string) => void
  /** Sai do jogo mantendo a sessão salva. */
  exit: () => void
  /** Apaga a sessão e sai. A ficha não é tocada. */
  discard: () => void

  setResource: (id: string, value: number) => void
  /** Delta negativo é dano, positivo é cura. Devolve o quanto realmente mudou. */
  adjustResource: (id: string, delta: number, max: number) => number
  setNotes: (notes: string) => void
  /**
   * Liga uma condição. `escalate` traduz "receber de novo" no agravamento certo (Abalado →
   * Apavorado) — quem sabe disso é o sistema, então a regra vem de fora.
   */
  addCondition: (id: string, escalate?: (id: string, active: string[]) => string) => void
  removeCondition: (id: string) => void
  addLog: (entry: Omit<LogEntry, 'id' | 'at'>) => void
  clearLog: () => void
}

function nextId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `log-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export const usePlayStore = create<PlayStore>((set, get) => {
  /** Aplica a mudança na sessão aberta, carimba `updatedAt` e persiste. */
  function mutate(fn: (session: PlaySession) => PlaySession): void {
    const current = get().session
    if (!current) return
    const next = { ...fn(current), updatedAt: Date.now() }
    saveSession(next)
    set({ session: next })
  }

  return {
    // Retoma a sessão que estava aberta antes de um reload.
    session: loadActiveSession(),

    start: (systemId, characterId, characterName) => {
      const existing = loadSession(systemId, characterId)
      const session: PlaySession = existing
        // Nome é reatualizado: a ficha pode ter sido renomeada desde a última sessão.
        ? { ...existing, characterName, updatedAt: Date.now() }
        : {
            systemId,
            characterId,
            characterName,
            runtime: { ...EMPTY_RUNTIME },
            log: [],
            startedAt: Date.now(),
            updatedAt: Date.now(),
          }
      saveSession(session)
      set({ session })
    },

    exit: () => {
      clearActiveSession()
      set({ session: null })
    },

    discard: () => {
      const current = get().session
      if (current) deleteSession(current.systemId, current.characterId)
      set({ session: null })
    },

    setResource: (id, value) => mutate(session => ({
      ...session,
      runtime: { ...session.runtime, resources: { ...session.runtime.resources, [id]: value } },
    })),

    adjustResource: (id, delta, max) => {
      const session = get().session
      if (!session) return 0
      const stored = session.runtime.resources[id]
      const current = stored === undefined ? max : stored
      const next = Math.max(0, Math.min(max, current + delta))
      if (next === current) return 0
      get().setResource(id, next)
      return next - current
    },

    setNotes: notes => mutate(session => ({ ...session, runtime: { ...session.runtime, notes } })),

    addCondition: (id, escalate) => mutate(session => {
      const active = session.runtime.conditions
      const resulting = escalate ? escalate(id, active) : id
      if (active.includes(resulting)) return session
      // Ao agravar, a condição de origem sai: Abalado vira Apavorado, não os dois.
      const kept = resulting === id ? active : active.filter(c => c !== id)
      return { ...session, runtime: { ...session.runtime, conditions: [...kept, resulting] } }
    }),

    removeCondition: id => mutate(session => ({
      ...session,
      runtime: { ...session.runtime, conditions: session.runtime.conditions.filter(c => c !== id) },
    })),

    addLog: entry => mutate(session => ({
      ...session,
      // Mais recente primeiro: é a ordem em que a mesa lê.
      log: [{ ...entry, id: nextId(), at: Date.now() }, ...session.log].slice(0, LOG_LIMIT),
    })),

    clearLog: () => mutate(session => ({ ...session, log: [] })),
  }
})

export type { LogKind }
