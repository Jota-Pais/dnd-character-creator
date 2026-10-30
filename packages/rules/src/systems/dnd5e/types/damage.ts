/**
 * Os 13 tipos de dano do livro (p. 198; `docs/regras-dano-e-morte.md`, seção 5). Os tipos não têm
 * regra própria, mas a resistência, a imunidade e a vulnerabilidade dependem deles (p. 199).
 *
 * Fonte única: o nome e o dano por extenso moram em `data/damage-types.json` e saem por
 * `utils/damageTypes.ts`. O tipo das armas (`DamageType`, equipment.ts), a imunidade das condições
 * (condition.ts) e o ancestral dracônico (dragon-ancestors.json) apontam para estes ids.
 */
export type DamageTypeId =
  | 'acid'
  | 'bludgeoning'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'piercing'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'slashing'
  | 'thunder'

/** Uma linha de `damage-types.json`. */
export type DamageTypeInfo = {
  id: DamageTypeId
  /** O tipo como o livro o lista (p. 198): "Fogo", "Elétrico". */
  name: string
  /**
   * O dano por extenso, na forma do livro: "dano de fogo", mas "dano elétrico" — o adjetivo
   * dispensa o "de". Guardado no dado para ninguém montar "dano de ${tipo}" ("dano de elétrico").
   */
  damageLabel: string
}
