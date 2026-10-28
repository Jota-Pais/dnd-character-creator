import { describe, it, expect } from 'vitest'
import {
  getProgressionSlots,
  getProgressionSlotsUpToLevel,
  isProgressionChoicesComplete,
  isSingleChoiceSlot,
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

  describe('isSingleChoiceSlot', () => {
    const slot = (id: string, classId: string, subclassId: string | null = null) =>
      getProgressionSlots(classId, subclassId).find(s => s.id === id)!

    it('slot de 1 escolha é rádio, cumulativo ou não', () => {
      expect(isSingleChoiceSlot(slot('warlock-pact-boon-3', 'warlock'))).toBe(true)
      expect(isSingleChoiceSlot(slot('draconic-ancestor-1', 'sorcerer', 'draconic-bloodline'))).toBe(true)
      expect(isSingleChoiceSlot(slot('totem-warrior-totem-3', 'barbarian', 'totem-warrior'))).toBe(true)
      expect(isSingleChoiceSlot(slot('totem-warrior-aspect-6', 'barbarian', 'totem-warrior'))).toBe(true)
      expect(isSingleChoiceSlot(slot('totem-warrior-attunement-14', 'barbarian', 'totem-warrior'))).toBe(true)
      // A invocação do 5º nível é cumulativa (soma às do 2º), mas é uma só: troca direto.
      expect(slot('warlock-invocations-5', 'warlock').cumulative).toBe(true)
      expect(isSingleChoiceSlot(slot('warlock-invocations-5', 'warlock'))).toBe(true)
    })

    it('de N escolhas, não', () => {
      expect(isSingleChoiceSlot(slot('warlock-invocations-2', 'warlock'))).toBe(false)
      expect(isSingleChoiceSlot(slot('warlock-pact-tome-cantrips-3', 'warlock'))).toBe(false)
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
