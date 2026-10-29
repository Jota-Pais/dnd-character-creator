import { canonicalJson } from '@rpg/rules/core/utils/canonicalJson'
import type { PlayState } from '@rpg/rules/systems/dnd5e/types/playState'
import type { OrdemCharacterDraft } from '@rpg/rules/systems/ordem/types/character'
import { sanitizeImportedDraft as sanitizeOrdemDraft } from '@rpg/rules/systems/ordem/utils/draftValidation'
import {
  buildCharacterFile,
  loadLibrary as loadDndLibrary,
  parseCharacterFile,
  type CharacterFile,
  type ImportedCharacter,
  type SavedCharacter as DndSaved,
} from './systems/dnd5e/utils/storage'
import { listPlayStateIds, loadPlayState } from './systems/dnd5e/utils/playStorage'
import { loadLibrary as loadOrdemLibrary, type SavedCharacter as OrdemSaved } from './systems/ordem/utils/storage'
import { downloadJsonFile } from './core/utils/download'
import { updateDeviceState } from './core/utils/deviceStorage'

/**
 * A cópia de segurança de todas as fichas (docs/app-instalavel.md): um arquivo só, com as fichas
 * dos dois sistemas e os estados de jogo, para guardar fora do navegador (que pode apagar o que o
 * site guarda) ou levar a outro aparelho. Cada ficha vai no formato do arquivo de uma ficha — a do
 * D&D no envelope `CharacterFile` (draft e estado de jogo), a do Ordem no draft, como o exportar
 * de cada uma —, e o importar lê cada uma pelo mesmo caminho do importar de uma ficha. Mora fora do
 * núcleo porque conhece os dois sistemas, como a galeria.
 */
export const BACKUP_FILE_FORMAT = 'rpg-character-backup'
export const BACKUP_FILE_VERSION = 1

export type BackupEntry =
  | { system: 'dnd5e'; file: CharacterFile }
  | { system: 'ordem'; file: OrdemCharacterDraft }

export type BackupFile = {
  format: typeof BACKUP_FILE_FORMAT
  version: number
  /** Quando a cópia foi feita (ms). */
  exportedAt: number
  characters: BackupEntry[]
}

