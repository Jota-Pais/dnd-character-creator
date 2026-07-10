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
  /** Bônus no teste de ataque da arma (Certeira/Alongada +2). */
  attackBonus?: number
  /** Bônus fixo na rolagem de dano (Cruel +2). */
  damageBonus?: number
  /** Dados de dano adicionais do mesmo tipo (Calibre Grosso +1). */
  damageDice?: number
  /** Amplia a margem de ameaça: reduz o início da faixa de crítico em N (Perigosa/Mira Laser +2). */
  threatMargin?: number
  /** Modificações que não podem coexistir na mesma peça (ex.: Reforçada × Discreta). */
  excludes?: string[]
}
