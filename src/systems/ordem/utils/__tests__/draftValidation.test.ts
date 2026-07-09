import { describe, it, expect } from 'vitest'
import { isStepComplete, getFirstIncompleteStep, sanitizeImportedDraft } from '../draftValidation'
import { EMPTY_DRAFT } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'

function makeDraft(overrides: Partial<OrdemCharacterDraft>): OrdemCharacterDraft {
  return { ...EMPTY_DRAFT, attributes: { ...EMPTY_DRAFT.attributes }, ...overrides }
}

describe('isStepComplete — name', () => {
  it('incompleto sem nome', () => expect(isStepComplete(makeDraft({}), 'name')).toBe(false))
  it('completo com nome não vazio', () => expect(isStepComplete(makeDraft({ name: 'Bianca' }), 'name')).toBe(true))
  it('incompleto com nome só espaços', () => expect(isStepComplete(makeDraft({ name: '   ' }), 'name')).toBe(false))
})

describe('isStepComplete — attributes', () => {
  it('incompleto na distribuição padrão', () => {
    expect(isStepComplete(makeDraft({}), 'attributes')).toBe(false)
  })
  it('completo com distribuição válida', () => {
    const draft = makeDraft({ attributes: { agility: 2, strength: 2, intellect: 2, presence: 2, vigor: 1 } })
    expect(isStepComplete(draft, 'attributes')).toBe(true)
  })
})

describe('isStepComplete — origin', () => {
  it('incompleto sem origem', () => expect(isStepComplete(makeDraft({}), 'origin')).toBe(false))
  it('completo com origem normal', () => expect(isStepComplete(makeDraft({ origin: 'academic' }), 'origin')).toBe(true))
  it('amnésico incompleto sem as 2 escolhas', () => {
    expect(isStepComplete(makeDraft({ origin: 'amnesiac' }), 'origin')).toBe(false)
  })
  it('amnésico completo com 2 escolhas', () => {
    const draft = makeDraft({ origin: 'amnesiac', originGmSkillChoices: ['stealth', 'perception'] })
    expect(isStepComplete(draft, 'origin')).toBe(true)
  })
})

describe('isStepComplete — class', () => {
  it('incompleto sem classe', () => expect(isStepComplete(makeDraft({}), 'class')).toBe(false))
  it('completo com classe', () => expect(isStepComplete(makeDraft({ class: 'combatant' }), 'class')).toBe(true))
})

describe('isStepComplete — skills', () => {
  it('incompleto sem escolhas de grupo nem livres (combatente exige ambos)', () => {
    const draft = makeDraft({
      class: 'combatant',
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 },
    })
    expect(isStepComplete(draft, 'skills')).toBe(false)
  })

  it('completo quando os 2 grupos e as escolhas livres (1+Int) estão preenchidos', () => {
    const draft = makeDraft({
      class: 'combatant',
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 }, // freeChoiceBase 1 + Int 1 = 2
      classChoiceGroupPicks: ['fighting', 'fortitude'],
      classFreeSkillChoices: ['medicine', 'technology'],
    })
    expect(isStepComplete(draft, 'skills')).toBe(true)
  })

  it('especialista não tem grupos de escolha, só livre (7+Int)', () => {
    const draft = makeDraft({
      class: 'specialist',
      attributes: { agility: 1, strength: 1, intellect: 0, presence: 1, vigor: 1 },
      classFreeSkillChoices: ['medicine', 'technology', 'science', 'crime', 'stealth', 'perception', 'piloting'],
    })
    expect(isStepComplete(draft, 'skills')).toBe(true)
  })
})

describe('getFirstIncompleteStep', () => {
  it('ficha vazia começa em name', () => expect(getFirstIncompleteStep(makeDraft({}))).toBe('name'))
  it('com nome, incompleto vai pra attributes', () => {
    expect(getFirstIncompleteStep(makeDraft({ name: 'Bianca' }))).toBe('attributes')
  })
})

describe('sanitizeImportedDraft', () => {
  it('rejeita entrada nula ou sem os campos mínimos', () => {
    expect(sanitizeImportedDraft(null)).toBeNull()
    expect(sanitizeImportedDraft({})).toBeNull()
    expect(sanitizeImportedDraft({ name: 'Bianca' })).toBeNull() // falta attributes
  })

  it('aceita um draft válido e preenche o resto com os defaults', () => {
    const result = sanitizeImportedDraft({
      name: 'Bianca',
      attributes: { agility: 2, strength: 0, intellect: 3, presence: 3, vigor: 1 },
      origin: 'investigator',
      class: 'specialist',
    })
    expect(result).not.toBeNull()
    expect(result?.name).toBe('Bianca')
    expect(result?.origin).toBe('investigator')
    expect(result?.classChoiceGroupPicks).toEqual([])
  })

  it('rejeita classe inválida (não é uma das 3 classes do livro)', () => {
    const result = sanitizeImportedDraft({
      name: 'Bianca',
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 },
      class: 'wizard',
    })
    expect(result?.class).toBeNull()
  })
})
