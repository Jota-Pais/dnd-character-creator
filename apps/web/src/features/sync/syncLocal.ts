import { canonicalJson } from '@rpg/rules/core/utils/canonicalJson'
import type { PlayState } from '@rpg/rules/systems/dnd5e/types/playState'
import { sanitizePlayState } from '@rpg/rules/systems/dnd5e/utils/playState'
import type { LocalDoc, RemoteDoc, SyncLocalPort } from '../../core/sync/engine'
import { characterKey, clearSyncMeta, parseDocKey, playKey, type DocKey } from '../../core/sync/syncStorage'
import * as dnd from '../../systems/dnd5e/storage/storage'
import * as play from '../../systems/dnd5e/storage/playStorage'
import { flushAutosave, useCharacterStore } from '../../systems/dnd5e/stores/characterStore'
import { usePlayStore } from '../../systems/dnd5e/stores/playStore'
import * as ordem from '../../systems/ordem/storage/storage'
import { useOrdemStore } from '../../systems/ordem/stores/characterStore'

/**
 * O aparelho, para o motor da sincronização (`core/sync/engine.ts`): quem sabe ler e gravar as
 * fichas dos dois sistemas e o estado de jogo, pelas camadas de storage de cada um. Mora fora do
 * núcleo, como a cópia de todas as fichas (`features/gallery/libraryBackup.ts`), porque conhece os
 * dois sistemas.
 *
 * É o ÚNICO arquivo do site que usa as funções de storage que gravam sem marcar o diário
 * (`putSynced*`, `removeSynced*`, `readSynced*`, `clear*`): o que elas gravam veio do servidor
 * (um teste prende isso).
 */

/** Uma ficha salva, de qualquer sistema, sem o tipo do draft. */
type Sheet = { id: string; updatedAt: number; step: string; draft: Record<string, unknown> }

/** O que o adaptador precisa da camada de storage de um sistema. */
type SheetStorage = {
  schema: number
  load(): Sheet[]
  /** A ficha remota como a biblioteca a guarda; null se não parece uma ficha. */
  read(raw: { id: string; step: string; draft: unknown; updatedAt: number }): Sheet | null
  /** Grava o que veio do servidor, sem marcar. */
  put(sheet: Sheet): void
  /** Tira o que foi apagado em outro aparelho, sem lápide. */
  remove(id: string): void
  /** Grava como o jogador gravaria: a ficha fica marcada para subir. */
  save(sheet: Sheet): void
  newId(): string
  clear(): void
}

// Cada camada tem o tipo do draft do seu sistema; aqui o draft é só um objeto a transportar.
const SHEETS: Record<string, SheetStorage> = {
  [dnd.SYSTEM_ID]: {
    schema: dnd.DRAFT_SYNC_SCHEMA,
    load: () => dnd.loadLibrary() as unknown as Sheet[],
    read: raw => dnd.readSyncedCharacter(raw) as unknown as Sheet | null,
    put: sheet => dnd.putSyncedCharacter(sheet as unknown as dnd.SavedCharacter),
    remove: dnd.removeSyncedCharacter,
    save: sheet => { dnd.saveCharacterEntry(sheet as unknown as dnd.SavedCharacter) },
    newId: dnd.newId,
    clear: dnd.clearLibrary,
  },
  [ordem.SYSTEM_ID]: {
    schema: ordem.DRAFT_SYNC_SCHEMA,
    load: () => ordem.loadLibrary() as unknown as Sheet[],
    read: raw => ordem.readSyncedCharacter(raw) as unknown as Sheet | null,
    put: sheet => ordem.putSyncedCharacter(sheet as unknown as ordem.SavedCharacter),
    remove: ordem.removeSyncedCharacter,
    save: sheet => { ordem.saveCharacterEntry(sheet as unknown as ordem.SavedCharacter) },
    newId: ordem.newId,
    clear: ordem.clearLibrary,
  },
}

/** O estado de jogo só existe no D&D: é a ficha dele que o estado acompanha. */
const dndSheet = (id: string) => SHEETS[dnd.SYSTEM_ID].load().find(sheet => sheet.id === id)

