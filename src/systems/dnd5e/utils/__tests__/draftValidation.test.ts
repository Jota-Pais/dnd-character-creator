import { describe, it, expect } from 'vitest'
import { sanitizeImportedDraft, getFirstIncompleteStep, isStepComplete } from '../draftValidation'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import { SPELLS } from '../spellUtils'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'

describe('sanitizeImportedDraft', () => {
  it('rejeita valores que não são objetos', () => {
    expect(sanitizeImportedDraft(null)).toBeNull()
    expect(sanitizeImportedDraft(undefined)).toBeNull()
    expect(sanitizeImportedDraft('Krusk')).toBeNull()
    expect(sanitizeImportedDraft(42)).toBeNull()
    expect(sanitizeImportedDraft([1, 2, 3])).toBeNull()
  })

  it('rejeita objetos sem name ou sem abilityScores', () => {
    expect(sanitizeImportedDraft({})).toBeNull()
    expect(sanitizeImportedDraft({ name: 'Krusk' })).toBeNull()
    expect(sanitizeImportedDraft({ abilityScores: {} })).toBeNull()
    expect(sanitizeImportedDraft({ name: 42, abilityScores: {} })).toBeNull()
    expect(sanitizeImportedDraft({ name: 'Krusk', abilityScores: 'fortes' })).toBeNull()
  })

  it('aceita ficha mínima e preenche todos os padrões', () => {
    const draft = sanitizeImportedDraft({ name: 'Conan', abilityScores: {} })
    expect(draft).toEqual({ ...structuredClone(EMPTY_DRAFT), name: 'Conan' })
  })

  it('mantém uma ficha completa intacta (roundtrip do export)', () => {
    const roundtrip = JSON.parse(JSON.stringify(COMPLETE_DRAFT)) as unknown
    expect(sanitizeImportedDraft(roundtrip)).toEqual(COMPLETE_DRAFT)
  })

  it('clampa o nível para 1–20 e ignora não-inteiros', () => {
    const base = { name: 'X', abilityScores: {} }
    expect(sanitizeImportedDraft({ ...base, level: 999 })?.level).toBe(20)
    expect(sanitizeImportedDraft({ ...base, level: -3 })?.level).toBe(1)
    expect(sanitizeImportedDraft({ ...base, level: 4.5 })?.level).toBe(1)
    expect(sanitizeImportedDraft({ ...base, level: '7' })?.level).toBe(1)
    expect(sanitizeImportedDraft({ ...base, level: 12 })?.level).toBe(12)
  })

  it('descarta raça/classe/antecedente desconhecidos e as escolhas dependentes', () => {
    const draft = sanitizeImportedDraft({
      name: 'X',
      abilityScores: {},
      race: 'gato-homebrew',
      raceChoices: { skills: ['perception'] },
      class: 'samurai',
      classChoices: { skills: ['athletics'] },
      background: 'astronauta',
      backgroundChoices: { languages: ['elvish'] },
      equipment: { method: 'wealth', rolledGold: 50 },
    })
    expect(draft?.race).toBeNull()
    expect(draft?.raceChoices).toEqual({})
    expect(draft?.class).toBeNull()
    expect(draft?.classChoices.skills).toEqual([])
    expect(draft?.background).toBeNull()
    expect(draft?.backgroundChoices).toEqual({})
    expect(draft?.equipment).toEqual(EMPTY_DRAFT.equipment)
  })

  it('descarta sub-raça que não pertence à raça', () => {
    const draft = sanitizeImportedDraft({
      name: 'X',
      abilityScores: {},
      race: 'half-orc',
      subrace: 'high-elf',
    })
    expect(draft?.race).toBe('half-orc')
    expect(draft?.subrace).toBeNull()
  })

  it('descarta subclasse que não pertence à classe', () => {
    const draft = sanitizeImportedDraft({
      name: 'X',
      abilityScores: {},
      class: 'barbarian',
      classChoices: { skills: ['athletics'], subclass: 'school-of-evocation' },
    })
    expect(draft?.class).toBe('barbarian')
    expect(draft?.classChoices.subclass).toBeNull()
    expect(draft?.classChoices.skills).toEqual(['athletics'])
  })

  it('descarta magias inexistentes e mantém as válidas', () => {
    const validSpell = SPELLS[0].id
    const draft = sanitizeImportedDraft({
      name: 'X',
      abilityScores: {},
      class: 'wizard',
      spellChoices: { cantrips: [validSpell, 'bola-de-fogo-caseira', 42], spells: [validSpell] },
    })
    expect(draft?.spellChoices).toEqual({ cantrips: [validSpell], spells: [validSpell] })
  })

  it('sanitiza estruturas aninhadas corrompidas sem lançar erro', () => {
    const draft = sanitizeImportedDraft({
      name: 'X',
      abilityScores: { STR: 'forte', DEX: 14.5, CON: 99, INT: 12, WIS: null },
      classChoices: 'banana',
      spellChoices: { cantrips: [1, {}] },
      equipment: 42,
      backgroundChoices: [1, 2],
      rolledValues: { a: 1 },
      hpRolls: 'muitos',
      abilityMethod: 'chute',
      hpMethod: 'chute',
    })
    expect(draft).not.toBeNull()
    expect(draft?.abilityScores).toEqual({ STR: null, DEX: null, CON: null, INT: 12, WIS: null, CHA: null })
    expect(draft?.classChoices).toEqual(EMPTY_DRAFT.classChoices)
    expect(draft?.spellChoices).toEqual({ cantrips: [], spells: [] })
    expect(draft?.equipment).toEqual(EMPTY_DRAFT.equipment)
    expect(draft?.backgroundChoices).toEqual({})
    expect(draft?.rolledValues).toEqual([])
    expect(draft?.hpRolls).toEqual([])
    expect(draft?.abilityMethod).toBeNull()
    expect(draft?.hpMethod).toBe('average')
  })

  it('limita hpRolls ao nível e ao dado de vida da classe', () => {
    const draft = sanitizeImportedDraft({
      name: 'X',
      abilityScores: {},
      class: 'barbarian', // d12
      level: 3,
      hpMethod: 'roll',
      hpRolls: [5, 13, 7, 9], // 13 > d12 é inválido; só cabem nível-1 = 2 entradas
    })
    expect(draft?.hpRolls[0]).toBe(5)
    expect(draft?.hpRolls[1]).toBeUndefined()
    expect(draft?.hpRolls.length).toBeLessThanOrEqual(2)
  })
})

