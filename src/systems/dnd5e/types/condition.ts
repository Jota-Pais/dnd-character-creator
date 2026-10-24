import type { AbilityScore } from './race'

/**
 * Condições do Apêndice A (PHB 2014, págs. 291-293), digitalizadas em `docs/regras-condicoes.md`.
 * Vivem no ESTADO DE JOGO, nunca na ficha: a ficha não muda, os números com a condição aplicada
 * são derivados na hora (`sheetEffects.ts → getActiveConditionEffects`).
 *
 * Classificação de cada efeito (`scope`, seção 6.3 do doc):
 * - `sheet` — INCONDICIONAL: entra no número ou no modo da jogada ("Deslocamento 0 (Agarrado)");
 * - `gameState` — INCONDICIONAL: mexe no estado (encerra concentração, sem ações, morte);
 * - `notice` — CONDICIONAL ou sobre a jogada de OUTRA criatura: vira linha/aviso com `text`,
 *   nunca altera número (a mesma regra de ouro de `types/effects.ts`).
 */

/** As 14 condições do livro. A exaustão fica à parte: é medida em níveis, não "tem ou não tem". */
export type ConditionId =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious'

/** Nível de exaustão: 0 = sem exaustão; 6 = morte (pág. 292). */
export type ExhaustionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Jogadas d20 que uma condição alcança. Iniciativa e passivo são testes de habilidade (págs. 177, 179). */
export type RollCategory = 'attack' | 'abilityCheck' | 'save'

export type AdvantageMode = 'advantage' | 'disadvantage'

/** Modo final de uma jogada, depois de vantagem e desvantagem se anularem (pág. 175). */
export type RollMode = 'normal' | AdvantageMode

/** Efeito condicional: a condição da mesa (`when`, curta) e a linha mostrada na UI (`text`). */
type Conditional = { scope: 'notice'; when: string; text: string }

/** Vantagem/desvantagem nas jogadas da própria criatura. Sem `abilities` = todos os atributos. */
export type RollModeEffect = { kind: 'rollMode'; rolls: RollCategory[]; abilities?: AbilityScore[]; mode: AdvantageMode }
  & ({ scope: 'sheet' } | Conditional)

/** Falha automática. Incondicional nos TR de FOR/DES; condicional em "teste que requeira a visão". */
export type AutoFailEffect = { kind: 'autoFail'; roll: Exclude<RollCategory, 'attack'>; abilities?: AbilityScore[] }
  & ({ scope: 'sheet' } | Conditional)

/**
 * Deslocamento: `zero` (Agarrado, Impedido, "não pode se mover", Exaustão 5) prevalece sobre
 * `half` (Exaustão 2). `ignoreBonuses`: "não pode se beneficiar de qualquer bônus em seu
 * deslocamento" (Agarrado, Impedido).
 */
export type SpeedEffect = { kind: 'speed'; op: 'zero' | 'half'; ignoreBonuses?: boolean; scope: 'sheet' }

/** PV máximo pela metade, arredondado para baixo (Exaustão 4; pág. 7). */
export type HpMaxEffect = { kind: 'hpMax'; op: 'half'; scope: 'sheet' }

/** Resistência a todos os tipos de dano (Petrificado). */
export type DamageResistanceEffect = { kind: 'damageResistance'; types: 'all'; scope: 'sheet' }

/** Efeitos que mexem no estado de jogo, sem número. */
export type StateEffect = {
  kind: 'noActions' | 'noReactions' | 'cannotSpeak' | 'endsConcentration' | 'death'
  scope: 'gameState'
  /** Página da regra quando ela não está no Apêndice A (concentração: pág. 205). */
  page?: number
}

/**
 * Suspende outras condições enquanto esta durar: elas continuam gravadas, mas sem efeito, e voltam
 * a valer quando esta sai (Petrificado → Envenenado já presente, pág. 293; `regras-condicoes.md`, 6.3).
 */
export type SuspendEffect = { kind: 'suspends'; conditions: ConditionId[]; scope: 'gameState' }

/** Jogadas de OUTRAS criaturas contra você (vantagem, crítico a 1,5 m): o jogador avisa o Mestre. */
export type AgainstYouEffect = { kind: 'againstYou'; scope: 'notice'; text: string }

/** Aviso narrativo ou situacional (fala hesitante, peso ×10, só rastejar). */
export type NoticeEffect = { kind: 'notice'; scope: 'notice'; text: string; page?: number }

export type ConditionEffect =
  | RollModeEffect
  | AutoFailEffect
  | SpeedEffect
  | HpMaxEffect
  | DamageResistanceEffect
  | StateEffect
  | SuspendEffect
  | AgainstYouEffect
  | NoticeEffect

/**
 * O que acontece UMA VEZ, ao aplicar a condição, e sobrevive ao fim dela (seção 6.4 do doc):
 * Inconsciente faz cair (Caído é gravado e só sai ao levantar) e largar o que segura.
 */
export type ConditionOnApply = {
  addConditions?: ConditionId[]
  dropHeldItems?: boolean
}

export type Condition = {
  id: ConditionId
  /** Rótulo pt-BR do livro. */
  name: string
  page: number
  /** Tópicos do livro para o card/tooltip, em pt-BR. */
  text: string[]
  /**
   * Condições DERIVADAS, que existem enquanto esta durar e somem junto (Paralisado ⇒
   * Incapacitado). Não são gravadas no estado de jogo.
   */
  implies: ConditionId[]
  onApply?: ConditionOnApply
  effects: ConditionEffect[]
}

export type ExhaustionRow = {
  level: Exclude<ExhaustionLevel, 0>
  text: string
  effects: ConditionEffect[]
}

export type Exhaustion = {
  id: 'exhaustion'
  name: string
  page: number
  text: string[]
  maxLevel: 6
  /** Nível N aplica os efeitos dos níveis 1..N (pág. 292). */
  cumulative: true
  /** Descanso longo reduz 1 nível, "contanto que" tenha comido e bebido. */
  longRest: { reduceBy: 1; requires: string }
  levels: ExhaustionRow[]
}

export type ConditionCatalog = {
  conditions: Condition[]
  exhaustion: Exhaustion
}
