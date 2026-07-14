import type { OrdemClassId } from './class'

export type TrilhaFeature = {
  nex: number
  name: string
  description: string
  /**
   * Id de um ritual que esta feature ensina ("Você aprende o ritual X"). Concedido
   * automaticamente ao alcançar o NEX da feature; NÃO conta no limite de rituais conhecidos.
   * Ver `getGrantedRituals`.
   */
  grantsRitual?: string
}

export type Trilha = {
  id: string
  name: string
  classId: OrdemClassId
  description: string
  requirement: string | null
  features: TrilhaFeature[]
}
