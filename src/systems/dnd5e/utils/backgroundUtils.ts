import type { Background, BackgroundChoice, BackgroundChoiceSelections } from '../types/background'
import type { BackgroundEquipmentItem } from '../types/equipment'
import backgroundsData from '../data/backgrounds.json'
import toolsData from '../data/tools.json'
import { LANGUAGES, SKILLS } from './raceUtils'
import { formatInventoryItem, getItemName } from './equipmentUtils'

export { LANGUAGES, SKILLS }

export const BACKGROUNDS: Background[] = backgroundsData as Background[]

type Tool = { id: string; name: string; category: string }
const ALL_TOOLS: Tool[] = toolsData as Tool[]

/** Todas as ferramentas da tabela de equipamento (p. 154-156), na ordem de tools.json. */
export const TOOLS: readonly Tool[] = ALL_TOOLS

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
  'musical-instrument': 'Instrumento Musical',
  'gaming-set': 'Conjunto de Jogos',
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
    (choices.languages?.length ?? 0) >= requiredLanguages &&
    getBackgroundItemChoices(background).every(c => getChosenBackgroundItem(c, choices) !== null)
  )
}

// ── Equipamento do antecedente ──────────────────────────────────────────────

export type ResolvedBackgroundItem = {
  /** Id do item no catálogo; null enquanto a escolha que o define está pendente. */
  id: string | null
  quantity: number
  /** Rótulo de inventário: "5× Bastão de Incenso", "Alaúde", "Ferramenta do Antecedente (a escolher)". */
  label: string
  /** A escolha que define o item ainda não foi feita. */
  pending: boolean
}

/**
 * Itens que o antecedente entrega, já resolvidos pelas escolhas do jogador. Fonte única do
 * equipamento de antecedente na etapa Equipamento, na Revisão e na ficha imprimível — nenhuma
 * tela converte `BackgroundEquipmentItem` em nome por conta própria.
 *
 * - `specific`: o item, com a quantidade;
 * - `chosen-tool`: a ferramenta escolhida na proficiência do antecedente (Artista, Artesão de
 *   Guilda, Herói do Povo — o livro entrega a mesma que você domina);
 * - `item-choice`: o item escolhido entre as opções do livro (`choices.items[key]`).
 */
export function resolveBackgroundItems(
  background: Background,
  choices: BackgroundChoiceSelections,
): ResolvedBackgroundItem[] {
  return background.equipment.items.map(item => {
    switch (item.kind) {
      case 'specific':
        return { id: item.id, quantity: item.quantity, label: formatInventoryItem(item.id, item.quantity), pending: false }
      case 'chosen-tool': {
        const toolId = choices.tools?.[0]
        return toolId
          ? { id: toolId, quantity: 1, label: getToolName(toolId), pending: false }
          : { id: null, quantity: 1, label: 'Ferramenta do Antecedente (a escolher)', pending: true }
      }
      case 'item-choice': {
        const chosen = getChosenBackgroundItem(item, choices)
        return chosen
          ? { id: chosen, quantity: 1, label: getItemName(chosen), pending: false }
          : { id: null, quantity: 1, label: `${item.label} (a escolher)`, pending: true }
      }
    }
  })
}

export type BackgroundItemChoice = Extract<BackgroundEquipmentItem, { kind: 'item-choice' }>

/**
 * Os "um item entre opções" do equipamento do antecedente — o símbolo sagrado e o livro de
 * preces ou a conta de orações do Acólito (p. 129), as ferramentas de trapaça do Charlatão
 * (p. 133), os dados de osso ou o baralho do Soldado (p. 142). Cada um vira um slot na etapa
 * Antecedente.
 */
export function getBackgroundItemChoices(background: Background): BackgroundItemChoice[] {
  return background.equipment.items.filter((i): i is BackgroundItemChoice => i.kind === 'item-choice')
}

/** O item escolhido num `item-choice`, ou null se ainda não há escolha válida. */
export function getChosenBackgroundItem(
  choice: BackgroundItemChoice,
  choices: BackgroundChoiceSelections,
): string | null {
  const id = choices.items?.[choice.key]
  return id !== undefined && choice.options.includes(id) ? id : null
}

/**
 * Filtra as escolhas de item contra o antecedente: só ficam chaves que ele tem e ids que são
 * opção daquela chave. Usado pela sanitização do draft (fichas antigas ou importadas).
 */
export function sanitizeBackgroundItemSelections(
  background: Background,
  raw: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const choice of getBackgroundItemChoices(background)) {
    const id = raw[choice.key]
    if (typeof id === 'string' && choice.options.includes(id)) out[choice.key] = id
  }
  return out
}

// ── Detalhes de interpretação (cap. 4) ──────────────────────────────────────

/**
 * Linhas que a ficha imprimível deixa em branco pra preencher a lápis: Tendência (p. 124),
 * Traços de Personalidade, Ideal, Vínculo e Defeito (p. 125-126). O livro sugere tabelas por
 * antecedente mas deixa inventar — o app não escolhe nem cobra nada disso.
 */
export const ROLEPLAY_FIELDS: ReadonlyArray<{ label: string; lines: number }> = [
  { label: 'Tendência', lines: 1 },
  { label: 'Traços de Personalidade', lines: 2 },
  { label: 'Ideal', lines: 1 },
  { label: 'Vínculo', lines: 1 },
  { label: 'Defeito', lines: 1 },
]

export type BackgroundDetailPrompt = {
  /** "Tramoia predileta", "Especialidade", "Origem"… */
  label: string
  /** "escolha ou role 1d6", ou a instrução própria do livro (Artista, Herói do Povo). */
  instruction: string
  /** As opções numeradas na ordem do dado: "1. Acrobata · 2. Ator · …". */
  optionsLine: string
}

/**
 * A tabela de detalhe do antecedente pronta pra ficha e Revisão (linha a lápis + opções do
 * livro), ou null quando o antecedente não tem uma (Acólito, Marinheiro, Nobre, Órfão).
 */
export function getBackgroundDetailPrompt(background: Background | undefined): BackgroundDetailPrompt | null {
  const table = background?.detailTable
  if (!table || table.options.length === 0) return null
  return {
    label: table.label,
    instruction: table.note ?? `escolha ou role 1d${table.options.length}`,
    optionsLine: table.options.map((o, i) => `${i + 1}. ${o}`).join(' · '),
  }
}
