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
  getFeatChoiceSlots,
  areFeatChoicesComplete,
  getFeatSavingThrows,
} from '../sheetEffects'
import {
  getArmorProficiencies, hasArmorProficiency, hasWeaponProficiency,
  getSavingThrowProficiencies, getAllGrantedSkills, getAllGrantedLanguages,
  getExcludedSkillsForFeat, getExcludedWeaponsForFeat,
} from '../proficiencyUtils'
import { getArmor, getWeaponById } from '../equipmentUtils'
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

/**
 * Quatro talentos prometem proficiência "à sua escolha" e antes não abriam escolha nenhuma —
 * o mesmo buraco do Colégio do Conhecimento, só que em talento.
 */
describe('escolhas abertas pelos talentos', () => {
  it('Perito abre um slot de 3 entre perícias e ferramentas', () => {
    const slots = getFeatChoiceSlots(draft({ raceChoices: { feat: 'perito' } }))
    expect(slots).toHaveLength(1)
    expect(slots[0].choices.skillOrToolChoice).toEqual({ count: 3 })
  })

  it('Perito conta perícias e ferramentas no MESMO limite de 3', () => {
    const base = { raceChoices: { feat: 'perito' } }
    const duas = draft({ ...base, featSelections: { perito: { skills: ['arcana'], tools: ['lute'] } } })
    const tres = draft({
      ...base,
      featSelections: { perito: { skills: ['arcana'], tools: ['lute', 'drum'] } },
    })
    expect(areFeatChoicesComplete(duas)).toBe(false)
    expect(areFeatChoicesComplete(tres)).toBe(true)
  })

  it('Resiliente não abre slot: usa o atributo que já recebe o +1 do talento', () => {
    const d = draft({ raceChoices: { feat: 'resiliente', featAbility: 'CON' } })
    expect(getFeatChoiceSlots(d)).toHaveLength(0)
    expect(getFeatSavingThrows(d)).toEqual(['CON'])
  })

  it('a resistência do Resiliente entra junto com as da classe', () => {
    const d = draft({ class: 'wizard', raceChoices: { feat: 'resiliente', featAbility: 'CON' } })
    expect(getSavingThrowProficiencies(d)).toEqual(['INT', 'WIS', 'CON'])
  })

  it('as perícias do Perito viram proficiência de verdade na ficha', () => {
    const d = draft({ featSelections: { perito: { skills: ['stealth'] } }, raceChoices: { feat: 'perito' } })
    expect(getAllGrantedSkills(d)).toContain('stealth')
  })

  it('o Perito não pode repetir perícia que o personagem já tem', () => {
    const d = draft({
      race: 'elf', // Percepção fixa
      raceChoices: { feat: 'perito' },
    })
    expect(getExcludedSkillsForFeat(d, 'perito')).toContain('perception')
  })

  it('o picker do Mestre de Armas esconde armas em que já se é proficiente', () => {
    // Guerreiro é proficiente com simples e marciais: sobra pouca coisa (nenhuma, na prática).
    const guerreiro = draft({ class: 'fighter', raceChoices: { feat: 'mestre-de-armas' } })
    expect(getExcludedWeaponsForFeat(guerreiro, 'mestre-de-armas')).toContain('greatsword')
    // Mago não tem espada grande: ela fica disponível.
    const mago = draft({ class: 'wizard', raceChoices: { feat: 'mestre-de-armas' } })
    expect(getExcludedWeaponsForFeat(mago, 'mestre-de-armas')).not.toContain('greatsword')
  })

  it('a arma escolhida no Mestre de Armas passa a valer como proficiência', () => {
    const d = draft({
      class: 'wizard',
      raceChoices: { feat: 'mestre-de-armas' },
      featSelections: { 'mestre-de-armas': { weapons: ['greatsword'] } },
    })
    expect(hasWeaponProficiency(d, getWeaponById('greatsword')!)).toBe(true)
  })

  it('os idiomas do Poliglota chegam à ficha', () => {
    const d = draft({
      raceChoices: { feat: 'poliglota' },
      featSelections: { poliglota: { languages: ['elvish', 'dwarvish', 'orc'] } },
    })
    expect(getAllGrantedLanguages(d)).toEqual(expect.arrayContaining(['elvish', 'dwarvish', 'orc']))
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
