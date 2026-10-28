import { describe, it, expect } from 'vitest'
import {
  getOwnedFeats,
  getInitiativeBonusTotal,
  getInitiativeBonuses,
  getHalfProficiencySources,
  getCheckProficiencyBonus,
  getSpeedBonusTotal,
  getSpeedBonuses,
  getSheetSpeed,
  describeSpeedBonuses,
  getFeatHpBonus,
  getRacialHpBonus,
  getHpPerLevelBonus,
  getTotalHp,
  getClassFeatureHpBonus,
  getUnarmoredAcOptions,
  getSheetArmorClass,
  getPassiveScoreBonus,
  getConditionalAcBonuses,
  getFeatArmorProficiencies,
  getFeatChoiceSlots,
  areFeatChoicesComplete,
  getFeatSavingThrows,
  getAttacksPerAction,
  getConditionalAttacks,
  describeAttacksPerAction,
  getOwnedClassFeatures,
  getConditionalSaveBonuses,
  describeConditionalSaveBonuses,
  getWeaponCritThreshold,
  getInitiativeAdvantageSources,
  getConditionalRollNotes,
  getMeleeCritExtraWeaponDice,
} from '../sheetEffects'
import {
  getArmorProficiencies, hasArmorProficiency, hasWeaponProficiency,
  getSavingThrowProficiencies, getAllGrantedSkills, getAllGrantedLanguages,
  getExcludedSkillsForFeat, getExcludedWeaponsForFeat,
  getSkillChecks, describeHalfProficiencyOnChecks, getSavingThrowChecks,
} from '../proficiencyUtils'
import { getArmor, getWeaponById } from '../equipmentUtils'
import { getFinalAbilityScores } from '../asiUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import progressionFeatures from '../../data/class-progression-features.json'

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), ...overrides }
}

/** O Deslocamento e as linhas como a Revisão e o PDF os pedem: com os atributos finais. */
const sheetSpeed = (d: CharacterDraft) => getSheetSpeed(d, getFinalAbilityScores(d))
const speedLines = (d: CharacterDraft) => describeSpeedBonuses(d, getFinalAbilityScores(d))

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

