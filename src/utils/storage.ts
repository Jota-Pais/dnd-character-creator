import type { CharacterDraft, WizardStep } from '../types/character'
import { EMPTY_DRAFT } from '../types/character'
import { sanitizeImportedDraft } from './draftValidation'

const SESSION_KEY = 'dnd-character-session'
const LIBRARY_KEY = 'dnd-character-library'
// Bump this whenever CharacterDraft schema changes in a breaking way
export const SESSION_VERSION = 4
export const LIBRARY_VERSION = 1

/** Uma ficha salva na biblioteca (com o passo do wizard em que parou). */
export type SavedCharacter = {
  id: string
  updatedAt: number
  step: WizardStep
  draft: CharacterDraft
}

type Library = { version: number; characters: SavedCharacter[] }

/** Preenche campos ausentes de um draft carregado com os padrões (compat de schema). */
function withDraftDefaults(partial: Partial<CharacterDraft> | undefined): CharacterDraft {
  const draft = { ...EMPTY_DRAFT, ...partial } as CharacterDraft
  draft.spellChoices ??= { cantrips: [], spells: [] }
  draft.level ??= 1
  draft.hpMethod ??= 'average'
  draft.hpRolls ??= []
  draft.asiChoices ??= []
  return draft
}

// ── Sessão única (legado — mantida só para migrar para a biblioteca) ─────────

type Session = { version: number; draft: CharacterDraft; step: WizardStep }

export function saveSession(draft: CharacterDraft, step: WizardStep): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ version: SESSION_VERSION, draft, step }))
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as Partial<Session>
    if (session.version !== SESSION_VERSION) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return { version: SESSION_VERSION, draft: withDraftDefaults(session.draft), step: session.step ?? 'name' }
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

// ── Biblioteca de fichas ─────────────────────────────────────────────────────

function writeLibrary(characters: SavedCharacter[]): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: LIBRARY_VERSION, characters } satisfies Library))
}

/**
 * Carrega a biblioteca. Na primeira execução após a introdução da biblioteca,
 * migra a sessão única antiga (se existir) para uma ficha da biblioteca.
 */
export function loadLibrary(): SavedCharacter[] {
  const raw = localStorage.getItem(LIBRARY_KEY)
  if (!raw) {
    // migração da sessão única legada
    const legacy = loadSession()
    if (legacy) {
      const migrated: SavedCharacter = {
        id: newId(),
        updatedAt: Date.now(),
        step: legacy.step,
        draft: legacy.draft,
      }
      writeLibrary([migrated])
      clearSession()
      return [migrated]
    }
    return []
  }
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

/** Insere ou atualiza uma ficha na biblioteca; devolve a lista atualizada. */
export function saveCharacterEntry(entry: SavedCharacter): SavedCharacter[] {
  const characters = loadLibrary()
  const idx = characters.findIndex(c => c.id === entry.id)
  if (idx >= 0) characters[idx] = entry
  else characters.push(entry)
  writeLibrary(characters)
  return characters
}

/** Remove uma ficha da biblioteca; devolve a lista atualizada. */
export function deleteCharacterEntry(id: string): SavedCharacter[] {
  const characters = loadLibrary().filter(c => c.id !== id)
  writeLibrary(characters)
  return characters
}

/** Gera um id único para uma ficha (usa crypto quando disponível). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `char-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function exportCharacter(character: CharacterDraft): void {
  const json = JSON.stringify(character, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${character.name.trim() || 'personagem'}-dnd5e.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function importCharacter(file: File): Promise<CharacterDraft | null> {
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
