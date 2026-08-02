import type { AttributeId } from '../types/attribute'
import type { ConditionDicePenalty, OrdemCondition } from '../types/condition'
import conditionsData from '../data/conditions.json'

export const CONDITIONS: OrdemCondition[] = conditionsData as OrdemCondition[]

const BY_ID = new Map(CONDITIONS.map(c => [c.id, c]))

export function getCondition(id: string): OrdemCondition | undefined {
  return BY_ID.get(id)
}

/** As que o jogador liga e desliga na mão — Machucado/Morrendo saem dos PV, não da lista. */
export function getSelectableConditions(): OrdemCondition[] {
  return CONDITIONS.filter(c => !c.derived)
}

/**
 * Expande a cascata: várias condições aplicam outras (Exausto → debilitado, lento, vulnerável;
 * Paralisado → imóvel, indefeso → desprevenido). Sem expandir, os efeitos das implicadas se
 * perderiam. Resolve em profundidade e é à prova de ciclo.
 */
export function expandConditions(ids: string[]): string[] {
  const seen = new Set<string>()
  const queue = [...ids]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (seen.has(id) || !BY_ID.has(id)) continue
    seen.add(id)
    for (const implied of getCondition(id)?.implies ?? []) queue.push(implied)
  }
  return [...seen]
}

/**
 * O que acontece ao receber `id` de novo. Quatro condições escalam em vez de acumular
 * (Abalado → Apavorado, Fraco → Debilitado → Inconsciente…). Devolve o id resultante.
 */
export function escalateCondition(id: string, active: string[]): string {
  const condition = getCondition(id)
  if (!condition?.escalatesTo) return id
  return active.includes(id) ? condition.escalatesTo : id
}

/** Onde a rolagem acontece, para saber quais penalidades incidem. */
export type RollContext =
  | { kind: 'skill'; skillId: string; attribute: AttributeId }
  | { kind: 'attack'; melee: boolean; attribute: AttributeId }

function penaltyApplies(penalty: ConditionDicePenalty, context: RollContext): boolean {
  switch (penalty.scope) {
    case 'all':
      return true
    case 'skills':
      // Ataque É um teste de perícia — "Teste de Ataque. Este é um tipo específico de teste de
      // perícia" (p. 84). Logo, quem penaliza "testes de perícia" (Apavorado) penaliza ataque
      // também. O escopo `attacks` é o inverso: vale SÓ no ataque.
      return true
    case 'attacks':
      return context.kind === 'attack'
    case 'melee-attacks':
      return context.kind === 'attack' && context.melee
    case 'attributes':
      return (penalty.attributes ?? []).includes(context.attribute)
    case 'named-skills':
      return context.kind === 'skill' && (penalty.skills ?? []).includes(context.skillId)
    default:
      return false
  }
}

/**
 * Penalidade em DADOS somada de todas as condições ativas para este teste. Alimenta o
 * `dicePenalty` de `getDicePool`, que subtrai do atributo com piso em 0 dados.
 *
 * As condições entram já expandidas — quem chama não precisa lembrar da cascata.
 */
export function getConditionDicePenalty(activeIds: string[], context: RollContext): number {
  let total = 0
  for (const id of expandConditions(activeIds)) {
    for (const penalty of getCondition(id)?.effects?.dicePenalty ?? []) {
      if (penaltyApplies(penalty, context)) total += penalty.amount
    }
  }
  return total
}

/** Modificador de Defesa somado das condições ativas (negativo penaliza). */
export function getConditionDefense(activeIds: string[]): number {
  return expandConditions(activeIds)
    .reduce((sum, id) => sum + (getCondition(id)?.effects?.defense ?? 0), 0)
}

/** Defesa contra um tipo específico de ataque, hoje só o Caído. */
export function getConditionDefenseVs(activeIds: string[]): { melee: number; ranged: number } {
  return expandConditions(activeIds).reduce(
    (acc, id) => {
      const vs = getCondition(id)?.effects?.defenseVs
      return { melee: acc.melee + (vs?.melee ?? 0), ranged: acc.ranged + (vs?.ranged ?? 0) }
    },
    { melee: 0, ranged: 0 },
  )
}

/** Quanto as condições somam ao custo em PE de habilidades e rituais (Alquebrado +1). */
export function getConditionPeCostDelta(activeIds: string[]): number {
  return expandConditions(activeIds)
    .reduce((sum, id) => sum + (getCondition(id)?.effects?.peCostDelta ?? 0), 0)
}

/** Alguma condição ativa impede agir? Devolve os nomes, para a UI explicar. */
export function getBlockingConditions(activeIds: string[]): string[] {
  return expandConditions(activeIds)
    .filter(id => getCondition(id)?.effects?.cannotAct)
    .map(id => getCondition(id)?.name ?? id)
}
