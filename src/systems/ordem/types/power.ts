import type { OrdemClassId } from './class'

export type ClassPower = {
  id: string
  name: string
  classIds: OrdemClassId[]
  description: string
  prerequisite: string | null
  repeatable: boolean
}
