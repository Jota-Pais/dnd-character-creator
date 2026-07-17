import type { ParanormalPower } from '../types/paranormalPower'
import type { ParanormalSourceKey } from '../types/character'
import type { ParanormalElement } from '../types/ritual'
import { PARANORMAL_ELEMENTS } from '../types/ritual'
import paranormalPowersData from '../data/paranormal-powers.json'

export const PARANORMAL_POWERS: ParanormalPower[] = paranormalPowersData as ParanormalPower[]

export function getParanormalPower(id: string): ParanormalPower | undefined {
  return PARANORMAL_POWERS.find(p => p.id === id)
}

export function isParanormalElement(value: unknown): value is ParanormalElement {
  return typeof value === 'string' && (PARANORMAL_ELEMENTS as string[]).includes(value)
}

export function isParanormalSourceKey(value: string): value is ParanormalSourceKey {
  return value === 'origin' || value === 'versatility' || /^slot-\d+$/.test(value)
}
