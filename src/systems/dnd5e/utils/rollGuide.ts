import type { CharacterDraft } from '../types/character'
import type { AdvantageMode, ConditionEffect, RollCategory, RollMode } from '../types/condition'
import type { PlayState } from '../types/playState'
import type { AbilityScore } from '../types/race'
import { ABILITY_LABELS, ALL_ABILITY_SCORES, calculateModifier, getProficiencyBonus } from './abilityScoreUtils'
import { getFinalAbilityScores } from './asiUtils'
import { getSheetAttacks, type SheetAttack } from './attackUtils'
import { SKILLS } from './backgroundUtils'
import { getHitDicePool } from './multiclassUtils'
import { getPlayConditionEffects } from './playState'
import { getRace } from './raceUtils'
import { getSavingThrowChecks, getSkillChecks, getPassiveScore, getUnproficientArmor } from './proficiencyUtils'
import {
  EXHAUSTION, describeConditionalSaveBonuses, formatCastingRestriction, getAttacksPerAction, getBestHalfProficiencySource,
  getCastingRestrictions, getCondition, getConditionalRollNotes,
  getHalfProficiencySources, getMeleeCritExtraWeaponDice,
  getInitiativeAdvantageSources, getInitiativeBonuses, getOwnedFeats, getSheetArmorClass, getWeaponCritThreshold, resolveRollMode,
  type ActiveConditionEffects, type ConditionRoll, type SheetEffect,
} from './sheetEffects'
import { getCasterEntries, getFeatSpellBlocks, getSpellAttackBonus, getSpellSaveDC } from './spellUtils'

/**
 * Guia de rolagens do modo de jogo: a "receita" de cada jogada da ficha — o que rolar, quanto
 * somar, com vantagem ou desvantagem e por quê, falha automática, de onde vem cada número. O
 * jogador rola os próprios dados (decisão de 2026-10-25); a tela diz o que rolar a partir daqui,
 * e a `notation` alimenta o motor de `src/core/dice` quando os dados do app estão ligados.
 *
 * Nenhuma conta da ficha é refeita: os números vêm das fontes únicas da Revisão e do PDF
 * (`getSkillChecks`, `getSavingThrowChecks`, `getSheetAttacks`, `getSpellSaveDC`…); daqui sai só a
 * explicação (`breakdown`) e o modo. Regra de ouro do `sheetEffects`: o incondicional entra no
 * número ou no modo; o condicional vira linha em `notes`, nunca no número.
 *
 * Fontes do modo: as condições e a exaustão do estado de jogo (`getPlayConditionEffects`) somadas
 * às da ficha — desvantagem de Furtividade da armadura, armadura sem proficiência (pág. 144) e arma
 * pesada nas mãos de criatura Pequena (pág. 149) —,
 * resolvidas por `resolveRollMode` (uma de cada lado anula, pág. 175). O que só a folha aberta sabe
 * entra por cima, com a mesma regra: a circunstância da mesa (`withTableMode`) e a Inspiração gasta
 * (`withInspirationSpent`).
 */

/** Origem de uma vantagem, desvantagem ou falha automática: `condition:poisoned` / "Envenenado". */
export type GuideReason = { source: string; label: string }

export type GuideKind = 'd20' | 'damage' | 'heal'

/** Uma parcela do modificador: "Destreza" +3, "Proficiência" +2. A soma dos `value` = `modifier`. */
export type GuideBreakdownItem = { label: string; value: number }

export type RollGuideEntry = {
  /**
   * `check:STR` | `save:DEX` | `skill:stealth` | `initiative` | `attack:<key>` | `damage:<key>` |
   * `damage:<key>:versatile` | `spell-attack:<classId>` | `spell-attack:feat:<featId>` |
   * `death-save` | `concentration` | `hit-die:<faces>`.
   */
  id: string
  kind: GuideKind
  /** "Furtividade", "Espada Longa — ataque". */
  label: string
  /** Atributo do teste, quando há um (o TR contra a morte não tem, pág. 199). */
  ability?: AbilityScore
  /** Dados a rolar ("1d20", "2d6"); vazio no dano fixo sem dado ("1 concussão"). */
  dice: string
  modifier: number
  /** Texto pronto: "1d20 + 5", "1d8 + 3 cortante". O modo vai à parte (`describeRollGuide`). */
  formula: string
  /** Para o motor de `src/core/dice`: "2d20kh1+5" com vantagem, "1d8+3". */
  notation: string
  /** `normal` em toda jogada que não é d20. */
  mode: RollMode
  advantage: GuideReason[]
  disadvantage: GuideReason[]
  autoFail: GuideReason[]
  breakdown: GuideBreakdownItem[]
  /** Linhas condicionais: nunca entram no número nem no modo. */
  notes: string[]
  /** Classe de dificuldade, quando a ficha a conhece (concentração). */
  dc?: number
  /** Jogada de ataque (arma, golpe desarmado, magia): o 1 natural erra sempre (pág. 196). */
  attackRoll?: true
  /**
   * Só dano: os dados dobrados do acerto crítico, o modificador igual (pág. 196). `notes`: o que
   * vale só no crítico e fica fora da fórmula (Ataques Selvagens, Crítico Brutal).
   */
  crit?: { dice: string; formula: string; notation: string; notes?: string[] }
  /**
   * Quem deixa jogar de novo o 1 natural desta jogada (Sortudo): com os dados do app, a tela
   * oferece a nova rolagem antes de registrar. Hoje só no teste contra a morte.
   */
  rerollNaturalOne?: string[]
}

/** Uma linha da tabela de ataques: a jogada de ataque, o dano e o dano a duas mãos (versátil). */
export type AttackGuide = {
  key: string
  name: string
  /** "Força" ou "Destreza". */
  ability: string
  properties: string
  attacksPerAction: number
  /**
   * A partir de que d20 natural o ataque é crítico (se acertar): 20, ou a margem das armas do
   * Campeão (`getWeaponCritThreshold`: 19 no 3º, 18 no 15º). O golpe desarmado fica no 20.
   */
  critThreshold: number
  /** As notas da linha de ataque da ficha (Duelismo, Artes Marciais, recarga…), menos as já no `breakdown`. */
  notes: string[]
  attack: RollGuideEntry
  /** Null quando a arma não causa dano (Rede). */
  damage: RollGuideEntry | null
  versatile: RollGuideEntry | null
}

