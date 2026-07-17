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

describe('isStepComplete — progression', () => {
  it('NEX 5% está sempre completo (nenhum slot de progressão existe ainda)', () => {
    const draft = makeDraft({ class: 'combatant', nex: 5 })
    expect(isStepComplete(draft, 'progression')).toBe(true)
  })

  it('NEX 10% incompleto sem trilha escolhida', () => {
    const draft = makeDraft({ class: 'combatant', nex: 10 })
    expect(isStepComplete(draft, 'progression')).toBe(false)
  })

  it('NEX 10% completo com trilha escolhida', () => {
    const draft = makeDraft({ class: 'combatant', nex: 10, trilha: 'annihilator' })
    expect(isStepComplete(draft, 'progression')).toBe(true)
  })

  it('NEX 15% exige trilha (de NEX10) e 1 poder de classe', () => {
    const semPoder = makeDraft({ class: 'combatant', nex: 15, trilha: 'annihilator' })
    expect(isStepComplete(semPoder, 'progression')).toBe(false)

    const comPoder = makeDraft({ class: 'combatant', nex: 15, trilha: 'annihilator', powerChoices: ['heavy-blow'] })
    expect(isStepComplete(comPoder, 'progression')).toBe(true)
  })

  it('NEX 20% exige também 1 aumento de atributo', () => {
    const semAumento = makeDraft({
      class: 'combatant', nex: 20, trilha: 'annihilator', powerChoices: ['heavy-blow'],
    })
    expect(isStepComplete(semAumento, 'progression')).toBe(false)

    const comAumento = makeDraft({
      class: 'combatant', nex: 20, trilha: 'annihilator', powerChoices: ['heavy-blow'],
      attributeIncreaseChoices: ['vigor'],
    })
    expect(isStepComplete(comAumento, 'progression')).toBe(true)
  })

  it('NEX 35% exige grau de treinamento com a contagem certa da classe (Combatente: 1+Int)', () => {
    // NEX 35: 2 slots de poder (15,30), 1 aumento de atributo (20), 1 slot de grau (35, tamanho 1+Int).
    const base = {
      class: 'combatant' as const, nex: 35,
      trilha: 'annihilator',
      powerChoices: ['heavy-blow', 'tireless'],
      attributeIncreaseChoices: ['vigor' as const],
      attributes: { agility: 1, strength: 1, intellect: 2, presence: 1, vigor: 1 }, // 1+2=3 perícias por slot
    }
    const semGrade = makeDraft(base)
    expect(isStepComplete(semGrade, 'progression')).toBe(false)

    const comGrade = makeDraft({ ...base, skillGradeChoices: [['fighting', 'fortitude', 'aim']] })
    expect(isStepComplete(comGrade, 'progression')).toBe(true)
  })

  it('NEX 50% exige versatilidade além do resto', () => {
    // NEX 50: 3 slots de poder (15,30,45), 2 aumentos de atributo (20,50), 1 slot de grau (35, tamanho 1+Int).
    const base = {
      class: 'combatant' as const, nex: 50,
      trilha: 'annihilator',
      powerChoices: ['heavy-blow', 'tireless', 'athletic-readiness'],
      attributeIncreaseChoices: ['vigor' as const, 'vigor' as const],
      attributes: { agility: 1, strength: 1, intellect: 0, presence: 1, vigor: 1 }, // 1+0=1 perícia por slot
      skillGradeChoices: [['fighting']],
    }
    const semVersatilidade = makeDraft(base)
    expect(isStepComplete(semVersatilidade, 'progression')).toBe(false)

    const comVersatilidade = makeDraft({ ...base, versatilityChoice: { kind: 'power' as const, powerId: 'opportunity-attack' } })
    expect(isStepComplete(comVersatilidade, 'progression')).toBe(true)
  })

  it('bloqueia poder sem pré-requisito e trilha Médico de Campo sem Medicina treinada', () => {
    const invalidPower = makeDraft({
      class: 'combatant', nex: 15, trilha: 'annihilator', powerChoices: ['heavy-weapons'],
    })
    expect(isStepComplete(invalidPower, 'progression')).toBe(false)

    const invalidTrilha = makeDraft({ class: 'specialist', nex: 10, trilha: 'field-medic' })
    expect(isStepComplete(invalidTrilha, 'progression')).toBe(false)
  })
})

