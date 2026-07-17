import type { ParanormalPower } from '../types/paranormalPower'
import paranormalPowersData from '../data/paranormal-powers.json'

export const PARANORMAL_POWERS: ParanormalPower[] = paranormalPowersData as ParanormalPower[]

export function getParanormalPower(id: string): ParanormalPower | undefined {
  return PARANORMAL_POWERS.find(p => p.id === id)
}
