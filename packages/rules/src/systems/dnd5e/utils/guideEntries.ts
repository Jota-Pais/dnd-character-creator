import type { RollMode } from '../types/condition'
import type { AbilityScore } from '../types/race'
import { resolveRollMode, type ConditionRoll, type SheetEffect } from './sheetEffects'

/**
 * Os montadores das entradas do guia de rolagens, num lugar só: a jogada de d20 (`d20Entry`), a de
 * dano (`damageEntry`) e a de cura (`healEntry`), com a fórmula, a notação do motor, o crítico e o
 * "de onde vem". O guia da ficha (`rollGuide.ts`) e o guia da magia (`spellGuide.ts`) montam as
 * jogadas por aqui, sem cópia: o ataque de magia, o dano do truque e o da arma saem da mesma conta.
 */

/** Origem de uma vantagem, desvantagem ou falha automática: `condition:poisoned` / "Envenenado". */
export type GuideReason = { source: string; label: string }

export type GuideKind = 'd20' | 'damage' | 'heal'

/** Uma parcela do modificador: "Destreza" +3, "Proficiência" +2. A soma dos `value` = `modifier`. */
export type GuideBreakdownItem = { label: string; value: number }

/**
 * Um grupo de dados a mais na jogada, com quem o dá: o d4 da Bênção (+) e o da Perdição (−) no d20,
 * o 1d4 radiante do Auxílio Divino no dano (com o tipo). Entra na fórmula depois do modificador
 * ("1d20 + 5 + 1d4", "1d8 + 3 cortante + 1d4 radiante") e na notação depois do d20, que fica
 * primeiro para o natural sair dele.
 */
export type GuideExtraDice = { label: string; count: number; sides: number; sign: 1 | -1; damageType?: string }