// Tenacidade Anã (p. 20): +1 no máximo de PV e +1 a cada nível = sempre 1 × nível de personagem.
describe('Tenacidade Anã soma nos PV', () => {
  const dwarf = (subrace: string, overrides: Partial<CharacterDraft> = {}) =>
    draft({ race: 'dwarf', subrace, class: 'fighter', ...overrides })

  it('anão da colina nível 5 tem 5 PV a mais que o da montanha', () => {
    const hill = dwarf('hill-dwarf', { level: 5 })
    const mountain = dwarf('mountain-dwarf', { level: 5 })
    expect(getRacialHpBonus(hill, 5)).toBe(5)
    expect(getTotalHp(hill, 2) - getTotalHp(mountain, 2)).toBe(5)
  })

  it('já soma +1 no 1º nível', () => {
    expect(getTotalHp(dwarf('hill-dwarf'), 2)).toBe(10 + 2 + 1)
  })

  it('vale também no método de rolagem', () => {
    const hill = dwarf('hill-dwarf', { level: 3, hpMethod: 'roll', hpRolls: [4, 7] })
    const mountain = dwarf('mountain-dwarf', { level: 3, hpMethod: 'roll', hpRolls: [4, 7] })
    expect(getTotalHp(hill, 1) - getTotalHp(mountain, 1)).toBe(3)
  })

  it('na multiclasse conta o nível de personagem, não o de uma classe', () => {
    const extra = {
      classId: 'wizard', level: 2, classChoices: structuredClone(EMPTY_DRAFT.classChoices),
      spellChoices: structuredClone(EMPTY_DRAFT.spellChoices), asiChoices: [], hpRolls: [],
    }
    const hill = dwarf('hill-dwarf', { level: 5, additionalClasses: [extra] })
    const mountain = dwarf('mountain-dwarf', { level: 5, additionalClasses: [extra] })
    expect(getTotalHp(hill, 0) - getTotalHp(mountain, 0)).toBe(5)
  })

  it('acumula com o Robusto: +3 por nível', () => {
    const hill = dwarf('hill-dwarf', { level: 4, asiChoices: [{ kind: 'feat', featId: 'robusto' }] })
    const mountain = dwarf('mountain-dwarf', { level: 4 })
    expect(getHpPerLevelBonus(hill, 4)).toBe(12)
    expect(getTotalHp(hill, 0) - getTotalHp(mountain, 0)).toBe(12)
  })

  it('outra raça (ou nenhuma) não ganha nada', () => {
    expect(getRacialHpBonus(dwarf('mountain-dwarf', { level: 5 }), 5)).toBe(0)
    expect(getRacialHpBonus(draft({ race: 'elf', subrace: 'high-elf', level: 5 }), 5)).toBe(0)
    expect(getRacialHpBonus(draft({ level: 5 }), 5)).toBe(0)
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
    expect(getSavingThrowProficiencies(d)).toEqual(['CON', 'INT', 'WIS']) // na ordem da ficha
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

// Versatilidade do bardo (p. 54): metade do bônus de proficiência, arredondada para baixo, em todo
// teste de habilidade sem proficiência — iniciativa inclusa, por ser um teste de Destreza (p. 179).
describe('Versatilidade (efeito de feature de classe)', () => {
  const bard = (level: number) => draft({ level, class: 'bard' })

  it('bardo do 1º nível ainda não tem', () => {
    expect(getHalfProficiencySources(bard(1))).toEqual([])
    expect(getInitiativeBonusTotal(bard(1))).toBe(0)
  })

  it('a partir do 2º nível soma metade do bônus de proficiência na iniciativa', () => {
    expect(getHalfProficiencySources(bard(2)).map(s => s.source)).toEqual(['Versatilidade'])
    expect(getInitiativeBonusTotal(bard(2))).toBe(1) // ⌊2/2⌋
    expect(getInitiativeBonusTotal(bard(5))).toBe(1) // ⌊3/2⌋, arredonda para baixo
    expect(getInitiativeBonusTotal(bard(9))).toBe(2) // ⌊4/2⌋
  })

  it('soma com o Alerta, cada um numa linha', () => {
    const d = draft({ level: 2, class: 'bard', raceChoices: { feat: 'alerta' } })
    expect(getInitiativeBonuses(d).map(e => e.source)).toEqual(['Alerta', 'Versatilidade'])
    expect(getInitiativeBonusTotal(d)).toBe(6)
  })

  it('conta o nível NA classe: guerreiro 5 / bardo 1 não tem', () => {
    const d = draft({
      level: 6,
      multiclass: true,
      class: 'fighter',
      additionalClasses: [{
        classId: 'bard', level: 1, classChoices: { ...EMPTY_DRAFT.classChoices },
        spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
      }],
    })
    expect(getHalfProficiencySources(d)).toEqual([])
  })

  it('a parcela do bônus nunca soma: metade, inteiro ou dobrado', () => {
    const d = bard(4) // proficiência +2
    expect(getCheckProficiencyBonus(d, 'none', 'INT')).toBe(1)
    expect(getCheckProficiencyBonus(d, 'proficient', 'INT')).toBe(2)
    expect(getCheckProficiencyBonus(d, 'expertise', 'INT')).toBe(4)
    expect(getCheckProficiencyBonus(draft({ level: 4, class: 'fighter' }), 'none', 'INT')).toBe(0)
  })

  it('a linha da Revisão e do PDF diz onde já entrou e onde mais vale', () => {
    expect(describeHalfProficiencyOnChecks(bard(2))).toEqual([{
      source: 'Versatilidade',
      text: '+1 já somado nas perícias sem proficiência e na iniciativa; vale também em testes de atributo e de ferramenta sem proficiência.',
    }])
    expect(describeHalfProficiencyOnChecks(bard(1))).toEqual([])
  })
})

// Atletismo Extraordinário do campeão 7 (p. 85): metade do bônus de proficiência, arredondada
// para CIMA, em teste de Força, Destreza ou Constituição que ainda não use o bônus. Com a
// Versatilidade não soma — é o mesmo bônus de proficiência (p. 175): vale o maior.
describe('Atletismo Extraordinário (efeito de feature de subclasse)', () => {
  const champion = (level: number, extra: Partial<CharacterDraft> = {}) => draft({
    level, class: 'fighter',
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'champion' },
    ...extra,
  })
  const scores = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }

  it('só a partir do 7º nível de guerreiro', () => {
    expect(getHalfProficiencySources(champion(6))).toEqual([])
    expect(getInitiativeBonusTotal(champion(6))).toBe(0)
  })

  it('arredonda para cima e entra na iniciativa', () => {
    expect(getInitiativeBonusTotal(champion(7))).toBe(2) // ⌈3/2⌉
    expect(getInitiativeBonuses(champion(7)).map(e => e.source)).toEqual(['Atletismo Extraordinário'])
    expect(getInitiativeBonusTotal(champion(9))).toBe(2) // ⌈4/2⌉
    expect(getInitiativeBonusTotal(champion(13))).toBe(3) // ⌈5/2⌉
  })

  it('só em Força, Destreza e Constituição, e só sem proficiência', () => {
    const d = champion(7, {
      classChoices: {
        ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'champion', skills: ['athletics', 'perception'],
      },
    })
    const checks = getSkillChecks(d, scores)
    expect(checks.athletics.bonus).toBe(3) // proficiente: o bônus inteiro, sem a metade por cima
    expect(checks.acrobatics.bonus).toBe(2) // DES sem proficiência
    expect(checks.stealth.bonus).toBe(2)
    expect(checks.arcana.bonus).toBe(0) // INT não leva
    expect(checks.insight.bonus).toBe(0) // SAB não leva
    expect(getCheckProficiencyBonus(d, 'none', 'CON')).toBe(2)
    expect(getCheckProficiencyBonus(d, 'none', 'CHA')).toBe(0)
  })

  it('conta o nível NA classe: bardo 6 / campeão 3 não tem', () => {
    const d = draft({
      level: 9, multiclass: true, class: 'bard',
      additionalClasses: [extraClass('fighter', 3, 'champion')],
    })
    expect(getHalfProficiencySources(d).map(s => s.source)).toEqual(['Versatilidade'])
  })

  it('com a Versatilidade, vale o maior em cada teste — nunca a soma', () => {
    // Campeão 7 / bardo 2 = 9º nível, proficiência +4: as duas dão +2 — empate, fica a Versatilidade.
    const tie = champion(7, { level: 9, multiclass: true, additionalClasses: [extraClass('bard', 2)] })
    expect(getInitiativeBonusTotal(tie)).toBe(2)
    expect(getInitiativeBonuses(tie).map(e => e.source)).toEqual(['Versatilidade'])
    expect(describeHalfProficiencyOnChecks(tie).map(l => l.source)).toEqual(['Versatilidade'])
    expect(describeHalfProficiencyOnChecks(tie)[0].text).toContain('Não se soma com Atletismo Extraordinário')

    // Campeão 11 / bardo 2 = 13º nível, proficiência +5: Atletismo +3, Versatilidade +2.
    const d = champion(11, { level: 13, multiclass: true, additionalClasses: [extraClass('bard', 2)] })
    expect(getInitiativeBonusTotal(d)).toBe(3)
    const checks = getSkillChecks(d, scores)
    expect(checks.acrobatics.bonus).toBe(3)
    expect(checks.arcana.bonus).toBe(2)
    expect(describeHalfProficiencyOnChecks(d)).toEqual([
      {
        source: 'Atletismo Extraordinário',
        text: '+3 já somado nas perícias de Força e Destreza sem proficiência e na iniciativa; vale também em testes de Força, Destreza ou Constituição sem proficiência (de atributo ou de ferramenta). Não se soma com Versatilidade: em cada teste vale o maior.',
      },
      {
        source: 'Versatilidade',
        text: '+2 já somado nas perícias de Inteligência, Sabedoria e Carisma sem proficiência; vale também em testes de Inteligência, Sabedoria ou Carisma sem proficiência (de atributo ou de ferramenta). Não se soma com Atletismo Extraordinário: em cada teste vale o maior.',
      },
    ])
  })
})

// ── Resiliência Dracônica e CA sem armadura das features de classe ─────────────

/** Classe adicional da multiclasse, com subclasse opcional. */
function extraClass(classId: string, level: number, subclass: string | null = null) {
  return {
    classId, level, classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass },
    spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
  }
}

const scores = (m: Partial<Record<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', number>>) =>
  ({ STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10, ...m })

// p. 80: +1 PV no 1º nível e +1 a cada nível na classe = 1 × nível de FEITICEIRO.
describe('Resiliência Dracônica soma nos PV', () => {
  const sorcerer = (level: number, subclass: string | null = 'draconic-bloodline', overrides: Partial<CharacterDraft> = {}) =>
    draft({ level, class: 'sorcerer', classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass }, ...overrides })

  it('feiticeiro dracônico 1 = 6 + CON + 1', () => {
    expect(getClassFeatureHpBonus(sorcerer(1))).toBe(1)
    expect(getTotalHp(sorcerer(1), 2)).toBe(6 + 2 + 1)
  })

  it('feiticeiro dracônico 5 = média + 5', () => {
    expect(getTotalHp(sorcerer(5), 2)).toBe(6 + 2 + 4 * (4 + 2) + 5)
    expect(getTotalHp(sorcerer(5), 2) - getTotalHp(sorcerer(5, null), 2)).toBe(5)
  })

  it('vale também no método de rolagem', () => {
    const roll = { hpMethod: 'roll' as const, hpRolls: [3, 5] }
    expect(getTotalHp(sorcerer(3, 'draconic-bloodline', roll), 1) - getTotalHp(sorcerer(3, null, roll), 1)).toBe(3)
  })

  it('feiticeiro sem a Linhagem Dracônica não ganha nada', () => {
    expect(getClassFeatureHpBonus(sorcerer(5, null))).toBe(0)
    expect(getClassFeatureHpBonus(draft({ level: 5, class: 'fighter' }))).toBe(0)
  })

  it('na multiclasse conta só o nível de feiticeiro: guerreiro 3 / feiticeiro dracônico 2 ganha +2', () => {
    const mc = (sub: string | null) => draft({
      level: 5, multiclass: true, class: 'fighter',
      additionalClasses: [extraClass('sorcerer', 2, sub)],
    })
    expect(getClassFeatureHpBonus(mc('draconic-bloodline'))).toBe(2)
    expect(getTotalHp(mc('draconic-bloodline'), 1) - getTotalHp(mc(null), 1)).toBe(2)
  })

  it('soma com a Tenacidade Anã (nível de personagem) sem se confundir com ela', () => {
    const d = sorcerer(4, 'draconic-bloodline', { race: 'dwarf', subrace: 'hill-dwarf' })
    expect(getTotalHp(d, 0) - getTotalHp(sorcerer(4, null, { race: 'dwarf', subrace: 'mountain-dwarf' }), 0)).toBe(4 + 4)
  })
})

describe('getUnarmoredAcOptions', () => {
  it('lê a fórmula das features, com o nome delas', () => {
    const d = draft({ level: 1, class: 'sorcerer', classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'draconic-bloodline' } })
    expect(getUnarmoredAcOptions(d)).toEqual([
      { id: 'draconic-resilience', base: 13, abilities: ['DEX'], source: 'Resiliência Dracônica' },
    ])
  })

  it('bárbaro / monge: uma Defesa sem Armadura só, a da classe que veio primeiro (p. 166)', () => {
    const d = draft({ level: 3, multiclass: true, class: 'barbarian', additionalClasses: [extraClass('monk', 1)] })
    const opts = getUnarmoredAcOptions(d)
    expect(opts).toHaveLength(1)
    expect(opts[0].abilities).toEqual(['DEX', 'CON'])
  })

  it('Defesa sem Armadura e Resiliência Dracônica ficam as duas (características diferentes)', () => {
    const d = draft({ level: 3, multiclass: true, class: 'barbarian', additionalClasses: [extraClass('sorcerer', 1, 'draconic-bloodline')] })
    expect(getUnarmoredAcOptions(d).map(o => o.id)).toEqual(['unarmored-defense', 'draconic-resilience'])
  })
})

