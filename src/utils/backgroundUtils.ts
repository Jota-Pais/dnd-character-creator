import type { Background, BackgroundChoice, BackgroundChoiceSelections } from '../types/background'
import backgroundsData from '../data/backgrounds.json'
import toolsData from '../data/tools.json'
import { LANGUAGES, SKILLS } from './raceUtils'

export { LANGUAGES, SKILLS }

export const BACKGROUNDS: Background[] = backgroundsData as Background[]

type Tool = { id: string; name: string; category: string }
const ALL_TOOLS: Tool[] = toolsData as Tool[]

export type { BackgroundChoice }

export function getBackground(id: string): Background | undefined {
  return BACKGROUNDS.find(b => b.id === id)
}

export function getToolsByCategory(category: string): Tool[] {
  return ALL_TOOLS.filter(t => t.category === category)
}

export function getToolName(id: string): string {
  return ALL_TOOLS.find(t => t.id === id)?.name ?? id
}

const SKILL_MAP = Object.fromEntries(SKILLS.map(s => [s.id, s.name]))

export function getSkillName(id: string): string {
  return SKILL_MAP[id] ?? id
}

export const TOOL_CHOICE_LABEL: Record<string, string> = {
  artisan: 'Ferramenta de Artesão',
  musical: 'Instrumento Musical',
  gaming: 'Conjunto de Jogos',
}

export type BackgroundPresentation = {
  emoji: string
  accent: string
}

export const BACKGROUND_PRESENTATION: Record<string, BackgroundPresentation> = {
  acolyte:        { emoji: '🕊️', accent: '#93c5fd' },
  'guild-artisan': { emoji: '⚒️', accent: '#fb923c' },
  entertainer:    { emoji: '🎭', accent: '#e879f9' },
  charlatan:      { emoji: '🃏', accent: '#f43f5e' },
  criminal:       { emoji: '🗡️', accent: '#94a3b8' },
  hermit:         { emoji: '🌙', accent: '#6ee7b7' },
  outlander:      { emoji: '🌲', accent: '#86efac' },
  'folk-hero':    { emoji: '🛡️', accent: '#60a5fa' },
  sailor:         { emoji: '⚓', accent: '#38bdf8' },
  noble:          { emoji: '👑', accent: '#d4900a' },
  urchin:         { emoji: '🏚️', accent: '#a8a29e' },
  sage:           { emoji: '📚', accent: '#818cf8' },
  soldier:        { emoji: '⚔️', accent: '#ef4444' },
}

export function isBackgroundStepComplete(
  background: Background | null,
  choices: BackgroundChoiceSelections,
): boolean {
  if (!background) return false

  const requiredTools = background.choices
    .filter((c): c is Extract<BackgroundChoice, { kind: 'tool-choice' }> => c.kind === 'tool-choice')
    .reduce((sum, c) => sum + c.count, 0)

  const requiredLanguages = background.choices
    .filter((c): c is Extract<BackgroundChoice, { kind: 'language-choice' }> => c.kind === 'language-choice')
    .reduce((sum, c) => sum + c.count, 0)

  return (
    (choices.tools?.length ?? 0) >= requiredTools &&
    (choices.languages?.length ?? 0) >= requiredLanguages
  )
}
