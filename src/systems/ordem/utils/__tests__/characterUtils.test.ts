import { describe, it, expect } from 'vitest'
import {
  deriveStats,
  getOriginSkills,
  getTrainedSkills,
  getAvailableChoiceGroupOptions,
  getAvailableFreeSkillOptions,
  getRequiredFreeSkillCount,
  getFixedSkillOverlapWithOrigin,
  getEffectiveAttributes,
  getSkillGrade,
  getAvailablePowerOptions,
  getAvailableTrilhaOptions,
  getAvailableVersatilityTrilhaOptions,
} from '../characterUtils'
import { getOrdemClass } from '../classUtils'
import { SKILLS } from '../skillUtils'
import { EMPTY_DRAFT } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'

function makeDraft(overrides: Partial<OrdemCharacterDraft>): OrdemCharacterDraft {
  return { ...EMPTY_DRAFT, attributes: { ...EMPTY_DRAFT.attributes }, ...overrides }
}

describe('deriveStats', () => {
  it('combatente em NEX 5%: PV = 20+Vig, PE = 2+Pre, Sanidade = 12 (flat)', () => {
    const combatant = getOrdemClass('combatant')!
    const stats = deriveStats(combatant, { agility: 1, strength: 1, intellect: 1, presence: 2, vigor: 3 }, 5)
    expect(stats).toEqual({ hp: 23, pe: 4, sanity: 12, defense: 11 })
  })

  it('ocultista em NEX 5%: PV = 12+Vig, PE = 4+Pre, Sanidade = 20 (a maior das 3 classes)', () => {
    const occultist = getOrdemClass('occultist')!
    const stats = deriveStats(occultist, { agility: 1, strength: 1, intellect: 1, presence: 3, vigor: 0 }, 5)
    expect(stats).toEqual({ hp: 12, pe: 7, sanity: 20, defense: 11 })
  })

  it('especialista em NEX 5%: PV = 16+Vig, PE = 3+Pre, Sanidade = 16', () => {
    const specialist = getOrdemClass('specialist')!
    const stats = deriveStats(specialist, { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 }, 5)
    expect(stats).toEqual({ hp: 17, pe: 4, sanity: 16, defense: 11 })
  })

  it('combatente em NEX 10% (1 degrau além do inicial): soma +4+Vig de PV e +2+Pre de PE', () => {
    const combatant = getOrdemClass('combatant')!
    const stats = deriveStats(combatant, { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 }, 10)
    // NEX5%: 20+1=21 PV, 2+1=3 PE, 12 SAN. +1 degrau: +4+1=5 PV, +2+1=3 PE, +3 SAN.
    expect(stats).toEqual({ hp: 26, pe: 6, sanity: 15, defense: 11 })
  })

  it('ocultista em NEX 99% (19 degraus além do inicial)', () => {
    const occultist = getOrdemClass('occultist')!
    const stats = deriveStats(occultist, { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 }, 99)
    // NEX5%: 12+1=13 PV, 4+1=5 PE, 20 SAN. +19 degraus: +2+1=3 PV/degrau, +4+1=5 PE/degrau, +5 SAN/degrau.
    expect(stats).toEqual({ hp: 13 + 19 * 3, pe: 5 + 19 * 5, sanity: 20 + 19 * 5, defense: 11 })
  })

  it('Defesa = 10 + Agilidade + bônus de proteção (livro pág. 43)', () => {
    const combatant = getOrdemClass('combatant')!
    // Agilidade 3, sem proteção → 13
    expect(deriveStats(combatant, { agility: 3, strength: 1, intellect: 1, presence: 1, vigor: 1 }, 5).defense).toBe(13)
    // Agilidade 2 + proteção +2 → 14
    expect(deriveStats(combatant, { agility: 2, strength: 1, intellect: 1, presence: 1, vigor: 1 }, 5, 2).defense).toBe(14)
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

  // F20: "Se receber uma perícia que já havia recebido pela origem, escolha outra" (pág. 25).
  it('perícia FIXA da classe repetida da origem vira +1 escolha livre (Vítima dá Vontade; Ocultista tem Vontade fixa)', () => {
    const occultist = getOrdemClass('occultist')!
    const draft = makeDraft({
      origin: 'victim', // reflexes + willpower
      attributes: { agility: 1, strength: 1, intellect: 3, presence: 1, vigor: 1 },
    })
    expect(getFixedSkillOverlapWithOrigin(draft, occultist)).toEqual(['willpower'])
    expect(getRequiredFreeSkillCount(draft, occultist)).toBe(7) // 3 + Int 3 + 1 da repetida
    // A perícia continua treinada uma vez só (não acumula).
    const trained = getTrainedSkills(draft)
    expect(trained.filter(s => s === 'willpower')).toHaveLength(1)
  })

  it('origem sem colisão com as fixas não altera a contagem', () => {
    const occultist = getOrdemClass('occultist')!
    const draft = makeDraft({
      origin: 'academic', // science + investigation
      attributes: { agility: 1, strength: 1, intellect: 3, presence: 1, vigor: 1 },
    })
    expect(getFixedSkillOverlapWithOrigin(draft, occultist)).toEqual([])
    expect(getRequiredFreeSkillCount(draft, occultist)).toBe(6)
  })
})

describe('getEffectiveAttributes', () => {
  it('sem aumentos, devolve os atributos base', () => {
    const draft = makeDraft({ attributes: { agility: 2, strength: 0, intellect: 3, presence: 3, vigor: 1 } })
    expect(getEffectiveAttributes(draft)).toEqual({ agility: 2, strength: 0, intellect: 3, presence: 3, vigor: 1 })
  })

  it('aplica os aumentos de atributo escolhidos', () => {
    const draft = makeDraft({
      attributes: { agility: 2, strength: 0, intellect: 3, presence: 3, vigor: 1 },
      attributeIncreaseChoices: ['strength', 'strength', 'vigor'],
    })
    expect(getEffectiveAttributes(draft)).toEqual({ agility: 2, strength: 2, intellect: 3, presence: 3, vigor: 2 })
  })

  it('nunca ultrapassa o teto 5', () => {
    const draft = makeDraft({
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 },
      attributeIncreaseChoices: ['vigor', 'vigor', 'vigor', 'vigor', 'vigor', 'vigor'],
    })
    expect(getEffectiveAttributes(draft).vigor).toBe(5)
  })

  // F16: aumentar Vigor/Presença via Aumento de Atributo recalcula PV/PE retroativamente,
  // como se o valor novo valesse desde o NEX 5% (PV/PE máximos são derivados, pág. 36).
  it('F16: +1 Vigor (Aumento de Atributo) aumenta o PV retroativamente em todos os degraus de NEX', () => {
    const combatant = getOrdemClass('combatant')!
    const base = makeDraft({ attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 } })
    const increased = makeDraft({
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 },
      attributeIncreaseChoices: ['vigor'],
    })
    // NEX 20% = 3 degraus além do 5%. Vigor 1→2: +1 no inicial e +1 por degrau = +4 PV.
    const hpBefore = deriveStats(combatant, getEffectiveAttributes(base), 20).hp
    const hpAfter = deriveStats(combatant, getEffectiveAttributes(increased), 20).hp
    expect(hpBefore).toBe(20 + 1 + 3 * (4 + 1)) // 36
    expect(hpAfter).toBe(20 + 2 + 3 * (4 + 2)) // 40
    expect(hpAfter - hpBefore).toBe(1 + 3)
  })

  it('F16: +1 Presença (Aumento de Atributo) aumenta o PE retroativamente em todos os degraus de NEX', () => {
    const occultist = getOrdemClass('occultist')!
    const increased = makeDraft({
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 2, vigor: 0 },
      attributeIncreaseChoices: ['presence'],
    })
    // NEX 50% = 9 degraus além do 5%. Presença efetiva 3: PE = 4+3 + 9×(4+3).
    expect(deriveStats(occultist, getEffectiveAttributes(increased), 50).pe).toBe(4 + 3 + 9 * (4 + 3))
  })
})

