import { describe, it, expect } from 'vitest'
import {
  getOwnedFeats,
  getInitiativeBonusTotal,
  getSpeedBonusTotal,
  getFeatHpBonus,
  getTotalHp,
  getPassiveScoreBonus,
  getConditionalAcBonuses,
  getFeatArmorProficiencies,
} from '../sheetEffects'
import { getArmorProficiencies, hasArmorProficiency } from '../proficiencyUtils'
import { getArmor } from '../equipmentUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), ...overrides }
}

describe('getOwnedFeats', () => {
  it('junta o talento do Humano Variante com os dos espaços de ASI', () => {
    const d = draft({
      raceChoices: { feat: 'alerta' },
      asiChoices: [{ kind: 'feat', featId: 'mobilidade' }],
    })
    expect(getOwnedFeats(d).map(f => f.id)).toEqual(['alerta', 'mobilidade'])
  })

  it('ignora espaços de ASI que não são talento', () => {
    const d = draft({ asiChoices: [{ kind: 'asi', abilities: ['STR', 'STR'] }] })
    expect(getOwnedFeats(d)).toEqual([])
  })

  it('não conta o mesmo talento duas vezes', () => {
    const d = draft({
      raceChoices: { feat: 'alerta' },
      asiChoices: [{ kind: 'feat', featId: 'alerta' }],
    })
    expect(getOwnedFeats(d)).toHaveLength(1)
    expect(getInitiativeBonusTotal(d)).toBe(5)
  })
})

describe('efeitos incondicionais entram no número', () => {
  it('Alerta soma +5 na iniciativa', () => {
    expect(getInitiativeBonusTotal(draft({ raceChoices: { feat: 'alerta' } }))).toBe(5)
    expect(getInitiativeBonusTotal(draft({}))).toBe(0)
  })

  it('Mobilidade soma +10 pés (3 m) no deslocamento', () => {
    expect(getSpeedBonusTotal(draft({ raceChoices: { feat: 'mobilidade' } }))).toBe(10)
  })

  it('Observador soma +5 só nos passivos de Percepção e Investigação', () => {
    const d = draft({ raceChoices: { feat: 'observador' } })
    expect(getPassiveScoreBonus(d, 'perception')).toBe(5)
    expect(getPassiveScoreBonus(d, 'investigation')).toBe(5)
    expect(getPassiveScoreBonus(d, 'stealth')).toBe(0)
  })

  // "duas vezes seu nível ao adquirir, +2 a cada nível seguinte" = sempre 2 × nível.
  it('Robusto soma 2 PV por nível de personagem', () => {
    const d = draft({ level: 5, raceChoices: { feat: 'robusto' } })
    expect(getFeatHpBonus(d, 5)).toBe(10)
  })

  it('getTotalHp soma os PV de talento ao poço de dados de vida', () => {
    const base = draft({ level: 3, class: 'fighter' })
    const comRobusto = draft({ level: 3, class: 'fighter', raceChoices: { feat: 'robusto' } })
    expect(getTotalHp(comRobusto, 2) - getTotalHp(base, 2)).toBe(6)
  })
})

describe('efeitos condicionais NÃO entram no número', () => {
  it('Ambidestro vira linha com a condição, não soma na CA', () => {
    const bonuses = getConditionalAcBonuses(draft({ raceChoices: { feat: 'ambidestro' } }))
    expect(bonuses).toEqual([
      {
        source: 'Ambidestro',
        value: 1,
        condition: 'empunhando uma arma corpo-a-corpo em cada mão',
      },
    ])
  })

  it('sem talento condicional, nenhuma linha', () => {
    expect(getConditionalAcBonuses(draft({}))).toEqual([])
  })
})

describe('talentos que concedem proficiência de armadura', () => {
  it('Proteção Moderada concede armadura média e escudos', () => {
    const d = draft({ raceChoices: { feat: 'protecao-moderada' } })
    expect(getFeatArmorProficiencies(d)).toEqual(['medium', 'shields'])
  })

  it('a proficiência do talento chega ao motor de proficiência', () => {
    // Mago não tem armadura nenhuma; com Proteção Pesada, passa a poder vestir cota de malha.
    const semTalento = draft({ class: 'wizard' })
    const comTalento = draft({ class: 'wizard', raceChoices: { feat: 'protecao-pesada' } })
    const chainMail = getArmor('chain-mail')!

    expect(getArmorProficiencies(semTalento)).toEqual([])
    expect(hasArmorProficiency(semTalento, chainMail)).toBe(false)
    expect(hasArmorProficiency(comTalento, chainMail)).toBe(true)
  })
})
