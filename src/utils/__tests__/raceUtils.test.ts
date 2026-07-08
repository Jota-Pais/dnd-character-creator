import { describe, it, expect } from 'vitest'
import {
  getRace,
  getSubrace,
  getEffectiveSpeed,
  getEffectiveDarkvision,
  getEffectiveAbilityBonuses,
  getAvailableInnateSpells,
  getEffectiveInnateSpells,
  isRaceStepComplete,
} from '../raceUtils'
import type { RaceChoiceSelections } from '../../types/character'

const dwarf = getRace('dwarf')!
const hillDwarf = getSubrace(dwarf, 'hill-dwarf')!
const mountainDwarf = getSubrace(dwarf, 'mountain-dwarf')!

const elf = getRace('elf')!
const woodElf = getSubrace(elf, 'wood-elf')!
const drow = getSubrace(elf, 'drow')!
const highElf = getSubrace(elf, 'high-elf')!

const human = getRace('human')!
const variantHuman = getSubrace(human, 'variant-human')!

const halfOrc = getRace('half-orc')!
const halfElf = getRace('half-elf')!
const tiefling = getRace('tiefling')!

describe('getRace', () => {
  it('retorna a raça correta pelo id', () => expect(dwarf.name).toBe('Anão'))
  it('retorna undefined para id inexistente', () => expect(getRace('unicorn')).toBeUndefined())
})

describe('getEffectiveSpeed', () => {
  it('retorna a velocidade base da raça quando não há sobrescrita', () =>
    expect(getEffectiveSpeed(dwarf, hillDwarf)).toBe(25))

  it('retorna 35 para Elfo da Floresta (sobrescreve os 30 do elfo)', () =>
    expect(getEffectiveSpeed(elf, woodElf)).toBe(35))

  it('retorna a velocidade base quando subrace é null', () =>
    expect(getEffectiveSpeed(elf, null)).toBe(30))
})

describe('getEffectiveDarkvision', () => {
  it('retorna 60 para elfo sem sobrescrita de subraça', () =>
    expect(getEffectiveDarkvision(elf, woodElf)).toBe(60))

  it('retorna 120 para Drow (sobrescreve os 60 do elfo)', () =>
    expect(getEffectiveDarkvision(elf, drow)).toBe(120))

  it('retorna 0 para humano sem visão no escuro', () =>
    expect(getEffectiveDarkvision(human, null)).toBe(0))
})

describe('magias inatas (Magia Drow / Legado Infernal)', () => {
  it('drow conhece globos de luz no nível 1', () => {
    const ids = getAvailableInnateSpells(elf, drow, 1).map(s => s.spellId)
    expect(ids).toEqual(['dancing-lights'])
  })
  it('drow ganha fogo das fadas no nível 3 e escuridão no 5', () => {
    expect(getAvailableInnateSpells(elf, drow, 3).map(s => s.spellId)).toEqual(['dancing-lights', 'faerie-fire'])
    expect(getAvailableInnateSpells(elf, drow, 5).map(s => s.spellId)).toEqual(['dancing-lights', 'faerie-fire', 'darkness'])
  })
  it('tiefling conhece taumaturgia no nível 1, todas com CAR', () => {
    const all = getEffectiveInnateSpells(tiefling, null)
    expect(all.map(s => s.spellId)).toEqual(['thaumaturgy', 'hellish-rebuke', 'darkness'])
    expect(all.every(s => s.ability === 'CHA')).toBe(true)
  })
  it('elfo comum (sem sub-raça inata) e alto elfo não têm magias inatas', () => {
    expect(getEffectiveInnateSpells(elf, woodElf)).toEqual([])
    expect(getEffectiveInnateSpells(elf, highElf)).toEqual([])
  })
  it('raça sem magia inata retorna vazio', () => {
    expect(getAvailableInnateSpells(human, variantHuman, 20)).toEqual([])
  })
})

