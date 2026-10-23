import type { Race, Subrace, AbilityBonus, RaceChoice, AbilityChoice, GrantedProficiency, InnateSpell, RacialTrait } from '../types/race'
import type { RaceChoiceSelections } from '../types/character'
import type { Spell } from '../types/spell'
import racesData from '../data/races.json'
// Dado bruto, não spellUtils: spellUtils → classUtils → raceUtils fecharia um ciclo de import.
import spellsData from '../data/spells.json'
import { getFeat } from './featUtils'
import { ABILITY_LABELS } from './abilityScoreUtils'

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
  'brewers-tools': 'Suprimentos de Cervejeiro', // p. 20 e tools.json: "suprimentos de cervejeiro"
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

/**
 * Traços da raça + sub-raça (respeita replacesParentTraits). Sem isso o Humano Variante herdava a
 * "Versatilidade" do humano comum — o texto do +1 em tudo, justamente o que a variante troca.
 */
export function getEffectiveTraits(race: Race, subrace: Subrace | null): RacialTrait[] {
  const raceTraits = replacesParentTraits(subrace) ? [] : race.traits
  return [...raceTraits, ...(subrace?.traits ?? [])]
}

export function getAllChoices(race: Race, subrace: Subrace | null): RaceChoice[] {
  const raceChoices = replacesParentTraits(subrace) ? [] : race.choices
  const subraceChoices = subrace?.choices ?? []
  return [...raceChoices, ...subraceChoices]
}

const SKILL_NAMES: Record<string, string> = Object.fromEntries(SKILLS.map(s => [s.id, s.name]))
const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(LANGUAGES.map(l => [l.id, l.name]))
const SPELL_NAMES: Record<string, string> = Object.fromEntries((spellsData as Spell[]).map(s => [s.id, s.name]))

/**
 * O que o jogador escolheu numa escolha da raça, em texto de ficha: "+1 CAR, +1 SAB",
 * "Persuasão", "Dracônico", "Ator (+1 CAR)", "Suprimentos de Cervejeiro", "Ilusão Menor".
 * `null` quando nada foi escolhido ainda. Só lê as seleções até o `count` da escolha — o mesmo
 * corte que getEffectiveAbilityBonuses aplica aos números.
 */
export function describeRaceChoice(choice: RaceChoice, selections: RaceChoiceSelections): string | null {
  const pick = <T,>(ids: T[] | undefined): T[] => (ids ?? []).slice(0, choice.count)
  let parts: string[]
  switch (choice.kind) {
    case 'ability':
      parts = pick(selections.abilityBonuses).map(a => `+${choice.value} ${ABILITY_LABELS[a].short}`)
      break
    case 'skill':
      parts = pick(selections.skills).map(id => SKILL_NAMES[id] ?? id)
      break
    case 'language':
      parts = pick(selections.languages).map(id => LANGUAGE_NAMES[id] ?? id)
      break
    case 'tool':
      parts = pick(selections.tools).map(id => TOOL_NAMES[id] ?? id)
      break
    case 'cantrip':
      parts = selections.cantrip ? [SPELL_NAMES[selections.cantrip] ?? selections.cantrip] : []
      break
    case 'feat': {
      const feat = selections.feat ? getFeat(selections.feat) : undefined
      if (!feat) return null
      // +1 do meio-talento só quando o atributo é uma opção válida do talento (como em getRaceFeatBonus).
      const ab = selections.featAbility
      const half = ab && feat.abilityIncrease?.includes(ab) ? ` (+1 ${ABILITY_LABELS[ab].short})` : ''
      parts = [`${feat.name}${half}`]
      break
    }
  }
  return parts.length > 0 ? parts.join(', ') : null
}

export type RacialTraitView = {
  trait: RacialTrait
  /** O que foi escolhido na escolha que o traço abre (null se o traço não abre escolha ou ainda vazia). */
  chosen: string | null
}

/**
 * Traços efetivos com a escolha feita em cada um — o que a ficha imprimível e a Revisão mostram
 * ("Perícia. Você ganha proficiência... Escolha: Persuasão"). Cada traço com `choice` aponta para
 * a escolha da raça/sub-raça do mesmo tipo (uma por tipo; ver o teste de integridade dos dados).
 */
export function getEffectiveTraitsWithChoices(
  race: Race,
  subrace: Subrace | null,
  selections: RaceChoiceSelections,
): RacialTraitView[] {
  const choices = getAllChoices(race, subrace)
  return getEffectiveTraits(race, subrace).map(trait => {
    const choice = trait.choice ? choices.find(c => c.kind === trait.choice) : undefined
    return { trait, chosen: choice ? describeRaceChoice(choice, selections) : null }
  })
}

/** Proficiências fixas concedidas pela raça + sub-raça (respeita replacesParentTraits). */
export function getEffectiveGrantedProficiencies(race: Race, subrace: Subrace | null): GrantedProficiency[] {
  const raceProfs = replacesParentTraits(subrace) ? [] : race.grantedProficiencies
  const subraceProfs = subrace?.grantedProficiencies ?? []
  return [...raceProfs, ...subraceProfs]
}

/** Perícias fixas concedidas pela raça (ex.: Percepção do elfo, Intimidação do meio-orc). */
export function getRaceGrantedSkills(race: Race, subrace: Subrace | null): string[] {
  return getEffectiveGrantedProficiencies(race, subrace)
    .filter(g => g.type === 'skill')
    .map(g => g.value)
}

/** Ferramentas fixas concedidas pela raça (ex.: ferramentas de funileiro do gnomo das rochas). */
export function getRaceGrantedTools(race: Race, subrace: Subrace | null): string[] {
  return getEffectiveGrantedProficiencies(race, subrace)
    .filter(g => g.type === 'tool')
    .map(g => g.value)
}

/** Magias inatas da raça + sub-raça (respeita replacesParentTraits). */
export function getEffectiveInnateSpells(race: Race, subrace: Subrace | null): InnateSpell[] {
  const raceSpells = replacesParentTraits(subrace) ? [] : (race.innateSpells ?? [])
  const subraceSpells = subrace?.innateSpells ?? []
  return [...raceSpells, ...subraceSpells]
}

/** Magias inatas já disponíveis no nível informado (minLevel <= charLevel). */
export function getAvailableInnateSpells(
  race: Race,
  subrace: Subrace | null,
  charLevel: number,
): InnateSpell[] {
  return getEffectiveInnateSpells(race, subrace).filter(s => s.minLevel <= charLevel)
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
      case 'feat': {
        if (!choices.feat) return false
        const options = getFeat(choices.feat)?.abilityIncrease
        if (options && options.length > 0) {
          if (!choices.featAbility || !options.includes(choices.featAbility)) return false
        }
        break
      }
    }
  }

  return true
}
