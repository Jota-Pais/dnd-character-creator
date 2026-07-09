import { describe, it, expect } from 'vitest'
import {
  getMaxRitualCircle,
  getRitualSlotsCount,
  getAvailableRituals,
  isRitualStepComplete,
} from '../ritualUtils'

describe('ritualUtils', () => {
  it('getMaxRitualCircle correctly maps NEX to max circle', () => {
    expect(getMaxRitualCircle(5)).toBe(1)
    expect(getMaxRitualCircle(24)).toBe(1)
    expect(getMaxRitualCircle(25)).toBe(2)
    expect(getMaxRitualCircle(54)).toBe(2)
    expect(getMaxRitualCircle(55)).toBe(3)
    expect(getMaxRitualCircle(84)).toBe(3)
    expect(getMaxRitualCircle(85)).toBe(4)
    expect(getMaxRitualCircle(99)).toBe(4)
  })

  it('getRitualSlotsCount correctly calculates total slots based on NEX', () => {
    expect(getRitualSlotsCount(5)).toBe(3)
    expect(getRitualSlotsCount(10)).toBe(4)
    expect(getRitualSlotsCount(50)).toBe(12)
    expect(getRitualSlotsCount(99)).toBe(22)
  })

  it('getAvailableRituals returns only rituals up to max circle', () => {
    const all = getAvailableRituals(4)
    expect(all.length).toBeGreaterThan(0)
    
    const circle1 = getAvailableRituals(1)
    expect(circle1.every(r => r.circle <= 1)).toBe(true)
    
    const circle2 = getAvailableRituals(2)
    expect(circle2.every(r => r.circle <= 2)).toBe(true)
    expect(circle2.length).toBeGreaterThan(circle1.length)
  })

  it('isRitualStepComplete returns true for non-occultists', () => {
    expect(isRitualStepComplete(5, 'combatant', [])).toBe(true)
    expect(isRitualStepComplete(5, null, [])).toBe(true)
  })

  it('isRitualStepComplete checks slots for occultist', () => {
    // using real ritual ids from the json is not necessary because the function just checks truthiness of choices
    const choices = ['ritual-1', 'ritual-1', 'ritual-1']
    expect(isRitualStepComplete(5, 'occultist', choices)).toBe(true)
    expect(isRitualStepComplete(5, 'occultist', ['ritual-1', 'ritual-1', null])).toBe(false)
    
    const nex10Choices = [...choices, 'ritual-1']
    expect(isRitualStepComplete(10, 'occultist', nex10Choices)).toBe(true)
    expect(isRitualStepComplete(10, 'occultist', choices)).toBe(false)
  })
})
