import { describe, it, expect } from 'vitest'
import {
  getProgressionSlots,
  getProgressionSlotsUpToLevel,
  isProgressionChoicesComplete
} from '../progressionChoiceUtils'
import type { ClassChoiceSelections } from '../../types/character'
import { EMPTY_CLASS_CHOICES } from '../../types/class'

describe('progressionChoiceUtils', () => {
  describe('getProgressionSlots', () => {
    it('returns empty array if no class/subclass provided', () => {
      expect(getProgressionSlots(null, null)).toEqual([])
    })

    it('returns sorted slots for a class', () => {
      const slots = getProgressionSlots('bard', null)
      expect(slots.length).toBeGreaterThan(0)
      expect(slots[0].level).toBeLessThanOrEqual(slots[slots.length - 1].level)
    })

    it('returns slots for both class and subclass', () => {
      const classSlots = getProgressionSlots('bard', null)
      const bothSlots = getProgressionSlots('bard', 'college-of-lore')
      expect(bothSlots.length).toBeGreaterThan(classSlots.length)
    })
  })

  describe('getProgressionSlotsUpToLevel', () => {
    it('filters slots by level', () => {
      const allSlots = getProgressionSlots('bard', null)
      const earlySlots = getProgressionSlotsUpToLevel('bard', null, 12)
      expect(earlySlots.length).toBeLessThan(allSlots.length)
      expect(earlySlots.every(s => s.level <= 12)).toBe(true)
    })
  })

  describe('isProgressionChoicesComplete', () => {
    it('returns false if no classId', () => {
      expect(isProgressionChoicesComplete(null, null, EMPTY_CLASS_CHOICES, 10)).toBe(false)
    })

    it('returns true if no slots needed', () => {
      expect(isProgressionChoicesComplete('cleric', 'life-domain', EMPTY_CLASS_CHOICES, 1)).toBe(true)
    })

    it('validates progression choices completion', () => {
      const choices: ClassChoiceSelections = {
        ...EMPTY_CLASS_CHOICES,
        progressionChoices: {
          'battle-master-maneuvers-3': ['aparar', 'contra-atacar', 'derrubar']
        }
      }
      // Nível 3 requer as 3 manobras, escolhemos 3.
      expect(isProgressionChoicesComplete('fighter', 'battle-master', choices, 3)).toBe(true)
      
      // Nível 7 requer as manobras do nv3 e as manobras do nv7 (2 manobras)
      expect(isProgressionChoicesComplete('fighter', 'battle-master', choices, 7)).toBe(false)
      
      choices.progressionChoices['battle-master-maneuvers-7'] = ['ataque-de-precisao', 'inspirar']
      expect(isProgressionChoicesComplete('fighter', 'battle-master', choices, 7)).toBe(true)
    })
  })
})
