import { create } from 'zustand'
import type { RollRecord } from '@rpg/rules/core/dice'
import { canonicalJson } from '@rpg/rules/core/utils/canonicalJson'
import type { CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import type { PlayNotice, PlayResult, PlaySheet, PlayState, SheetSnapshot } from '@rpg/rules/systems/dnd5e/types/playState'
import { buildPlaySheet } from '@rpg/rules/systems/dnd5e/utils/playSheet'
import { clearRollHistory, getWornArmor, recordRoll } from '@rpg/rules/systems/dnd5e/utils/playState'
import { sameArmorSetup } from '@rpg/rules/systems/dnd5e/utils/wornArmor'
import { syncSheetSnapshot, takeSheetSnapshot } from '@rpg/rules/systems/dnd5e/utils/sheetSnapshot'
import {
  loadPlayPreferences, loadPlayState, loadPlayStateFor, savePlayPreferences, savePlayState, type PlayPreferences,
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

/** Um Dado de Vida do rascunho do descanso curto: o tipo, a face tirada e a rolagem do app (se houve). */
export type ShortRestSpend = { die: number; value: number; record: RollRecord | null }

/** O painel de descanso aberto na aba Estado. */
export type RestPanel = 'short' | 'long'

type PlayStoreState = {
  characterId: string | null
  characterName: string
  /**
   * A ficha aberta, só leitura: o `PlaySheet` sai dela ao abrir e de novo quando a armadura vestida
   * no jogo muda. O jogo nunca a reescreve.
   */
  draft: CharacterDraft | null
  /**
   * Os números da ficha, montados ao abrir com a armadura vestida do estado, e remontados quando ela
   * muda (`syncSheet`: a operação, o desfazer); fora disso, o jogo nunca lê o draft.
   */
  sheet: PlaySheet | null
  state: PlayState | null
  /** Estados anteriores, do mais antigo ao mais recente, no máximo `UNDO_LIMIT`. */
  undoStack: PlayState[]
  /** Avisos da última ação (ou da abertura, quando a ficha mudou desde a última sessão). */
  notices: PlayNotice[]
  /**
   * O aviso de correção da ficha (decisão 10.2.23) ainda não fechado, com o retrato novo. Fica
   * fora dos `notices`, que cada ação troca: só o OK (`dismissNotices`) o tira, e só aí o retrato
   * novo entra no estado — fechado o jogo antes (ou recarregada a página), o aviso volta.
   */
  sheetCorrection: { notice: PlayNotice; snapshot: SheetSnapshot } | null
  /**
   * A última ação mudou o estado? Só aí o `undo` desfaz ELA; depois de uma recusa (ou de algo sem
   * efeito) o desfazer voltaria uma ação anterior, então a UI não o oferece junto dos avisos.
   */
  lastActionChanged: boolean
  prefs: PlayPreferences
  /**
   * Rascunho do descanso: o painel aberto e os Dados de Vida já gastos no curto. Efêmero (não é
   * gravado nem entra no desfazer), mas mora aqui para sobreviver à troca de aba.
   */
  restPanel: RestPanel | null
  shortRestDraft: ShortRestSpend[]

  /**
   * Abre a ficha salva `id` no modo de jogo: monta o `PlaySheet`, carrega (ou cria) o estado e
   * compara os números com o retrato da última abertura (`sheetUpdatedAt`: o `updatedAt` da ficha
   * na biblioteca, que diz se foi o jogador quem a mudou).
   */
  open: (id: string, draft: CharacterDraft, sheetUpdatedAt: number) => void
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
   * "Nova sessão": esvazia o histórico de rolagens, zera o turno e grava. Como o `logRoll`, fora do
   * desfazer e sem mexer nos avisos — o desfazer nunca toca o histórico, então quem pede confirmação
   * é a tela. O que o desfazer guarda também perde o turno: desfazer uma ação de antes da Nova
   * sessão não traz de volta o turno da sessão anterior, como não traz as rolagens.
   */
  clearRolls: () => void
  /**
   * Volta ao estado anterior à última ação que mudou algo, e grava. O histórico de rolagens fica
   * como está: desfazer um dano não apaga o que foi rolado depois dele. O retrato da ficha também:
   * o de antes da correção lida faria o aviso voltar.
   */
  undo: () => void
  /** Fecha os avisos (o "OK"); com a correção da ficha entre eles, grava o retrato novo. */
  dismissNotices: () => void
  /** Liga/desliga os dados do app (preferência do aparelho, não da ficha). */
  setAppDice: (on: boolean) => void
  /** Liga/desliga a tela acesa durante o jogo (preferência do aparelho, não da ficha). */
  setKeepScreenOn: (on: boolean) => void
  /** Abre um painel de descanso (null fecha). Abrir, fechar ou trocar descarta o rascunho do curto. */
  setRestPanel: (panel: RestPanel | null) => void
  setShortRestDraft: (spends: ShortRestSpend[]) => void
  /**
   * Grava as edições em curso na tela (`registerPendingEdit`): a nota digitada há pouco, a nota
   * de duração sem Enter. A tela chama ao ser escondida (pagehide/visibilitychange).
   */
  flushPendingEdits: () => void
  /**
   * Fecha o modo de jogo. Antes, grava as edições em curso: quem fecha (sair, apagar a ficha) roda
   * antes de a tela desmontar, e depois disso não haveria estado aberto onde gravar.
   */
  close: () => void
}

/** As edições em curso na tela que ainda não viraram estado de jogo (ver `flushPendingEdits`). */
const pendingEdits = new Set<() => void>()

/**
 * Registra o "gravar agora" de um campo com edição pendente; devolve o desregistro (para o
 * cleanup do `useEffect` que registrou).
 */
export function registerPendingEdit(flush: () => void): () => void {
  pendingEdits.add(flush)
  return () => { pendingEdits.delete(flush) }
}

const CLOSED = {
  characterId: null,
  characterName: '',
  draft: null,
  sheet: null,
  state: null,
  undoStack: [],
  notices: [],
  sheetCorrection: null,
  lastActionChanged: false,
  restPanel: null,
  shortRestDraft: [],
} satisfies Partial<PlayStoreState>

/**
 * O sheet que vale para este estado: o mesmo, ou, quando a armadura vestida do estado não é aquela com
 * que ele foi montado (vestir, tirar, desfazer uma troca), um novo, com ela (`buildPlaySheet`). Assim
 * a barra, as abas e a próxima operação leem o deslocamento, as defesas e os benefícios da armadura de
 * agora.
 */
function syncSheet(draft: CharacterDraft | null, sheet: PlaySheet, state: PlayState): PlaySheet {
  if (!draft || sameArmorSetup(getWornArmor(state, sheet), sheet.wornArmor)) return sheet
  return buildPlaySheet(draft, state.wornArmor)
}

/** Mudou de verdade? Operações sem efeito devolvem o mesmo objeto; as demais, um novo. */
function changed(before: PlayState, after: PlayState): boolean {
  return before !== after && JSON.stringify(before) !== JSON.stringify(after)
}

/**
 * Estado da tela do modo de jogo (a ficha viva de UM personagem). A ficha (`CharacterDraft`) só é
 * lida para montar o `PlaySheet` — no `open` e quando a armadura vestida muda —; o jogo grava apenas
 * o `PlayState`, sempre pelo `playStorage` — nunca o localStorage direto (CLAUDE.md).
 */
export const usePlayStore = create<PlayStoreState>((set, get) => ({
  ...CLOSED,
  prefs: loadPlayPreferences(),

  open: (id, draft, sheetUpdatedAt) => {
    // O sheet sai com a armadura vestida no estado salvo, conferida com a ficha de agora; a
    // reconciliação tira do estado a troca que não vale mais, com a mesma conta.
    const saved = loadPlayState(id)
    const sheet = buildPlaySheet(draft, saved?.wornArmor)
    const loaded = loadPlayStateFor(id, sheet)
    const snapshot = takeSheetSnapshot(draft, sheet, sheetUpdatedAt)
    const synced = syncSheetSnapshot(loaded.state, snapshot)
    // Corrigida pelo app, o retrato novo espera o OK do aviso; até lá, o estado fica com o de antes.
    const correction = synced.notices.find(n => n.kind === 'sheetCorrected')
    const opened = correction ? loaded.state : synced.state
    // A abertura mudou o estado (reconciliado com a ficha mudada, ou com o retrato novo da ficha):
    // grava, para o aviso da reconciliação aparecer uma vez só (e não em toda abertura até a
    // primeira ação). A primeira abertura grava o retrato, para a próxima ter com o que comparar.
    const state = !saved || canonicalJson(saved) !== canonicalJson(opened)
      ? savePlayState(opened)
      : opened
    set({
      ...CLOSED,
      characterId: id,
      characterName: draft.name.trim(),
      draft,
      sheet: syncSheet(draft, sheet, state),
      state,
      undoStack: [],
      notices: loaded.notices,
      sheetCorrection: correction ? { notice: correction, snapshot } : null,
      lastActionChanged: false,
      prefs: loadPlayPreferences(),
    })
  },

  run: (op, options) => {
    const { state, sheet, undoStack, draft } = get()
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
      sheet: syncSheet(draft, sheet, saved),
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

  clearRolls: () => {
    const { state } = get()
    if (!state) return
    const next = clearRollHistory(state).state
    if (next !== state) set({ state: savePlayState(next) })
    set(s => ({ undoStack: s.undoStack.map(entry => clearRollHistory(entry).state) }))
  },

  undo: () => {
    const { undoStack, state, sheet, draft } = get()
    const previous = undoStack.at(-1)
    if (!previous || !state || !sheet) return
    const restored = savePlayState({ ...previous, rolls: state.rolls, sheetSnapshot: state.sheetSnapshot })
    set({
      state: restored, sheet: syncSheet(draft, sheet, restored),
      undoStack: undoStack.slice(0, -1), notices: [], lastActionChanged: false,
    })
  },

  dismissNotices: () => {
    const { state, sheetCorrection } = get()
    // Fora do desfazer, como o histórico: o retrato é da ficha, não da sessão.
    const read = state && sheetCorrection ? { state: savePlayState({ ...state, sheetSnapshot: sheetCorrection.snapshot }) } : {}
    set({ ...read, notices: [], sheetCorrection: null })
  },

  setAppDice: (on) => set(s => ({ prefs: savePlayPreferences({ ...s.prefs, appDice: on }) })),

  setKeepScreenOn: (on) => set(s => ({ prefs: savePlayPreferences({ ...s.prefs, keepScreenOn: on }) })),

  setRestPanel: (panel) => set({ restPanel: panel, shortRestDraft: [] }),

  setShortRestDraft: (spends) => set({ shortRestDraft: spends }),

  flushPendingEdits: () => {
    for (const flush of [...pendingEdits]) flush()
  },

  close: () => {
    get().flushPendingEdits()
    set({ ...CLOSED })
  },
}))