/**
 * Conjuração de uma classe ou de um talento que ensina magias (Iniciado em Magia, p. 170): a CD
 * que os alvos enfrentam e o ataque de magia.
 */
export type SpellcastingGuide = {
  /**
   * Única no guia: `class:<classId>` ou `feat:<featId>` — o clérigo com Iniciado em Magia de
   * clérigo tem as duas, cada uma com a sua CD.
   */
  key: string
  /** A classe da lista e do atributo: a conjuradora, ou a escolhida no talento. */
  classId: string
  /** O talento que ensina as magias; null na conjuração da classe. */
  featId: string | null
  /** "Mago", "Guerreiro (Cavaleiro Arcano)", "Iniciado em Magia (Clérigo)". */
  label: string
  ability: AbilityScore
  saveDc: number
  saveDcBreakdown: GuideBreakdownItem[]
  attack: RollGuideEntry
}

/** Valor passivo (pág. 177): o da ficha, mais o ±5 da vantagem ou desvantagem em vigor. */
export type PassiveGuide = {
  id: string
  label: string
  value: number
  /** O valor da ficha, sem as condições (`getPassiveScore`). */
  sheetValue: number
  adjustment: -5 | 0 | 5
  advantage: GuideReason[]
  disadvantage: GuideReason[]
  breakdown: GuideBreakdownItem[]
  notes: string[]
}

export type RollGuide = {
  checks: Record<AbilityScore, RollGuideEntry>
  saves: Record<AbilityScore, RollGuideEntry>
  /** Por id da perícia (`SKILLS`), como `getSkillChecks`. */
  skills: Record<string, RollGuideEntry>
  initiative: RollGuideEntry
  passivePerception: PassiveGuide
  attacks: AttackGuide[]
  spellcasting: SpellcastingGuide[]
  deathSave: RollGuideEntry
  /** Um por tipo de Dado de Vida do poço, do maior para o menor. */
  hitDice: RollGuideEntry[]
  /**
   * Linhas que valem para a ficha toda: Incapacitado (sem ações nem reações), sem fala (sem
   * componente verbal) e não conjurar com armadura sem proficiência.
   */
  notes: string[]
  /**
   * O que proíbe conjurar numa situação que a ficha não conhece (em fúria, pág. 48 —
   * `getCastingRestrictions`): condicional, nunca em `notes`, que é só o que está em vigor. Também
   * nas notas do ataque de magia e da concentração.
   */
  castingRestrictions: string[]
}

// ── Formatação ───────────────────────────────────────────────────────────────

