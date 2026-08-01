import type { OrdemClassId } from './class'
import type { OrdemPowerPrereq } from './prereq'
import type { ParanormalPowerEffects } from './paranormalPower'

/**
 * Como um poder é acionado em jogo. Estruturado a partir da descrição do livro para o modo de
 * jogo poder cobrar o custo e travar a frequência — sem isso o app só saberia exibir o texto.
 */
export type PowerActivation = {
  /** Custo em PE. */
  peCost: number
  /** Tipo de ação consumido. Ausente quando o livro não especifica. */
  actionType?: 'standard' | 'movement' | 'full' | 'free' | 'reaction'
  /** Limite de uso, quando o livro impõe um. */
  frequency?: 'per-scene' | 'per-round'
  /**
   * - `action` — ação própria: clicar gasta o PE e registra
   * - `rider` — modifica outra rolagem; o app cobra o PE, aplicar o efeito é do jogador
   * - `variable` — o custo não é fixo (ex.: Segurar o Gatilho, 2 PE por ataque já feito no turno),
   *   então o app mostra mas não calcula
   */
  kind: 'action' | 'rider' | 'variable'
}

export type ClassPower = {
  id: string
  name: string
  classIds: OrdemClassId[]
  description: string
  /** Presente só nos poderes que se ativam gastando PE. Reduções de custo passivas não têm. */
  activation?: PowerActivation
  /** Texto de exibição do pré-requisito, como no livro (mantido intacto na UI). */
  prerequisite: string | null
  /**
   * Pré-requisitos estruturados, validados pelo motor (`prereqUtils`) — necessários para a
   * Expansão de Conhecimento (poder paranormal que aprende um poder de OUTRA classe
   * "preenchendo os pré-requisitos dele", p. 114) e para o picker da Progressão.
   */
  prereqs?: OrdemPowerPrereq[]
  repeatable: boolean
  /** Reservado p/ efeitos passivos estruturados de poderes de classe (nenhum preenchido hoje). */
  effects?: ParanormalPowerEffects
}
