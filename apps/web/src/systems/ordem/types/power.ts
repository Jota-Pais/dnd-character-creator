import type { OrdemClassId } from './class'
import type { OrdemPowerPrereq } from './prereq'
import type { ParanormalPowerEffects } from './paranormalPower'

export type ClassPower = {
  id: string
  name: string
  classIds: OrdemClassId[]
  description: string
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
