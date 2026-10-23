import { describe, it, expect } from 'vitest'
import {
  getAsiLevels,
  getAsiSlotCount,
  getAsiBonuses,
  getFinalAbilityScores,
  isAsiChoiceComplete,
  isImprovementsStepComplete,
  getRacialBonuses,
  getCharacterFeats,
  describeAsiChoice,
  getAsiFeatures,
  getSheetClassFeatures,
  ASI_FEATURE_NAME,
} from '../asiUtils'
import { EMPTY_DRAFT, type CharacterDraft, type AsiChoice, type ClassEntry } from '../../types/character'

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), ...overrides }
}

describe('getAsiLevels', () => {
  it('classe padrão: 4/8/12/16/19', () => {
    expect(getAsiLevels('barbarian')).toEqual([4, 8, 12, 16, 19])
    expect(getAsiLevels('wizard')).toEqual([4, 8, 12, 16, 19])
  })
  it('guerreiro tem extras no 6 e 14', () => {
    expect(getAsiLevels('fighter')).toEqual([4, 6, 8, 12, 14, 16, 19])
  })
  it('ladino tem extra no 10', () => {
    expect(getAsiLevels('rogue')).toEqual([4, 8, 10, 12, 16, 19])
  })
  it('sem classe retorna vazio', () => {
    expect(getAsiLevels(null)).toEqual([])
  })
})

describe('getAsiSlotCount', () => {
  it('bárbaro nv3 tem 0, nv4 tem 1, nv20 tem 5', () => {
    expect(getAsiSlotCount('barbarian', 3)).toBe(0)
    expect(getAsiSlotCount('barbarian', 4)).toBe(1)
    expect(getAsiSlotCount('barbarian', 20)).toBe(5)
  })
  it('guerreiro nv6 tem 2, nv20 tem 7', () => {
    expect(getAsiSlotCount('fighter', 6)).toBe(2)
    expect(getAsiSlotCount('fighter', 20)).toBe(7)
  })
})

describe('getAsiBonuses', () => {
  it('+2 num atributo = duas entradas iguais', () => {
    expect(getAsiBonuses([{ kind: 'asi', abilities: ['STR', 'STR'] }]).STR).toBe(2)
  })
  it('+1 em dois atributos distintos', () => {
    const b = getAsiBonuses([{ kind: 'asi', abilities: ['STR', 'DEX'] }])
    expect(b.STR).toBe(1)
    expect(b.DEX).toBe(1)
  })
  it('soma vários ASIs', () => {
    const choices: AsiChoice[] = [
      { kind: 'asi', abilities: ['STR', 'STR'] },
      { kind: 'asi', abilities: ['STR', 'CON'] },
    ]
    expect(getAsiBonuses(choices).STR).toBe(3)
    expect(getAsiBonuses(choices).CON).toBe(1)
  })
  it('talentos não contam como bônus de atributo', () => {
    expect(getAsiBonuses([{ kind: 'feat', featId: 'alert' }]).STR).toBe(0)
  })
})

describe('getFinalAbilityScores', () => {
  it('soma base + racial + ASI', () => {
    const d = draft({
      race: 'half-orc', // +2 STR, +1 CON
      abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
      class: 'barbarian',
      level: 4,
      asiChoices: [{ kind: 'asi', abilities: ['STR', 'STR'] }],
    })
    const f = getFinalAbilityScores(d)
    expect(f.STR).toBe(19) // 15 + 2 (racial) + 2 (asi)
    expect(f.CON).toBe(14) // 13 + 1 (racial)
  })
  it('ASI não eleva um atributo acima de 20', () => {
    const d = draft({
      race: 'half-orc', // +2 STR
      abilityScores: { STR: 15, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 },
      class: 'barbarian',
      level: 8,
      asiChoices: [
        { kind: 'asi', abilities: ['STR', 'STR'] }, // 17 -> 19
        { kind: 'asi', abilities: ['STR', 'STR'] }, // 19 -> 21, mas teto 20
      ],
    })
    expect(getFinalAbilityScores(d).STR).toBe(20)
  })
})

