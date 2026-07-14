import { describe, it, expect } from 'vitest'
import {
  getCasterType,
  getSpellSlots,
  getWarlockPactSlots,
  getMaxSpellLevel,
  getCantripsKnownCount,
  getSpellsKnownCount,
  getWizardSpellbookSize,
  getSpellSaveDC,
  getSpellAttackBonus,
  getMaxPreparedSpells,
  isSpellStepComplete,
} from '../spellUtils'
import type { GameClass, ClassSpellcasting } from '../../types/class'
import type { SpellChoices } from '../../types/spell'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const clericCasting: ClassSpellcasting = {
  ability: 'WIS',
  cantripsKnown: 3,
  type: 'prepared',
  spellsAtLevel1: 0,
  preparedFormula: 'mod. de Sabedoria + nível',
  ritualCasting: true,
  focus: 'holy-symbol',
  castingStartsAtLevel: 1,
}

const paladinCasting: ClassSpellcasting = {
  ability: 'CHA',
  cantripsKnown: 0,
  type: 'prepared',
  spellsAtLevel1: 0,
  preparedFormula: 'metade do nível + mod. de Carisma',
  ritualCasting: false,
  focus: 'holy-symbol',
  castingStartsAtLevel: 2,
}

const wizardCasting: ClassSpellcasting = {
  ability: 'INT',
  cantripsKnown: 3,
  type: 'hybrid',
  spellsAtLevel1: 6,
  preparedFormula: 'mod. de Inteligência + nível',
  ritualCasting: true,
  focus: 'arcane-focus',
  castingStartsAtLevel: 1,
}

const bardCasting: ClassSpellcasting = {
  ability: 'CHA',
  cantripsKnown: 2,
  type: 'known',
  spellsAtLevel1: 4,
  preparedFormula: null,
  ritualCasting: true,
  focus: 'arcane-focus',
  castingStartsAtLevel: 1,
}

const baseClass: GameClass = {
  id: 'fighter',
  name: 'Guerreiro',
  description: '',
  primaryAbility: ['STR'],
  hitDie: 10,
  savingThrows: ['STR', 'CON'],
  skillChoices: { count: 2, from: [] },
  toolProficiencies: { granted: [], choices: [] },
  armorProficiencies: [],
  weaponProficiencies: [],
  casterProgression: 'none',
  multiclassPrereq: { mode: 'any', abilities: ['STR', 'DEX'] },
  multiclassProficiencies: { armor: [], weapons: [], tools: [], skills: null, instruments: 0 },
  isCaster: false,
  spellcasting: null,
  features: [],
  subclassLevel: 3,
  subclasses: [],
  hasFightingStyle: true,
  hasExpertise: false,
  startingEquipment: { fixed: [], choices: [], wealthDice: '2d4', wealthMultiplier: 10, wealthUnit: 'po' },
}

const clericClass: GameClass = { ...baseClass, id: 'cleric', isCaster: true, spellcasting: clericCasting }
const wizardClass: GameClass = { ...baseClass, id: 'wizard', isCaster: true, spellcasting: wizardCasting }
const bardClass: GameClass = { ...baseClass, id: 'bard', isCaster: true, spellcasting: bardCasting }
const paladinClass: GameClass = { ...baseClass, id: 'paladin', isCaster: true, spellcasting: paladinCasting }

const emptyChoices: SpellChoices = { cantrips: [], spells: [] }

// ── Caster type & progression tables ───────────────────────────────────────────

describe('getCasterType', () => {
  it('clérigo é full caster', () => expect(getCasterType('cleric')).toBe('full'))
  it('paladino é half caster', () => expect(getCasterType('paladin')).toBe('half'))
  it('bruxo é warlock', () => expect(getCasterType('warlock')).toBe('warlock'))
  it('guerreiro não é conjurador', () => expect(getCasterType('fighter')).toBeNull())
})

describe('getSpellSlots', () => {
  it('full caster nível 1 tem 2 slots de 1º nível', () =>
    expect(getSpellSlots('wizard', 1)).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]))
  it('full caster nível 5 tem [4,3,2]', () =>
    expect(getSpellSlots('cleric', 5)).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]))
  it('half caster (paladino) nível 1 não tem slots', () =>
    expect(getSpellSlots('paladin', 1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]))
  it('half caster (paladino) nível 5 tem [4,2]', () =>
    expect(getSpellSlots('paladin', 5)).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]))
  it('warlock nível 1 tem 1 slot de 1º nível', () =>
    expect(getSpellSlots('warlock', 1)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]))
  it('warlock nível 3 tem 2 slots de 2º nível', () =>
    expect(getSpellSlots('warlock', 3)).toEqual([0, 2, 0, 0, 0, 0, 0, 0, 0]))
  it('não conjurador retorna 9 zeros', () =>
    expect(getSpellSlots('fighter', 5)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]))
  it('clampeia nível acima de 20', () =>
    expect(getSpellSlots('wizard', 99)).toEqual(getSpellSlots('wizard', 20)))
})

describe('getWarlockPactSlots', () => {
  it('nível 1: 1 slot de nível 1', () =>
    expect(getWarlockPactSlots(1)).toEqual({ slots: 1, slotLevel: 1 }))
  it('nível 11: 3 slots de nível 5', () =>
    expect(getWarlockPactSlots(11)).toEqual({ slots: 3, slotLevel: 5 }))
})

