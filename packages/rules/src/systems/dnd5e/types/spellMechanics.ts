import type { DamageTypeId } from './damage'
import type { LevelStep } from './effects'
import type { AbilityScore } from './race'

/**
 * O que cada magia faz em número (Fase 2, onda `magias-base`; o processo em
 * `docs/magias/mecanica-magias.md`): como resolve (ataque, TR do alvo), o dano por parte, a cura, os
 * PV temporários, as instâncias (feixes, raios, dardos), os alvos e a área. Mora em
 * `data/spell-mechanics.json`, separado de `spells.json`, porque o `parse-spells` regenera o
 * spells.json a partir de `docs/magias` e apagaria o que estivesse lá.
 *
 * Nenhum campo é chutado: o script `scripts/draft-spell-mechanics.mjs` só propõe, com a evidência, e
 * cada entrada passa pela revisão contra o extrato do livro (`bookLines`). O que o texto não deixa
 * claro, o que depende do Mestre e o que o esquema ainda não diz fica `textOnly`, com o motivo: o
 * guia mostra só o texto da magia.
 */

/**
 * Como a magia resolve. Só a jogada de ataque tem acerto crítico, que dobra os dados (pág. 198); no
 * TR, `onSuccess` é o que o sucesso faz: metade do dano, nenhum dano, ou outra coisa que o texto diz.
 */
export type SpellResolution =
  | { kind: 'attack'; range: 'melee' | 'ranged' }
  | { kind: 'save'; ability: AbilityScore; onSuccess: 'half' | 'none' | 'other' }
  | { kind: 'auto' }
  | { kind: 'none' }

/**
 * O que cresce. `perSlotAbove`: por nível de espaço acima do da magia — `count` dados a mais, `flat`
 * a mais, a cada `every` níveis ("a cada dois níveis acima", every 2; sem ele, a cada nível).
 * `byCharacterLevel`: o total de dados em degraus de nível de PERSONAGEM, o dos truques (1º, 5º,
 * 11º e 17º; decisão de 2026-10-29, `docs/regras-conjuracao.md`, seção 2).
 */
export type LevelScaled = {
  perSlotAbove?: { count?: number; flat?: number; every?: number }
  byCharacterLevel?: LevelStep[]
}

/**
 * Jogadas separadas da mesma magia: os feixes da Rajada Mística (pelo nível de PERSONAGEM, como o
 * truque), os dardos dos Mísseis Mágicos e os raios do Raio Ardente (pelo espaço).
 */
export type SpellInstances = {
  count: number
  noun: 'feixe' | 'raio' | 'dardo' | 'alvo'
  perSlotAbove?: number
  byCharacterLevel?: LevelStep[]
}

/**
 * Uma parte do dano: os dados, o bônus fixo ou o modificador de conjuração, e o tipo — um id de
 * `damage-types.json`, ou a escolha entre alguns. `when` é a situação em que só esta parte vale,
 * com as palavras do livro.
 */
export type SpellDamagePart = LevelScaled & {
  count: number
  sides: number
  bonus?: number | 'spellcastingModifier'
  type: DamageTypeId | { choose: DamageTypeId[] }
  when?: string
}

/** Cura, PV temporários ou aumento de PV máximo: dados, valor fixo ou os dois, com o modificador. */
export type SpellAmountPart = LevelScaled & {
  count?: number
  sides?: number
  flat?: number
  bonus?: number | 'spellcastingModifier'
}

/** Os lotes do desenho: os truques e as magias de cada nível (4 e 5, 6 a 9 juntos). */
export type SpellMechanicsBatch = 'T' | '1' | '2' | '3' | '4-5' | '6-9'

export type SpellMechanics = {
  /** O id de `spells.json`. */
  id: string
  batch: SpellMechanicsBatch
  /** As linhas do extrato do livro, do nome da magia ao fim do texto: a revisão foi feita contra elas. */
  bookLines: [number, number]
  /**
   * `reviewed`: tudo o que a magia faz em número está declarado e conferido — a de utilidade, sem
   * número nenhum, também (resolução `none`). `textOnly`: há número ou efeito que o esquema ainda
   * não diz, ou que depende do Mestre; o motivo é obrigatório.
   */
  status: 'reviewed' | 'textOnly'
  reason?: string
  resolution: SpellResolution
  instances?: SpellInstances
  damage?: SpellDamagePart[]
  heal?: SpellAmountPart
  /** Vitalidade Falsa, Armadura de Agathys. */
  tempHp?: SpellAmountPart
  /** Ajuda: o PV máximo e o atual sobem juntos. */
  maxHpIncrease?: SpellAmountPart
  /** Até quantas criaturas a magia alcança (o Espirro Ácido, dois; a Bênção, três e mais um por nível acima). */
  targets?: { count: number; perSlotAbove?: number }
  area?: { shape: 'sphere' | 'cube' | 'cone' | 'line' | 'cylinder' | 'radius'; text: string }
  /** O efeito que a magia marca em quem a recebe: o id em `data/active-effects.json` ('spell:bless'). */
  targetEffect?: string
}
