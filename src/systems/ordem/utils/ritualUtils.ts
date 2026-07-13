import ritualsJson from '../data/rituals.json'
import type { OrdemElement, OrdemRitual, OrdemRitualCircle } from '../types/ritual'
import { getNexIndex, NEX_STEPS } from './progressionUtils'

export const RITUALS = ritualsJson as OrdemRitual[]

/** Custo de conjuração por círculo (Tabela 5.2): 1º = 1 PE, 2º = 3, 3º = 6, 4º = 10. */
export const RITUAL_COST: Record<OrdemRitualCircle, number> = { 1: 1, 2: 3, 3: 6, 4: 10 }

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

/**
 * Rótulo de elemento(s) de um ritual para exibição: se for multi-elemento (ex.: Amaldiçoar Arma)
 * e o jogador já escolheu um elemento, mostra só o escolhido; senão, lista todos.
 */
export function formatRitualElementLabel(
  ritual: OrdemRitual,
  ritualElementChoices: Record<string, OrdemElement> = {}
): string {
  const chosen = ritualElementChoices[ritual.id]
  if (ritual.elements.length > 1 && chosen) return ELEMENT_NAMES[chosen]
  return formatElements(ritual.elements)
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
  // Escolhido pelo Outro Lado: 3 iniciais (NEX 5%) + 1 por NEX ganho acima de 5%.
  return 3 + Math.max(0, getNexIndex(nex) - 1)
}

/**
 * NEX em que o ritual de um slot foi ganho. Os 3 primeiros slots são iniciais (NEX 5%);
 * o slot i>=3 corresponde ao ritual ganho ao alcançar `NEX_STEPS[i-2]`
 * (i=3 → NEX 10%, ..., i=21 → NEX 99%). O teto de progressão é 99% (NEX 100% não existe).
 */
export function getRitualSlotNex(slotIndex: number): number {
  if (slotIndex < 3) return 5
  return NEX_STEPS[slotIndex - 1]
}

export function getAvailableRituals(maxCircle: OrdemRitualCircle): OrdemRitual[] {
  return RITUALS.filter(r => r.circle <= maxCircle)
}

/** Rituais com mais de um elemento exigem que o jogador escolha um ao aprendê-los (ex.: Amaldiçoar Arma). */
export function ritualNeedsElementChoice(ritual: OrdemRitual): boolean {
  return ritual.elements.length > 1
}

export function isRitualStepComplete(
  nex: number,
  charClass: string | null,
  ritualChoices: (string | null)[],
  ritualElementChoices: Record<string, OrdemElement> = {}
): boolean {
  if (charClass !== 'occultist') return true

  const expectedCount = getRitualSlotsCount(nex)
  const active = ritualChoices.slice(0, expectedCount)
  // Todos os slots preenchidos...
  if (active.length !== expectedCount || active.some(id => !id)) return false
  // ...e sem rituais repetidos (não se conhece o mesmo ritual duas vezes).
  if (new Set(active as string[]).size !== expectedCount) return false
  // ...e todo ritual multi-elemento (ex.: Amaldiçoar Arma) precisa ter um elemento escolhido.
  for (const id of active as string[]) {
    const ritual = getRitualById(id)
    if (ritual && ritualNeedsElementChoice(ritual) && !ritualElementChoices[id]) return false
  }
  return true
}
