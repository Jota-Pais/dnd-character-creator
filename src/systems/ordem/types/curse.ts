import type { OrdemAttributes } from './character'
import type { OrdemElement } from './ritual'

/**
 * Elemento de uma maldição (pág. 145-148). 'varies' = o elemento é escolhido ao aplicar
 * (Proteção Elemental: o acessório conta como item do elemento contra o qual protege).
 */
export type CurseElement = Exclude<OrdemElement, 'fear'> | 'varies'

/** A que tipo de item uma maldição pode ser aplicada. */
export type CurseTarget =
  | 'weapon-any'      // qualquer arma
  | 'weapon-melee'    // só corpo a corpo (Empuxo)
  | 'protection-any'  // qualquer proteção
  | 'accessory-wear'  // utensílios e vestuários (o livro exclui kits)

export type OrdemCurse = {
  id: string
  name: string
  element: CurseElement
  target: CurseTarget
  /** Texto integral do efeito (livro, pág. 145-148), incluindo custos de ativação em PE/ações. */
  effect: string
  /** Bônus incondicional de Defesa (Repulsora/Cinética/Letárgica +2, Defesa +5). */
  defenseBonus?: number
  /** Resistência a dano concedida pela maldição, quando difere por peso da proteção (Cinética: 2 leve / 5 pesada). */
  damageResistanceByWeight?: { light: number; heavy: number }
  /**
   * Bônus incondicional de atributo (Carisma, Sagacidade, Destreza, Disposição, Pujança).
   * `noPe`: o aumento de Presença NÃO fornece PE adicionais (ressalva do livro pro Carisma).
   */
  attributeBonus?: { attribute: keyof OrdemAttributes; value: number; noPe?: boolean }
  /** PV fixos adicionais (Vitalidade +15). */
  hpBonus?: number
  /** PE fixos adicionais (Esforço Adicional +5). */
  peBonus?: number
  /** Dano extra por acerto com tipo próprio, ex.: "1d8 Sangue" (Lancinante) / "1d8 Morte" (Erosiva). */
  extraDamage?: string
  /** Predadora: duplica a margem de ameaça (aplicada ANTES de aumentos fixos) e sobe o alcance. */
  doublesThreat?: boolean
  rangeIncrease?: boolean
  /** Escolha exigida ao aplicar: 'element' (Antielemento, Proteção Elemental) ou 'ritual1' (Conjuração). */
  choice?: 'element' | 'ritual1'
}
