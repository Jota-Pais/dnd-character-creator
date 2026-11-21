import type { OrdemCharacterDraft, WizardStep } from '@rpg/rules/systems/ordem/types/character'
import { EMPTY_DRAFT, WIZARD_STEPS } from '@rpg/rules/systems/ordem/types/character'
import { canonicalJson } from '@rpg/rules/core/utils/canonicalJson'
import { createId } from '@rpg/rules/core/utils/id'
import { sanitizeImportedDraft } from '@rpg/rules/systems/ordem/utils/draftValidation'
import { requestPersistentStorage } from '../../../core/pwa/persistentStorage'
import { characterKey, markDocChanged, markDocDeleted } from '../../../core/sync/syncStorage'
import { saveJsonFile } from '../../../core/utils/download'

const LIBRARY_KEY = 'ordem-character-library'
export const LIBRARY_VERSION = 1

/** O nome do sistema nas chaves da sincronização e no servidor. */
export const SYSTEM_ID = 'ordem'

/**
 * O número da forma do draft na sincronização (ver o `storage.ts` do dnd5e): sobe quando o draft
 * ganha um campo, e o teste de `syncSchema.test.ts` prende a lista de campos a ele.
 */
export const DRAFT_SYNC_SCHEMA = 1

export type SavedCharacter = {
  id: string
  updatedAt: number
  step: WizardStep
  draft: OrdemCharacterDraft
}

type Library = { version: number; characters: SavedCharacter[] }

function withDraftDefaults(partial: Partial<OrdemCharacterDraft> | undefined): OrdemCharacterDraft {
  return { ...EMPTY_DRAFT, ...partial }
}

function writeLibrary(characters: SavedCharacter[]): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: LIBRARY_VERSION, characters } satisfies Library))
  // A primeira gravação de ficha da sessão pede ao navegador para não apagar o que o site guarda.
  requestPersistentStorage()
}

export function loadLibrary(): SavedCharacter[] {
  const raw = localStorage.getItem(LIBRARY_KEY)
  if (!raw) return []
  try {
    const lib = JSON.parse(raw) as Partial<Library>
    if (lib.version !== LIBRARY_VERSION || !Array.isArray(lib.characters)) {
      localStorage.removeItem(LIBRARY_KEY)
      return []
    }
    return lib.characters
      .filter(c => c && typeof c.id === 'string')
      .map(c => ({
        id: c.id,
        updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : 0,
        step: c.step ?? 'name',
        draft: withDraftDefaults(c.draft),
      }))
  } catch {
    localStorage.removeItem(LIBRARY_KEY)
    return []
  }
}

/**
 * Insere ou atualiza uma ficha; devolve a lista atualizada. Ficha nova, ou com o draft diferente do
 * que estava salvo, fica marcada para subir ao servidor (o diário de `core/sync/syncStorage.ts`):
 * regravar o mesmo draft, ao navegar entre as etapas, não marca nada.
 */
export function saveCharacterEntry(entry: SavedCharacter): SavedCharacter[] {
  const characters = loadLibrary()
  const idx = characters.findIndex(c => c.id === entry.id)
  const previous = idx >= 0 ? characters[idx] : undefined
  // Antes de gravar a ficha: se a página cair entre as duas gravações, sobra um envio a mais.
  if (!previous || canonicalJson(previous.draft) !== canonicalJson(entry.draft)) {
    markDocChanged(characterKey(SYSTEM_ID, entry.id))
  }
  if (idx >= 0) characters[idx] = entry
  else characters.push(entry)
  writeLibrary(characters)
  return characters
}

/** Remove uma ficha; devolve a lista atualizada. Só aqui nasce a exclusão que sobe ao servidor. */
export function deleteCharacterEntry(id: string): SavedCharacter[] {
  const all = loadLibrary()
  const characters = all.filter(c => c.id !== id)
  if (characters.length !== all.length) markDocDeleted(characterKey(SYSTEM_ID, id))
  writeLibrary(characters)
  return characters
}

// ── O que só a sincronização usa ─────────────────────────────────────────────
// Gravar e apagar SEM marcar nada no diário (ver o `storage.ts` do dnd5e). Só o adaptador de
// features/sync importa estas funções.

/** A ficha que veio do servidor, como a biblioteca a guarda; null se não parece uma ficha. */
export function readSyncedCharacter(raw: { id: string; step: string; draft: unknown; updatedAt: number }): SavedCharacter | null {
  const draft = raw.draft
  if (typeof draft !== 'object' || draft === null || Array.isArray(draft)) return null
  if (typeof (draft as { name?: unknown }).name !== 'string') return null
  const step = (WIZARD_STEPS as readonly string[]).includes(raw.step) ? (raw.step as WizardStep) : 'name'
  return { id: raw.id, updatedAt: raw.updatedAt, step, draft: withDraftDefaults(draft as Partial<OrdemCharacterDraft>) }
}

/** Grava na biblioteca a ficha que veio do servidor. */
export function putSyncedCharacter(entry: SavedCharacter): void {
  const characters = loadLibrary()
  const idx = characters.findIndex(c => c.id === entry.id)
  if (idx >= 0) characters[idx] = entry
  else characters.push(entry)
  writeLibrary(characters)
}

/** Tira da biblioteca a ficha que foi apagada em outro aparelho. */
export function removeSyncedCharacter(id: string): void {
  const all = loadLibrary()
  const characters = all.filter(c => c.id !== id)
  if (characters.length !== all.length) writeLibrary(characters)
}

/** Apaga a biblioteca deste aparelho (ao sair da conta: as fichas continuam no servidor). */
export function clearLibrary(): void {
  localStorage.removeItem(LIBRARY_KEY)
}

/** Gera um id único para uma ficha (o gerador comum do núcleo). */
export function newId(): string {
  return createId('char')
}

export function exportCharacter(character: OrdemCharacterDraft): void {
  saveJsonFile(`${character.name.trim() || 'agente'}-ordem.json`, character)
}

export function importCharacter(file: File): Promise<OrdemCharacterDraft | null> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const parsed: unknown = JSON.parse(e.target?.result as string)
        resolve(sanitizeImportedDraft(parsed))
      } catch {
        resolve(null)
      }
    }
    reader.onerror = () => resolve(null)
    reader.readAsText(file)
  })
}
