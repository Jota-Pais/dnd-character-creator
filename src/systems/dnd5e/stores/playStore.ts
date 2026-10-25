import { create } from 'zustand'
import type { RollRecord } from '../../../core/dice'
import type { CharacterDraft } from '../types/character'
import type { PlayNotice, PlayResult, PlaySheet, PlayState } from '../types/playState'
import { buildPlaySheet } from '../utils/playSheet'
import { recordRoll } from '../utils/playState'
import {
  loadPlayPreferences, loadPlayStateFor, savePlayPreferences, savePlayState, type PlayPreferences,
} from '../utils/playStorage'

/** Quantos estados anteriores o "desfazer" guarda: o bastante para uma rodada de combate. */
export const UNDO_LIMIT = 30

/** Uma operação de jogo: as funções puras de `utils/playState.ts`, já com os argumentos. */
export type PlayOperation = (state: PlayState, sheet: PlaySheet) => PlayResult

/**
 * `background`: operação de bastidor (o autosave de uma nota). Continua gravando e entrando no
 * desfazer, mas não troca os avisos da tela (o aviso de concentração do último dano fica) e marca
 * `lastActionChanged: false`: o "Desfazer" do aviso desfaria a nota, não a ação que ele descreve.
 */
export type RunOptions = { background?: boolean }

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
  /**
   * A última ação mudou o estado? Só aí o `undo` desfaz ELA; depois de uma recusa (ou de algo sem
   * efeito) o desfazer voltaria uma ação anterior, então a UI não o oferece junto dos avisos.
   */
  lastActionChanged: boolean
  prefs: PlayPreferences

  /** Abre a ficha salva `id` no modo de jogo: monta o `PlaySheet` e carrega (ou cria) o estado. */
  open: (id: string, draft: CharacterDraft) => void
  /**
   * Roda uma operação no estado aberto. Se o estado mudou, empilha o anterior para o desfazer e
   * grava pelo `playStorage`; os avisos ficam em `notices`. Devolve o resultado, ou null sem ficha aberta.
   */
  run: (op: PlayOperation, options?: RunOptions) => PlayResult | null
  /**
   * Grava uma rolagem dos dados do app no histórico. O histórico é registro, não estado de regra:
   * não entra no desfazer nem mexe nos avisos (o aviso de concentração e o seu "Desfazer" ficam).
   */
  logRoll: (record: RollRecord) => void
  /**
   * Volta ao estado anterior à última ação que mudou algo, e grava. O histórico de rolagens fica
   * como está: desfazer um dano não apaga o que foi rolado depois dele.
   */
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
  lastActionChanged: false,
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
      lastActionChanged: false,
      prefs: loadPlayPreferences(),
    })
  },

  run: (op, options) => {
    const { state, sheet, undoStack } = get()
    if (!state || !sheet) return null
    const background = options?.background === true
    const result = op(state, sheet)
    if (!changed(state, result.state)) {
      if (!background) set({ notices: result.notices, lastActionChanged: false })
      return result
    }
    const saved = savePlayState(result.state)
    set({
      state: saved,
      undoStack: [...undoStack, state].slice(-UNDO_LIMIT),
      ...(background ? {} : { notices: result.notices }),
      lastActionChanged: !background,
    })
    return { state: saved, notices: result.notices }
  },

  logRoll: (record) => {
    const { state } = get()
    if (!state) return
    set({ state: savePlayState(recordRoll(state, record).state) })
  },

  undo: () => {
    const { undoStack, state } = get()
    const previous = undoStack.at(-1)
    if (!previous) return
    const restored = { ...previous, rolls: state?.rolls ?? previous.rolls }
    set({ state: savePlayState(restored), undoStack: undoStack.slice(0, -1), notices: [], lastActionChanged: false })
  },

  dismissNotices: () => set({ notices: [] }),

  setAppDice: (on) => set(s => ({ prefs: savePlayPreferences({ ...s.prefs, appDice: on }) })),

  close: () => set({ ...CLOSED }),
}))
