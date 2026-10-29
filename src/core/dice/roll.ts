import { createId } from '../utils/id'
import { formatNotation, parseNotation, validateModifier, validateTerm } from './notation'
import { cryptoRoller, type DieRoller } from './rng'
import type { DiceTerm, DieResult, RollFormula, RollRecord, TermResult } from './types'

export type RollOptions = {
  roller?: DieRoller
  /**
   * Faces de dados físicos, por termo, na ordem da fórmula. `manual[i]` substitui o sorteio do
   * termo i e precisa trazer um valor por dado; termo sem entrada (ou `undefined`) é sorteado.
   * Entrada sem termo correspondente é erro, para nenhum dado digitado sumir em silêncio.
   */
  manual?: (number[] | undefined)[]
  label?: string
  id?: string
  at?: number
}

/** Cópia profunda: o registro não pode mudar se quem chamou mexer na fórmula depois. */
function cloneFormula(f: RollFormula): RollFormula {
  return {
    dice: f.dice.map(t => ({ ...t, ...(t.keep ? { keep: { ...t.keep } } : {}) })),
    modifiers: f.modifiers.map(m => ({ ...m })),
  }
}

/** Marca como mantidos os `keep.count` maiores/menores; no empate, fica o que veio primeiro. */
function applyKeep(values: number[], term: DiceTerm): boolean[] {
  if (!term.keep) return values.map(() => true)
  const { mode, count } = term.keep
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => (mode === 'highest' ? b.value - a.value : a.value - b.value) || a.index - b.index)
  const kept = new Set(order.slice(0, count).map(o => o.index))
  return values.map((_, i) => kept.has(i))
}

function manualFaces(term: DiceTerm, manual: number[]): number[] {
  if (manual.length !== term.count) {
    throw new Error(`Informe ${term.count} valor(es) para ${term.count}d${term.sides}`)
  }
  // Laço por índice, e não `map`: um array esparso esconderia o dado que faltou digitar.
  const faces: number[] = []
  for (let i = 0; i < term.count; i++) {
    const v = manual[i]
    if (!Number.isInteger(v) || v < 1 || v > term.sides) throw new Error(`${v} não é uma face de d${term.sides}`)
    faces.push(v)
  }
  return faces
}

function rollTerm(term: DiceTerm, roller: DieRoller, manual: number[] | undefined): TermResult {
  const values = manual ? manualFaces(term, manual) : Array.from({ length: term.count }, () => roller(term.sides))
  const kept = applyKeep(values, term)
  const dice: DieResult[] = values.map((value, i) => ({ value, kept: kept[i], manual: !!manual }))
  const sum = dice.reduce((s, d) => (d.kept ? s + d.value : s), 0)
  return { term, dice, subtotal: (term.sign ?? 1) * sum }
}

/**
 * Rola uma fórmula (objeto ou notação) e devolve o registro completo. Função pura dado o
 * `roller`, o `id` e o `at`: os testes fixam os três.
 */
export function roll(formula: RollFormula | string, options: RollOptions = {}): RollRecord {
  const f = typeof formula === 'string' ? parseNotation(formula) : cloneFormula(formula)
  f.dice.forEach(t => validateTerm(t))
  f.modifiers.forEach(validateModifier)
  const manual = options.manual ?? []
  if (manual.length > f.dice.length && manual.slice(f.dice.length).some(m => m !== undefined)) {
    throw new Error(`Faces manuais para ${manual.length} termos, mas a rolagem tem ${f.dice.length}`)
  }
  const roller = options.roller ?? cryptoRoller
  const terms = f.dice.map((t, i) => rollTerm(t, roller, manual[i]))
  const modifierTotal = f.modifiers.reduce((sum, m) => sum + m.value, 0)
  const record: RollRecord = {
    id: options.id ?? createId('roll'),
    at: options.at ?? Date.now(),
    formula: f,
    notation: formatNotation(f),
    terms,
    modifierTotal,
    total: terms.reduce((sum, t) => sum + t.subtotal, 0) + modifierTotal,
  }
  if (options.label !== undefined) record.label = options.label
  return record
}

/**
 * "Rolar os dados duas vezes": cada termo aparece repetido logo depois de si mesmo, com a
 * mesma origem, e os modificadores ficam intactos. Repetir em vez de dobrar a quantidade mantém
 * cada termo dentro do teto e deixa a animação mostrar as duas levas. Termo com regra de manter
 * não tem segunda leva óbvia, então é erro: quem chama decide o que fazer com ele.
 */
export function doubleDice(formula: RollFormula): RollFormula {
  const f = cloneFormula(formula)
  return {
    dice: f.dice.flatMap(t => {
      if (t.keep) throw new Error(`Não dá para dobrar ${t.count}d${t.sides} com regra de manter`)
      return [t, { ...t }]
    }),
    modifiers: f.modifiers,
  }
}

/** Faces mantidas de um termo, na ordem em que saíram (o "natural" do d20 é `keptFaces(t)[0]`). */
export function keptFaces(term: TermResult): number[] {
  return term.dice.filter(d => d.kept).map(d => d.value)
}