describe('getSheetArmorClass', () => {
  const sorcererDraft = (overrides: Partial<CharacterDraft> = {}) => draft({
    level: 1, class: 'sorcerer',
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'draconic-bloodline' },
    ...overrides,
  })
  const withShield = { equipment: { ...structuredClone(EMPTY_DRAFT.equipment), method: 'wealth' as const, purchasedItems: [{ itemId: 'shield', quantity: 1, source: 'purchased' as const }] } }

  it('feiticeiro dracônico sem armadura: 13 + DES', () => {
    expect(getSheetArmorClass(sorcererDraft(), scores({ DEX: 14 })).value).toBe(15)
  })

  it('feiticeiro dracônico com escudo: 13 + DES + 2', () => {
    expect(getSheetArmorClass(sorcererDraft(withShield), scores({ DEX: 14 })).value).toBe(17)
  })

  it('feiticeiro de outra origem fica no 10 + DES', () => {
    const d = draft({ level: 1, class: 'sorcerer' })
    expect(getSheetArmorClass(d, scores({ DEX: 14 })).value).toBe(12)
  })

  it('regressão: bárbaro e monge com a CA de antes', () => {
    expect(getSheetArmorClass(draft({ level: 1, class: 'barbarian' }), scores({ DEX: 14, CON: 16 })).value).toBe(15)
    expect(getSheetArmorClass(draft({ level: 1, class: 'monk' }), scores({ DEX: 16, WIS: 14 })).value).toBe(15)
    expect(getSheetArmorClass(draft({ level: 1, class: 'monk', ...withShield }), scores({ DEX: 16, WIS: 14 })).value).toBe(15)
  })

  it('a Defesa sem Armadura vale de classe adicional, não só da primária', () => {
    const d = draft({ level: 3, multiclass: true, class: 'fighter', additionalClasses: [extraClass('barbarian', 1)] })
    expect(getSheetArmorClass(d, scores({ DEX: 14, CON: 18 })).value).toBe(16) // 10 + 2 + 4
  })

  it('monge / feiticeiro dracônico de escudo usa a dracônica', () => {
    const d = draft({
      level: 3, multiclass: true, class: 'monk', ...withShield,
      additionalClasses: [extraClass('sorcerer', 1, 'draconic-bloodline')],
    })
    expect(getSheetArmorClass(d, scores({ DEX: 16, WIS: 18 })).value).toBe(18) // 13 + 3 + 2
  })
})