describe('getEffectiveAbilityBonuses', () => {
  it('mescla bônus da raça e subraça', () => {
    const bonuses = getEffectiveAbilityBonuses(dwarf, hillDwarf, {})
    expect(bonuses).toContainEqual({ ability: 'CON', value: 2 })
    expect(bonuses).toContainEqual({ ability: 'WIS', value: 1 })
  })

  it('inclui bônus de atributo escolhido pelo usuário', () => {
    const bonuses = getEffectiveAbilityBonuses(halfElf, null, {
      abilityBonuses: ['STR', 'DEX'],
    })
    expect(bonuses).toContainEqual({ ability: 'CHA', value: 2 })
    expect(bonuses).toContainEqual({ ability: 'STR', value: 1 })
    expect(bonuses).toContainEqual({ ability: 'DEX', value: 1 })
  })

  it('substitui bônus do humano base quando Variante está ativo', () => {
    const bonuses = getEffectiveAbilityBonuses(human, variantHuman, {
      abilityBonuses: ['STR', 'INT'],
    })
    const abilities = bonuses.map(b => b.ability)
    expect(abilities).not.toContain('DEX')
    expect(abilities).not.toContain('WIS')
    expect(bonuses).toContainEqual({ ability: 'STR', value: 1 })
    expect(bonuses).toContainEqual({ ability: 'INT', value: 1 })
  })

  it('inclui bônus fixos de STR e CON para anão da montanha', () => {
    const bonuses = getEffectiveAbilityBonuses(dwarf, mountainDwarf, {})
    expect(bonuses).toContainEqual({ ability: 'CON', value: 2 })
    expect(bonuses).toContainEqual({ ability: 'STR', value: 2 })
  })
})

describe('isRaceStepComplete', () => {
  it('retorna false quando nenhuma raça está selecionada', () =>
    expect(isRaceStepComplete(null, null, {})).toBe(false))

  it('retorna false quando raça tem subraças e nenhuma foi escolhida', () =>
    expect(isRaceStepComplete(dwarf, null, {})).toBe(false))

  it('retorna false quando a escolha de ferramenta do anão não foi feita', () =>
    expect(isRaceStepComplete(dwarf, hillDwarf, {})).toBe(false))

  it('retorna true quando anão da colina completo com escolha de ferramenta', () =>
    expect(isRaceStepComplete(dwarf, hillDwarf, { tools: ['smiths-tools'] })).toBe(true))

  it('retorna true para meio-orc sem subraças e sem choices', () =>
    expect(isRaceStepComplete(halfOrc, null, {})).toBe(true))

  it('retorna false quando meio-elfo não fez as escolhas de atributo', () =>
    expect(isRaceStepComplete(halfElf, null, {})).toBe(false))

  it('retorna false quando meio-elfo fez escolha parcial de atributo', () =>
    expect(isRaceStepComplete(halfElf, null, { abilityBonuses: ['STR'] })).toBe(false))

  it('retorna true quando meio-elfo completou todas as escolhas', () =>
    expect(
      isRaceStepComplete(halfElf, null, {
        abilityBonuses: ['STR', 'DEX'],
        skills: ['athletics', 'perception'],
        languages: ['goblin'],
      }),
    ).toBe(true))

  it('humano variante exige o talento escolhido', () => {
    const base: RaceChoiceSelections = { abilityBonuses: ['STR', 'DEX'], skills: ['athletics'] }
    expect(isRaceStepComplete(human, variantHuman, base)).toBe(false) // falta o talento
    expect(isRaceStepComplete(human, variantHuman, { ...base, feat: 'alerta' })).toBe(true)
  })

  it('humano variante com meio-talento exige o atributo do +1', () => {
    const base: RaceChoiceSelections = { abilityBonuses: ['STR', 'DEX'], skills: ['athletics'], feat: 'atleta' }
    expect(isRaceStepComplete(human, variantHuman, base)).toBe(false) // meio-talento sem +1
    expect(isRaceStepComplete(human, variantHuman, { ...base, featAbility: 'STR' })).toBe(true)
    expect(isRaceStepComplete(human, variantHuman, { ...base, featAbility: 'CON' })).toBe(false) // CON não é opção do Atleta
  })
})
