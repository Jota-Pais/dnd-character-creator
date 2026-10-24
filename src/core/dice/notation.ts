import type { DiceTerm, Modifier, RollFormula } from './types'

/** Teto de dados por termo e de lados por dado: evita travar a tela com `9999d9999`. */
export const MAX_DICE = 100
export const MAX_SIDES = 1000

const TOKEN = /([+-])?\s*(?:(\d*)\s*d\s*(\d+|%)\s*(?:k\s*([hl])\s*(\d+))?|(\d+))/giy

/**
 * Lê a notação de dados usual: `d20`, `2d6+3`, `1d8 + 1d6 - 1`, `d%` (= d100), `4d6kh3` (manter
 * os 3 maiores), `2d20kl1` (manter o menor). Espaços são ignorados. Erra em qualquer sobra.
 */
export function parseNotation(input: string): RollFormula {
  const text = input.trim()
  if (!text) throw new Error('Notação vazia')
  const formula: RollFormula = { dice: [], modifiers: [] }
  // Cópia por chamada: a regex sticky guarda a posição em `lastIndex`.
  const token = new RegExp(TOKEN)
  let first = true
  while (token.lastIndex < text.length) {
    while (/\s/.test(text[token.lastIndex])) token.lastIndex++
    const start = token.lastIndex
    const m = token.exec(text)
    if (!m || m[0].trim() === '') throw new Error(`Notação inválida perto de "${text.slice(start)}"`)
    const [, op, countRaw, sidesRaw, keepMode, keepRaw, constant] = m
    if (!op && !first) throw new Error(`Falta + ou - antes de "${m[0].trim()}"`)
    const sign = op === '-' ? -1 : 1
    first = false
    if (constant !== undefined) {
      const modifier = { value: sign * Number(constant) }
      validateModifier(modifier)
      formula.modifiers.push(modifier)
      continue
    }
    const count = countRaw === '' ? 1 : Number(countRaw)
    const sides = sidesRaw === '%' ? 100 : Number(sidesRaw)
    const term: DiceTerm = { count, sides }
    if (sign === -1) term.sign = -1
    if (keepMode) term.keep = { mode: keepMode.toLowerCase() === 'h' ? 'highest' : 'lowest', count: Number(keepRaw) }
    validateTerm(term)
    formula.dice.push(term)
  }
  return formula
}

/** Confere um termo vindo do parser ou montado em código. */
export function validateTerm(term: DiceTerm): void {
  if (!Number.isInteger(term.count) || term.count < 1 || term.count > MAX_DICE) {
    throw new Error(`Quantidade de dados inválida: ${term.count} (de 1 a ${MAX_DICE})`)
  }
  if (!Number.isInteger(term.sides) || term.sides < 1 || term.sides > MAX_SIDES) {
    throw new Error(`Dado inválido: d${term.sides} (de d1 a d${MAX_SIDES})`)
  }
  if (term.sign !== undefined && term.sign !== 1 && term.sign !== -1) {
    throw new Error(`Sinal de termo inválido: ${term.sign}`)
  }
  if (term.keep) {
    const { mode, count } = term.keep
    if (mode !== 'highest' && mode !== 'lowest') throw new Error(`Regra de manter inválida: ${mode}`)
    if (!Number.isInteger(count) || count < 1 || count > term.count) {
      throw new Error(`Não dá para manter ${count} de ${term.count} dados`)
    }
  }
}

/** Modificador precisa ser inteiro exato: fração ou `Infinity` quebrariam a notação e o JSON. */
export function validateModifier(modifier: Modifier): void {
  if (!Number.isSafeInteger(modifier.value)) throw new Error(`Modificador inválido: ${modifier.value}`)
}

function formatTerm(term: DiceTerm): string {
  const keep = term.keep ? `k${term.keep.mode === 'highest' ? 'h' : 'l'}${term.keep.count}` : ''
  return `${term.count}d${term.sides}${keep}`
}

/**
 * Escreve a fórmula de volta na notação: `2d6+1d4+3`. Os modificadores entram somados num valor
 * só, no fim, e somem quando dão zero. Sem dados, sobra só o número.
 */
export function formatNotation(formula: RollFormula): string {
  const parts = formula.dice.map((t, i) => {
    const s = formatTerm(t)
    if (t.sign === -1) return `-${s}`
    return i === 0 ? s : `+${s}`
  })
  const mod = formula.modifiers.reduce((sum, m) => sum + m.value, 0)
  if (parts.length === 0) return String(mod)
  if (mod > 0) parts.push(`+${mod}`)
  if (mod < 0) parts.push(`${mod}`)
  return parts.join('')
}
