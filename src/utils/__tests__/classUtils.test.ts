import { describe, it, expect } from 'vitest'
import {
  getHpAtLevel1,
  getHpFormula,
  getAverageHpPerLevel,
  getAverageHpAtLevel,
  getRolledHpAtLevel,
  isActiveCaster,
  isClassStepComplete,
  getExpertiseOptions,
} from '../classUtils'
import type { GameClass } from '../../types/class'
import { EMPTY_CLASS_CHOICES } from '../../types/class'

const baseClass: GameClass = {
  id: 'fighter',
  name: 'Guerreiro',
  description: '',
  primaryAbility: ['STR'],
  hitDie: 10,
  savingThrows: ['STR', 'CON'],
  skillChoices: { count: 2, from: ['athletics', 'perception'] },
  toolProficiencies: { granted: [], choices: [] },
  isCaster: false,
  spellcasting: null,
  features: [],
  subclassLevel: 3,
  subclasses: [],
  hasFightingStyle: true,
  hasExpertise: false,
  startingEquipment: { fixed: [], choices: [], wealthDice: '2d4', wealthMultiplier: 10, wealthUnit: 'po' },
}

const casterClass: GameClass = {
  id: 'cleric',
  name: 'Clérigo',
  description: '',
  primaryAbility: ['WIS'],
  hitDie: 8,
  savingThrows: ['WIS', 'CHA'],
  skillChoices: { count: 2, from: ['history', 'insight'] },
  toolProficiencies: { granted: [], choices: [] },
  isCaster: true,
  spellcasting: {
    ability: 'WIS',
    cantripsKnown: 3,
    type: 'prepared',
    spellsAtLevel1: 0,
    preparedFormula: 'mod. de Sabedoria + nível',
    ritualCasting: true,
    focus: 'holy-symbol',
    castingStartsAtLevel: 1,
  },
  features: [],
  subclassLevel: 1,
  subclasses: [
    { id: 'life-domain', name: 'Domínio da Vida', description: '', features: [], extras: null },
  ],
  hasFightingStyle: false,
  hasExpertise: false,
  startingEquipment: { fixed: [], choices: [], wealthDice: '2d4', wealthMultiplier: 10, wealthUnit: 'po' },
}

const lateCasterClass: GameClass = {
  ...casterClass,
  id: 'paladin',
  spellcasting: {
    ...casterClass.spellcasting!,
    castingStartsAtLevel: 2,
  },
  subclassLevel: 3,
  subclasses: [],
}

const rogueClass: GameClass = {
  id: 'rogue',
  name: 'Ladino',
  description: '',
  primaryAbility: ['DEX'],
  hitDie: 8,
  savingThrows: ['DEX', 'INT'],
  skillChoices: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'perception', 'stealth'] },
  toolProficiencies: { granted: ['thieves-tools'], choices: [] },
  isCaster: false,
  spellcasting: null,
  features: [],
  subclassLevel: 3,
  subclasses: [],
  hasFightingStyle: false,
  hasExpertise: true,
  startingEquipment: { fixed: [], choices: [], wealthDice: '2d4', wealthMultiplier: 10, wealthUnit: 'po' },
}

describe('getHpAtLevel1', () => {
  it('d10 com CON +2 retorna 12', () => expect(getHpAtLevel1(baseClass, 2)).toBe(12))
  it('d10 com CON -1 retorna 9', () => expect(getHpAtLevel1(baseClass, -1)).toBe(9))
  it('d8 com CON 0 retorna 8', () => expect(getHpAtLevel1(casterClass, 0)).toBe(8))
  it('d6 com CON +3 retorna 9', () => {
    const sorcerer = { ...baseClass, hitDie: 6 }
    expect(getHpAtLevel1(sorcerer, 3)).toBe(9)
  })
})

describe('getHpFormula', () => {
  it('retorna fórmula com dado correto para d10', () =>
    expect(getHpFormula(baseClass)).toBe('d10 + mod. de CON'))
  it('retorna fórmula com dado correto para d8', () =>
    expect(getHpFormula(casterClass)).toBe('d8 + mod. de CON'))
})

describe('getAverageHpPerLevel', () => {
  it('d10 retorna 6', () => expect(getAverageHpPerLevel(baseClass)).toBe(6))
  it('d8 retorna 5', () => expect(getAverageHpPerLevel(casterClass)).toBe(5))
  it('d6 retorna 4', () => expect(getAverageHpPerLevel({ ...baseClass, hitDie: 6 })).toBe(4))
  it('d12 retorna 7', () => expect(getAverageHpPerLevel({ ...baseClass, hitDie: 12 })).toBe(7))
})