// ── Ataques por ação: Ataque Extra e Lâmina Sedenta ───────────────────────────

describe('getAttacksPerAction (Ataque Extra)', () => {
  const single = (classId: string, level: number, subclass: string | null = null) =>
    draft({ level, class: classId, classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass } })
  const attacks = (d: CharacterDraft) => getAttacksPerAction(d).value

  // p. 85: duas vezes no 5º, três no 11º, quatro no 20º nível de guerreiro.
  it('guerreiro 4/5/11/19/20 faz 1/2/3/3/4 ataques', () => {
    expect([4, 5, 11, 19, 20].map(l => attacks(single('fighter', l)))).toEqual([1, 2, 3, 3, 4])
  })

  it('bárbaro, monge e paladino fazem 2 a partir do 5º', () => {
    expect(attacks(single('barbarian', 4))).toBe(1)
    for (const c of ['barbarian', 'monk', 'paladin']) {
      expect(attacks(single(c, 5))).toBe(2)
      expect(attacks(single(c, 20))).toBe(2)
    }
  })

  // Patrulheiro Revisado (p. 119-121 do livro do projeto): o 5º nível é "Característica de
  // Conclave". Caçador e Rastreador Subterrâneo têm Ataque Extra; a Besta tem Ataque Coordenado,
  // que é o ataque do companheiro (reação dele), não um ataque a mais do patrulheiro.
  it('patrulheiro 5: Caçador e Rastreador Subterrâneo fazem 2; Besta e sem conclave, 1', () => {
    expect(attacks(single('ranger', 4, 'hunter'))).toBe(1)
    expect(getAttacksPerAction(single('ranger', 5, 'hunter'))).toEqual({ value: 2, source: 'Ataque Extra' })
    expect(getAttacksPerAction(single('ranger', 5, 'gloom-stalker'))).toEqual({ value: 2, source: 'Ataque Extra' })
    expect(attacks(single('ranger', 20, 'hunter'))).toBe(2)
    expect(attacks(single('ranger', 5, 'beast-master'))).toBe(1)
    expect(attacks(single('ranger', 20, 'beast-master'))).toBe(1)
    expect(attacks(single('ranger', 5))).toBe(1)
    expect(describeAttacksPerAction(single('ranger', 5, 'beast-master'))).toEqual([])
    expect(describeAttacksPerAction(single('ranger', 5, 'gloom-stalker'))).toEqual([
      'Ataque Extra: você faz 2 ataques ao usar a ação de Atacar.',
    ])
  })

  it('patrulheiro 5 da Besta tem Ataque Coordenado no lugar do Ataque Extra', () => {
    const names = (sub: string | null) => getOwnedClassFeatures(single('ranger', 5, sub)).map(f => f.name)
    expect(names('beast-master')).toContain('Ataque Coordenado')
    expect(names('beast-master')).not.toContain('Ataque Extra')
    expect(names('hunter')).not.toContain('Ataque Coordenado')
    expect(names(null)).not.toContain('Ataque Extra')
  })

  it('patrulheiro 3 da Besta tem o Vínculo com o Companheiro junto do Companheiro Animal (p. 119)', () => {
    const features = getOwnedClassFeatures(single('ranger', 3, 'beast-master'))
    const bond = features.find(f => f.name === 'Vínculo com o Companheiro')
    expect(bond?.level).toBe(3)
    expect(bond?.description).toMatch(/Ataques Múltiplos/)
    expect(bond?.description).toMatch(/duas perícias/)
    expect(bond?.description).toMatch(/todos os testes de resistência/)
    expect(features.map(f => f.name)).toContain('Companheiro Animal')
    expect(getOwnedClassFeatures(single('ranger', 3, 'hunter')).map(f => f.name)).not.toContain('Vínculo com o Companheiro')
  })

  it('multiclasse: patrulheiro da Besta 5 / guerreiro 5 faz 2 (o do guerreiro)', () => {
    const d = draft({
      level: 10, multiclass: true, class: 'ranger',
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'beast-master' },
      additionalClasses: [extraClass('fighter', 5)],
    })
    expect(attacks(d)).toBe(2)
    const hunterPlusPaladin = draft({
      level: 10, multiclass: true, class: 'ranger',
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'hunter' },
      additionalClasses: [extraClass('paladin', 5)],
    })
    expect(attacks(hunterPlusPaladin)).toBe(2)
  })

  it('nomeia a característica que dá o número', () => {
    expect(getAttacksPerAction(single('fighter', 11))).toEqual({ value: 3, source: 'Ataque Extra' })
    expect(getAttacksPerAction(single('wizard', 20))).toEqual({ value: 1, source: null })
  })

  // p. 55: o Ataque Extra do Colégio da Bravura chega no 6º nível de bardo.
  it('bardo do Colégio da Bravura faz 2 a partir do 6º; o de outro colégio, não', () => {
    expect(attacks(single('bard', 5, 'college-of-valor'))).toBe(1)
    expect(attacks(single('bard', 6, 'college-of-valor'))).toBe(2)
    expect(attacks(single('bard', 6, 'college-of-lore'))).toBe(1)
  })

  // p. 166: Ataque Extra de mais de uma classe não se acumula; o do guerreiro 11 vale.
  it('multiclasse vale o maior, sem somar', () => {
    const mc = (primary: string, primaryLevel: number, other: string, otherLevel: number) => draft({
      level: primaryLevel + otherLevel, multiclass: true, class: primary,
      additionalClasses: [extraClass(other, otherLevel)],
    })
    expect(attacks(mc('fighter', 11, 'paladin', 5))).toBe(3)
    expect(attacks(mc('paladin', 5, 'fighter', 11))).toBe(3)
    expect(attacks(mc('barbarian', 5, 'paladin', 5))).toBe(2)
  })

  it('conta o nível NA classe: guerreiro 4 / paladino 4 não tem', () => {
    const d = draft({
      level: 8, multiclass: true, class: 'fighter', additionalClasses: [extraClass('paladin', 4)],
    })
    expect(attacks(d)).toBe(1)
    expect(describeAttacksPerAction(d)).toEqual([])
  })
})