describe('getSkillGrade', () => {
  it('perícia não treinada é destreinado', () => {
    const draft = makeDraft({ origin: 'academic' }) // science, investigation
    expect(getSkillGrade(draft, 'occultism')).toBe('destreinado')
  })

  it('perícia treinada (origem/classe) começa em treinado', () => {
    const draft = makeDraft({ origin: 'academic' })
    expect(getSkillGrade(draft, 'science')).toBe('treinado')
  })

  it('cada escolha de Grau de Treinamento sobe um grau (treinado → veterano → expert)', () => {
    const draft = makeDraft({ origin: 'academic', skillGradeChoices: [['science']] })
    expect(getSkillGrade(draft, 'science')).toBe('veterano')

    const draft2 = makeDraft({ origin: 'academic', skillGradeChoices: [['science'], ['science']] })
    expect(getSkillGrade(draft2, 'science')).toBe('expert')
  })

  it('não passa de expert mesmo com escolhas demais', () => {
    const draft = makeDraft({ origin: 'academic', skillGradeChoices: [['science'], ['science'], ['science']] })
    expect(getSkillGrade(draft, 'science')).toBe('expert')
  })
})

describe('getAvailablePowerOptions', () => {
  it('exclui poderes já escolhidos que não são repetíveis', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ class: 'combatant', powerChoices: ['heavy-weapons'] })
    const options = getAvailablePowerOptions(draft, combatant)
    expect(options.find(p => p.id === 'heavy-weapons')).toBeUndefined()
  })

  it('mantém poderes repetíveis (Transcender, Treinamento em Perícia) mesmo já escolhidos', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ class: 'combatant', powerChoices: ['transcend'] })
    const options = getAvailablePowerOptions(draft, combatant)
    expect(options.find(p => p.id === 'transcend')).toBeDefined()
  })

  it('só lista poderes da classe (Ocultista não vê poderes de Combatente)', () => {
    const occultist = getOrdemClass('occultist')!
    const draft = makeDraft({ class: 'occultist' })
    const options = getAvailablePowerOptions(draft, occultist)
    expect(options.find(p => p.id === 'heavy-weapons')).toBeUndefined()
    expect(options.find(p => p.id === 'create-seal')).toBeDefined()
  })

  it('com slotIndex, isenta a própria escolha do slot da exclusão (senão o slot nunca aparece marcado)', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ class: 'combatant', powerChoices: ['heavy-weapons', 'heavy-blow'] })

    // Slot 0 (escolheu heavy-weapons): a própria escolha continua na lista dele.
    const slot0Options = getAvailablePowerOptions(draft, combatant, 0)
    expect(slot0Options.find(p => p.id === 'heavy-weapons')).toBeDefined()
    // ...mas o que o slot 1 escolheu não aparece pro slot 0.
    expect(slot0Options.find(p => p.id === 'heavy-blow')).toBeUndefined()

    // Slot 1 (escolheu heavy-blow): idem, ao contrário.
    const slot1Options = getAvailablePowerOptions(draft, combatant, 1)
    expect(slot1Options.find(p => p.id === 'heavy-blow')).toBeDefined()
    expect(slot1Options.find(p => p.id === 'heavy-weapons')).toBeUndefined()
  })

  it('sem slotIndex (uso da Versatilidade), exclui qualquer poder já escolhido em algum slot regular', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ class: 'combatant', powerChoices: ['heavy-weapons'] })
    const options = getAvailablePowerOptions(draft, combatant)
    expect(options.find(p => p.id === 'heavy-weapons')).toBeUndefined()
  })
})

describe('getAvailableTrilhaOptions / getAvailableVersatilityTrilhaOptions', () => {
  it('lista as 5 trilhas da classe', () => {
    const combatant = getOrdemClass('combatant')!
    expect(getAvailableTrilhaOptions(combatant)).toHaveLength(5)
  })

  it('versatilidade exclui a trilha já escolhida', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ class: 'combatant', trilha: 'annihilator' })
    const options = getAvailableVersatilityTrilhaOptions(draft, combatant)
    expect(options).toHaveLength(4)
    expect(options.find(t => t.id === 'annihilator')).toBeUndefined()
  })
})
