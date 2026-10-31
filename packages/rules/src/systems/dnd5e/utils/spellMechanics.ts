import type { LevelScaled, SpellMechanics, SpellMechanicsBatch } from '../types/spellMechanics'
import spellMechanicsData from '../data/spell-mechanics.json'
import { stepValue } from './classResourceUtils'

/**
 * O dano estruturado de magia (`data/spell-mechanics.json`, revisado contra o livro): a leitura e
 * as contas do que cresce. O guia da magia (`spellGuide.ts`) monta a receita daqui; nenhuma tela
 * lê o JSON nem o texto da magia para tirar dado.
 */
export const SPELL_MECHANICS: readonly SpellMechanics[] = spellMechanicsData as SpellMechanics[]

const BY_ID = new Map(SPELL_MECHANICS.map(m => [m.id, m]))

/** A mecânica revisada de uma magia; undefined enquanto o lote dela não chegou. */
export function getSpellMechanics(id: string): SpellMechanics | undefined {
  return BY_ID.get(id)
}

/** Os níveis de magia de cada lote (desenho da Fase 2, `magias-base` e os lotes seguintes). */
export const SPELL_BATCH_LEVELS: Record<SpellMechanicsBatch, readonly number[]> = {
  T: [0], 1: [1], 2: [2], 3: [3], '4-5': [4, 5], '6-9': [6, 7, 8, 9],
}

/** O lote de uma magia pelo nível dela. */
export function getSpellBatch(level: number): SpellMechanicsBatch {
  const entry = (Object.entries(SPELL_BATCH_LEVELS) as [SpellMechanicsBatch, readonly number[]][])
    .find(([, levels]) => levels.includes(level))
  if (!entry) throw new Error(`Nível de magia fora dos lotes: ${level}`)
  return entry[0]
}

/**
 * Onde a magia é conjurada: o nível de PERSONAGEM (os degraus dos truques) e quantos níveis de
 * espaço acima do da magia (0 no truque e no espaço do próprio nível).
 */
export type SpellCastContext = { characterLevel: number; slotsAbove: number }

/**
 * Quanto cresce a cada nível de espaço acima: `every` agrupa os níveis ("a cada dois níveis
 * acima": no 4º, uma magia de 2º sobe uma vez; no 6º, duas).
 */
function slotSteps(perSlotAbove: LevelScaled['perSlotAbove'], slotsAbove: number): number {
  if (!perSlotAbove || slotsAbove <= 0) return 0
  return Math.floor(slotsAbove / (perSlotAbove.every ?? 1))
}

/**
 * Quantos dados agora: o degrau de nível de personagem, quando a parte o tem (os truques: o total,
 * não o acréscimo), ou a base mais o que o espaço acima acrescenta.
 */
export function scaledDiceCount(part: LevelScaled & { count?: number }, at: SpellCastContext): number {
  const byLevel = part.byCharacterLevel ? stepValue(part.byCharacterLevel, at.characterLevel) : undefined
  const base = byLevel ?? part.count ?? 0
  return base + slotSteps(part.perSlotAbove, at.slotsAbove) * (part.perSlotAbove?.count ?? 0)
}

/** O valor fixo agora: a base mais o que o espaço acima acrescenta (a Ajuda: +5 por nível). */
export function scaledFlat(part: LevelScaled & { flat?: number }, at: SpellCastContext): number {
  return (part.flat ?? 0) + slotSteps(part.perSlotAbove, at.slotsAbove) * (part.perSlotAbove?.flat ?? 0)
}
