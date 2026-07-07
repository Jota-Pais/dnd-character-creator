import type { CharacterDraft, WizardStep } from '../types/character'
import { EMPTY_DRAFT } from '../types/character'
import { sanitizeImportedDraft } from './draftValidation'

const SESSION_KEY = 'dnd-character-session'
// Bump this whenever CharacterDraft schema changes in a breaking way
export const SESSION_VERSION = 3

type Session = {
  version: number
  draft: CharacterDraft
  step: WizardStep
}

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
    const draft = { ...EMPTY_DRAFT, ...session.draft } as CharacterDraft
    draft.spellChoices ??= { cantrips: [], spells: [] }
    draft.level ??= 1
    draft.hpMethod ??= 'average'
    draft.hpRolls ??= []
    return { version: SESSION_VERSION, draft, step: session.step ?? 'name' }
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
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
