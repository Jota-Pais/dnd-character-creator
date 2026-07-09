import { describe, it, expect } from 'vitest'
import {
  getAsiLevels,
  getAsiSlotCount,
  getAsiBonuses,
  getFinalAbilityScores,
  isAsiChoiceComplete,
  isImprovementsStepComplete,
} from '../asiUtils'
import { EMPTY_DRAFT, type CharacterDraft, type AsiChoice } from '../../types/character'

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
