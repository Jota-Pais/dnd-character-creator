/**
 * Motor de dados do modo de jogo. Agnóstico de sistema: não conhece Ordem nem D&D, só dados.
 *
 * Tudo recebe um `Rng` injetável para os testes serem determinísticos — em produção o padrão é
 * `Math.random`. Nenhuma função aqui tem estado.
 */

/** Fonte de aleatoriedade: devolve um número em [0, 1). */
export type Rng = () => number

const defaultRng: Rng = Math.random

/**
 * PRNG determinístico (mulberry32) para testes e para reproduzir uma rolagem a partir da semente.
 * Não é criptográfico — e não precisa ser.
 */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type RolledDie = {
  sides: number
  value: number
  /** `false` no dado descartado de um pool (o que não foi o melhor/pior). */
  kept: boolean
}

export function rollDie(sides: number, rng: Rng = defaultRng): number {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new Error(`Dado inválido: d${sides}`)
  }
  return Math.floor(rng() * sides) + 1
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool de d20 — o teste do Ordem: N dados, vale o melhor (ou o pior)
// ─────────────────────────────────────────────────────────────────────────────

export type PoolSpec = {
  /** Quantos d20 rolar. Sempre >= 1. */
  dice: number
  /** `worst` cobre atributo 0 e penalidade que derrubou o pool (ver getDicePool). */
  mode: 'best' | 'worst'
  bonus?: number
}

export type PoolResult = {
  /** Todos os dados rolados, com `kept` marcando o que valeu. */
  dice: RolledDie[]
  /** O valor do dado que valeu, sem o bônus. */
  kept: number
  bonus: number
  /** `kept + bonus`. */
  total: number
  mode: 'best' | 'worst'
}

export function rollPool(spec: PoolSpec, rng: Rng = defaultRng): PoolResult {
  const count = Math.max(1, Math.floor(spec.dice))
  const values = Array.from({ length: count }, () => rollDie(20, rng))

  const kept = spec.mode === 'worst' ? Math.min(...values) : Math.max(...values)
  // Só UM dado conta como mantido, mesmo com valores repetidos — senão a UI marcaria dois.
  let alreadyKept = false
  const dice: RolledDie[] = values.map(value => {
    const isKept = !alreadyKept && value === kept
    if (isKept) alreadyKept = true
    return { sides: 20, value, kept: isKept }
  })

  const bonus = spec.bonus ?? 0
  return { dice, kept, bonus, total: kept + bonus, mode: spec.mode }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dano
// ─────────────────────────────────────────────────────────────────────────────

export type DiceTerm = { count: number; sides: number }

/**
 * Dano com os dados separados do bônus — exigência da regra de crítico do Ordem (p. 84):
 * o multiplicador incide **só nos dados da arma**. Bônus numéricos e dados extras (Ataque
 * Furtivo, munição explosiva, maldições) ficam de fora da multiplicação.
 */
export type DamageSpec = {
  /** Dados da arma. Multiplicam no crítico. */
  dice: DiceTerm[]
  /** Soma fixa (Força, modificações, poderes). Nunca multiplica. */
  bonus: number
  /** Dados de fontes extras. Nunca multiplicam. */
  extra?: DiceTerm[]
}

export type DamageResult = {
  /** Dados da arma, já replicados pelo multiplicador quando houver crítico. */
  dice: RolledDie[]
  extra: RolledDie[]
  bonus: number
  total: number
  /** 1 quando não foi crítico. */
  critMultiplier: number
}

function rollTerms(terms: DiceTerm[], rng: Rng, repeat = 1): RolledDie[] {
  const out: RolledDie[] = []
  for (const term of terms) {
    const count = Math.max(0, Math.floor(term.count)) * repeat
    for (let i = 0; i < count; i++) {
      out.push({ sides: term.sides, value: rollDie(term.sides, rng), kept: true })
    }
  }
  return out
}

export function rollDamage(
  spec: DamageSpec,
  opts: { critMultiplier?: number } = {},
  rng: Rng = defaultRng,
): DamageResult {
  const critMultiplier = Math.max(1, Math.floor(opts.critMultiplier ?? 1))
  const dice = rollTerms(spec.dice, rng, critMultiplier)
  const extra = rollTerms(spec.extra ?? [], rng)
  const sum = (list: RolledDie[]) => list.reduce((s, d) => s + d.value, 0)
  // O total nunca é negativo: um bônus de Força negativo não "cura" o alvo.
  const total = Math.max(0, sum(dice) + sum(extra) + spec.bonus)
  return { dice, extra, bonus: spec.bonus, total, critMultiplier }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notação
// ─────────────────────────────────────────────────────────────────────────────

const TERM_RE = /([+-]?)\s*(\d*)d(\d+)|([+-])\s*(\d+)|^(\d+)(?![d\d])/gi

/**
 * Lê uma notação em `DamageSpec`, tolerante a texto no meio — as strings de dano da ficha do
 * Ordem vêm no formato `"3d6+2 balístico +1d8"`, com o tipo de dano por escrito e termos extras
 * grudados no fim.
 *
 * **Todos os dados caem em `dice`.** Quem decide o que é dado da arma e o que é dado extra é o
 * adaptador do sistema, que tem a informação estruturada — a string já perdeu essa distinção.
 */
export function parseDice(notation: string): DamageSpec {
  const dice: DiceTerm[] = []
  let bonus = 0
  TERM_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = TERM_RE.exec(notation)) !== null) {
    const [, diceSign, diceCount, diceSides, flatSign, flatValue, leadingFlat] = match
    if (diceSides !== undefined) {
      const count = diceCount === '' ? 1 : parseInt(diceCount, 10)
      const sides = parseInt(diceSides, 10)
      // Um termo de dado negativo não existe nas fichas; se aparecer, vira bônus negativo do dado
      // médio seria chute — melhor ignorar o sinal e somar os dados.
      if (count > 0 && sides > 0) dice.push({ count, sides })
      void diceSign
    } else if (flatValue !== undefined) {
      bonus += (flatSign === '-' ? -1 : 1) * parseInt(flatValue, 10)
    } else if (leadingFlat !== undefined) {
      bonus += parseInt(leadingFlat, 10)
    }
  }

  return { dice, bonus }
}

/** Atalho para efeitos soltos do livro: `rollNotation('1d6')` no dano de Em Chamas. */
export function rollNotation(
  notation: string,
  opts: { critMultiplier?: number } = {},
  rng: Rng = defaultRng,
): DamageResult {
  return rollDamage(parseDice(notation), opts, rng)
}

/** `{dice:[{count:2,sides:6}], bonus:3}` → `"2d6+3"`. Para o log e os rótulos da UI. */
export function formatDamageSpec(spec: DamageSpec): string {
  const parts = [...spec.dice, ...(spec.extra ?? [])].map(t => `${t.count}d${t.sides}`)
  const base = parts.join('+') || '0'
  if (spec.bonus === 0) return base
  return `${base}${spec.bonus > 0 ? '+' : '−'}${Math.abs(spec.bonus)}`
}
