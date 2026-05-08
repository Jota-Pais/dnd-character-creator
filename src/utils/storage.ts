import type { CharacterDraft, WizardStep } from '../types/character'

const SESSION_KEY = 'dnd-character-session'

type Session = {
  draft: CharacterDraft
  step: WizardStep
}

export function saveSession(draft: CharacterDraft, step: WizardStep): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ draft, step }))
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as Session
    // Migrate drafts that predate spellChoices
    if (!session.draft.spellChoices) {
      session.draft.spellChoices = { cantrips: [], spells: [] }
    }
    return session
  } catch {
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
        const parsed = JSON.parse(e.target?.result as string)
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'name' in parsed &&
          'abilityScores' in parsed
        ) {
          resolve(parsed as CharacterDraft)
        } else {
          resolve(null)
        }
      } catch {
        resolve(null)
      }
    }
    reader.onerror = () => resolve(null)
    reader.readAsText(file)
  })
}
