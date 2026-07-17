import type { AttributeId } from './attribute'
import type { ParanormalElement } from './ritual'

/**
 * Um pré-requisito atômico de poder (de classe ou paranormal). A lista `prereqs` de um poder
 * é um AND de todos os itens; alternativas ("treinado em Luta ou Pontaria") ficam dentro de
 * um único item via `anyOf`.
 *
 * Convenções de validação (ver `prereqUtils`):
 * - `attribute` compara com os atributos EFETIVOS (base + Aumentos de Atributo), como o
 *   pré-requisito de multiclasse do dnd5e — é assim que mesas montam personagens de NEX alto.
 * - `nex` compara com o NEX DE AQUISIÇÃO da instância (o NEX do slot em que o poder foi
 *   escolhido), não com o NEX final da ficha.
 * - `elementCount` ("Morte 2") exige já possuir N poderes paranormais daquele elemento
 *   ANTES da instância, em ordem cronológica de aquisição (p. 116).
 */
export type OrdemPowerPrereq =
  | { kind: 'attribute'; attribute: AttributeId; min: number }
  | { kind: 'nex'; min: number }
  | { kind: 'trainedSkill'; anyOf: string[] }
  | { kind: 'classPower'; powerId: string; sameElementParam?: boolean }
  | { kind: 'elementCount'; element: ParanormalElement; count: number }