describe('Lâmina Sedenta (ataques condicionais)', () => {
  const warlock = (
    level: number,
    slotId: string,
    overrides: Partial<CharacterDraft> = {},
    pact: string | null = 'pact-of-the-blade',
  ) => draft({
    level, class: 'warlock',
    classChoices: {
      ...structuredClone(EMPTY_DRAFT.classChoices),
      progressionChoices: {
        [slotId]: ['lamina-sedenta'],
        ...(pact ? { 'warlock-pact-boon-3': [pact] } : {}),
      },
    },
    ...overrides,
  })

  it('bruxo 5 com Lâmina Sedenta: 1 ataque no número, 2 numa linha com a condição', () => {
    const d = warlock(5, 'warlock-invocations-5')
    expect(getAttacksPerAction(d).value).toBe(1)
    expect(getConditionalAttacks(d)).toEqual([
      { value: 2, condition: 'com a arma do pacto', source: 'Lâmina Sedenta' },
    ])
    expect(describeAttacksPerAction(d)).toEqual([
      'Lâmina Sedenta: você faz 2 ataques ao usar a ação de Atacar, com a arma do pacto.',
    ])
  })

  // p. 61: "Pré-requisito: 5° nível, característica Pacto da Lâmina".
  it('sem o Pacto da Lâmina (outro pacto, ou pacto nenhum) a linha some', () => {
    expect(getConditionalAttacks(warlock(5, 'warlock-invocations-5', {}, 'pact-of-the-tome'))).toEqual([])
    expect(getConditionalAttacks(warlock(5, 'warlock-invocations-5', {}, null))).toEqual([])
    expect(describeAttacksPerAction(warlock(5, 'warlock-invocations-5', {}, 'pact-of-the-chain'))).toEqual([])
  })

  it('o pacto de uma ficha de bruxo abaixo do 3º nível não conta', () => {
    expect(getConditionalAttacks(warlock(2, 'warlock-invocations-2'))).toEqual([])
  })

  it('antes do 5º nível de bruxo (pré-requisito) não dá nada', () => {
    expect(getConditionalAttacks(warlock(4, 'warlock-invocations-2'))).toEqual([])
  })

  it('bruxo sem a invocação não tem a linha', () => {
    expect(getConditionalAttacks(draft({ level: 5, class: 'warlock' }))).toEqual([])
  })

  // p. 166: "Lâmina Sedenta não lhe concede ataques adicionais se você também tiver Ataque Extra".
  it('bruxo 5 com Lâmina Sedenta / guerreiro 5: 2 ataques, sem a linha condicional', () => {
    const d = warlock(10, 'warlock-invocations-5', {
      multiclass: true, additionalClasses: [extraClass('fighter', 5)],
    })
    expect(getAttacksPerAction(d).value).toBe(2)
    expect(getConditionalAttacks(d)).toEqual([])
    expect(describeAttacksPerAction(d)).toEqual([
      'Ataque Extra: você faz 2 ataques ao usar a ação de Atacar.',
    ])
  })
})

describe('integridade dos dados: Ataque Extra', () => {
  it('toda feature "Ataque Extra" declara attacksPerAction', () => {
    const all = [
      ...Object.values(progressionFeatures.classes),
      ...Object.values(progressionFeatures.subclasses),
    ].flat() as { name: string; effects?: { attacksPerAction?: unknown } }[]
    const extra = all.filter(f => f.name === 'Ataque Extra')
    expect(extra.length).toBeGreaterThanOrEqual(6)
    for (const f of extra) expect(f.effects?.attacksPerAction).toBeDefined()
  })
})

// ── Deslocamento: Movimento Rápido e Movimento sem Armadura ───────────────────