export function buildBackupFile(
  dnd: DndSaved[],
  ordem: OrdemSaved[],
  playStateOf: (characterId: string) => PlayState | null,
  now: number,
): BackupFile {
  return {
    format: BACKUP_FILE_FORMAT,
    version: BACKUP_FILE_VERSION,
    exportedAt: now,
    characters: [
      ...dnd.map(c => ({ system: 'dnd5e' as const, file: buildCharacterFile(c.draft, playStateOf(c.id)) })),
      ...ordem.map(c => ({ system: 'ordem' as const, file: c.draft })),
    ],
  }
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** O arquivo é uma cópia de todas as fichas (e não o de uma ficha). */
export function isBackupFile(raw: unknown): boolean {
  return isRecord(raw) && raw.format === BACKUP_FILE_FORMAT
}

/** O que a cópia traz, já lido e sanitizado; `invalid`: as entradas que não pareciam ficha. */
export type BackupContents = { dnd5e: ImportedCharacter[]; ordem: OrdemCharacterDraft[]; invalid: number }

/** Lê a cópia; null se não é uma cópia (ou não tem a lista de fichas). */
export function parseBackupFile(raw: unknown): BackupContents | null {
  if (!isBackupFile(raw)) return null
  const characters = (raw as Record<string, unknown>).characters
  if (!Array.isArray(characters)) return null
  const contents: BackupContents = { dnd5e: [], ordem: [], invalid: 0 }
  for (const entry of characters) {
    if (!isRecord(entry)) contents.invalid++
    else if (entry.system === 'dnd5e') {
      const parsed = parseCharacterFile(entry.file)
      if (parsed) contents.dnd5e.push(parsed)
      else contents.invalid++
    } else if (entry.system === 'ordem') {
      const draft = sanitizeOrdemDraft(entry.file)
      if (draft) contents.ordem.push(draft)
      else contents.invalid++
    } else contents.invalid++
  }
  return contents
}

/** O que entra de uma cópia; `alreadyHere`: as fichas iguais às que já estão neste navegador. */
export type RestorePlan = BackupContents & { alreadyHere: number }

/**
 * A ficha do D&D lida de um arquivo, para comparar a daqui com a da cópia. Sem a hora da gravação
 * do estado de jogo: restaurar grava o estado de novo (com a hora de agora), e o jogo é o mesmo.
 */
function dndKey({ draft, playState }: ImportedCharacter): string {
  return canonicalJson({ draft, playState: playState && { ...playState, updatedAt: 0 } })
}

/**
 * Tira da cópia as fichas que já estão aqui iguaizinhas — a mesma ficha e o mesmo estado de jogo
 * —, para restaurar duas vezes a mesma cópia não dobrar a galeria. Qualquer diferença (a ficha
 * mudou, ou jogou-se depois da cópia) entra como ficha nova: importar nunca mexe na ficha daqui.
 */
export function planRestore(
  contents: BackupContents,
  here: { dnd5e: DndSaved[]; ordem: OrdemSaved[]; playStateOf: (characterId: string) => PlayState | null },
): RestorePlan {
  // As daqui passam pelo mesmo caminho das da cópia (arquivo → JSON → leitura), com o mesmo saneamento.
  const roundTrip = (x: unknown): unknown => JSON.parse(JSON.stringify(x))
  const dndHere = new Set(here.dnd5e.map(c => {
    const parsed = parseCharacterFile(roundTrip(buildCharacterFile(c.draft, here.playStateOf(c.id))))
    return parsed ? dndKey(parsed) : ''
  }))
  const ordemHere = new Set(here.ordem.map(c => canonicalJson(sanitizeOrdemDraft(roundTrip(c.draft)))))
  const dnd5e = contents.dnd5e.filter(c => !dndHere.has(dndKey(c)))
  const ordem = contents.ordem.filter(d => !ordemHere.has(canonicalJson(d)))
  return {
    dnd5e,
    ordem,
    invalid: contents.invalid,
    alreadyHere: contents.dnd5e.length - dnd5e.length + contents.ordem.length - ordem.length,
  }
}

const fichas = (n: number) => `${n} ficha${n === 1 ? '' : 's'}`

/** O que a galeria diz depois de restaurar uma cópia. */
export function formatRestoreResult(plan: RestorePlan): string {
  const entered = plan.dnd5e.length + plan.ordem.length
  const parts = [
    entered === 0
      ? plan.alreadyHere > 0 ? 'Todas as fichas da cópia já estão aqui.' : 'A cópia não tem fichas.'
      : `Cópia restaurada: ${fichas(entered)} ${entered === 1 ? 'entrou' : 'entraram'} na galeria.`,
  ]
  if (entered > 0 && plan.alreadyHere > 0) {
    parts.push(`${fichas(plan.alreadyHere)} igua${plan.alreadyHere === 1 ? 'l' : 'is'} às daqui ${plan.alreadyHere === 1 ? 'ficou' : 'ficaram'} de fora.`)
  }
  if (plan.invalid > 0) {
    parts.push(`${plan.invalid === 1 ? 'Um item não parecia ficha e foi ignorado' : `${plan.invalid} itens não pareciam fichas e foram ignorados`}.`)
  }
  return parts.join(' ')
}

/** A última mudança nas fichas ou nos estados de jogo deste navegador (ms); null sem ficha. */
export function getLatestChangeAt(): number | null {
  const times = [
    ...loadDndLibrary().map(c => c.updatedAt),
    ...loadOrdemLibrary().map(c => c.updatedAt),
    ...listPlayStateIds().map(id => loadPlayState(id)?.updatedAt ?? 0),
  ]
  return times.length > 0 ? Math.max(...times) : null
}

/** "2026-10-29", no fuso do aparelho. */
function localDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Baixa a cópia de todas as fichas deste navegador e anota a data (o lembrete da galeria lê). */
export function exportAllCharacters(now = Date.now()): void {
  const file = buildBackupFile(loadDndLibrary(), loadOrdemLibrary(), loadPlayState, now)
  downloadJsonFile(`forja-de-herois-fichas-${localDate(now)}.json`, file)
  updateDeviceState({ lastBackupAt: now })
}