export type RollGuideEntry = {
  /**
   * `check:STR` | `save:DEX` | `skill:stealth` | `initiative` | `attack:<key>` | `damage:<key>` |
   * `damage:<key>:versatile` | `spell-attack:<classId>` | `spell-attack:feat:<featId>` |
   * `death-save` | `concentration` | `zero-hp-save` | `hit-die:<faces>`; as do guia da magia,
   * `spell:<magia>:<nível do espaço>:<parte>@<conjuração>` (`spellGuideEntryId`).
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
  /** Os dados a mais dos efeitos ligados e do dano extra (a Bênção, o Auxílio Divino); ausente sem nenhum. */
  extraDice?: GuideExtraDice[]
  /** Só dano: o tipo do dado da arma, por extenso ("cortante"), para remontar a fórmula do crítico. */
  damageType?: string
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
   * Só dano: os dados dobrados do acerto crítico, os a mais também, o modificador igual (pág. 198).
   * `notes`: o que vale só no crítico e fica fora da fórmula (Ataques Selvagens, Crítico Brutal).
   */
  crit?: { dice: string; formula: string; notation: string; notes?: string[] }
  /**
   * Quem deixa jogar de novo o 1 natural desta jogada (Sortudo): com os dados do app, a tela
   * oferece a nova rolagem antes de registrar. Hoje só no teste contra a morte.
   */
  rerollNaturalOne?: string[]
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

/** Os dados a mais dobram no crítico (pág. 198), menos os grupos que o jogador desmarcou. */
const timesFor = (e: GuideExtraDice, crit: boolean, undoubled: readonly string[]) =>
  (crit && !undoubled.includes(e.label) ? 2 : 1)

/** " + 1d4", " - 1d4", " + 1d4 radiante": os dados a mais, na fórmula de texto. */
function extraFormula(extra: readonly GuideExtraDice[], crit = false, undoubled: readonly string[] = []): string {
  return extra.map(e => `${e.sign < 0 ? ' - ' : ' + '}${e.count * timesFor(e, crit, undoubled)}d${e.sides}${e.damageType ? ` ${e.damageType}` : ''}`).join('')
}

/** "+1d4", "-1d4": os dados a mais, na notação do motor. */
function extraNotation(extra: readonly GuideExtraDice[], crit = false, undoubled: readonly string[] = []): string {
  return extra.map(e => `${e.sign < 0 ? '-' : '+'}${e.count * timesFor(e, crit, undoubled)}d${e.sides}`).join('')
}

/**
 * Fórmula de texto: "1d8 + 3 cortante"; sem dado, só o número ("4 concussão"); com os dados a mais
 * depois ("1d20 + 5 + 1d4", "1d8 + 3 cortante + 1d4 radiante"), dobrados no crítico (`crit`), menos
 * os grupos desmarcados (`undoubled`). A arma que acerta sem causar dano (a Rede, pág. 150) com dano
 * extra fica só com ele: "1d4 radiante".
 */
export function formatGuideFormula(
  dice: string, modifier: number, damageType = '', extra: readonly GuideExtraDice[] = [], crit = false, undoubled: readonly string[] = [],
): string {
  const extras = extraFormula(extra, crit, undoubled)
  if (!dice && modifier === 0 && !damageType && extra.length > 0) return extras.replace(/^ \+ /, '')
  const base = dice ? `${dice}${spacedModifier(modifier)}` : String(modifier)
  return `${damageType ? `${base} ${damageType}` : base}${extras}`
}

/**
 * Notação do motor: "1d8+3"; sem dado, a constante ("4"); os dados a mais depois ("1d20+5+1d4"),
 * como na fórmula. Sem dado nem constante, só os dados a mais ("1d4", não "0+1d4").
 */
export function formatGuideNotation(
  dice: string, modifier: number, extra: readonly GuideExtraDice[] = [], crit = false, undoubled: readonly string[] = [],
): string {
  const extras = extraNotation(extra, crit, undoubled)
  if (!dice && modifier === 0 && extra.length > 0) return extras.replace(/^\+/, '')
  return `${dice ? `${dice}${notationModifier(modifier)}` : String(modifier)}${extras}`
}

/**
 * O d20 na notação do motor: com vantagem, dois d20 e fica o maior (`2d20kh1`); os dados a mais
 * vêm depois, e o d20 fica primeiro (o natural sai dele).
 */
export function d20Notation(mode: RollMode, modifier: number, extra: readonly GuideExtraDice[] = []): string {
  const dice = mode === 'advantage' ? '2d20kh1' : mode === 'disadvantage' ? '2d20kl1' : '1d20'
  return `${dice}${notationModifier(modifier)}${extraNotation(extra)}`
}

export type ModeSources = Pick<RollGuideEntry, 'mode' | 'advantage' | 'disadvantage' | 'autoFail'>

/** As notas possíveis da Inspiração ainda não gasta, por situação (`inspirationNote`). */
const INSPIRATION_NOTES = {
  autoFail: 'Inspiração: não adianta aqui — a jogada falha automaticamente.',
  advantage: 'Inspiração: a jogada já tem vantagem; gastá-la não muda nada (vantagens não se somam, pág. 175).',
  disadvantage: 'Inspiração: gastá-la anula a desvantagem e a jogada sai normal (pág. 175).',
  canceled: 'Inspiração: aqui não muda nada — vantagem e desvantagem já se anulam, qualquer que seja a quantidade (pág. 175).',
  normal: 'Inspiração: você pode gastá-la para rolar esta jogada com vantagem (pág. 127).',
} as const

export const isInspirationNote = (note: string) => (Object.values(INSPIRATION_NOTES) as string[]).includes(note)

/**
 * A nota da Inspiração ainda não gasta (pág. 127), conforme o modo: gastá-la dá vantagem; com
 * vantagem não muda nada (não acumula) e com desvantagem anula (pág. 175). Com falha automática, a
 * vantagem não muda o resultado: gastá-la seria desperdício.
 */
export function inspirationNote({ mode, advantage, disadvantage, autoFail }: ModeSources): string {
  if (autoFail.length > 0) return INSPIRATION_NOTES.autoFail
  if (mode === 'advantage') return INSPIRATION_NOTES.advantage
  if (mode === 'disadvantage') return INSPIRATION_NOTES.disadvantage
  if (advantage.length > 0 && disadvantage.length > 0) return INSPIRATION_NOTES.canceled
  return INSPIRATION_NOTES.normal
}

// ── Montagem ─────────────────────────────────────────────────────────────────

export type D20Input = {
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
export function closeBreakdown(items: GuideBreakdownItem[], total: number): GuideBreakdownItem[] {
  const rest = total - items.reduce((sum, i) => sum + i.value, 0)
  return rest === 0 ? [...items] : [...items, { label: 'Outros', value: rest }]
}

export function d20Entry(input: D20Input, inspiration: boolean): RollGuideEntry {
  const advantage = [...input.condition.advantage, ...(input.extraAdvantage ?? [])]
  const disadvantage = [...input.condition.disadvantage, ...(input.extraDisadvantage ?? [])]
  const mode = resolveRollMode(advantage, disadvantage)
  const notes = [...(input.notes ?? [])]
  if (inspiration) notes.push(inspirationNote({ mode, advantage, disadvantage, autoFail: input.condition.autoFail }))
  // Os dados a mais dos efeitos ligados (a Bênção, a Perdição), com o nome de quem os dá.
  const extraDice: GuideExtraDice[] = input.condition.extraDice.map(d => ({ label: d.source.label, count: d.count, sides: d.sides, sign: d.sign }))
  return {
    id: input.id,
    kind: 'd20',
    label: input.label,
    ...(input.ability ? { ability: input.ability } : {}),
    dice: '1d20',
    modifier: input.modifier,
    ...(extraDice.length > 0 ? { extraDice } : {}),
    formula: formatGuideFormula('1d20', input.modifier, '', extraDice),
    notation: d20Notation(mode, input.modifier, extraDice),
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

/** O dano em partes: dados, modificador total e tipo por extenso. `count` 0 = dano fixo, sem dado. */
export type ParsedDamage = { count: number; sides: number; modifier: number; damageType: string }

export type DamageInput = {
  id: string
  label: string
  parsed: ParsedDamage
  damageType: string
  breakdown: GuideBreakdownItem[]
  notes?: string[]
  /**
   * O dano vem de uma jogada de ataque, que tem acerto crítico (pág. 196; o padrão). A magia de TR
   * não tem jogada de ataque, e o dano dela fica sem o `crit`.
   */
  critical?: boolean
  /** Dados de arma a mais só no crítico (Crítico Brutal, Ataques Selvagens): viram nota, fora da fórmula. */
  critExtraDice?: CritExtraDice[]
  /** O dano é do golpe desarmado, que não é arma: a nota do dado a mais fala do golpe. */
  unarmedStrike?: boolean
  /** O dano extra de outro tipo (o Auxílio Divino, a Destruição Divina Aprimorada): parcela própria, que o crítico dobra. */
  extraDice?: GuideExtraDice[]
  /** A arma acerta sem causar dano (a Rede, pág. 150): a jogada é só o dano extra, sem dano fixo. */
  noWeaponDamage?: boolean
}

/** O que a ficha diz do dano fixo que dá 0 (golpe desarmado com Força baixa). */
const NO_DAMAGE_NOTE = 'Não causa dano: o valor fixo mais o modificador dá 0 ou menos, e o dano nunca é negativo.'

export function damageEntry(input: DamageInput): RollGuideEntry {
  const { count, sides } = input.parsed
  // Dano fixo tem piso 0 (decisão 14 de `regras-dano-e-morte.md`): Força 6-7 no golpe desarmado
  // dá 0, não −1, e a ficha diz que não causa dano (decisão de 2026-10-25).
  const modifier = count === 0 ? Math.max(0, input.parsed.modifier) : input.parsed.modifier
  const floor = modifier - input.parsed.modifier
  const dice = count > 0 ? `${count}d${sides}` : ''
  const critDice = count > 0 ? `${count * 2}d${sides}` : ''
  // Sem dado (o golpe desarmado de dano fixo), não há dado a rolar a mais (decisão 21).
  const critNotes = count > 0 ? (input.critExtraDice ?? []).map(e => critExtraDiceNote(e, sides, input.unarmedStrike)) : []
  const notes = [...(input.notes ?? [])]
  const extra = input.extraDice ?? []
  // Com dado a mais (o 1d4 radiante do Auxílio Divino), o golpe causa dano mesmo com o fixo em 0.
  if (input.noWeaponDamage) notes.push('A arma não causa dano: o acerto causa só o dano extra.')
  else if (count === 0 && modifier === 0 && extra.length === 0) notes.push(NO_DAMAGE_NOTE)
  else if (count === 0 && extra.length === 0) notes.push('Dano fixo, sem dado: o acerto crítico não muda o valor (só os dados dobram, pág. 198).')
  else if (count === 0) notes.push('Dano fixo: no acerto crítico, só os dados a mais dobram (pág. 198).')
  const breakdown = floor > 0 ? [...input.breakdown, { label: 'Mínimo 0', value: floor }] : input.breakdown
  return {
    id: input.id,
    kind: 'damage',
    label: input.label,
    dice,
    modifier,
    ...(extra.length > 0 ? { extraDice: extra } : {}),
    ...(input.damageType ? { damageType: input.damageType } : {}),
    formula: formatGuideFormula(dice, modifier, input.damageType, extra),
    notation: formatGuideNotation(dice, modifier, extra),
    mode: 'normal',
    advantage: [],
    disadvantage: [],
    autoFail: [],
    breakdown: closeBreakdown(breakdown, modifier),
    notes,
    // O crítico dobra todos os dados de dano do ataque, os a mais também (pág. 198, linhas 17752-17764).
    ...(input.critical === false ? {} : {
      crit: {
        dice: critDice,
        formula: formatGuideFormula(critDice, modifier, input.damageType, extra, true),
        notation: formatGuideNotation(critDice, modifier, extra, true),
        ...(critNotes.length > 0 ? { notes: critNotes } : {}),
      },
    }),
  }
}

export type HealInput = {
  id: string
  label: string
  ability?: AbilityScore
  /** Vazio no valor fixo, sem dado (os PV temporários de valor fixo). */
  dice: string
  modifier: number
  breakdown: GuideBreakdownItem[]
  notes?: string[]
}

/**
 * Uma jogada de cura (o Dado de Vida, a cura de uma magia) ou de PV temporários: os dados e o
 * modificador, sem modo nem crítico.
 */
export function healEntry(input: HealInput): RollGuideEntry {
  return {
    id: input.id,
    kind: 'heal',
    label: input.label,
    ...(input.ability ? { ability: input.ability } : {}),
    dice: input.dice,
    modifier: input.modifier,
    formula: formatGuideFormula(input.dice, input.modifier),
    notation: formatGuideNotation(input.dice, input.modifier),
    mode: 'normal',
    advantage: [],
    disadvantage: [],
    autoFail: [],
    breakdown: closeBreakdown(input.breakdown, input.modifier),
    notes: [...(input.notes ?? [])],
  }
}

/** Um dado a mais no crítico, com a ressalva do que a linha não cumpre do escopo (`scopeCaveat`). */
export type CritExtraDice = SheetEffect<number> & { caveat: string }

/**
 * "Crítico Brutal: no acerto crítico com esta arma corpo a corpo, role mais 2d12…". O dado é o que
 * a arma usa NAQUELE ataque (decisão de 2026-10-25): o versátil a duas mãos, o de Artes Marciais
 * quando ele substitui o da arma — por isso a nota sai de cada entrada de dano, com os lados dela.
 * No golpe desarmado, o dado é o dele: o de Artes Marciais ou o d4 do Especialista em Briga. Na
 * arma de arremesso, a ressalva: arremessada, o ataque é à distância (p. 149 e 197).
 */
function critExtraDiceNote({ source, value, caveat }: CritExtraDice, sides: number, unarmedStrike = false): string {
  return unarmedStrike
    ? `${source}: no acerto crítico com o golpe desarmado${caveat}, role mais ${value}d${sides} (o dado do golpe neste ataque) e some ao dano.`
    : `${source}: no acerto crítico com esta arma corpo a corpo${caveat}, role mais ${value}d${sides} (o dado da arma neste ataque) e some ao dano.`
}

/**
 * A nota do d20 natural num ataque (pág. 196): o 20 sempre acerta e é crítico; com margem maior
 * (Crítico Aprimorado), o 19 (ou o 18) só é crítico se acertar — acertar automático é só o 20.
 */
export function critNote(threshold: number, source?: string): string {
  if (threshold >= 20) return '20 natural: acerta e é crítico — role os dados de dano duas vezes. 1 natural: erra (pág. 196).'
  const range = threshold === 19 ? '19 ou 20' : `${threshold} a 20`
  const from = source ? ` (${source})` : ''
  return `${range} natural: crítico se acertar${from} — role os dados de dano duas vezes; só o 20 acerta automaticamente. 1 natural: erra (pág. 196).`
}