describe('bônus de deslocamento com condição de equipamento', () => {
  const wearing = (...itemIds: string[]) => ({
    equipment: {
      ...structuredClone(EMPTY_DRAFT.equipment),
      method: 'wealth' as const,
      purchasedItems: itemIds.map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const })),
    },
  })
  const single = (classId: string, level: number, overrides: Partial<CharacterDraft> = {}) =>
    draft({ level, class: classId, race: 'human', ...overrides })

  // p. 49: +3 m a partir do 5º, "enquanto você não estiver vestindo uma armadura pesada".
  describe('Movimento Rápido (bárbaro 5)', () => {
    it('bárbaro 4 não tem; bárbaro 5 sem armadura ganha +10 pés', () => {
      expect(getSpeedBonusTotal(single('barbarian', 4))).toBe(0)
      expect(getSpeedBonusTotal(single('barbarian', 5))).toBe(10)
      expect(sheetSpeed(single('barbarian', 5))).toBe(40)
    })

    it('de gibão (média) e de escudo continua valendo', () => {
      expect(getSpeedBonusTotal(single('barbarian', 5, wearing('hide', 'shield')))).toBe(10)
    })

    it('de placas fica de fora do número, com a linha dizendo por quê', () => {
      // Força 15 final: a placa não tira os 3 m dela (p. 146), só o Movimento Rápido sai.
      const d = single('barbarian', 5, {
        ...wearing('plate'), abilityScores: { STR: 14, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      })
      expect(getSpeedBonusTotal(d)).toBe(0)
      expect(sheetSpeed(d)).toBe(30)
      expect(getSpeedBonuses(d)).toEqual([{
        source: 'Movimento Rápido', value: 10, condition: 'sem armadura pesada', active: false, blockedBy: 'Placas',
      }])
      expect(speedLines(d)).toEqual([
        'Não somado: +3 m sem armadura pesada (Movimento Rápido) — você está de Placas.',
      ])
    })

    it('ativo, a linha diz que já está somado', () => {
      expect(speedLines(single('barbarian', 5))).toEqual([
        'Deslocamento inclui +3 m sem armadura pesada (Movimento Rápido).',
      ])
    })
  })

  // p. 104 e tabela O Monge (p. 103): +3 / 4,5 / 6 / 7,5 / 9 m nos níveis 2 / 6 / 10 / 14 / 18.
  describe('Movimento sem Armadura (monge 2)', () => {
    it('segue a tabela do monge', () => {
      expect([1, 2, 5, 6, 9, 10, 14, 17, 18, 20].map(l => getSpeedBonusTotal(single('monk', l))))
        .toEqual([0, 10, 10, 15, 15, 20, 25, 25, 30, 30])
    })

    it('monge 2 humano sai com 12 m', () => {
      expect(sheetSpeed(single('monk', 2))).toBe(40)
    })

    it('de escudo ou de armadura leve não soma', () => {
      const shield = single('monk', 6, wearing('shield'))
      expect(getSpeedBonusTotal(shield)).toBe(0)
      expect(speedLines(shield)).toEqual([
        'Não somado: +4,5 m sem armadura nem escudo (Movimento sem Armadura) — você está de escudo.',
      ])
      const leather = single('monk', 6, wearing('leather', 'shield'))
      expect(getSpeedBonusTotal(leather)).toBe(0)
      expect(getSpeedBonuses(leather)[0].blockedBy).toBe('Couro e escudo')
    })
  })

  it('compra que sobrou do método riqueza não bloqueia: monge 10 no padrão com Camisão de Malha', () => {
    const d = single('monk', 10, {
      equipment: { ...wearing('chain-shirt').equipment, method: 'standard' as const },
    })
    expect(sheetSpeed(d)).toBe(50)
    expect(speedLines(d)).toEqual([
      'Deslocamento inclui +6 m sem armadura nem escudo (Movimento sem Armadura).',
    ])
  })

  describe('multiclasse', () => {
    it('conta o nível no monge, não o de personagem: guerreiro 5 / monge 2 ganha +10', () => {
      const d = single('fighter', 7, { multiclass: true, additionalClasses: [extraClass('monk', 2)] })
      expect(getSpeedBonusTotal(d)).toBe(10)
    })

    it('monge 1 numa multiclasse ainda não tem', () => {
      const d = single('fighter', 6, { multiclass: true, additionalClasses: [extraClass('monk', 1)] })
      expect(getSpeedBonuses(d)).toEqual([])
    })

    it('bárbaro 5 / monge 2 sem armadura soma as duas (características diferentes)', () => {
      const d = single('barbarian', 7, { multiclass: true, additionalClasses: [extraClass('monk', 2)] })
      expect(getSpeedBonusTotal(d)).toBe(20)
      expect(sheetSpeed(d)).toBe(50)
    })

    it('bárbaro 5 / monge 2 de gibão fica só com o Movimento Rápido', () => {
      const d = single('barbarian', 7, {
        multiclass: true, additionalClasses: [extraClass('monk', 2)], ...wearing('hide'),
      })
      expect(getSpeedBonusTotal(d)).toBe(10)
      expect(getSpeedBonuses(d).map(b => [b.source, b.active])).toEqual([
        ['Movimento Rápido', true], ['Movimento sem Armadura', false],
      ])
    })
  })

  it('a Mobilidade continua somando junto, sem linha de condição', () => {
    const d = single('monk', 2, { raceChoices: { feat: 'mobilidade' } })
    expect(getSpeedBonusTotal(d)).toBe(20)
    expect(sheetSpeed(d)).toBe(50)
    expect(speedLines(d)).toHaveLength(1)
  })

  it('sem raça, não há deslocamento', () => {
    expect(sheetSpeed(draft({ level: 2, class: 'monk' }))).toBeNull()
  })

  it('a raça e a sub-raça dão a base (elfo da floresta: 35 pés)', () => {
    expect(sheetSpeed(single('monk', 2, { race: 'elf', subrace: 'wood-elf' }))).toBe(45)
  })
})

