import type { AbilityScore } from './race'
import type { FeatureEffects } from './effects'

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
  /**
   * O livro deixa escolher o talento de novo ("Você pode escolher esse talento diversas vezes": o
   * Adepto Elemental, p. 167); os outros, só uma vez (p. 167, linhas 14890-14891). A ficha guarda
   * cada talento uma vez só (`getOwnedFeats`, `featSelections` por id), então o repetido trava a
   * etapa Aprimoramentos do mesmo jeito (`getRepeatedFeatSlots`): o campo só muda o motivo
   * (`formatRepeatedFeat`), que não diz que o livro proíbe.
   */
  repeatable?: true
  /** Efeitos que a ficha aplica sozinha (ver `sheetEffects`). Ausente = só descritivo. */
  effects?: FeatureEffects
}
