import type { CharacterDraft } from '../types/character'

const STORAGE_KEY = 'dnd-character-draft'

export function saveCharacter(character: CharacterDraft): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(character))
}

export function loadCharacter(): CharacterDraft | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CharacterDraft
  } catch {
    return null
  }
}

export function clearCharacter(): void {
  localStorage.removeItem(STORAGE_KEY)
}
