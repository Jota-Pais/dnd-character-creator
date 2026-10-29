/**
 * Tipos do motor de dados. O motor só sabe rolar e somar: o que é crítico, vantagem ou teste
 * contra a morte é regra de cada sistema, montada em cima destes tipos. Tudo aqui é JSON puro,
 * para o resultado ir direto para o histórico e, um dia, para outro jogador.
 */

/** Manter só os `count` maiores (`highest`) ou menores (`lowest`) dados do termo. */
export type KeepRule = {
  mode: 'highest' | 'lowest'
  count: number
}

/** Um grupo de dados iguais: `2d6`, `2d20kh1`. `sign` −1 subtrai o termo (`1d20-1d4`). */
export type DiceTerm = {
  count: number
  sides: number
  sign?: 1 | -1
  keep?: KeepRule
  /** Origem do termo, para a ficha explicar a conta ("Ataque Furtivo"). */
  label?: string
}

/** Valor fixo somado à rolagem, com a origem ("Força", "Proficiência"). */
export type Modifier = {
  value: number
  label?: string
}

export type RollFormula = {
  dice: DiceTerm[]
  modifiers: Modifier[]
}

export type DieResult = {
  value: number
  /** Fora da conta por uma regra de manter (o d20 descartado na vantagem). */
  kept: boolean
  /** Digitado pelo jogador a partir de um dado físico, não sorteado. */
  manual: boolean
}

export type TermResult = {
  term: DiceTerm
  dice: DieResult[]
  /** Soma dos dados mantidos, já com o sinal do termo. */
  subtotal: number
}

/** Resultado de uma rolagem, completo o bastante para refazer a explicação depois. */
export type RollRecord = {
  id: string
  /** Momento da rolagem, em ms desde a época. */
  at: number
  label?: string
  formula: RollFormula
  notation: string
  terms: TermResult[]
  modifierTotal: number
  total: number
}