describe('isAsiChoiceComplete', () => {
  it('+2 (duas iguais) e +1/+1 (dois distintos) são válidos', () => {
    expect(isAsiChoiceComplete({ kind: 'asi', abilities: ['STR', 'STR'] })).toBe(true)
    expect(isAsiChoiceComplete({ kind: 'asi', abilities: ['STR', 'DEX'] })).toBe(true)
  })
  it('escolha incompleta (uma só entrada) é inválida', () => {
    expect(isAsiChoiceComplete({ kind: 'asi', abilities: ['STR'] })).toBe(false)
    expect(isAsiChoiceComplete({ kind: 'asi', abilities: [] })).toBe(false)
    expect(isAsiChoiceComplete(undefined)).toBe(false)
  })
  it('talento simples (sem +1) exige apenas o featId', () => {
    expect(isAsiChoiceComplete({ kind: 'feat', featId: 'alerta' })).toBe(true)
    expect(isAsiChoiceComplete({ kind: 'feat', featId: '' })).toBe(false)
  })
  it('meio-talento exige escolher 1 atributo elegível', () => {
    expect(isAsiChoiceComplete({ kind: 'feat', featId: 'atleta' })).toBe(false) // falta o +1
    expect(isAsiChoiceComplete({ kind: 'feat', featId: 'atleta', abilities: ['STR'] })).toBe(true)
    expect(isAsiChoiceComplete({ kind: 'feat', featId: 'atleta', abilities: ['CON'] })).toBe(false) // CON não é opção
  })
  it('o +1 do meio-talento entra nos atributos finais', () => {
    const b = getAsiBonuses([{ kind: 'feat', featId: 'resistente', abilities: ['CON'] }])
    expect(b.CON).toBe(1)
  })
})

describe('isImprovementsStepComplete', () => {
  it('sem espaços de ASI (nível baixo) está completo', () => {
    expect(isImprovementsStepComplete(draft({ class: 'barbarian', level: 3 }))).toBe(true)
  })
  it('com espaço não preenchido está incompleto', () => {
    expect(isImprovementsStepComplete(draft({ class: 'barbarian', level: 4, asiChoices: [] }))).toBe(false)
  })
  it('com todos os espaços preenchidos está completo', () => {
    const d = draft({
      class: 'barbarian',
      level: 4,
      abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
      asiChoices: [{ kind: 'asi', abilities: ['STR', 'DEX'] }],
    })
    expect(isImprovementsStepComplete(d)).toBe(true)
  })
  it('rejeita escolhas que somadas ultrapassam o teto de 20', () => {
    // meio-orc STR base 15 + racial 2 = 17
    const ok = draft({
      race: 'half-orc',
      class: 'barbarian',
      level: 8, // 2 espaços
      abilityScores: { STR: 15, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 },
      asiChoices: [
        { kind: 'asi', abilities: ['STR', 'STR'] }, // 17 -> 19
        { kind: 'asi', abilities: ['DEX', 'CON'] }, // outros atributos
      ],
    })
    expect(isImprovementsStepComplete(ok)).toBe(true)
    const over = draft({
      race: 'half-orc',
      class: 'barbarian',
      level: 8,
      abilityScores: { STR: 15, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 },
      asiChoices: [
        { kind: 'asi', abilities: ['STR', 'STR'] }, // 17 -> 19
        { kind: 'asi', abilities: ['STR', 'STR'] }, // 19 -> 21, estoura 20
      ],
    })
    expect(isImprovementsStepComplete(over)).toBe(false)
  })
})

/**
 * Humano Variante escolhe +1 em dois atributos E um talento. Quando o talento é meio-talento
 * (Ator, +1 Carisma), o mesmo atributo pode receber os dois — total +2 antes de qualquer ASI.
 * A etapa Atributos calculava o bônus racial por conta própria e esquecia o do talento, então
 * mostrava +1 enquanto a Revisão mostrava +2.
 */
