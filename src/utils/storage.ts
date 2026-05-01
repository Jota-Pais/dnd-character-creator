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
