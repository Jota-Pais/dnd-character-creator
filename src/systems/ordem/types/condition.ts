import type { AttributeId } from './attribute'

/** Agrupamentos do livro; algumas habilidades dão imunidade a uma família inteira. */
export type ConditionFamily = 'fear' | 'mental' | 'paralysis' | 'fatigue' | 'senses'

/**
 * Onde uma penalidade em dados incide.
 *
 * - `all` — todos os testes (Abalado)
 * - `skills` — testes de perícia (Apavorado). **Inclui ataque**: "Teste de Ataque. Este é um tipo
 *   específico de teste de perícia" (p. 84)
 * - `attacks` — SÓ testes de ataque, o escopo mais estreito (Agarrado, Enredado, Ofuscado)
 * - `melee-attacks` — só ataques corpo a corpo (Caído)
 * - `attributes` — testes dos atributos listados (Debilitado, Cego, Fraco)
 * - `named-skills` — só as perícias listadas (Desprevenido em Reflexos, Surdo em Iniciativa)
 */
export type DicePenaltyScope = 'all' | 'skills' | 'attacks' | 'melee-attacks' | 'attributes' | 'named-skills'

export type ConditionDicePenalty = {
  /** Em DADOS: 1 = –O, 2 = –OO. */
  amount: number
  scope: DicePenaltyScope
  attributes?: AttributeId[]
  skills?: string[]
}

/** Só o que o motor aplica sozinho. O resto da condição vive em `description`. */
export type ConditionEffects = {
  dicePenalty?: ConditionDicePenalty[]
  /** Modificador na Defesa (negativo penaliza). */
  defense?: number
  /** Defesa diferente por tipo de ataque recebido — hoje só o Caído (−5 c.a.c., +5 à distância). */
  defenseVs?: { melee?: number; ranged?: number }
  /** Soma ao custo em PE de habilidades e rituais. Só o Alquebrado (+1). */
  peCostDelta?: number
  /** Não pode realizar ações. */
  cannotAct?: boolean
  /** Dano no início do turno, quando é automático (Em Chamas). */
  recurringDamage?: { notation: string; type: string }
  /** Falha automaticamente em testes de Reflexos (Indefeso). */
  autoFailReflexes?: boolean
}

export type OrdemCondition = {
  id: string
  name: string
  /** Texto do glossário (p. 310–311), para a ficha exibir. */
  description: string
  family?: ConditionFamily
  /** Ao receber a condição de novo, vira esta em vez de acumular. */
  escalatesTo?: string
  /** Condições que esta aplica junto. Resolvidas em cascata pelo motor. */
  implies?: string[]
  effects?: ConditionEffects
  /**
   * Ligada e desligada pelo motor a partir do estado (PV), não escolhida pelo jogador.
   * Machucado, Morrendo e Inconsciente entram assim.
   */
  derived?: boolean
}