describe('getAverageHpAtLevel', () => {
  it('nível 1 retorna o HP de nível 1', () =>
    expect(getAverageHpAtLevel(baseClass, 2, 1)).toBe(12))
  it('nível <= 1 não soma níveis extras', () =>
    expect(getAverageHpAtLevel(baseClass, 2, 0)).toBe(12))
  it('d10 CON +2 no nível 5 retorna 44', () =>
    // 12 + (6 + 2) * 4
    expect(getAverageHpAtLevel(baseClass, 2, 5)).toBe(44))
  it('d8 CON 0 no nível 3 retorna 18', () =>
    // 8 + (5 + 0) * 2
    expect(getAverageHpAtLevel(casterClass, 0, 3)).toBe(18))
})

describe('getRolledHpAtLevel', () => {
  it('nível 1 ignora os rolls', () =>
    expect(getRolledHpAtLevel(baseClass, 2, 1, [])).toBe(12))
  it('soma os rolls fornecidos + CON por nível', () =>
    // d10 CON +2, nível 3: 12 + (7+2) + (3+2) = 26
    expect(getRolledHpAtLevel(baseClass, 2, 3, [7, 3])).toBe(26))
  it('usa a média quando o roll está ausente', () =>
    // d10 CON +1, nível 2, roll undefined → média 6: 11 + (6+1) = 18
    expect(getRolledHpAtLevel(baseClass, 1, 2, [])).toBe(18))
})

describe('isActiveCaster', () => {
  it('não conjurador retorna false', () => expect(isActiveCaster(baseClass)).toBe(false))
  it('conjurador nível 1 com castingStartsAtLevel 1 retorna true', () =>
    expect(isActiveCaster(casterClass, 1)).toBe(true))
  it('paladino nível 1 com castingStartsAtLevel 2 retorna false', () =>
    expect(isActiveCaster(lateCasterClass, 1)).toBe(false))
  it('paladino nível 2 com castingStartsAtLevel 2 retorna true', () =>
    expect(isActiveCaster(lateCasterClass, 2)).toBe(true))
})

describe('isClassStepComplete', () => {
  it('retorna false se classe for null', () =>
    expect(isClassStepComplete(null, EMPTY_CLASS_CHOICES)).toBe(false))

  it('retorna false se perícias insuficientes', () =>
    expect(isClassStepComplete(baseClass, { ...EMPTY_CLASS_CHOICES, skills: ['athletics'] })).toBe(false))

  it('retorna false se estilo de luta não escolhido (Guerreiro)', () =>
    expect(isClassStepComplete(baseClass, { ...EMPTY_CLASS_CHOICES, skills: ['athletics', 'perception'] })).toBe(false))

  it('retorna true para Guerreiro com perícias e estilo de luta', () =>
    expect(isClassStepComplete(baseClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['athletics', 'perception'],
      fightingStyle: 'defense',
    })).toBe(true))

  it('retorna false para Clérigo sem subclasse (subclassLevel 1)', () =>
    expect(isClassStepComplete(casterClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['history', 'insight'],
    })).toBe(false))

  it('retorna true para Clérigo com subclasse sem extras', () =>
    expect(isClassStepComplete(casterClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['history', 'insight'],
      subclass: 'life-domain',
    })).toBe(true))

  it('retorna false para Ladino sem expertise', () =>
    expect(isClassStepComplete(rogueClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['acrobatics', 'athletics', 'deception', 'insight'],
    })).toBe(false))

  it('retorna true para Ladino com 4 perícias e 2 expertise', () =>
    expect(isClassStepComplete(rogueClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['acrobatics', 'athletics', 'deception', 'insight'],
      expertiseItems: ['acrobatics', 'thieves-tools'],
    })).toBe(true))
})

describe('getExpertiseOptions', () => {
  it('retorna perícias escolhidas + ferramentas de ladrão', () => {
    const choices = { ...EMPTY_CLASS_CHOICES, skills: ['acrobatics', 'stealth'] }
    const options = getExpertiseOptions(choices)
    expect(options.map(o => o.id)).toContain('acrobatics')
    expect(options.map(o => o.id)).toContain('stealth')
    expect(options.map(o => o.id)).toContain('thieves-tools')
    expect(options).toHaveLength(3)
  })
})