// p. 146: "For 13" / "For 15" na tabela tiram 3 m de quem não tem a Força listada.
// p. 20: o deslocamento do anão "não é reduzido quando estiver usando armadura pesada".
describe('armadura pesada sem a Força mínima', () => {
  const wearing = (...itemIds: string[]) => ({
    ...structuredClone(EMPTY_DRAFT.equipment),
    method: 'wealth' as const,
    purchasedItems: itemIds.map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const })),
  })
  const scores = (STR: number) => ({ STR, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 })
  const fighter = (STR: number, armor: string, overrides: Partial<CharacterDraft> = {}) =>
    draft({ level: 1, class: 'fighter', race: 'human', abilityScores: scores(STR), equipment: wearing(armor), ...overrides })

  it('placas com Força 14 (15 com o +1 do humano) não reduzem: vale a Força final', () => {
    const d = fighter(14, 'plate')
    expect(getFinalAbilityScores(d).STR).toBe(15)
    expect(sheetSpeed(d)).toBe(30)
    expect(speedLines(d)).toEqual([])
  })

  it('placas com Força 13 (14 final) tiram 3 m, com a linha do motivo', () => {
    const d = fighter(13, 'plate')
    expect(sheetSpeed(d)).toBe(20)
    expect(speedLines(d)).toEqual(['Deslocamento reduzido em 3 m: Placas pede Força 15 e você tem 14.'])
  })

  it('cota de malha pede Força 13; cota de anéis e armadura média não pedem nada', () => {
    expect(sheetSpeed(fighter(11, 'chain-mail'))).toBe(20)
    expect(sheetSpeed(fighter(12, 'chain-mail'))).toBe(30)
    expect(sheetSpeed(fighter(8, 'ring-mail'))).toBe(30)
    expect(sheetSpeed(fighter(8, 'half-plate'))).toBe(30)
  })

  it('sem armadura vestida, nada muda', () => {
    expect(sheetSpeed(draft({ level: 1, class: 'fighter', race: 'human', abilityScores: scores(8) }))).toBe(30)
  })

  it('compra que sobrou de outro método não está vestida', () => {
    const d = fighter(8, 'plate')
    d.equipment.method = 'standard'
    expect(speedLines(d)).toEqual([])
  })

  it('anão de placas sem a Força: continua com 7,5 m e a linha diz por quê', () => {
    const d = fighter(10, 'plate', { race: 'dwarf', subrace: 'hill-dwarf' })
    expect(sheetSpeed(d)).toBe(25)
    expect(speedLines(d)).toEqual([
      'Deslocamento não reduzido: Placas pede Força 15 e você tem 10, mas Deslocamento (Anão da Colina) ignora a redução de 3 m.',
    ])
  })

  it('anão com a Força não ganha linha', () => {
    const d = fighter(13, 'plate', { race: 'dwarf', subrace: 'mountain-dwarf' })
    expect(getFinalAbilityScores(d).STR).toBe(15)
    expect(speedLines(d)).toEqual([])
  })

  it('a redução soma com os bônus: Mobilidade +3 m e placas sem Força dão 9 m', () => {
    const d = fighter(8, 'plate', { raceChoices: { feat: 'mobilidade' } })
    expect(sheetSpeed(d)).toBe(30)
  })

  it('sem raça não há Deslocamento ("—"), então nem linha de redução ou de bônus embaixo', () => {
    const noRace = fighter(10, 'plate', { race: null })
    expect(sheetSpeed(noRace)).toBeNull()
    expect(speedLines(noRace)).toEqual([])
    expect(speedLines(fighter(8, 'plate', { race: null, level: 5, class: 'barbarian' }))).toEqual([])
  })

  it('o bárbaro de placas sem Força perde o Movimento Rápido e ainda leva a redução', () => {
    const d = fighter(8, 'plate', { level: 5, class: 'barbarian' })
    expect(sheetSpeed(d)).toBe(20)
    expect(speedLines(d)).toEqual([
      'Não somado: +3 m sem armadura pesada (Movimento Rápido) — você está de Placas.',
      'Deslocamento reduzido em 3 m: Placas pede Força 15 e você tem 9.',
    ])
  })
})

// ── Aura de Proteção: bônus condicional nas resistências (p. 111) ─────────────

describe('Aura de Proteção (resistências condicionais)', () => {
  const paladin = (level: number, overrides: Partial<CharacterDraft> = {}) =>
    draft({ level, class: 'paladin', ...overrides })
  const aura = (cha: number, condition: string) =>
    ({ value: Math.max(1, Math.floor((cha - 10) / 2)), condition, source: 'Aura de Proteção' })
  const near3 = 'você e criaturas amigáveis a até 3 m, enquanto você estiver consciente; mínimo +1'
  const near9 = 'você e criaturas amigáveis a até 9 m, enquanto você estiver consciente; mínimo +1'

  it('antes do 6º nível de paladino não há linha', () => {
    expect(getConditionalSaveBonuses(paladin(5), scores({ CHA: 16 }))).toEqual([])
    expect(describeConditionalSaveBonuses(paladin(5), scores({ CHA: 16 }))).toEqual([])
  })

  it('paladino 6 com CAR 16: +3, numa linha com a condição', () => {
    expect(getConditionalSaveBonuses(paladin(6), scores({ CHA: 16 }))).toEqual([aura(16, near3)])
    expect(describeConditionalSaveBonuses(paladin(6), scores({ CHA: 16 }))).toEqual([
      '+3 em todos os testes de resistência (Aura de Proteção: você e criaturas amigáveis a até 3 m, enquanto você estiver consciente; mínimo +1)',
    ])
  })

  it('mínimo +1 com Carisma baixo', () => {
    expect(getConditionalSaveBonuses(paladin(6), scores({ CHA: 8 }))[0].value).toBe(1)
    expect(getConditionalSaveBonuses(paladin(6), scores({ CHA: 10 }))[0].value).toBe(1)
  })

  it('o alcance passa a 9 m no 18º nível de paladino', () => {
    expect(getConditionalSaveBonuses(paladin(17), scores({ CHA: 20 }))).toEqual([aura(20, near3)])
    expect(getConditionalSaveBonuses(paladin(18), scores({ CHA: 20 }))).toEqual([aura(20, near9)])
  })

  it('não entra no número das resistências', () => {
    const d = paladin(6, { abilityScores: scores({ CHA: 16, WIS: 12 }) })
    const fs = getFinalAbilityScores(d)
    const saves = getSavingThrowChecks(d, fs)
    expect(saves.WIS.bonus).toBe(1 + 3) // mod. 1 + proficiência 3, sem a aura
    expect(saves.STR.bonus).toBe(0)
  })

  it('multiclasse conta o nível NA classe: paladino 6 / guerreiro 12 tem a aura de 3 m', () => {
    const d = draft({
      level: 18, multiclass: true, class: 'fighter', additionalClasses: [extraClass('paladin', 6)],
    })
    expect(getConditionalSaveBonuses(d, scores({ CHA: 14 }))).toEqual([aura(14, near3)])
    const low = draft({
      level: 18, multiclass: true, class: 'fighter', additionalClasses: [extraClass('paladin', 5)],
    })
    expect(getConditionalSaveBonuses(low, scores({ CHA: 14 }))).toEqual([])
  })

  it('integridade dos dados: toda "Aura de Proteção" declara o efeito', () => {
    const all = [
      ...Object.values(progressionFeatures.classes),
      ...Object.values(progressionFeatures.subclasses),
    ].flat() as { name: string; effects?: { conditionalSaveBonus?: unknown } }[]
    const auras = all.filter(f => f.name === 'Aura de Proteção')
    expect(auras.length).toBeGreaterThanOrEqual(1)
    for (const f of auras) expect(f.effects?.conditionalSaveBonus).toBeDefined()
  })
})

