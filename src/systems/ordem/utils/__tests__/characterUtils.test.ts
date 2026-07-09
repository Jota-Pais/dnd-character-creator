import { describe, it, expect } from 'vitest'
import {
  deriveStats,
  getOriginSkills,
  getTrainedSkills,
  getAvailableChoiceGroupOptions,
  getAvailableFreeSkillOptions,
  getRequiredFreeSkillCount,
} from '../characterUtils'
import { getOrdemClass } from '../classUtils'
import { SKILLS } from '../skillUtils'
import { EMPTY_DRAFT } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'

function makeDraft(overrides: Partial<OrdemCharacterDraft>): OrdemCharacterDraft {
  return { ...EMPTY_DRAFT, attributes: { ...EMPTY_DRAFT.attributes }, ...overrides }
}

describe('deriveStats', () => {
  it('combatente: PV = 20+Vig, PE = 2+Pre, Sanidade = 12 (flat)', () => {
    const combatant = getOrdemClass('combatant')!
    const stats = deriveStats(combatant, { agility: 1, strength: 1, intellect: 1, presence: 2, vigor: 3 })
    expect(stats).toEqual({ hp: 23, pe: 4, sanity: 12 })
  })

  it('ocultista: PV = 12+Vig, PE = 4+Pre, Sanidade = 20 (a maior das 3 classes)', () => {
    const occultist = getOrdemClass('occultist')!
    const stats = deriveStats(occultist, { agility: 1, strength: 1, intellect: 1, presence: 3, vigor: 0 })
    expect(stats).toEqual({ hp: 12, pe: 7, sanity: 20 })
  })

  it('especialista: PV = 16+Vig, PE = 3+Pre, Sanidade = 16', () => {
    const specialist = getOrdemClass('specialist')!
    const stats = deriveStats(specialist, { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 })
    expect(stats).toEqual({ hp: 17, pe: 4, sanity: 16 })
  })
})

describe('getOriginSkills', () => {
  it('retorna as 2 perícias fixas de uma origem normal', () => {
    const draft = makeDraft({ origin: 'academic' })
    expect(getOriginSkills(draft)).toEqual(['science', 'investigation'])
  })

  it('amnésico usa as escolhas do jogador no lugar do mestre', () => {
    const draft = makeDraft({ origin: 'amnesiac', originGmSkillChoices: ['stealth', 'perception'] })
    expect(getOriginSkills(draft)).toEqual(['stealth', 'perception'])
  })

  it('sem origem escolhida retorna vazio', () => {
    expect(getOriginSkills(makeDraft({}))).toEqual([])
  })
})

describe('getTrainedSkills', () => {
  it('junta perícias de origem, fixas de classe, grupos de escolha e escolhas livres, sem duplicar', () => {
    const draft = makeDraft({
      origin: 'academic', // science, investigation
      class: 'occultist', // fixed: occultism, willpower
      classChoiceGroupPicks: [],
      classFreeSkillChoices: ['medicine', 'technology'],
    })
    expect(getTrainedSkills(draft).sort()).toEqual(
      ['science', 'investigation', 'occultism', 'willpower', 'medicine', 'technology'].sort(),
    )
  })

  it('dedup: se a mesma perícia aparecer em origem e escolha livre, conta uma vez só', () => {
    const draft = makeDraft({
      origin: 'academic', // science, investigation
      class: 'occultist',
      classFreeSkillChoices: ['science', 'medicine'],
    })
    const skills = getTrainedSkills(draft)
    expect(skills.filter(s => s === 'science')).toHaveLength(1)
  })
})

describe('getAvailableChoiceGroupOptions — regra do livro: perícia já recebida pela origem exclui a opção', () => {
  it('combatente com origem Militar (Pontaria, Tática) não pode escolher Pontaria de novo no grupo Luta/Pontaria', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ origin: 'military', class: 'combatant' }) // military: aim, tactics
    const options = getAvailableChoiceGroupOptions(draft, combatant, 0) // grupo: fighting | aim
    expect(options).toEqual(['fighting'])
  })

  it('sem conflito com a origem, as duas opções do grupo continuam disponíveis', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ origin: 'academic', class: 'combatant' }) // academic: science, investigation
    const options = getAvailableChoiceGroupOptions(draft, combatant, 0)
    expect(options.sort()).toEqual(['aim', 'fighting'].sort())
  })
})

describe('getAvailableFreeSkillOptions', () => {
  it('exclui perícias já garantidas por origem, fixas de classe e grupos de escolha já feitos', () => {
    const occultist = getOrdemClass('occultist')!
    const draft = makeDraft({
      origin: 'academic', // science, investigation
      class: 'occultist', // fixed: occultism, willpower
    })
    const allIds = SKILLS.map(s => s.id)
    const available = getAvailableFreeSkillOptions(draft, occultist, allIds)
    expect(available).not.toContain('science')
    expect(available).not.toContain('investigation')
    expect(available).not.toContain('occultism')
    expect(available).not.toContain('willpower')
    expect(available).toContain('medicine')
  })
})

describe('getRequiredFreeSkillCount', () => {
  it('combatente: 1 + Intelecto', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ attributes: { agility: 1, strength: 1, intellect: 2, presence: 1, vigor: 1 } })
    expect(getRequiredFreeSkillCount(draft, combatant)).toBe(3)
  })

  it('especialista: 7 + Intelecto', () => {
    const specialist = getOrdemClass('specialist')!
    const draft = makeDraft({ attributes: { agility: 1, strength: 1, intellect: 0, presence: 1, vigor: 1 } })
    expect(getRequiredFreeSkillCount(draft, specialist)).toBe(7)
  })

  it('ocultista: 3 + Intelecto', () => {
    const occultist = getOrdemClass('occultist')!
    const draft = makeDraft({ attributes: { agility: 1, strength: 1, intellect: 3, presence: 1, vigor: 1 } })
    expect(getRequiredFreeSkillCount(draft, occultist)).toBe(6)
  })
})
