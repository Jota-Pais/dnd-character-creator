import type { OrdemCharacterDraft, WizardStep } from '../types/character'
import { EMPTY_DRAFT } from '../types/character'
import { sanitizeImportedDraft } from './draftValidation'

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

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `char-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function exportCharacter(character: OrdemCharacterDraft): void {
  const json = JSON.stringify(character, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${character.name.trim() || 'agente'}-ordem.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
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
