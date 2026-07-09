import type { AbilityScore } from './race'

/**
 * Talento (PHB 2014, cap. 6). Alguns talentos são "meio-talentos" e concedem
 * +1 num atributo — modelado em `abilityIncrease` (lista de atributos elegíveis,
 * dentre os quais o jogador escolhe um para receber +1). Ausente = sem bônus.
 */
export type Feat = {
  id: string
  name: string
  prerequisite: string | null
  description: string
  abilityIncrease?: AbilityScore[]
}
