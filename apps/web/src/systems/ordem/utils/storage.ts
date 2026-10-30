import type { OrdemCharacterDraft, WizardStep } from '@rpg/rules/systems/ordem/types/character'
import { EMPTY_DRAFT } from '@rpg/rules/systems/ordem/types/character'
import { createId } from '@rpg/rules/core/utils/id'
import { sanitizeImportedDraft } from '@rpg/rules/systems/ordem/utils/draftValidation'
import { requestPersistentStorage } from '../../../core/pwa/persistentStorage'
import { downloadJsonFile } from '../../../core/utils/download'

const LIBRARY_KEY = 'ordem-character-library'
export const LIBRARY_VERSION = 1

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

export function saveCharacterEntry(entry: SavedCharacter): SavedCharacter[] {
  const characters = loadLibrary()
  const idx = characters.findIndex(c => c.id === entry.id)
  if (idx >= 0) characters[idx] = entry
  else characters.push(entry)
  writeLibrary(characters)
  return characters
}

export function deleteCharacterEntry(id: string): SavedCharacter[] {
  const characters = loadLibrary().filter(c => c.id !== id)
  writeLibrary(characters)
  return characters
}

/** Gera um id único para uma ficha (o gerador comum do núcleo). */
export function newId(): string {
  return createId('char')
}

export function exportCharacter(character: OrdemCharacterDraft): void {
  downloadJsonFile(`${character.name.trim() || 'agente'}-ordem.json`, character)
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