// ── Efeitos do modo de jogo ──────────────────────────────────────────────────

describe('getWeaponCritThreshold (Crítico Aprimorado / Superior)', () => {
  const champion = (level: number) =>
    draft({ level, class: 'fighter', classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'champion' } })

  // p. 85-86: 19 a 20 a partir do 3º; 18 a 20 a partir do 15º.
  it('campeão 3 e 14: 19; campeão 15: 18; sem subclasse, nada', () => {
    expect(getWeaponCritThreshold(champion(3))).toEqual({ source: 'Crítico Aprimorado', value: 19 })
    expect(getWeaponCritThreshold(champion(14))).toEqual({ source: 'Crítico Aprimorado', value: 19 })
    expect(getWeaponCritThreshold(champion(15))).toEqual({ source: 'Crítico Superior', value: 18 })
    expect(getWeaponCritThreshold(draft({ level: 15, class: 'fighter' }))).toBeNull()
  })

  it('conta o nível NA classe: mago 12 / guerreiro campeão 3 fica no 19', () => {
    const d = draft({
      level: 15, multiclass: true, class: 'wizard', additionalClasses: [extraClass('fighter', 3, 'champion')],
    })
    expect(getWeaponCritThreshold(d)?.value).toBe(19)
  })
})

describe('getInitiativeAdvantageSources (Instinto Selvagem)', () => {
  it('bárbaro 7 tem; bárbaro 6 e guerreiro 7, não; conta o nível NA classe', () => {
    expect(getInitiativeAdvantageSources(draft({ level: 7, class: 'barbarian' }))).toEqual(['Instinto Selvagem'])
    expect(getInitiativeAdvantageSources(draft({ level: 6, class: 'barbarian' }))).toEqual([])
    expect(getInitiativeAdvantageSources(draft({ level: 7, class: 'fighter' }))).toEqual([])
    const mc = draft({ level: 10, multiclass: true, class: 'fighter', additionalClasses: [extraClass('barbarian', 6)] })
    expect(getInitiativeAdvantageSources(mc)).toEqual([])
  })
})

describe('getMeleeCritExtraWeaponDice (Crítico Brutal, Ataques Selvagens)', () => {
  it('bárbaro 9/13/17 pelo nível NA classe: 1/2/3; meio-orc: 1 em qualquer nível', () => {
    const barbarian = (level: number) => draft({ level, class: 'barbarian' })
    expect(getMeleeCritExtraWeaponDice(barbarian(8))).toEqual([])
    expect([9, 12, 13, 17].map(l => getMeleeCritExtraWeaponDice(barbarian(l))[0].value)).toEqual([1, 1, 2, 3])
    expect(getMeleeCritExtraWeaponDice(draft({ level: 1, class: 'fighter', race: 'half-orc' })))
      .toEqual([{ source: 'Ataques Selvagens', value: 1 }])
    const mc = draft({ level: 12, multiclass: true, class: 'fighter', additionalClasses: [extraClass('barbarian', 8)] })
    expect(getMeleeCritExtraWeaponDice(mc)).toEqual([])
  })
})

describe('getConditionalRollNotes', () => {
  it('traços raciais com a origem: Sortudo (com o teste contra a morte) e Bravura do halfling', () => {
    const notes = getConditionalRollNotes(draft({ race: 'halfling', subrace: 'lightfoot-halfling' }))
    expect(notes.map(n => n.source)).toEqual(['Sortudo', 'Bravura'])
    expect(notes[0]).toMatchObject({ rolls: ['attack', 'abilityCheck', 'save'], deathSave: true })
    expect(notes[1]).toMatchObject({ rolls: ['save'] })
    expect(notes[1].deathSave).toBeUndefined()
  })

  it('feature de classe pelo nível NA classe: Sentido de Perigo a partir do bárbaro 2', () => {
    expect(getConditionalRollNotes(draft({ level: 1, class: 'barbarian' }))).toEqual([])
    expect(getConditionalRollNotes(draft({ level: 2, class: 'barbarian' }))).toEqual([
      expect.objectContaining({ source: 'Sentido de Perigo', rolls: ['save'], abilities: ['DEX'] }),
    ])
  })

  it('sem raça nem classe, nada', () => {
    expect(getConditionalRollNotes(draft({}))).toEqual([])
  })
})