describe('getFirstIncompleteStep', () => {
  it('ficha vazia começa em name', () => {
    expect(getFirstIncompleteStep(structuredClone(EMPTY_DRAFT))).toBe('name')
  })

  it('só nome preenchido leva a race', () => {
    expect(getFirstIncompleteStep({ ...structuredClone(EMPTY_DRAFT), name: 'Conan' })).toBe('race')
  })

  it('ficha completa vai direto para review', () => {
    expect(getFirstIncompleteStep(COMPLETE_DRAFT)).toBe('review')
  })

  it('sem escolhas de classe leva a class', () => {
    const draft = {
      ...COMPLETE_DRAFT,
      classChoices: { ...COMPLETE_DRAFT.classChoices, skills: [] },
    }
    expect(getFirstIncompleteStep(draft)).toBe('class')
  })

  it('sem método de atributos leva a abilities', () => {
    expect(getFirstIncompleteStep({ ...COMPLETE_DRAFT, abilityMethod: null })).toBe('abilities')
  })

  it('sem antecedente leva a background', () => {
    expect(getFirstIncompleteStep({ ...COMPLETE_DRAFT, background: null })).toBe('background')
  })

  it('sem equipamento leva a equipment', () => {
    const draft: CharacterDraft = {
      ...COMPLETE_DRAFT,
      equipment: { method: null, classResolutions: [], rolledGold: null, purchasedItems: [] },
    }
    expect(getFirstIncompleteStep(draft)).toBe('equipment')
  })
})

describe('isStepComplete', () => {
  it('name completo com nome preenchido', () => {
    expect(isStepComplete(COMPLETE_DRAFT, 'name')).toBe(true)
    expect(isStepComplete({ ...COMPLETE_DRAFT, name: '  ' }, 'name')).toBe(false)
  })
  it('class incompleto sem perícias', () => {
    const d = { ...COMPLETE_DRAFT, classChoices: { ...COMPLETE_DRAFT.classChoices, skills: [] } }
    expect(isStepComplete(d, 'class')).toBe(false)
  })
  it('review sempre completo', () => {
    expect(isStepComplete(structuredClone(EMPTY_DRAFT), 'review')).toBe(true)
  })
})