describe('getFirstIncompleteStep', () => {
  it('ficha vazia começa em name', () => expect(getFirstIncompleteStep(makeDraft({}))).toBe('name'))
  it('com nome, incompleto vai pra attributes', () => {
    expect(getFirstIncompleteStep(makeDraft({ name: 'Bianca' }))).toBe('attributes')
  })
})

describe('isStepComplete — paranormal', () => {
  it('sem fontes de transcender e NEX < 50: completo', () => {
    expect(isStepComplete(makeDraft({}), 'paranormal')).toBe(true)
  })

  it('Transcender escolhido sem o poder paranormal bloqueia o passo', () => {
    const draft = makeDraft({ class: 'combatant', nex: 15, powerChoices: ['transcend'] })
    expect(isStepComplete(draft, 'paranormal')).toBe(false)
    expect(isStepComplete(
      makeDraft({ ...draft, paranormalPowerChoices: { 'slot-0': { powerId: 'fortunate' } } }),
      'paranormal',
    )).toBe(true)
  })

  it('NEX ≥ 50 exige o elemento de afinidade, mesmo sem transcends', () => {
    expect(isStepComplete(makeDraft({ nex: 50 }), 'paranormal')).toBe(false)
    expect(isStepComplete(makeDraft({ nex: 50, affinityElement: 'death' }), 'paranormal')).toBe(true)
  })

  it('sub-escolha pendente (Resistir a Elemento sem elemento) bloqueia', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 15, powerChoices: ['transcend'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'resist-element' } },
    })
    expect(isStepComplete(draft, 'paranormal')).toBe(false)
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

describe('sanitizeImportedDraft — poderes paranormais', () => {
  const base = {
    name: 'Bianca',
    attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 },
  }

  it('draft antigo (sem os campos novos) importa com defaults', () => {
    const result = sanitizeImportedDraft(base)
    expect(result?.paranormalPowerChoices).toEqual({})
    expect(result?.affinityElement).toBeNull()
  })

  it('mantém escolhas bem-formadas com sub-escolhas', () => {
    const result = sanitizeImportedDraft({
      ...base,
      paranormalPowerChoices: {
        'slot-0': { powerId: 'iron-blood' },
        'slot-1': { powerId: 'resist-element', element: 'death' },
        versatility: { powerId: 'learn-ritual', ritualId: 'amaldicoar-arma', ritualElement: 'blood' },
        origin: { powerId: 'knowledge-expansion', classPowerId: 'element-specialist', classPowerParams: ['energy'] },
      },
      affinityElement: 'death',
    })
    expect(result?.paranormalPowerChoices).toEqual({
      'slot-0': { powerId: 'iron-blood' },
      'slot-1': { powerId: 'resist-element', element: 'death' },
      versatility: { powerId: 'learn-ritual', ritualId: 'amaldicoar-arma', ritualElement: 'blood' },
      origin: { powerId: 'knowledge-expansion', classPowerId: 'element-specialist', classPowerParams: ['energy'] },
    })
    expect(result?.affinityElement).toBe('death')
  })

  it('descarta entradas malformadas e valores corrompidos', () => {
    const result = sanitizeImportedDraft({
      ...base,
      paranormalPowerChoices: {
        'slot-0': { powerId: 42 }, // powerId não-string
        'slot-1': 'iron-blood', // entrada não-objeto
        'chave-invalida': { powerId: 'iron-blood' }, // fonte desconhecida
        'slot-2': { powerId: 'resist-element', element: 'fear' }, // Medo não é elegível
        versatility: { powerId: 'learn-ritual', classPowerParams: ['ok', 7, null] },
      },
      affinityElement: 'fear',
    })
    expect(result?.paranormalPowerChoices).toEqual({
      'slot-2': { powerId: 'resist-element' },
      versatility: { powerId: 'learn-ritual', classPowerParams: ['ok'] },
    })
    expect(result?.affinityElement).toBeNull()
  })

  it('paranormalPowerChoices não-objeto vira {}', () => {
    expect(sanitizeImportedDraft({ ...base, paranormalPowerChoices: ['x'] })?.paranormalPowerChoices).toEqual({})
    expect(sanitizeImportedDraft({ ...base, paranormalPowerChoices: 'x' })?.paranormalPowerChoices).toEqual({})
  })
})
