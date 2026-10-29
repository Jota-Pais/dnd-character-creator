import type { Race, Subrace, AbilityBonus, RaceChoice, AbilityChoice, GrantedProficiency, InnateSpell, RacialTrait } from '../types/race'
import type { RaceChoiceSelections } from '../types/character'
import type { Spell } from '../types/spell'
import racesData from '../data/races.json'
import toolsData from '../data/tools.json'
// Dado bruto, não spellUtils: spellUtils → classUtils → raceUtils fecharia um ciclo de import.
import spellsData from '../data/spells.json'
import { getFeat } from './featUtils'
import { ABILITY_LABELS, formatMeters } from './abilityScoreUtils'
import { getDragonAncestor } from './dragonAncestors'

/**
 * Nome de cada ferramenta, lido de tools.json: o mesmo da etapa Raça, da Revisão e da ficha. Era
 * uma cópia à mão, e o gnomo das rochas saía com "Ferramentas de Engenhoqueiro" na ficha e
 * "Ferramentas de Funileiro" na Revisão. O item leva o nome da tabela de equipamento (p. 156); o
 * texto do traço Engenhoqueiro (races.json) segue a redação do livro (p. 37), com o nome da
 * tabela entre parênteses (`toolNote`). Antes de RACES, que o lê na carga.
 */
export const TOOL_NAMES: Record<string, string> = Object.fromEntries(
  (toolsData as { id: string; name: string }[]).map(t => [t.id, t.name]),
)

/**
 * Traço que chama a ferramenta pelo nome do livro (`toolNote`) ganha o nome de tools.json entre
 * parênteses logo depois dele: "usando ferramentas de engenhoqueiro (Ferramentas de Funileiro)".
 * Feito na carga, como os traços do ancestral dracônico: a etapa Raça, a Revisão e o PDF leem o
 * mesmo texto.
 */
function withToolNote(trait: RacialTrait): RacialTrait {
  const note = trait.toolNote
  const name = note ? TOOL_NAMES[note.tool] : undefined
  if (!note || !name || !trait.description.includes(note.after)) return trait
  return { ...trait, description: trait.description.replace(note.after, `${note.after} (${name})`) }
}

/**
 * Sub-raça com ancestral dracônico (draconato, p. 34) ganha os traços da linha da tabela: o tipo
 * de dano e a área do sopro. Feito na carga, todo leitor de traços (etapa Raça, Revisão, PDF, os
 * efeitos) vê o mesmo.
 */
function withDragonAncestorTraits(subrace: Subrace): Subrace {
  const ancestor = subrace.dragonAncestor ? getDragonAncestor(subrace.dragonAncestor) : undefined
  if (!ancestor) return subrace
  return {
    ...subrace,
    traits: [
      { name: 'Tipo de Dano', description: `${ancestor.damageType}.` },
      { name: 'Área do Sopro', description: ancestor.breath },
      ...subrace.traits,
    ],
  }
}

export const RACES: Race[] = (racesData as Race[]).map(race => ({
  ...race,
  traits: race.traits.map(withToolNote),
  subraces: race.subraces.map(withDragonAncestorTraits).map(sub => ({ ...sub, traits: sub.traits.map(withToolNote) })),
}))

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

export type Language = {
  id: string
  name: string
  /**
   * Da tabela Idiomas Exóticos (p. 125): só se escolhe com a permissão do Mestre. Os da tabela
   * Idiomas Padrão são a escolha livre. Os ids são estáveis; os nomes seguem o livro em pt-BR.
   */
  exotic: boolean
}

export const LANGUAGES: readonly Language[] = [
  // Idiomas Padrão (p. 125)
  { id: 'common', name: 'Comum', exotic: false },
  { id: 'dwarvish', name: 'Anão', exotic: false },
  { id: 'elvish', name: 'Élfico', exotic: false },
  { id: 'giant', name: 'Gigante', exotic: false },
  { id: 'gnomish', name: 'Gnômico', exotic: false },
  { id: 'goblin', name: 'Goblin', exotic: false },
  { id: 'halfling', name: 'Halfling', exotic: false },
  { id: 'orc', name: 'Orc', exotic: false },
  // Idiomas Exóticos (p. 125)
  { id: 'abyssal', name: 'Abissal', exotic: true },
  { id: 'celestial', name: 'Celestial', exotic: true },
  { id: 'deep-speech', name: 'Dialeto Subterrâneo', exotic: true },
  { id: 'draconic', name: 'Dracônico', exotic: true },
  { id: 'infernal', name: 'Infernal', exotic: true },
  { id: 'primordial', name: 'Primordial', exotic: true },
  { id: 'sylvan', name: 'Silvestre', exotic: true },
  { id: 'undercommon', name: 'Subcomum', exotic: true },
]

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
 * O texto do traço Visão no Escuro, que os dados guardam só como alcance (`darkvision`), fora de
 * `traits`. É o mesmo nas raças do livro (anão, elfo, gnomo, meio-elfo, meio-orc, tiefling; págs.
 * 20, 23, 37, 39, 41, 43), com o alcance da raça ou da sub-raça (o drow, 36 m).
 */
export function describeDarkvision(feet: number): string {
  return `Você enxerga na penumbra a até ${formatMeters(feet)} como se fosse luz plena, e no escuro como se fosse na penumbra. Você não pode discernir cores no escuro, apenas tons de cinza.`
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

/** Nome do idioma na ficha ("Dracônico"); o próprio id se não estiver no catálogo. */
export function getLanguageName(id: string): string {
  return LANGUAGE_NAMES[id] ?? id
}

/** Idioma da tabela Idiomas Exóticos (p. 125) — escolhê-lo depende da permissão do Mestre. */
export function isExoticLanguage(id: string): boolean {
  return LANGUAGES.some(l => l.id === id && l.exotic)
}
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

/** As mesmas ferramentas com o nome de tools.json — o que a etapa Raça mostra ("Ferramentas de Funileiro"). */
export function getRaceGrantedToolNames(race: Race, subrace: Subrace | null): string[] {
  return getRaceGrantedTools(race, subrace).map(id => TOOL_NAMES[id] ?? id)
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

/**
 * Como se usa uma magia inata, do jeito que a Revisão e a ficha imprimível mostram: truque à
 * vontade; magia de 1º nível ou mais, uma vez por descanso longo cada (Magia Drow, p. 24; Legado
 * Infernal, p. 43), no nível que o traço fixa quando fixa (repreensão infernal no 2º).
 * `limited` diz se a ficha desenha o círculo pra marcar o uso.
 */
export function describeInnateSpellUsage(
  entry: InnateSpell,
  spellLevel: number,
): { limited: boolean; text: string } {
  if (spellLevel === 0) return { limited: false, text: 'truque, à vontade' }
  const castAt = entry.castLevel && entry.castLevel !== spellLevel
    ? `, como magia de ${entry.castLevel}º nível`
    : ''
  return { limited: true, text: `1 uso por descanso longo${castAt}` }
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

/** A raça só fecha com uma sub-raça escolhida — salvo a que vale sozinha (`baseOption`: o humano). */
export function requiresSubrace(race: Race): boolean {
  return race.subraces.length > 0 && !race.baseOption
}

export function isRaceStepComplete(
  race: Race | null,
  subrace: Subrace | null,
  choices: RaceChoiceSelections,
): boolean {
  if (!race) return false
  if (requiresSubrace(race) && !subrace) return false

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