/** " + 5" / " - 1" / "" — o sinal ASCII de `formatModifier`, com espaços para ler na mesa. */
function spacedModifier(modifier: number): string {
  if (modifier === 0) return ''
  return modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`
}

function notationModifier(modifier: number): string {
  if (modifier === 0) return ''
  return modifier > 0 ? `+${modifier}` : `${modifier}`
}

/** Fórmula de texto: "1d8 + 3 cortante"; sem dado, só o número ("4 concussão"). */
export function formatGuideFormula(dice: string, modifier: number, damageType = ''): string {
  const base = dice ? `${dice}${spacedModifier(modifier)}` : String(modifier)
  return damageType ? `${base} ${damageType}` : base
}

/** Notação do motor: "1d8+3"; sem dado, a constante ("4"). */
export function formatGuideNotation(dice: string, modifier: number): string {
  return dice ? `${dice}${notationModifier(modifier)}` : String(modifier)
}

/** O d20 na notação do motor: com vantagem, dois d20 e fica o maior (`2d20kh1`). */
function d20Notation(mode: RollMode, modifier: number): string {
  const dice = mode === 'advantage' ? '2d20kh1' : mode === 'disadvantage' ? '2d20kl1' : '1d20'
  return `${dice}${notationModifier(modifier)}`
}

const labels = (reasons: GuideReason[]) => reasons.map(r => r.label).join(', ')

/**
 * A frase da mesa: "1d20 + 5, com desvantagem (Envenenado)"; "1d20 + 2 — falha automática
 * (Paralisado)"; quando uma de cada lado se anula, diz quais.
 */
export function describeRollGuide(entry: RollGuideEntry): string {
  const parts = [entry.formula]
  if (entry.mode === 'advantage') parts.push(`com vantagem (${labels(entry.advantage)})`)
  else if (entry.mode === 'disadvantage') parts.push(`com desvantagem (${labels(entry.disadvantage)})`)
  else if (entry.advantage.length > 0 && entry.disadvantage.length > 0) {
    parts.push(`normal: vantagem (${labels(entry.advantage)}) e desvantagem (${labels(entry.disadvantage)}) se anulam`)
  }
  const text = parts.join(', ')
  return entry.autoFail.length > 0 ? `${text} — falha automática (${labels(entry.autoFail)})` : text
}

// ── Dano em texto ────────────────────────────────────────────────────────────

/** O texto de dano de `WeaponAttack` lido de volta: dados, modificador total e tipo. */
export type ParsedDamage = { count: number; sides: number; modifier: number; damageType: string }

const DAMAGE_TEXT = /^(?:(\d+)d(\d+))?\s*([+-]\s*\d+|\d+)?\s*(.*)$/

/**
 * Lê o dano como `weaponFormat` o escreve: "1d8+3 cortante", "1d6 perfurante", "1d4-1 perfurante",
 * "1d10+3" (versátil, sem tipo), o fixo "4 concussão" / "-1 concussão" (golpe desarmado,
 * Zarabatana). "—" (Rede) ou texto que não bate dá null. `count` 0 = dano fixo, sem dado.
 */
export function parseDamageText(text: string): ParsedDamage | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed === '—') return null
  const m = DAMAGE_TEXT.exec(trimmed)
  if (!m) return null
  const [, countRaw, sidesRaw, modRaw, rest] = m
  if (countRaw === undefined && modRaw === undefined) return null
  // Dano fixo começa pelo número: "4 concussão". Um "+3" sem dado na frente não é texto da ficha.
  if (countRaw === undefined && /^[+]/.test(modRaw)) return null
  const damageType = rest.trim()
  if (damageType && !/^[\p{L} ]+$/u.test(damageType)) return null
  return {
    count: countRaw === undefined ? 0 : Number(countRaw),
    sides: sidesRaw === undefined ? 0 : Number(sidesRaw),
    modifier: modRaw === undefined ? 0 : Number(modRaw.replace(/\s+/g, '')),
    damageType,
  }
}

// ── Fontes do modo ───────────────────────────────────────────────────────────

type SheetModeSources = {
  /** Armadura/escudo sem proficiência: desvantagem em tudo de FOR e DES (pág. 144). */
  unproficientArmor: GuideReason[]
  /** Armadura que impõe desvantagem em Furtividade. */
  stealth: GuideReason[]
}

const STR_DEX: readonly AbilityScore[] = ['STR', 'DEX']

/**
 * Linha condicional de uma condição ou característica, já com a categoria de jogada que ela
 * alcança. `deathSave`: vale também no teste contra a morte (Sortudo).
 */
type ConditionalLine = {
  rolls: RollCategory[]
  abilities?: AbilityScore[]
  deathSave?: boolean
  /** Quem deixa jogar de novo o 1 natural (Sortudo): o nome, para a tela oferecer a rolagem. */
  rerollNaturalOne?: string
  text: string
}

/**
 * As linhas condicionais de jogada das condições em vigor (Amedrontado "com a fonte do medo na
 * linha de visão", Cego/Surdo "teste que requeira a visão/audição") — as que o agregador entrega
 * só como texto solto. Condição suspensa (Envenenado sob Petrificado) não entra.
 */
function getConditionalLines(effects: ActiveConditionEffects): ConditionalLine[] {
  const tagged: { label: string; effect: ConditionEffect }[] = [
    ...effects.conditions.filter(c => !c.suspendedBy).flatMap(c =>
      (getCondition(c.id)?.effects ?? []).map(effect => ({ label: c.name, effect }))),
    ...EXHAUSTION.levels.filter(row => row.level <= effects.exhaustion).flatMap(row =>
      row.effects.map(effect => ({ label: `Exaustão ${row.level}`, effect }))),
  ]
  return tagged.flatMap(({ label, effect }): ConditionalLine[] => {
    if (effect.scope !== 'notice') return []
    if (effect.kind === 'rollMode') return [{ rolls: effect.rolls, abilities: effect.abilities, text: `${effect.text} (${label})` }]
    if (effect.kind === 'autoFail') return [{ rolls: [effect.roll], abilities: effect.abilities, text: `${effect.text} (${label})` }]
    return []
  })
}

/**
 * As linhas condicionais que a ficha declara (`getConditionalRollNotes`): Resiliência Anã, Bravura,
 * Sortudo, Sentido de Perigo — "Sortudo: tirou 1 natural no d20?…". A ressalva do livro vai no
 * texto; a que o estado de jogo conhece (`unlessConditions`: Cego, Surdo, Incapacitado, gravados ou
 * derivados) tira a linha enquanto valer (decisão de 2026-10-25).
 */
function getSheetConditionalLines(draft: CharacterDraft, effects: ActiveConditionEffects): ConditionalLine[] {
  const active = new Set(effects.conditions.filter(c => !c.suspendedBy).map(c => c.id))
  return getConditionalRollNotes(draft).filter(n => !n.unlessConditions?.some(id => active.has(id))).map(n => ({
    rolls: n.rolls,
    ...(n.abilities ? { abilities: n.abilities } : {}),
    ...(n.deathSave ? { deathSave: true } : {}),
    ...(n.rerollNaturalOne ? { rerollNaturalOne: n.source } : {}),
    text: `${n.source}: ${n.text}`,
  }))
}

function linesFor(lines: ConditionalLine[], roll: RollCategory, ability?: AbilityScore): string[] {
  return lines
    .filter(l => l.rolls.includes(roll) && (!l.abilities || (ability !== undefined && l.abilities.includes(ability))))
    .map(l => l.text)
}

type ModeSources = Pick<RollGuideEntry, 'mode' | 'advantage' | 'disadvantage' | 'autoFail'>

/** As notas possíveis da Inspiração ainda não gasta, por situação (`inspirationNote`). */
const INSPIRATION_NOTES = {
  autoFail: 'Inspiração: não adianta aqui — a jogada falha automaticamente.',
  advantage: 'Inspiração: a jogada já tem vantagem; gastá-la não muda nada (vantagens não se somam, pág. 175).',
  disadvantage: 'Inspiração: gastá-la anula a desvantagem e a jogada sai normal (pág. 175).',
  canceled: 'Inspiração: aqui não muda nada — vantagem e desvantagem já se anulam, qualquer que seja a quantidade (pág. 175).',
  normal: 'Inspiração: você pode gastá-la para rolar esta jogada com vantagem (pág. 127).',
} as const

const isInspirationNote = (note: string) => (Object.values(INSPIRATION_NOTES) as string[]).includes(note)

/**
 * A nota da Inspiração ainda não gasta (pág. 127), conforme o modo: gastá-la dá vantagem; com
 * vantagem não muda nada (não acumula) e com desvantagem anula (pág. 175). Com falha automática, a
 * vantagem não muda o resultado: gastá-la seria desperdício.
 */
function inspirationNote({ mode, advantage, disadvantage, autoFail }: ModeSources): string {
  if (autoFail.length > 0) return INSPIRATION_NOTES.autoFail
  if (mode === 'advantage') return INSPIRATION_NOTES.advantage
  if (mode === 'disadvantage') return INSPIRATION_NOTES.disadvantage
  if (advantage.length > 0 && disadvantage.length > 0) return INSPIRATION_NOTES.canceled
  return INSPIRATION_NOTES.normal
}

// ── Montagem ─────────────────────────────────────────────────────────────────

type D20Input = {
  id: string
  label: string
  ability?: AbilityScore
  modifier: number
  breakdown: GuideBreakdownItem[]
  condition: ConditionRoll
  extraAdvantage?: GuideReason[]
  extraDisadvantage?: GuideReason[]
  notes?: string[]
  dc?: number
  attackRoll?: boolean
}

/** Parcelas que somam o total: o que sobrar de uma conta que não fecha vira "Outros". */
function closeBreakdown(items: GuideBreakdownItem[], total: number): GuideBreakdownItem[] {
  const rest = total - items.reduce((sum, i) => sum + i.value, 0)
  return rest === 0 ? [...items] : [...items, { label: 'Outros', value: rest }]
}

function d20Entry(input: D20Input, inspiration: boolean): RollGuideEntry {
  const advantage = [...input.condition.advantage, ...(input.extraAdvantage ?? [])]
  const disadvantage = [...input.condition.disadvantage, ...(input.extraDisadvantage ?? [])]
  const mode = resolveRollMode(advantage, disadvantage)
  const notes = [...(input.notes ?? [])]
  if (inspiration) notes.push(inspirationNote({ mode, advantage, disadvantage, autoFail: input.condition.autoFail }))
  return {
    id: input.id,
    kind: 'd20',
    label: input.label,
    ...(input.ability ? { ability: input.ability } : {}),
    dice: '1d20',
    modifier: input.modifier,
    formula: formatGuideFormula('1d20', input.modifier),
    notation: d20Notation(mode, input.modifier),
    mode,
    advantage,
    disadvantage,
    autoFail: [...input.condition.autoFail],
    breakdown: closeBreakdown(input.breakdown, input.modifier),
    notes,
    ...(input.dc !== undefined ? { dc: input.dc } : {}),
    ...(input.attackRoll ? { attackRoll: true as const } : {}),
  }
}

/**
 * Mais uma fonte de vantagem ou desvantagem numa jogada de d20 já montada (a Inspiração gasta, a
 * circunstância da mesa): o modo é recalculado pela pág. 175 — várias do mesmo lado valem uma; uma
 * de cada lado anula, qualquer que seja a quantidade —, com a notação que os dados do app rolam.
 * `effect` diz o que a fonte fez quando não é só dar o modo dela (null nesse caso): a regra avisa,
 * não impede.
 */
function addModeSource(
  entry: RollGuideEntry,
  side: AdvantageMode,
  reason: GuideReason,
): { next: RollGuideEntry; effect: string | null } {
  const advantage = side === 'advantage' ? [...entry.advantage, reason] : entry.advantage
  const disadvantage = side === 'disadvantage' ? [...entry.disadvantage, reason] : entry.disadvantage
  const mode = resolveRollMode(advantage, disadvantage)
  const [chosen, chosenPlural, opposite] = side === 'advantage'
    ? ['vantagem', 'vantagens', 'desvantagem']
    : ['desvantagem', 'desvantagens', 'vantagem']
  const canceled = entry.advantage.length > 0 && entry.disadvantage.length > 0
  const effect = entry.autoFail.length > 0
    ? 'não muda nada — a jogada falha automaticamente.'
    : entry.mode === side
      ? `a jogada já tinha ${chosen}; não muda nada (${chosenPlural} não se somam, pág. 175).`
      : entry.mode !== 'normal'
        ? `anula a ${opposite}: role um d20 só (pág. 175).`
        : canceled
          ? 'não muda nada — vantagem e desvantagem já se anulavam, qualquer que seja a quantidade (pág. 175).'
          : null
  return { next: { ...entry, advantage, disadvantage, mode, notation: d20Notation(mode, entry.modifier) }, effect }
}

/** A fonte de vantagem da Inspiração gasta numa jogada (pág. 127). */
export const INSPIRATION_REASON: GuideReason = { source: 'inspiration', label: 'Inspiração' }

/**
 * A jogada com a Inspiração gasta (`regras-rolagens-e-concentracao.md`, 11.5): a fonte
 * `inspiration` entra na lista de vantagem (`addModeSource`). A primeira nota diz o que o gasto fez
 * — inclusive quando não mudou nada (já com vantagem, vantagem e desvantagem já anuladas, falha
 * automática). Só d20; as demais jogadas voltam iguais.
 */
export function withInspirationSpent(entry: RollGuideEntry): RollGuideEntry {
  if (entry.kind !== 'd20' || entry.advantage.some(r => r.source === INSPIRATION_REASON.source)) return entry
  const { next, effect } = addModeSource(entry, 'advantage', INSPIRATION_REASON)
  return { ...next, notes: [`Inspiração gasta: ${effect ?? 'role com vantagem (pág. 127).'}`, ...entry.notes] }
}

/**
 * A vantagem ou desvantagem que a mesa dá e a ficha não conhece: a circunstância que o Mestre
 * decide (pág. 175), o Ataque Descuidado, a ação Ajudar. Escolhida à mão na folha da receita.
 */
export const TABLE_MODE_REASONS: Record<Exclude<RollMode, 'normal'>, GuideReason> = {
  advantage: { source: 'table:advantage', label: 'Circunstância da mesa' },
  disadvantage: { source: 'table:disadvantage', label: 'Circunstância da mesa' },
}

/**
 * A jogada com o Normal / Vantagem / Desvantagem escolhido na folha: a circunstância da mesa entra
 * como mais uma fonte (`addModeSource`). Quando a escolha não muda o modo (já havia o mesmo, já se
 * anulavam, falha automática) ou anula o outro lado, a primeira nota diz por quê; a nota da
 * Inspiração ainda não gasta, qualquer que seja, passa a dizer o que ela faz no modo novo. `normal`
 * e as jogadas que não são d20 voltam iguais.
 */
export function withTableMode(entry: RollGuideEntry, choice: RollMode): RollGuideEntry {
  if (entry.kind !== 'd20' || choice === 'normal') return entry
  const reason = TABLE_MODE_REASONS[choice]
  const sameSide = choice === 'advantage' ? entry.advantage : entry.disadvantage
  if (sameSide.some(r => r.source === reason.source)) return entry
  const { next, effect } = addModeSource(entry, choice, reason)
  const notes = entry.notes.map(n => (isInspirationNote(n) ? inspirationNote(next) : n))
  const label = choice === 'advantage' ? 'Vantagem da mesa' : 'Desvantagem da mesa'
  return { ...next, notes: effect ? [`${label}: ${effect}`, ...notes] : notes }
}

type DamageInput = {
  id: string
  label: string
  parsed: ParsedDamage
  damageType: string
  breakdown: GuideBreakdownItem[]
  notes?: string[]
  /** Dados de arma a mais só no crítico (Crítico Brutal, Ataques Selvagens): viram nota, fora da fórmula. */
  critExtraDice?: SheetEffect<number>[]
}

/** O que a ficha diz do dano fixo que dá 0 (golpe desarmado com Força baixa). */
const NO_DAMAGE_NOTE = 'Não causa dano: o valor fixo mais o modificador dá 0 ou menos, e o dano nunca é negativo.'

function damageEntry(input: DamageInput): RollGuideEntry {
  const { count, sides } = input.parsed
  // Dano fixo tem piso 0 (decisão 14 de `regras-dano-e-morte.md`): Força 6-7 no golpe desarmado
  // dá 0, não −1, e a ficha diz que não causa dano (decisão de 2026-10-25).
  const modifier = count === 0 ? Math.max(0, input.parsed.modifier) : input.parsed.modifier
  const floor = modifier - input.parsed.modifier
  const dice = count > 0 ? `${count}d${sides}` : ''
  const critDice = count > 0 ? `${count * 2}d${sides}` : ''
  const critNotes = count > 0 ? (input.critExtraDice ?? []).map(e => critExtraDiceNote(e, sides)) : []
  const notes = [...(input.notes ?? [])]
  if (count === 0 && modifier === 0) notes.push(NO_DAMAGE_NOTE)
  else if (count === 0) notes.push('Dano fixo, sem dado: o acerto crítico não muda o valor (só os dados dobram, pág. 196).')
  const breakdown = floor > 0 ? [...input.breakdown, { label: 'Mínimo 0', value: floor }] : input.breakdown
  return {
    id: input.id,
    kind: 'damage',
    label: input.label,
    dice,
    modifier,
    formula: formatGuideFormula(dice, modifier, input.damageType),
    notation: formatGuideNotation(dice, modifier),
    mode: 'normal',
    advantage: [],
    disadvantage: [],
    autoFail: [],
    breakdown: closeBreakdown(breakdown, modifier),
    notes,
    crit: {
      dice: critDice,
      formula: formatGuideFormula(critDice, modifier, input.damageType),
      notation: formatGuideNotation(critDice, modifier),
      ...(critNotes.length > 0 ? { notes: critNotes } : {}),
    },
  }
}

const ABILITY_BY_LONG_NAME = new Map(ALL_ABILITY_SCORES.map(ab => [ABILITY_LABELS[ab].long, ab]))

/** "inclui +2 no ataque (Arquearia)": o bônus que `getWeaponAttack` já somou, com a origem. */
const INCLUDED_ATTACK_BONUS = /^inclui ([+-]\d+) no ataque \((.+)\)$/

/** O que todo ataque da ficha compartilha: o personagem, o estado de jogo e as fontes do modo. */
type AttackGuideContext = {
  mods: Record<AbilityScore, number>
  proficiencyBonus: number
  condition: ConditionRoll
  sheet: SheetModeSources
  lines: ConditionalLine[]
  inspiration: boolean
  /** O que impede de agir (Incapacitado): vale para todo ataque. */
  cannotAct: string[]
  /** Quem dá os ataques a mais da ação de Atacar (Ataque Extra), para a nota da linha. */
  attacksPerActionSource: string | null
  /** Margem de crítico das armas (Crítico Aprimorado/Superior); null = só o 20. */
  weaponCrit: SheetEffect<number> | null
  /** A raça é de tamanho Pequeno (halfling, gnomo): desvantagem com arma pesada (pág. 149). */
  small: boolean
  /** Dados de arma a mais no crítico corpo a corpo, por fonte (Crítico Brutal, Ataques Selvagens). */
  meleeCritExtraDice: SheetEffect<number>[]
}

/**
 * "Crítico Brutal: no acerto crítico com esta arma corpo a corpo, role mais 2d12…". O dado é o que
 * a arma usa NAQUELE ataque (decisão de 2026-10-25): o versátil a duas mãos, o de Artes Marciais
 * quando ele substitui o da arma — por isso a nota sai de cada entrada de dano, com os lados dela.
 */
function critExtraDiceNote({ source, value }: SheetEffect<number>, sides: number): string {
  return `${source}: no acerto crítico com esta arma corpo a corpo, role mais ${value}d${sides} (o dado da arma neste ataque) e some ao dano.`
}

/**
 * A nota do d20 natural num ataque (pág. 196): o 20 sempre acerta e é crítico; com margem maior
 * (Crítico Aprimorado), o 19 (ou o 18) só é crítico se acertar — acertar automático é só o 20.
 */
function critNote(threshold: number, source?: string): string {
  if (threshold >= 20) return '20 natural: acerta e é crítico — role os dados de dano duas vezes. 1 natural: erra (pág. 196).'
  const range = threshold === 19 ? '19 ou 20' : `${threshold} a 20`
  const from = source ? ` (${source})` : ''
  return `${range} natural: crítico se acertar${from} — role os dados de dano duas vezes; só o 20 acerta automaticamente. 1 natural: erra (pág. 196).`
}

function attackGuide(attack: SheetAttack, ctx: AttackGuideContext): AttackGuide {
  const { mods, proficiencyBonus, condition, sheet, lines, inspiration, cannotAct } = ctx
  const ability = ABILITY_BY_LONG_NAME.get(attack.ability) ?? 'STR'
  const breakdown: GuideBreakdownItem[] = [
    { label: attack.ability, value: mods[ability] },
    ...(attack.proficient ? [{ label: 'Proficiência', value: proficiencyBonus }] : []),
  ]
  // As notas da arma (Duelismo, outra mão, recarga, Artes Marciais) valem no ataque e no dano:
  // a folha de cada jogada diz o que muda nela.
  const notes: string[] = []
  for (const n of attack.notes) {
    const m = INCLUDED_ATTACK_BONUS.exec(n)
    if (m) breakdown.push({ label: m[2], value: Number(m[1]) })
    else notes.push(n)
  }
  // A margem do Campeão vale nas armas; o golpe desarmado fica no 20 (decisão 20 de
  // regras-dano-e-morte.md, em aberto desde que ele é ataque corpo a corpo com arma, decisão 27).
  const weaponCrit = attack.weapon ? ctx.weaponCrit : null
  const critThreshold = weaponCrit?.value ?? 20
  // Pesada: "criaturas pequenas têm desvantagem nas jogadas de ataque com estas armas" (pág. 149).
  const heavySmall: GuideReason[] = attack.weapon?.heavy && ctx.small
    ? [{ source: 'weapon:heavy-small', label: `${attack.name} pesada para criatura Pequena` }]
    : []
  // Só arma corpo a corpo: o golpe desarmado fica de fora (decisão 21, em aberto pela 27).
  const critExtraDice = attack.weapon?.melee ? ctx.meleeCritExtraDice : []
  const extraAttacks = attack.attacksPerAction > 1
    ? [`${ctx.attacksPerActionSource ?? 'Ataque Extra'}: você faz ${attack.attacksPerAction} ataques ao usar a ação de Atacar — role cada um.`]
    : []

  const attackEntry = d20Entry({
    id: `attack:${attack.key}`,
    label: `${attack.name} — ataque`,
    attackRoll: true,
    ability,
    modifier: Number(attack.attackBonus),
    breakdown,
    condition,
    extraDisadvantage: [...(STR_DEX.includes(ability) ? sheet.unproficientArmor : []), ...heavySmall],
    notes: [
      ...cannotAct,
      ...(attack.proficient ? [] : [`Sem proficiência com ${attack.name}: o bônus de proficiência não entra (pág. 148).`]),
      ...(heavySmall.length > 0 ? ['Arma pesada: criaturas Pequenas têm desvantagem nas jogadas de ataque com ela (pág. 149).'] : []),
      ...extraAttacks,
      ...notes,
      critNote(critThreshold, weaponCrit?.source),
      ...linesFor(lines, 'attack'),
    ],
  }, inspiration)

  // O texto do dano fixo já vem com o piso 0 ("0 concussão"): a conta aberta sai do valor fixo da
  // arma mais o modificador, e o damageEntry põe de volta o piso como parcela ("Mínimo 0").
  const text = parseDamageText(attack.damage)
  const parsed = text && text.count === 0 && attack.fixedDamageBase !== undefined
    ? { ...text, modifier: attack.fixedDamageBase + mods[ability] }
    : text
  const damageBreakdown = (p: ParsedDamage): GuideBreakdownItem[] => [
    ...(p.count === 0 ? [{ label: attack.name, value: attack.fixedDamageBase ?? p.modifier - mods[ability] }] : []),
    { label: attack.ability, value: mods[ability] },
  ]
  const damage = parsed
    ? damageEntry({
      id: `damage:${attack.key}`,
      label: `${attack.name} — dano`,
      parsed,
      damageType: parsed.damageType,
      breakdown: damageBreakdown(parsed),
      notes,
      critExtraDice,
    })
    : null

  const versatileParsed = attack.versatileDamage ? parseDamageText(attack.versatileDamage) : null
  const versatile = versatileParsed && parsed
    ? damageEntry({
      id: `damage:${attack.key}:versatile`,
      label: `${attack.name} — dano a duas mãos`,
      parsed: versatileParsed,
      damageType: versatileParsed.damageType || parsed.damageType,
      breakdown: damageBreakdown(versatileParsed),
      notes,
      critExtraDice,
    })
    : null

  return {
    key: attack.key,
    name: attack.name,
    ability: attack.ability,
    properties: attack.properties,
    attacksPerAction: attack.attacksPerAction,
    critThreshold,
    notes,
    attack: attackEntry,
    damage,
    versatile,
  }
}

const WAR_CASTER_ID = 'conjurador-de-guerra'

function hasWarCaster(draft: CharacterDraft): { source: string; label: string } | null {
  const feat = getOwnedFeats(draft).find(f => f.id === WAR_CASTER_ID)
  return feat ? { source: `feat:${feat.id}`, label: feat.name } : null
}

/** O TR de Constituição de base, que a concentração reaproveita. */
function saveInput(
  ability: AbilityScore,
  check: { proficient: boolean; bonus: number },
  mods: Record<AbilityScore, number>,
  proficiencyBonus: number,
  effects: ActiveConditionEffects,
  sheet: SheetModeSources,
  lines: ConditionalLine[],
): D20Input {
  return {
    id: `save:${ability}`,
    label: `TR de ${ABILITY_LABELS[ability].long}`,
    ability,
    modifier: check.bonus,
    breakdown: [
      { label: ABILITY_LABELS[ability].long, value: mods[ability] },
      ...(check.proficient ? [{ label: 'Proficiência', value: proficiencyBonus }] : []),
    ],
    condition: effects.savingThrows[ability],
    extraDisadvantage: STR_DEX.includes(ability) ? sheet.unproficientArmor : [],
    notes: linesFor(lines, 'save', ability),
  }
}

/** Uma conjuração (classe ou talento) com a CD e o bônus de ataque já calculados pela fonte dela. */
type SpellcastingInput = Omit<SpellcastingGuide, 'saveDcBreakdown' | 'attack'> & { attackId: string; attackModifier: number }

/** O guia de todas as jogadas da ficha, com o estado de jogo aplicado. Pura. */
export function getRollGuide(draft: CharacterDraft, state: PlayState): RollGuide {
  const scores = getFinalAbilityScores(draft)
  const mods = Object.fromEntries(ALL_ABILITY_SCORES.map(ab => [ab, calculateModifier(scores[ab])])) as Record<AbilityScore, number>
  const level = draft.level ?? 1
  const prof = getProficiencyBonus(level)
  const effects = getPlayConditionEffects(state)
  // As linhas das condições e as da ficha. O valor passivo leva só as das condições: rerrolar ou
  // "vantagem contra veneno" não alcançam um número que não se rola.
  const conditionLines = getConditionalLines(effects)
  const lines = [...conditionLines, ...getSheetConditionalLines(draft, effects)]
  const inspiration = state.inspiration

  // Fontes da ficha.
  const unproficient = getUnproficientArmor(draft)
  const ac = getSheetArmorClass(draft, scores)
  const sheet: SheetModeSources = {
    unproficientArmor: unproficient.map(a => ({ source: `armor:${a.id}`, label: `${a.name} sem proficiência` })),
    stealth: ac.stealthDisadvantage
      ? [{ source: 'armor:stealth', label: ac.components[0]?.label ?? 'Armadura' }]
      : [],
  }
  const cannotCast = unproficient.length > 0
    ? [`Usando ${unproficient.map(a => a.name).join(' e ')} sem proficiência, você não pode conjurar magias (pág. 144).`]
    : []
  const warCaster = hasWarCaster(draft)
  // Incapacitado (gravado ou implicado: Paralisado, Atordoado, Inconsciente…) e sem fala. A ficha
  // não bloqueia a jogada — só diz, no ataque, no ataque de magia e nas notas gerais.
  const cannotAct = effects.noActions.active
    ? [`${labels(effects.noActions.sources)}: não pode realizar ações nem reações (pág. 292).`]
    : []
  const cannotSpeak = effects.cannotSpeak.active
    ? [`Não pode falar (${labels(effects.cannotSpeak.sources)}): sem o componente verbal, a magia que o exige não pode ser conjurada (pág. 205).`]
    : []
  // Em fúria não se conjura (pág. 48): a ficha não sabe se você está em fúria, então é nota.
  const castingRestrictions = getCastingRestrictions(draft).map(formatCastingRestriction)

  // Testes de atributo puros: modificador + meia proficiência quando a ficha a tem (Versatilidade).
  const halfSources = getHalfProficiencySources(draft)
  const checkDisadvantage = (ab: AbilityScore) => (STR_DEX.includes(ab) ? sheet.unproficientArmor : [])
  const checks = Object.fromEntries(ALL_ABILITY_SCORES.map(ab => {
    const half = getBestHalfProficiencySource(halfSources, ab)
    const breakdown = [
      { label: ABILITY_LABELS[ab].long, value: mods[ab] },
      ...(half ? [{ label: half.source, value: half.value }] : []),
    ]
    return [ab, d20Entry({
      id: `check:${ab}`,
      label: `Teste de ${ABILITY_LABELS[ab].long}`,
      ability: ab,
      modifier: mods[ab] + (half?.value ?? 0),
      breakdown,
      condition: effects.abilityChecks[ab],
      extraDisadvantage: checkDisadvantage(ab),
      notes: linesFor(lines, 'abilityCheck', ab),
    }, inspiration)]
  })) as Record<AbilityScore, RollGuideEntry>

  const saveChecks = getSavingThrowChecks(draft, scores)
  // Bônus que depende da situação (Aura de Proteção, pág. 111): fica fora do número, como na
  // Revisão e no PDF, e vira nota com a condição — o mesmo texto de describeConditionalSaveBonuses.
  const conditionalSaveLines = describeConditionalSaveBonuses(draft, scores)
  const saves = Object.fromEntries(ALL_ABILITY_SCORES.map(ab => {
    const input = saveInput(ab, saveChecks[ab], mods, prof, effects, sheet, lines)
    if (conditionalSaveLines.length > 0) input.notes = [...(input.notes ?? []), ...conditionalSaveLines]
    if (ab === 'CON' && warCaster) {
      input.notes = [...(input.notes ?? []), `${warCaster.label}: vantagem neste TR para manter a concentração ao sofrer dano (pág. 169).`]
    }
    return [ab, d20Entry(input, inspiration)]
  })) as Record<AbilityScore, RollGuideEntry>

  const skillChecks = getSkillChecks(draft, scores)
  const skills = Object.fromEntries(SKILLS.map(skill => {
    const check = skillChecks[skill.id]
    const ab = check.ability
    const half = check.proficiency === 'none' ? getBestHalfProficiencySource(halfSources, ab) : undefined
    const profPart: GuideBreakdownItem[] = check.proficiency === 'expertise'
      ? [{ label: 'Especialização', value: prof * 2 }]
      : check.proficiency === 'proficient'
        ? [{ label: 'Proficiência', value: prof }]
        : half ? [{ label: half.source, value: half.value }] : []
    return [skill.id, d20Entry({
      id: `skill:${skill.id}`,
      label: skill.name,
      ability: ab,
      modifier: check.bonus,
      breakdown: [{ label: ABILITY_LABELS[ab].long, value: mods[ab] }, ...profPart],
      condition: effects.abilityChecks[ab],
      extraDisadvantage: [...checkDisadvantage(ab), ...(skill.id === 'stealth' ? sheet.stealth : [])],
      notes: linesFor(lines, 'abilityCheck', ab),
    }, inspiration)]
  })) as Record<string, RollGuideEntry>

  // Iniciativa: teste de Destreza (pág. 179) com os bônus próprios (Alerta, Versatilidade).
  const initiativeBonuses = getInitiativeBonuses(draft)
  const initiative = d20Entry({
    id: 'initiative',
    label: 'Iniciativa',
    ability: 'DEX',
    modifier: mods.DEX + initiativeBonuses.reduce((sum, b) => sum + b.value, 0),
    breakdown: [
      { label: ABILITY_LABELS.DEX.long, value: mods.DEX },
      ...initiativeBonuses.map(b => ({ label: b.source, value: b.value })),
    ],
    condition: effects.initiative,
    extraAdvantage: getInitiativeAdvantageSources(draft).map(name => ({ source: `feature:${name}`, label: name })),
    extraDisadvantage: sheet.unproficientArmor,
    notes: linesFor(lines, 'abilityCheck', 'DEX'),
  }, inspiration)

  // Percepção passiva: o valor da ficha, +5/−5 com vantagem/desvantagem no teste (pág. 177).
  const perception = skills.perception
  const sheetPassive = getPassiveScore(draft, 'perception', skillChecks)
  const adjustment = perception.mode === 'advantage' ? 5 : perception.mode === 'disadvantage' ? -5 : 0
  const passiveFeats = getOwnedFeats(draft).flatMap(f => {
    const bonus = f.effects?.passiveScoreBonus
    return bonus?.skills.includes('perception') ? [{ label: f.name, value: bonus.value }] : []
  })
  const passivePerception: PassiveGuide = {
    id: 'passive:perception',
    label: 'Percepção passiva',
    value: sheetPassive + adjustment,
    sheetValue: sheetPassive,
    adjustment,
    advantage: perception.advantage,
    disadvantage: perception.disadvantage,
    breakdown: closeBreakdown([
      { label: 'Base', value: 10 },
      ...perception.breakdown,
      ...passiveFeats,
      ...(adjustment > 0 ? [{ label: `Vantagem (${labels(perception.advantage)})`, value: 5 }] : []),
      ...(adjustment < 0 ? [{ label: `Desvantagem (${labels(perception.disadvantage)})`, value: -5 }] : []),
    ], sheetPassive + adjustment),
    notes: linesFor(conditionLines, 'abilityCheck', 'WIS'),
  }

  const attackContext: AttackGuideContext = {
    mods, proficiencyBonus: prof, condition: effects.attack, sheet, lines, inspiration, cannotAct,
    attacksPerActionSource: getAttacksPerAction(draft).source,
    weaponCrit: getWeaponCritThreshold(draft),
    small: (draft.race ? getRace(draft.race)?.size : undefined) === 'Small',
    meleeCritExtraDice: getMeleeCritExtraWeaponDice(draft),
  }
  const attacks = getSheetAttacks(draft, scores).map(a => attackGuide(a, attackContext))

  // A CD e o ataque de magia de uma conjuração, com os números prontos da fonte dela.
  const spellcastingGuide = ({ attackId, attackModifier, ...source }: SpellcastingInput): SpellcastingGuide => {
    const abilityPart = { label: ABILITY_LABELS[source.ability].long, value: mods[source.ability] }
    return {
      ...source,
      saveDcBreakdown: closeBreakdown([{ label: 'Base', value: 8 }, { label: 'Proficiência', value: prof }, abilityPart], source.saveDc),
      attack: d20Entry({
        id: attackId,
        label: `Ataque de magia — ${source.label}`,
        attackRoll: true,
        ability: source.ability,
        modifier: attackModifier,
        breakdown: [abilityPart, { label: 'Proficiência', value: prof }],
        condition: effects.attack,
        notes: [
          ...cannotAct,
          ...cannotSpeak,
          ...cannotCast,
          ...castingRestrictions,
          critNote(20),
          ...linesFor(lines, 'attack'),
        ],
      }, inspiration),
    }
  }
  const spellcasting = [
    ...getCasterEntries(draft).map(caster => {
      const sc = caster.casting.spellcasting
      return spellcastingGuide({
        key: `class:${caster.cls.id}`,
        classId: caster.cls.id,
        featId: null,
        label: caster.casting.label,
        ability: sc.ability,
        saveDc: getSpellSaveDC(sc, scores, level),
        attackId: `spell-attack:${caster.cls.id}`,
        attackModifier: getSpellAttackBonus(sc, scores, level),
      })
    }),
    // Talento que ensina magias (Iniciado em Magia, p. 170): a CD e o ataque pelo atributo da classe
    // escolhida nele, os de getFeatSpellBlocks — os mesmos da Revisão e do PDF.
    ...getFeatSpellBlocks(draft, scores).map(block => spellcastingGuide({
      key: `feat:${block.featId}`,
      classId: block.spellClass,
      featId: block.featId,
      label: block.label,
      ability: block.ability,
      saveDc: block.saveDc,
      attackId: `spell-attack:feat:${block.featId}`,
      attackModifier: Number(block.attackBonus),
    })),
  ]

  // Teste contra a morte: d20 puro, sem atributo (pág. 199); só as fontes de TODO teste de resistência.
  // Sortudo vale nele (decisão de 2026-10-25): a nota e, com os dados do app, o "rolar de novo".
  const deathSaveLines = lines.filter(l => l.deathSave)
  const deathSaveRerolls = deathSaveLines.flatMap(l => (l.rerollNaturalOne ? [l.rerollNaturalOne] : []))
  const deathSave: RollGuideEntry = {
    ...d20Entry({
      id: 'death-save',
      label: 'Teste contra a morte',
      modifier: 0,
      breakdown: [],
      condition: effects.deathSave,
      notes: [
        '10 ou mais: sucesso; 1: dois fracassos; 20: recupera 1 PV (pág. 199).',
        ...deathSaveLines.map(l => l.text),
      ],
    }, inspiration),
    ...(deathSaveRerolls.length > 0 ? { rerollNaturalOne: deathSaveRerolls } : {}),
  }

  const resilient = getOwnedFeats(draft).find(f => f.id === 'resistente')
  const hitDice = getHitDicePool(draft).map(({ die }): RollGuideEntry => {
    const dice = `1d${die}`
    return {
      id: `hit-die:${die}`,
      kind: 'heal',
      label: `Dado de Vida (d${die})`,
      ability: 'CON',
      dice,
      modifier: mods.CON,
      formula: formatGuideFormula(dice, mods.CON),
      notation: formatGuideNotation(dice, mods.CON),
      mode: 'normal',
      advantage: [],
      disadvantage: [],
      autoFail: [],
      breakdown: closeBreakdown([{ label: ABILITY_LABELS.CON.long, value: mods.CON }], mods.CON),
      notes: [
        ...(mods.CON < 0 ? ['Se o total der menos que 0, recupera 0: a cura nunca vira dano.'] : []),
        ...(resilient
          ? [`${resilient.name}: cada dado recupera no mínimo 2 × mod. de Constituição (mínimo 2) (pág. 172) — confira na mesa.`]
          : []),
      ],
    }
  })

  return {
    checks, saves, skills, initiative, passivePerception, attacks, spellcasting, deathSave, hitDice,
    notes: [...cannotAct, ...cannotSpeak, ...cannotCast],
    castingRestrictions,
  }
}

/**
 * O TR de Constituição para manter a concentração depois de um dano (pág. 205): CD =
 * max(10, metade do dano, para baixo). O dano é o total do evento, depois da resistência e
 * contando o que os PV temporários absorveram (assumido E, `regras-rolagens-e-concentracao.md`).
 * Conjurador de Guerra (pág. 169) entra como vantagem — aqui o efeito vale sempre. A restrição de
 * conjuração (em fúria não se concentra, pág. 48) vira nota.
 */
export function getConcentrationGuide(draft: CharacterDraft, state: PlayState, damage: number): RollGuideEntry {
  const scores = getFinalAbilityScores(draft)
  const mods = Object.fromEntries(ALL_ABILITY_SCORES.map(ab => [ab, calculateModifier(scores[ab])])) as Record<AbilityScore, number>
  const prof = getProficiencyBonus(draft.level ?? 1)
  const effects = getPlayConditionEffects(state)
  const lines = [...getConditionalLines(effects), ...getSheetConditionalLines(draft, effects)]
  const sheet: SheetModeSources = { unproficientArmor: [], stealth: [] }
  const input = saveInput('CON', getSavingThrowChecks(draft, scores).CON, mods, prof, effects, sheet, lines)
  const amount = Number.isFinite(damage) ? Math.max(0, Math.floor(damage)) : 0
  const warCaster = hasWarCaster(draft)
  const spell = state.concentration?.label
  return d20Entry({
    ...input,
    id: 'concentration',
    label: spell ? `Concentração em ${spell} — TR de Constituição` : 'Concentração — TR de Constituição',
    extraAdvantage: warCaster ? [warCaster] : [],
    notes: [...getCastingRestrictions(draft).map(formatCastingRestriction), ...(input.notes ?? [])],
    dc: Math.max(10, Math.floor(amount / 2)),
  }, state.inspiration)
}

/** Acha uma entrada pelo `id` em qualquer parte do guia (a UI guarda só o id da jogada aberta). */
export function findRollGuideEntry(guide: RollGuide, id: string): RollGuideEntry | undefined {
  const all: (RollGuideEntry | null)[] = [
    ...Object.values(guide.checks),
    ...Object.values(guide.saves),
    ...Object.values(guide.skills),
    guide.initiative,
    ...guide.attacks.flatMap(a => [a.attack, a.damage, a.versatile]),
    ...guide.spellcasting.map(s => s.attack),
    guide.deathSave,
    ...guide.hitDice,
  ]
  return all.find((e): e is RollGuideEntry => e !== null && e.id === id)
}