describe('getMaxSpellLevel', () => {
  it('full caster nível 1 acessa magias de 1º nível', () =>
    expect(getMaxSpellLevel('wizard', 1)).toBe(1))
  it('full caster nível 5 acessa magias de 3º nível', () =>
    expect(getMaxSpellLevel('cleric', 5)).toBe(3))
  it('paladino nível 1 não acessa magias', () =>
    expect(getMaxSpellLevel('paladin', 1)).toBe(0))
  it('warlock nível 3 acessa magias de 2º nível', () =>
    expect(getMaxSpellLevel('warlock', 3)).toBe(2))
})

describe('getCantripsKnownCount', () => {
  it('mago nível 1 conhece 3 truques', () =>
    expect(getCantripsKnownCount('wizard', 1)).toBe(3))
  it('mago nível 10 conhece 5 truques', () =>
    expect(getCantripsKnownCount('wizard', 10)).toBe(5))
  it('feiticeiro nível 1 conhece 4 truques', () =>
    expect(getCantripsKnownCount('sorcerer', 1)).toBe(4))
  it('classe sem truques retorna 0', () =>
    expect(getCantripsKnownCount('paladin', 5)).toBe(0))
})

describe('getSpellsKnownCount', () => {
  it('bardo nível 1 conhece 4 magias', () =>
    expect(getSpellsKnownCount('bard', 1)).toBe(4))
  it('bardo nível 10 conhece 14 magias', () =>
    expect(getSpellsKnownCount('bard', 10)).toBe(14))
  it('patrulheiro nível 1 conhece 0 magias', () =>
    expect(getSpellsKnownCount('ranger', 1)).toBe(0))
  it('classe preparada (clérigo) não está na tabela e retorna 0', () =>
    expect(getSpellsKnownCount('cleric', 5)).toBe(0))
})

describe('getWizardSpellbookSize', () => {
  it('nível 1: 6 magias', () => expect(getWizardSpellbookSize(1)).toBe(6))
  it('nível 2: 8 magias', () => expect(getWizardSpellbookSize(2)).toBe(8))
  it('nível 5: 14 magias', () => expect(getWizardSpellbookSize(5)).toBe(14))
})

// ── Casting stats (dependem do nível) ──────────────────────────────────────────

describe('getSpellSaveDC', () => {
  it('mago INT 16 nível 1: 8 + 2 + 3 = 13', () =>
    expect(getSpellSaveDC(wizardCasting, { INT: 16 }, 1)).toBe(13))
  it('mago INT 16 nível 5 usa +3 de proficiência: 8 + 3 + 3 = 14', () =>
    expect(getSpellSaveDC(wizardCasting, { INT: 16 }, 5)).toBe(14))
  it('usa 10 (mod 0) quando o atributo está ausente', () =>
    expect(getSpellSaveDC(wizardCasting, {}, 1)).toBe(10))
})

describe('getSpellAttackBonus', () => {
  it('mago INT 16 nível 1: 2 + 3 = 5', () =>
    expect(getSpellAttackBonus(wizardCasting, { INT: 16 }, 1)).toBe(5))
  it('mago INT 16 nível 5: 3 + 3 = 6', () =>
    expect(getSpellAttackBonus(wizardCasting, { INT: 16 }, 5)).toBe(6))
})

describe('getMaxPreparedSpells', () => {
  it('clérigo SAB 16 nível 5: mod 3 + nível 5 = 8', () =>
    expect(getMaxPreparedSpells(clericCasting, { WIS: 16 }, 5)).toBe(8))
  it('paladino (fórmula "metade") CAR 16 nível 5: floor(5/2) + 3 = 5', () =>
    expect(getMaxPreparedSpells(paladinCasting, { CHA: 16 }, 5)).toBe(5))
  it('mínimo de 1 magia preparada', () =>
    expect(getMaxPreparedSpells(clericCasting, { WIS: 8 }, 1)).toBe(1))
})

// ── Validação do passo de magias ────────────────────────────────────────────────

describe('isSpellStepComplete', () => {
  it('classe sem conjuração está completa', () =>
    expect(isSpellStepComplete(baseClass, emptyChoices, 1)).toBe(true))
  it('paladino nível 1 (conjura a partir do 2) está completo', () =>
    expect(isSpellStepComplete(paladinClass, emptyChoices, 1)).toBe(true))
  it('mago nível 1 incompleto sem truques nem grimório', () =>
    expect(isSpellStepComplete(wizardClass, emptyChoices, 1)).toBe(false))
  it('mago nível 1 completo com 3 truques e 6 magias', () =>
    expect(isSpellStepComplete(wizardClass, {
      cantrips: ['c1', 'c2', 'c3'],
      spells: ['s1', 's2', 's3', 's4', 's5', 's6'],
    }, 1)).toBe(true))
  it('clérigo (preparado) incompleto sem nenhuma magia preparada', () =>
    expect(isSpellStepComplete(clericClass, { cantrips: ['c1', 'c2', 'c3'], spells: [] }, 1)).toBe(false))
  it('clérigo (preparado) completo com truques e ao menos 1 preparada', () =>
    expect(isSpellStepComplete(clericClass, { cantrips: ['c1', 'c2', 'c3'], spells: ['s1'] }, 1)).toBe(true))
  it('clérigo (preparado) ainda exige os truques mesmo com magia preparada', () =>
    expect(isSpellStepComplete(clericClass, { cantrips: ['c1'], spells: ['s1'] }, 1)).toBe(false))
  it('bardo nível 1 precisa de 2 truques e 4 magias conhecidas', () =>
    expect(isSpellStepComplete(bardClass, {
      cantrips: ['c1', 'c2'],
      spells: ['s1', 's2', 's3'],
    }, 1)).toBe(false))
})
