import type { ClassPower } from '../types/power'
import type { OrdemClassId } from '../types/class'
import powersData from '../data/class-powers.json'

export const CLASS_POWERS: ClassPower[] = powersData as ClassPower[]

export function getPower(id: string): ClassPower | undefined {
  return CLASS_POWERS.find(p => p.id === id)
}

export function getPowersByClass(classId: OrdemClassId): ClassPower[] {
  return CLASS_POWERS.filter(p => p.classIds.includes(classId))
}