describe('humano variante com meio-talento', () => {
  const variante = (featAbility?: 'CHA') => draft({
    race: 'human',
    subrace: 'variant-human',
    raceChoices: {
      abilityBonuses: ['CHA', 'DEX'],
      skills: ['deception'],
      feat: 'ator',
      ...(featAbility ? { featAbility } : {}),
    },
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 15 },
  })

  it('soma o +1 da raça e o +1 do talento no bônus racial', () => {
    expect(getRacialBonuses(variante('CHA')).CHA).toBe(2)
    expect(getRacialBonuses(variante('CHA')).DEX).toBe(1)
  })

  it('o atributo final reflete os dois (15 + 1 + 1 = 17)', () => {
    expect(getFinalAbilityScores(variante('CHA')).CHA).toBe(17)
  })

  it('sem escolher o atributo do talento, só o +1 da raça conta', () => {
    expect(getRacialBonuses(variante()).CHA).toBe(1)
    expect(getFinalAbilityScores(variante()).CHA).toBe(16)
  })

  it('não conta em dobro: o bônus racial já inclui o do talento', () => {
    const d = variante('CHA')
    const base = d.abilityScores.CHA ?? 0
    expect(getFinalAbilityScores(d).CHA).toBe(base + getRacialBonuses(d).CHA)
  })
})

describe('getCharacterFeats', () => {
  it('cada talento vem com a origem: racial (sub-raça) ou o nível do Incremento', () => {
    const d = draft({
      race: 'human',
      subrace: 'variant-human',
      class: 'bard',
      level: 8,
      raceChoices: { feat: 'ator', featAbility: 'CHA' },
      asiChoices: [{ kind: 'asi', abilities: ['CHA', 'CHA'] }, { kind: 'feat', featId: 'sortudo' }],
    })
    expect(getCharacterFeats(d).map(f => [f.feat.id, f.origin])).toEqual([
      ['ator', 'Talento racial (Humano (Variante))'],
      ['sortudo', 'Incremento nv 8'],
    ])
  })

  it('inclui os talentos das classes adicionais, com a classe na origem (multiclasse)', () => {
    const d = draft({
      class: 'wizard',
      level: 8,
      asiChoices: [{ kind: 'feat', featId: 'alerta' }],
      additionalClasses: [{
        classId: 'fighter', level: 6, classChoices: structuredClone(EMPTY_DRAFT.classChoices), spellChoices: structuredClone(EMPTY_DRAFT.spellChoices),
        asiChoices: [{ kind: 'asi', abilities: ['STR', 'STR'] }, { kind: 'feat', featId: 'resiliente', abilities: ['CON'] }], hpRolls: [],
      }],
    })
    // mago 2 não alcançou ASI: o espaço sobrando sai sem nível, mas não some
    expect(getCharacterFeats(d).map(f => [f.feat.id, f.origin])).toEqual([
      ['alerta', 'Incremento (Mago)'],
      ['resiliente', 'Incremento nv 6 (Guerreiro)'],
    ])
  })

  it('não repete o mesmo talento (junta as origens) nem inclui id desconhecido ou espaço vazio', () => {
    const d = draft({
      race: 'human',
      subrace: 'variant-human',
      class: 'bard',
      level: 12,
      raceChoices: { feat: 'alerta' },
      asiChoices: [{ kind: 'feat', featId: 'alerta' }, { kind: 'feat', featId: '' }, { kind: 'feat', featId: 'nao-existe' }],
    })
    expect(getCharacterFeats(d).map(f => [f.feat.id, f.origin])).toEqual([
      ['alerta', 'Talento racial (Humano (Variante)), Incremento nv 4'],
    ])
  })

  it('sem talentos, lista vazia', () => {
    expect(getCharacterFeats(draft({}))).toEqual([])
  })
})

