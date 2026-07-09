import ritualsJson from '../data/rituals.json'
import type { OrdemElement, OrdemRitual, OrdemRitualCircle } from '../types/ritual'
import { getNexIndex, NEX_STEPS } from './progressionUtils'

export const RITUALS = ritualsJson as OrdemRitual[]

export const ELEMENT_NAMES: Record<OrdemElement, string> = {
  blood: 'Sangue',
  death: 'Morte',
  energy: 'Energia',
  knowledge: 'Conhecimento',
  fear: 'Medo',
}

export function formatElements(elements: OrdemElement[]): string {
  return elements.map(e => ELEMENT_NAMES[e]).join('/')
}

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

/**
 * NEX em que o ritual de um slot foi ganho. Os 3 primeiros slots são iniciais (NEX 5%);
 * o slot i>=3 corresponde ao ritual ganho ao alcançar `NEX_STEPS[i-2]`
 * (i=3 → NEX 10%, ..., i=21 → NEX 99%). O teto de progressão é 99% (NEX 100% não existe).
 */
export function getRitualSlotNex(slotIndex: number): number {
  if (slotIndex < 3) return 5
  return NEX_STEPS[slotIndex - 2]
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
  const active = ritualChoices.slice(0, expectedCount)
  // Todos os slots preenchidos...
  if (active.length !== expectedCount || active.some(id => !id)) return false
  // ...e sem rituais repetidos (não se conhece o mesmo ritual duas vezes).
  return new Set(active as string[]).size === expectedCount
}
