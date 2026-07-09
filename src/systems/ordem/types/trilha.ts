import type { OrdemClassId } from './class'

export type TrilhaFeature = {
  nex: number
  name: string
  description: string
}

export type Trilha = {
  id: string
  name: string
  classId: OrdemClassId
  description: string
  requirement: string | null
  features: TrilhaFeature[]
}
