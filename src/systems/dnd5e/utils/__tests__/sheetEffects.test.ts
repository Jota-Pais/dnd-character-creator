import { describe, it, expect } from 'vitest'
import {
  getOwnedFeats,
  getInitiativeBonusTotal,
  getInitiativeBonuses,
  hasHalfProficiencyOnChecks,
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
} from '../sheetEffects'
import {
  getArmorProficiencies, hasArmorProficiency, hasWeaponProficiency,
  getSavingThrowProficiencies, getAllGrantedSkills, getAllGrantedLanguages,
  getExcludedSkillsForFeat, getExcludedWeaponsForFeat,
} from '../proficiencyUtils'
import { getArmor, getWeaponById } from '../equipmentUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import progressionFeatures from '../../data/class-progression-features.json'

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
    expect(hasHalfProficiencyOnChecks(bard(1))).toBe(false)
    expect(getInitiativeBonusTotal(bard(1))).toBe(0)
  })

  it('a partir do 2º nível soma metade do bônus de proficiência na iniciativa', () => {
    expect(hasHalfProficiencyOnChecks(bard(2))).toBe(true)
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
    expect(hasHalfProficiencyOnChecks(d)).toBe(false)
  })

  it('a parcela do bônus nunca soma: metade, inteiro ou dobrado', () => {
    const d = bard(4) // proficiência +2
    expect(getCheckProficiencyBonus(d, 'none')).toBe(1)
    expect(getCheckProficiencyBonus(d, 'proficient')).toBe(2)
    expect(getCheckProficiencyBonus(d, 'expertise')).toBe(4)
    expect(getCheckProficiencyBonus(draft({ level: 4, class: 'fighter' }), 'none')).toBe(0)
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

  it('bárbaro, monge, paladino e patrulheiro fazem 2 a partir do 5º', () => {
    expect(attacks(single('barbarian', 4))).toBe(1)
    for (const c of ['barbarian', 'monk', 'paladin', 'ranger']) {
      expect(attacks(single(c, 5))).toBe(2)
      expect(attacks(single(c, 20))).toBe(2)
    }
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
  const warlock = (level: number, slotId: string, overrides: Partial<CharacterDraft> = {}) => draft({
    level, class: 'warlock',
    classChoices: {
      ...structuredClone(EMPTY_DRAFT.classChoices),
      progressionChoices: { [slotId]: ['lamina-sedenta'] },
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
      expect(getSheetSpeed(single('barbarian', 5))).toBe(40)
    })

    it('de gibão (média) e de escudo continua valendo', () => {
      expect(getSpeedBonusTotal(single('barbarian', 5, wearing('hide', 'shield')))).toBe(10)
    })

    it('de placas fica de fora do número, com a linha dizendo por quê', () => {
      const d = single('barbarian', 5, wearing('plate'))
      expect(getSpeedBonusTotal(d)).toBe(0)
      expect(getSheetSpeed(d)).toBe(30)
      expect(getSpeedBonuses(d)).toEqual([{
        source: 'Movimento Rápido', value: 10, condition: 'sem armadura pesada', active: false, blockedBy: 'Placas',
      }])
      expect(describeSpeedBonuses(d)).toEqual([
        'Não somado: +3 m sem armadura pesada (Movimento Rápido) — você está de Placas.',
      ])
    })

    it('ativo, a linha diz que já está somado', () => {
      expect(describeSpeedBonuses(single('barbarian', 5))).toEqual([
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
      expect(getSheetSpeed(single('monk', 2))).toBe(40)
    })

    it('de escudo ou de armadura leve não soma', () => {
      const shield = single('monk', 6, wearing('shield'))
      expect(getSpeedBonusTotal(shield)).toBe(0)
      expect(describeSpeedBonuses(shield)).toEqual([
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
    expect(getSheetSpeed(d)).toBe(50)
    expect(describeSpeedBonuses(d)).toEqual([
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
      expect(getSheetSpeed(d)).toBe(50)
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
    expect(getSheetSpeed(d)).toBe(50)
    expect(describeSpeedBonuses(d)).toHaveLength(1)
  })

  it('sem raça, não há deslocamento', () => {
    expect(getSheetSpeed(draft({ level: 2, class: 'monk' }))).toBeNull()
  })

  it('a raça e a sub-raça dão a base (elfo da floresta: 35 pés)', () => {
    expect(getSheetSpeed(single('monk', 2, { race: 'elf', subrace: 'wood-elf' }))).toBe(45)
  })
})
