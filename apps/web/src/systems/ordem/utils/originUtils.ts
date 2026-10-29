import type { Origin } from '../types/origin'
import originsData from '../data/origins.json'

export const ORIGINS: Origin[] = originsData as Origin[]

export function getOrigin(id: string): Origin | undefined {
  return ORIGINS.find(o => o.id === id)
}
