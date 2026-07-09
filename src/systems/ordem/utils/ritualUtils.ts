import ritualsJson from '../data/rituals.json'
import { OrdemRitual, OrdemRitualCircle } from '../types/ritual'
import { getNexIndex } from './progressionUtils'

export const RITUALS = ritualsJson as OrdemRitual[]

export function getRitualById(id: string): OrdemRitual | undefined {
  return RITUALS.find(r => r.id === id)
}

export function getMaxRitualCircle(nex: number): OrdemRitualCircle {
  if (nex >= 85) return 4
  if (nex >= 55) return 3
  if (nex >= 25) return 2
  return 1
}

export function getRitualSlotsCount(nex: number): number {
  // Escolhido pelo Outro Lado: 3 iniciais (NEX 5%) + 1 por NEX ganho
  return 3 + getNexIndex(nex)
}

export function getAvailableRituals(maxCircle: OrdemRitualCircle): OrdemRitual[] {
  return RITUALS.filter(r => r.circle <= maxCircle)
}

export function isRitualStepComplete(
  nex: number,
  charClass: string | null,
  ritualChoices: (string | null)[]
): boolean {
  if (charClass !== 'occultist') return true
  
  const expectedCount = getRitualSlotsCount(nex)
  for (let i = 0; i < expectedCount; i++) {
    if (!ritualChoices[i]) return false
  }
  return true
}