/** "21/11 14:32", no horário do aparelho. */
export function formatConflictMoment(now: number): string {
  const date = new Date(now)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(date.getDate())}/${two(date.getMonth() + 1)} ${two(date.getHours())}:${two(date.getMinutes())}`
}

/** O nome da cópia: o da ficha, com o motivo e a hora ao lado. */
const copyName = (name: unknown, reason: string, now: number) =>
  `${typeof name === 'string' ? name.trim() : ''} (${reason} ${formatConflictMoment(now)})`.trim()

/** O estado de jogo sem o que não é conteúdo do jogador: a data e o retrato dos números da ficha. */
function playContent(state: Record<string, unknown>): string {
  const { updatedAt: _updatedAt, sheetSnapshot: _sheetSnapshot, ...content } = state
  void _updatedAt
  void _sheetSnapshot
  return canonicalJson(content)
}

export const syncLocal: SyncLocalPort = {
  keys() {
    const keys: DocKey[] = []
    for (const [system, storage] of Object.entries(SHEETS)) {
      for (const sheet of storage.load()) keys.push(characterKey(system, sheet.id))
    }
    // O estado de jogo de uma ficha que não existe mais não sobe.
    const dndIds = new Set(SHEETS[dnd.SYSTEM_ID].load().map(sheet => sheet.id))
    for (const id of play.listPlayStateIds()) {
      if (dndIds.has(id)) keys.push(playKey(id))
    }
    return keys
  },

  read(key) {
    const parsed = parseDocKey(key)
    if (!parsed) return null
    if (parsed.kind === 'play') {
      const state = play.loadPlayState(parsed.characterId)
      if (!state) return null
      return {
        kind: 'play', key, characterId: parsed.characterId, state: state as unknown as Record<string, unknown>,
        schema: play.PLAY_STATE_SYNC_SCHEMA, updatedAt: state.updatedAt,
      }
    }
    const storage = SHEETS[parsed.system]
    const sheet = storage?.load().find(candidate => candidate.id === parsed.id)
    if (!storage || !sheet) return null
    return { kind: 'character', key, system: parsed.system, id: sheet.id, step: sheet.step, draft: sheet.draft, schema: storage.schema, updatedAt: sheet.updatedAt }
  },

  applyRemote(remote) {
    if (remote.kind === 'character') {
      const { doc } = remote
      // A ficha chega com a data de quem a gravou, e não a de agora: a ordem das fichas fica igual
      // nos aparelhos, e é ela que diz qual versão é a mais nova num conflito futuro.
      const sheet = SHEETS[doc.system]?.read({ id: doc.id, step: doc.step, draft: doc.draft, updatedAt: doc.clientUpdatedAt })
      if (!sheet) return false
      SHEETS[doc.system].put(sheet)
      return true
    }
    // O estado de jogo só entra com a ficha dele no aparelho.
    if (!dndSheet(remote.doc.characterId)) return false
    const state = sanitizePlayState(remote.doc.state, remote.doc.characterId)
    play.putSyncedPlayState({ ...state, updatedAt: remote.doc.clientUpdatedAt })
    return true
  },

  remove(key) {
    const parsed = parseDocKey(key)
    if (!parsed) return
    if (parsed.kind === 'play') {
      play.removeSyncedPlayState(parsed.characterId)
      return
    }
    if (parsed.system === dnd.SYSTEM_ID) {
      play.removeSyncedPlayState(parsed.id)
      if (play.loadOpenPlayId() === parsed.id) play.saveOpenPlayId(null)
    }
    SHEETS[parsed.system]?.remove(parsed.id)
  },

  saveConflictCopy(loser, now) {
    const isRemote = 'doc' in loser
    if (loser.kind === 'character') {
      const system = isRemote ? loser.doc.system : loser.system
      const storage = SHEETS[system]
      const sheet = isRemote
        ? storage?.read({ id: loser.doc.id, step: loser.doc.step, draft: loser.doc.draft, updatedAt: loser.doc.clientUpdatedAt })
        : { id: loser.id, step: loser.step, draft: loser.draft, updatedAt: loser.updatedAt }
      // O que veio do servidor e não parece uma ficha não tem o que copiar.
      if (!storage || !sheet) return
      storage.save({ ...sheet, id: storage.newId(), draft: { ...sheet.draft, name: copyName(sheet.draft.name, 'conflito', now) } })
      return
    }

    // O estado de jogo que perdeu vira uma cópia da ficha, com ele dentro: assim ele aparece na
    // galeria, e o jogador decide o que fazer com ele.
    const characterId = isRemote ? loser.doc.characterId : loser.characterId
    const sheet = dndSheet(characterId)
    if (!sheet) return
    const storage = SHEETS[dnd.SYSTEM_ID]
    const id = storage.newId()
    storage.save({ ...sheet, id, draft: { ...sheet.draft, name: copyName(sheet.draft.name, 'jogo em conflito', now) } })
    const state = sanitizePlayState(isRemote ? loser.doc.state : loser.state, id)
    play.savePlayState({ ...state, characterId: id } as PlayState, now)
  },

  sameContent(local: LocalDoc, remote: RemoteDoc) {
    if (local.kind === 'character' && remote.kind === 'character') {
      // A versão do servidor passa pelo mesmo tratamento da que se lê do aparelho antes de comparar.
      const sheet = SHEETS[remote.doc.system]?.read({ id: remote.doc.id, step: remote.doc.step, draft: remote.doc.draft, updatedAt: 0 })
      return sheet !== null && sheet !== undefined && canonicalJson(local.draft) === canonicalJson(sheet.draft)
    }
    if (local.kind === 'play' && remote.kind === 'play') {
      const state = sanitizePlayState(remote.doc.state, remote.doc.characterId) as unknown as Record<string, unknown>
      return playContent(local.state) === playContent(state)
    }
    return false
  },

  supports(remote) {
    if (remote.kind === 'play') return remote.doc.schema <= play.PLAY_STATE_SYNC_SCHEMA
    const storage = SHEETS[remote.doc.system]
    // Sistema que este app não conhece é como uma forma mais nova: nem aplica, nem envia.
    return storage !== undefined && remote.doc.schema <= storage.schema
  },
}

/** Quantas fichas este aparelho guarda, dos dois sistemas. */
export function countLocalSheets(): number {
  return Object.values(SHEETS).reduce((total, storage) => total + storage.load().length, 0)
}

/**
 * Apaga do aparelho as fichas, os estados de jogo e o diário (ao sair da conta: tudo continua no
 * servidor). Ficam as preferências do jogo e o que é do aparelho (`app-device`).
 */
export function wipeLocalSheets(): void {
  for (const storage of Object.values(SHEETS)) storage.clear()
  play.clearPlayStorage()
  clearSyncMeta()
}

/** As telas releem as bibliotecas: a sincronização gravou nelas o que veio do servidor. */
export function reloadLibraries(): void {
  useCharacterStore.getState().reloadLibrary()
  useOrdemStore.getState().reloadLibrary()
}

/** Grava agora o que a tela ainda não gravou: o salvamento automático e a nota em edição no jogo. */
export function flushLocalEdits(): void {
  flushAutosave()
  usePlayStore.getState().flushPendingEdits()
}
