/** A que tipo de item uma modificação pode ser aplicada (Tabelas 3.5/3.7/3.9). */
export type ModTarget =
  | 'weapon-any'            // qualquer arma (ex.: Tática)
  | 'weapon-melee-ranged'   // armas corpo a corpo / arremesso / disparo
  | 'weapon-firearm'        // armas de fogo
  | 'ammunition'            // munições
  | 'protection-any'        // qualquer proteção
  | 'protection-heavy'      // só proteção pesada
  | 'protection-light'      // só proteção leve
  | 'accessory'             // acessórios (kit, utensílio, vestimenta)

export type OrdemModification = {
  id: string
  name: string
  /** Texto do efeito (livro). */
  effect: string
  target: ModTarget
  /** Variação de espaços ocupados (ex.: Discreta −1, Reforçada +1). */
  spaceDelta?: number
  /** Bônus de Defesa (ex.: Reforçada +2), aplicado a proteções. */
  defenseBonus?: number
  /** Modificações que não podem coexistir na mesma peça (ex.: Reforçada × Discreta). */
  excludes?: string[]
}
