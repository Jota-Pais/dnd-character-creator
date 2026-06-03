import type { Race, Subrace, AbilityBonus, RaceChoice, AbilityChoice } from '../types/race'
import type { RaceChoiceSelections } from '../types/character'
import racesData from '../data/races.json'

export const RACES: Race[] = racesData as Race[]

export const SKILLS = [
  { id: 'acrobatics', name: 'Acrobacia' },
  { id: 'animal-handling', name: 'Adestrar Animais' },
  { id: 'arcana', name: 'Arcanismo' },
  { id: 'athletics', name: 'Atletismo' },
  { id: 'deception', name: 'Enganação' },
  { id: 'history', name: 'História' },
  { id: 'insight', name: 'Intuição' },
  { id: 'intimidation', name: 'Intimidação' },
  { id: 'investigation', name: 'Investigação' },
  { id: 'medicine', name: 'Medicina' },
  { id: 'nature', name: 'Natureza' },
  { id: 'perception', name: 'Percepção' },
  { id: 'performance', name: 'Atuação' },
  { id: 'persuasion', name: 'Persuasão' },
  { id: 'religion', name: 'Religião' },
  { id: 'sleight-of-hand', name: 'Prestidigitação' },
  { id: 'stealth', name: 'Furtividade' },
  { id: 'survival', name: 'Sobrevivência' },
] as const

export const LANGUAGES = [
  { id: 'common', name: 'Comum' },
  { id: 'dwarvish', name: 'Anão' },
  { id: 'elvish', name: 'Élfico' },
  { id: 'giant', name: 'Gigante' },
  { id: 'gnomish', name: 'Gnômico' },
  { id: 'goblin', name: 'Goblin' },
  { id: 'halfling', name: 'Halfling' },
  { id: 'orc', name: 'Orc' },
  { id: 'abyssal', name: 'Abissal' },
  { id: 'celestial', name: 'Celestial' },
  { id: 'draconic', name: 'Dracônico' },
  { id: 'deep-speech', name: 'Fala das Profundezas' },
  { id: 'infernal', name: 'Infernal' },
  { id: 'primordial', name: 'Primordial' },
  { id: 'sylvan', name: 'Silvano' },
  { id: 'undercommon', name: 'Subcomum' },
] as const

export type RacePresentation = {
  emoji: string
  accent: string
  beginnerFriendly?: boolean
  beginnerNote?: string
}

export const RACE_PRESENTATION: Record<string, RacePresentation> = {
  dwarf:      { emoji: '⛏️',  accent: '#d97706', beginnerFriendly: true, beginnerNote: 'Resistente e perdoa erros — ótimo pra quem está começando.' },
  elf:        { emoji: '🌿',  accent: '#10b981' },
  halfling:   { emoji: '🍀',  accent: '#84cc16', beginnerFriendly: true, beginnerNote: 'Sortudo e difícil de derrubar; seguro pra primeira ficha.' },
  human:      { emoji: '🛡️',  accent: '#60a5fa', beginnerFriendly: true, beginnerNote: 'Equilibrado e flexível, combina com qualquer classe.' },
  dragonborn: { emoji: '🐉',  accent: '#f87171' },
  gnome:      { emoji: '⚙️',  accent: '#a78bfa' },
  'half-elf': { emoji: '🌙',  accent: '#2dd4bf' },
  'half-orc': { emoji: '⚔️',  accent: '#4ade80', beginnerFriendly: true, beginnerNote: 'Forte e durável, perfeito pra partir pra briga sem medo.' },
  tiefling:   { emoji: '🔮',  accent: '#c084fc' },
}

export const TOOL_NAMES: Record<string, string> = {
  'smiths-tools': 'Ferramentas de Ferreiro',
  'brewers-tools': 'Ferramentas de Cervejeiro',
  'masons-tools': 'Ferramentas de Pedreiro',
  'tinkers-tools': 'Ferramentas de Engenhoqueiro',
}

export function getRace(raceId: string): Race | undefined {
  return RACES.find(r => r.id === raceId)
}

export function getSubrace(race: Race, subraceId: string): Subrace | undefined {
  return race.subraces.find(s => s.id === subraceId)
}

function replacesParentTraits(subrace: Subrace | null): boolean {
  return subrace?.overrides.replacesParentTraits === true
}

export function getEffectiveSpeed(race: Race, subrace: Subrace | null): number {
  return subrace?.overrides.speed ?? race.speed
}

export function getEffectiveDarkvision(race: Race, subrace: Subrace | null): number {
  return subrace?.overrides.darkvision ?? race.darkvision
}

export function getAllChoices(race: Race, subrace: Subrace | null): RaceChoice[] {
  const raceChoices = replacesParentTraits(subrace) ? [] : race.choices
  const subraceChoices = subrace?.choices ?? []
  return [...raceChoices, ...subraceChoices]
}

export function getEffectiveAbilityBonuses(
  race: Race,
  subrace: Subrace | null,
  choices: RaceChoiceSelections,
): AbilityBonus[] {
  const fixedRaceBonuses = replacesParentTraits(subrace) ? [] : race.abilityBonuses
  const fixedSubraceBonuses = subrace?.abilityBonuses ?? []
  const fixed = [...fixedRaceBonuses, ...fixedSubraceBonuses]

  const abilityChoices = getAllChoices(race, subrace).filter(
    (c): c is AbilityChoice => c.kind === 'ability',
  )

  const chosen: AbilityBonus[] = []
  for (const choice of abilityChoices) {
    const selected = choices.abilityBonuses ?? []
    for (const ability of selected.slice(0, choice.count)) {
      chosen.push({ ability, value: choice.value })
    }
  }

  return [...fixed, ...chosen]
}

export function isRaceStepComplete(
  race: Race | null,
  subrace: Subrace | null,
  choices: RaceChoiceSelections,
): boolean {
  if (!race) return false
  if (race.subraces.length > 0 && !subrace) return false

  const allChoices = getAllChoices(race, subrace)
  for (const choice of allChoices) {
    switch (choice.kind) {
      case 'ability':
        if ((choices.abilityBonuses?.length ?? 0) < choice.count) return false
        break
      case 'skill':
        if ((choices.skills?.length ?? 0) < choice.count) return false
        break
      case 'language':
        if ((choices.languages?.length ?? 0) < choice.count) return false
        break
      case 'tool':
        if ((choices.tools?.length ?? 0) < choice.count) return false
        break
      case 'cantrip':
        if (!choices.cantrip) return false
        break
      case 'feat':
        if (!choices.feat) return false
        break
    }
  }

  return true
}
