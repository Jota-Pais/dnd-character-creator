import { create } from 'zustand'
import type { CharacterDraft } from '../types/character'
import type { PlayNotice, PlayResult, PlaySheet, PlayState } from '../types/playState'
import { buildPlaySheet } from '../utils/playSheet'
import {
  loadPlayPreferences, loadPlayStateFor, savePlayPreferences, savePlayState, type PlayPreferences,
} from '../utils/playStorage'

/** Quantos estados anteriores o "desfazer" guarda: o bastante para uma rodada de combate. */
export const UNDO_LIMIT = 30

/** Uma operação de jogo: as funções puras de `utils/playState.ts`, já com os argumentos. */
export type PlayOperation = (state: PlayState, sheet: PlaySheet) => PlayResult

type PlayStoreState = {
  characterId: string | null
  characterName: string
  /** Os números da ficha, montados ao abrir; o jogo nunca lê o draft depois disso. */
  sheet: PlaySheet | null
  state: PlayState | null
  /** Estados anteriores, do mais antigo ao mais recente, no máximo `UNDO_LIMIT`. */
  undoStack: PlayState[]
  /** Avisos da última ação (ou da abertura, quando a ficha mudou desde a última sessão). */
  notices: PlayNotice[]
  prefs: PlayPreferences

  /** Abre a ficha salva `id` no modo de jogo: monta o `PlaySheet` e carrega (ou cria) o estado. */
  open: (id: string, draft: CharacterDraft) => void
  /**
   * Roda uma operação no estado aberto. Se o estado mudou, empilha o anterior para o desfazer e
   * grava pelo `playStorage`; os avisos ficam em `notices`. Devolve o resultado, ou null sem ficha aberta.
   */
  run: (op: PlayOperation) => PlayResult | null
  /** Volta ao estado anterior à última ação que mudou algo, e grava. */
  undo: () => void
  dismissNotices: () => void
  /** Liga/desliga os dados do app (preferência do aparelho, não da ficha). */
  setAppDice: (on: boolean) => void
  /** Fecha o modo de jogo. O estado já está gravado; nada é regravado aqui. */
  close: () => void
}

const CLOSED = {
  characterId: null,
  characterName: '',
  sheet: null,
  state: null,
  undoStack: [],
  notices: [],
} satisfies Partial<PlayStoreState>

/** Mudou de verdade? Operações sem efeito devolvem o mesmo objeto; as demais, um novo. */
function changed(before: PlayState, after: PlayState): boolean {
  return before !== after && JSON.stringify(before) !== JSON.stringify(after)
}

/**
 * Estado da tela do modo de jogo (a ficha viva de UM personagem). A ficha (`CharacterDraft`) só é
 * lida no `open`, para montar o `PlaySheet`; o jogo grava apenas o `PlayState`, sempre pelo
 * `playStorage` — nunca o localStorage direto (CLAUDE.md).
 */
export const usePlayStore = create<PlayStoreState>((set, get) => ({
  ...CLOSED,
  prefs: loadPlayPreferences(),

  open: (id, draft) => {
    const sheet = buildPlaySheet(draft)
    const { state, notices } = loadPlayStateFor(id, sheet)
    set({
      characterId: id,
      characterName: draft.name.trim(),
      sheet,
      state,
      undoStack: [],
      notices,
      prefs: loadPlayPreferences(),
    })
  },

  run: (op) => {
    const { state, sheet, undoStack } = get()
    if (!state || !sheet) return null
    const result = op(state, sheet)
    if (!changed(state, result.state)) {
      set({ notices: result.notices })
      return result
    }
    const saved = savePlayState(result.state)
    set({
      state: saved,
      undoStack: [...undoStack, state].slice(-UNDO_LIMIT),
      notices: result.notices,
    })
    return { state: saved, notices: result.notices }
  },

  undo: () => {
    const { undoStack } = get()
    const previous = undoStack.at(-1)
    if (!previous) return
    set({ state: savePlayState(previous), undoStack: undoStack.slice(0, -1), notices: [] })
  },

  dismissNotices: () => set({ notices: [] }),

  setAppDice: (on) => set(s => ({ prefs: savePlayPreferences({ ...s.prefs, appDice: on }) })),

  close: () => set({ ...CLOSED }),
}))