describe('describeAsiChoice', () => {
  it('[a, a] é +2; [a, b] é +1 e +1', () => {
    expect(describeAsiChoice({ kind: 'asi', abilities: ['STR', 'STR'] })).toBe('+2 FOR')
    expect(describeAsiChoice({ kind: 'asi', abilities: ['CHA', 'WIS'] })).toBe('+1 CAR, +1 SAB')
  })

  it('talento com o nome; meio-talento com o +1 escolhido', () => {
    expect(describeAsiChoice({ kind: 'feat', featId: 'sortudo' })).toBe('Talento: Sortudo')
    expect(describeAsiChoice({ kind: 'feat', featId: 'ator', abilities: ['CHA'] })).toBe('Talento: Ator (+1 CAR)')
    // atributo fora das opções do talento não vira +1 (o mesmo corte da validação)
    expect(describeAsiChoice({ kind: 'feat', featId: 'ator', abilities: ['STR'] })).toBe('Talento: Ator')
  })

  it('espaço vazio ou talento desconhecido: null', () => {
    expect(describeAsiChoice(undefined)).toBeNull()
    expect(describeAsiChoice({ kind: 'asi', abilities: [] })).toBeNull()
    expect(describeAsiChoice({ kind: 'feat', featId: '' })).toBeNull()
    expect(describeAsiChoice({ kind: 'feat', featId: 'nao-existe' })).toBeNull()
  })
})

function entry(classId: string, level: number, asiChoices: AsiChoice[] = [], subclass: string | null = null): ClassEntry {
  return {
    classId, level, asiChoices, hpRolls: [],
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass },
    spellChoices: structuredClone(EMPTY_DRAFT.spellChoices),
  }
}

describe('getAsiFeatures', () => {
  it('bardo 4: uma linha no nível 4, com a escolha', () => {
    const lines = getAsiFeatures(entry('bard', 4, [{ kind: 'asi', abilities: ['CHA', 'WIS'] }]))
    expect(lines.map(l => [l.level, l.name, l.chosen])).toEqual([[4, ASI_FEATURE_NAME, '+1 CAR, +1 SAB']])
  })

  it('guerreiro 6: níveis 4 e 6; ladino 10: níveis 4, 8 e 10', () => {
    expect(getAsiFeatures(entry('fighter', 6)).map(l => l.level)).toEqual([4, 6])
    expect(getAsiFeatures(entry('rogue', 10)).map(l => l.level)).toEqual([4, 8, 10])
  })

  it('cada linha leva a escolha do seu espaço; espaço vazio fica sem escolha', () => {
    const lines = getAsiFeatures(entry('fighter', 6, [{ kind: 'feat', featId: 'sortudo' }]))
    expect(lines.map(l => l.chosen)).toEqual(['Talento: Sortudo', null])
  })

  it('antes do nível 4 não há linha', () => {
    expect(getAsiFeatures(entry('bard', 3))).toEqual([])
  })
})

describe('getSheetClassFeatures', () => {
  it('bardo 4 do Colégio do Conhecimento: classe, subclasse e Incremento em ordem de nível', () => {
    const features = getSheetClassFeatures(entry('bard', 4, [{ kind: 'asi', abilities: ['CHA', 'CHA'] }], 'college-of-lore'))
    const levels = features.map(f => f.level)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
    expect(features.some(f => f.name === 'Palavras de Interrupção' && f.level === 3)).toBe(true)
    const last = features[features.length - 1]
    expect([last.level, last.name, last.chosen]).toEqual([4, ASI_FEATURE_NAME, '+2 CAR'])
    // features dos dados não abrem escolha aqui
    expect(features.filter(f => f.name !== ASI_FEATURE_NAME).every(f => f.chosen === null)).toBe(true)
  })

  it('bardo 6: as features do colégio (nv 3) entram antes das da classe nos níveis 5 e 6', () => {
    const features = getSheetClassFeatures(entry('bard', 6, [], 'college-of-lore'))
    const levels = features.map(f => f.level)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
    expect(levels.filter(l => l === 6).length).toBeGreaterThan(0)
  })

  it('classe desconhecida: lista vazia', () => {
    expect(getSheetClassFeatures(entry('nao-existe', 4))).toEqual([])
  })
})
