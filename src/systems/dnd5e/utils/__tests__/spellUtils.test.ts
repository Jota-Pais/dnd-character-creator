import { describe, it, expect } from 'vitest'
import {
  getCasterType,
  getSpellSlots,
  getWarlockPactSlots,
  getMaxSpellLevel,
  getCantripsKnownCount,
  getSpellsKnownCount,
  getWizardSpellbookSize,
  getSpellSaveDC,
  getSpellAttackBonus,
  getMaxPreparedSpells,
  isSpellStepComplete,
  describeCastingAids,
  getSpell,
  getEntrySpellcasting,
  getRequiredCantrips,
  getCantripsNeeded,
  getKnownCantrips,
  getSpellsToChoose,
  getSchoolRestrictionStatus,
  isAllowedBySchoolRestriction,
  isOutsideSchoolRestriction,
  getCasterEntries,
  getSpellChoiceOverflow,
} from '../spellUtils'
import { getFinalAbilityScores } from '../asiUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import { getClass } from '../classUtils'
import type { GameClass, ClassSpellcasting } from '../../types/class'
import type { SpellChoices } from '../../types/spell'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const clericCasting: ClassSpellcasting = {
  ability: 'WIS',
  cantripsKnown: 3,
  type: 'prepared',
  spellsAtLevel1: 0,
  preparedFormula: 'mod. de Sabedoria + nível',
  ritualCasting: true,
  focus: 'holy-symbol',
  castingStartsAtLevel: 1,
}

const paladinCasting: ClassSpellcasting = {
  ability: 'CHA',
  cantripsKnown: 0,
  type: 'prepared',
  spellsAtLevel1: 0,
  preparedFormula: 'metade do nível + mod. de Carisma',
  ritualCasting: false,
  focus: 'holy-symbol',
  castingStartsAtLevel: 2,
}

const wizardCasting: ClassSpellcasting = {
  ability: 'INT',
  cantripsKnown: 3,
  type: 'hybrid',
  spellsAtLevel1: 6,
  preparedFormula: 'mod. de Inteligência + nível',
  ritualCasting: true,
  focus: 'arcane-focus',
  castingStartsAtLevel: 1,
}

const bardCasting: ClassSpellcasting = {
  ability: 'CHA',
  cantripsKnown: 2,
  type: 'known',
  spellsAtLevel1: 4,
  preparedFormula: null,
  ritualCasting: true,
  focus: 'arcane-focus',
  castingStartsAtLevel: 1,
}

const baseClass: GameClass = {
  id: 'fighter',
  name: 'Guerreiro',
  description: '',
  primaryAbility: ['STR'],
  hitDie: 10,
  savingThrows: ['STR', 'CON'],
  skillChoices: { count: 2, from: [] },
  toolProficiencies: { granted: [], choices: [] },
  armorProficiencies: [],
  weaponProficiencies: [],
  casterProgression: 'none',
  multiclassPrereq: { mode: 'any', abilities: ['STR', 'DEX'] },
  multiclassProficiencies: { armor: [], weapons: [], tools: [], skills: null, instruments: 0 },
  isCaster: false,
  spellcasting: null,
  subclassLevel: 3,
  subclasses: [],
  hasFightingStyle: true,
  expertise: null,
  startingEquipment: { fixed: [], choices: [], wealthDice: '2d4', wealthMultiplier: 10, wealthUnit: 'po' },
}

const clericClass: GameClass = { ...baseClass, id: 'cleric', isCaster: true, spellcasting: clericCasting }
const wizardClass: GameClass = { ...baseClass, id: 'wizard', isCaster: true, spellcasting: wizardCasting }
const bardClass: GameClass = { ...baseClass, id: 'bard', isCaster: true, spellcasting: bardCasting }
const paladinClass: GameClass = { ...baseClass, id: 'paladin', isCaster: true, spellcasting: paladinCasting }

const emptyChoices: SpellChoices = { cantrips: [], spells: [] }

// ── Caster type & progression tables ───────────────────────────────────────────

describe('getCasterType', () => {
  it('clérigo é full caster', () => expect(getCasterType('cleric')).toBe('full'))
  it('paladino é half caster', () => expect(getCasterType('paladin')).toBe('half'))
  it('bruxo é warlock', () => expect(getCasterType('warlock')).toBe('warlock'))
  it('guerreiro não é conjurador', () => expect(getCasterType('fighter')).toBeNull())
})

describe('getSpellSlots', () => {
  it('full caster nível 1 tem 2 slots de 1º nível', () =>
    expect(getSpellSlots('wizard', 1)).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]))
  it('full caster nível 5 tem [4,3,2]', () =>
    expect(getSpellSlots('cleric', 5)).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]))
  it('half caster (paladino) nível 1 não tem slots', () =>
    expect(getSpellSlots('paladin', 1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]))
  it('half caster (paladino) nível 5 tem [4,2]', () =>
    expect(getSpellSlots('paladin', 5)).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]))
  it('warlock nível 1 tem 1 slot de 1º nível', () =>
    expect(getSpellSlots('warlock', 1)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]))
  it('warlock nível 3 tem 2 slots de 2º nível', () =>
    expect(getSpellSlots('warlock', 3)).toEqual([0, 2, 0, 0, 0, 0, 0, 0, 0]))
  it('não conjurador retorna 9 zeros', () =>
    expect(getSpellSlots('fighter', 5)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]))
  it('clampeia nível acima de 20', () =>
    expect(getSpellSlots('wizard', 99)).toEqual(getSpellSlots('wizard', 20)))
})

describe('getWarlockPactSlots', () => {
  it('nível 1: 1 slot de nível 1', () =>
    expect(getWarlockPactSlots(1)).toEqual({ slots: 1, slotLevel: 1 }))
  it('nível 11: 3 slots de nível 5', () =>
    expect(getWarlockPactSlots(11)).toEqual({ slots: 3, slotLevel: 5 }))
})

describe('getMaxSpellLevel', () => {
  it('full caster nível 1 acessa magias de 1º nível', () =>
    expect(getMaxSpellLevel('wizard', 1)).toBe(1))
  it('full caster nível 5 acessa magias de 3º nível', () =>
    expect(getMaxSpellLevel('cleric', 5)).toBe(3))
  it('paladino nível 1 não acessa magias', () =>
    expect(getMaxSpellLevel('paladin', 1)).toBe(0))
  it('warlock nível 3 acessa magias de 2º nível', () =>
    expect(getMaxSpellLevel('warlock', 3)).toBe(2))
})

describe('getCantripsKnownCount', () => {
  it('mago nível 1 conhece 3 truques', () =>
    expect(getCantripsKnownCount('wizard', 1)).toBe(3))
  it('mago nível 10 conhece 5 truques', () =>
    expect(getCantripsKnownCount('wizard', 10)).toBe(5))
  it('feiticeiro nível 1 conhece 4 truques', () =>
    expect(getCantripsKnownCount('sorcerer', 1)).toBe(4))
  it('classe sem truques retorna 0', () =>
    expect(getCantripsKnownCount('paladin', 5)).toBe(0))
})

describe('getSpellsKnownCount', () => {
  it('bardo nível 1 conhece 4 magias', () =>
    expect(getSpellsKnownCount('bard', 1)).toBe(4))
  it('bardo nível 10 conhece 14 magias', () =>
    expect(getSpellsKnownCount('bard', 10)).toBe(14))
  it('patrulheiro nível 1 conhece 0 magias', () =>
    expect(getSpellsKnownCount('ranger', 1)).toBe(0))
  it('classe preparada (clérigo) não está na tabela e retorna 0', () =>
    expect(getSpellsKnownCount('cleric', 5)).toBe(0))
})

describe('getWizardSpellbookSize', () => {
  it('nível 1: 6 magias', () => expect(getWizardSpellbookSize(1)).toBe(6))
  it('nível 2: 8 magias', () => expect(getWizardSpellbookSize(2)).toBe(8))
  it('nível 5: 14 magias', () => expect(getWizardSpellbookSize(5)).toBe(14))
})

// ── Casting stats (dependem do nível) ──────────────────────────────────────────

describe('getSpellSaveDC', () => {
  it('mago INT 16 nível 1: 8 + 2 + 3 = 13', () =>
    expect(getSpellSaveDC(wizardCasting, { INT: 16 }, 1)).toBe(13))
  it('mago INT 16 nível 5 usa +3 de proficiência: 8 + 3 + 3 = 14', () =>
    expect(getSpellSaveDC(wizardCasting, { INT: 16 }, 5)).toBe(14))
  it('usa 10 (mod 0) quando o atributo está ausente', () =>
    expect(getSpellSaveDC(wizardCasting, {}, 1)).toBe(10))
})

describe('getSpellAttackBonus', () => {
  it('mago INT 16 nível 1: 2 + 3 = 5', () =>
    expect(getSpellAttackBonus(wizardCasting, { INT: 16 }, 1)).toBe(5))
  it('mago INT 16 nível 5: 3 + 3 = 6', () =>
    expect(getSpellAttackBonus(wizardCasting, { INT: 16 }, 5)).toBe(6))
})

describe('getMaxPreparedSpells', () => {
  it('clérigo SAB 16 nível 5: mod 3 + nível 5 = 8', () =>
    expect(getMaxPreparedSpells(clericCasting, { WIS: 16 }, 5)).toBe(8))
  it('paladino (fórmula "metade") CAR 16 nível 5: floor(5/2) + 3 = 5', () =>
    expect(getMaxPreparedSpells(paladinCasting, { CHA: 16 }, 5)).toBe(5))
  it('mínimo de 1 magia preparada', () =>
    expect(getMaxPreparedSpells(clericCasting, { WIS: 8 }, 1)).toBe(1))
})

// ── Validação do passo de magias ────────────────────────────────────────────────

describe('isSpellStepComplete', () => {
  it('classe sem conjuração está completa', () =>
    expect(isSpellStepComplete(baseClass, emptyChoices, 1)).toBe(true))
  it('paladino nível 1 (conjura a partir do 2) está completo', () =>
    expect(isSpellStepComplete(paladinClass, emptyChoices, 1)).toBe(true))
  it('mago nível 1 incompleto sem truques nem grimório', () =>
    expect(isSpellStepComplete(wizardClass, emptyChoices, 1)).toBe(false))
  it('mago nível 1 completo com 3 truques e 6 magias', () =>
    expect(isSpellStepComplete(wizardClass, {
      cantrips: ['c1', 'c2', 'c3'],
      spells: ['s1', 's2', 's3', 's4', 's5', 's6'],
    }, 1)).toBe(true))
  it('clérigo (preparado) incompleto sem nenhuma magia preparada', () =>
    expect(isSpellStepComplete(clericClass, { cantrips: ['c1', 'c2', 'c3'], spells: [] }, 1)).toBe(false))
  it('clérigo (preparado) completo com truques e ao menos 1 preparada', () =>
    expect(isSpellStepComplete(clericClass, { cantrips: ['c1', 'c2', 'c3'], spells: ['s1'] }, 1)).toBe(true))
  it('clérigo (preparado) ainda exige os truques mesmo com magia preparada', () =>
    expect(isSpellStepComplete(clericClass, { cantrips: ['c1'], spells: ['s1'] }, 1)).toBe(false))
  it('bardo nível 1 precisa de 2 truques e 4 magias conhecidas', () =>
    expect(isSpellStepComplete(bardClass, {
      cantrips: ['c1', 'c2'],
      spells: ['s1', 's2', 's3'],
    }, 1)).toBe(false))
})

// ── Foco e rituais (p. 53, 64, 72, 78, 96, 110; regras gerais nas p. 202 e 204) ───────────

describe('describeCastingAids', () => {
  const sc = (id: string) => getClass(id)!.spellcasting!

  it('bardo: instrumento musical e rituais das magias que conhece', () => {
    const aids = describeCastingAids(sc('bard'))
    expect(aids.focus).toBe('Foco de conjuração: instrumento musical — substitui componentes materiais sem custo indicado.')
    expect(aids.ritual).toBe('Rituais: conjura como ritual as magias com o descritor ritual que você conhece (+10 minutos, sem gastar espaço).')
  })

  it('clérigo e druida: rituais das magias preparadas, foco separado do ritual', () => {
    expect(describeCastingAids(sc('cleric')).focus).toContain('símbolo sagrado')
    expect(describeCastingAids(sc('cleric')).ritual).toContain('que você tem preparadas')
    expect(describeCastingAids(sc('druid')).focus).toContain('foco druídico')
    expect(describeCastingAids(sc('druid')).ritual).toContain('que você tem preparadas')
  })

  it('mago: qualquer magia de ritual do grimório, mesmo sem prepará-la', () => {
    expect(describeCastingAids(sc('wizard')).focus).toContain('foco arcano')
    expect(describeCastingAids(sc('wizard')).ritual).toContain('que esteja no grimório, mesmo sem prepará-la')
  })

  it('feiticeiro, bruxo e paladino têm foco mas não conjuram rituais', () => {
    for (const id of ['sorcerer', 'warlock']) {
      expect(describeCastingAids(sc(id))).toMatchObject({ ritual: null })
      expect(describeCastingAids(sc(id)).focus).toContain('foco arcano')
    }
    expect(describeCastingAids(sc('paladin'))).toMatchObject({ ritual: null })
    expect(describeCastingAids(sc('paladin')).focus).toContain('símbolo sagrado')
  })

  it('patrulheiro do PHB 2014 não tem foco nem rituais', () => {
    expect(describeCastingAids(sc('ranger'))).toEqual({ focus: null, ritual: null })
  })
})

// ── Conjuradores de 1/3 via subclasse (Cavaleiro Arcano p. 86, Trapaceiro Arcano p. 93) ────

describe('getCasterEntries: o que a Revisão e a ficha imprimível listam', () => {
  const at = { ...EMPTY_DRAFT.classChoices, subclass: 'arcane-trickster' }

  it('Trapaceiro Arcano 3 entra como conjurador, com mãos mágicas entre os truques', () => {
    const draft: CharacterDraft = {
      ...EMPTY_DRAFT, class: 'rogue', level: 3, classChoices: at,
      spellChoices: { cantrips: ['fire-bolt', 'light'], spells: ['sleep'] },
    }
    const [caster] = getCasterEntries(draft)
    expect(caster.casting.label).toBe('Ladino (Trapaceiro Arcano)')
    expect(caster.cantrips).toEqual(['mage-hand', 'fire-bolt', 'light'])
    expect(caster.spells).toEqual(['sleep'])
  })

  it('Ladino 2 (antes do arquétipo) e Ladino Ladrão não conjuram', () => {
    expect(getCasterEntries({ ...EMPTY_DRAFT, class: 'rogue', level: 2, classChoices: at })).toEqual([])
    expect(getCasterEntries({
      ...EMPTY_DRAFT, class: 'rogue', level: 5, classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'thief' },
    })).toEqual([])
  })

  it('multiclasse: cada classe com a própria conjuração, na ordem da ficha', () => {
    const draft: CharacterDraft = {
      ...EMPTY_DRAFT, class: 'wizard', level: 8,
      additionalClasses: [{
        classId: 'fighter', level: 3,
        classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'eldritch-knight' },
        spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
      }],
    }
    expect(getCasterEntries(draft).map(c => c.casting.label)).toEqual(['Mago', 'Guerreiro (Cavaleiro Arcano)'])
  })
})

describe('Cavaleiro Arcano e Trapaceiro Arcano: tabela própria de conjuração', () => {
  it('o tipo de conjurador vem da subclasse: um terço', () => {
    expect(getCasterType('fighter', 'eldritch-knight')).toBe('third')
    expect(getCasterType('rogue', 'arcane-trickster')).toBe('third')
    expect(getCasterType('fighter', 'champion')).toBeNull()
    expect(getCasterType('rogue')).toBeNull()
  })

  it('espaços da tabela do livro, do 3° ao 20° nível', () => {
    const slots = (lvl: number) => getSpellSlots('fighter', lvl, 'eldritch-knight').filter(n => n > 0)
    expect(slots(2)).toEqual([])
    expect(slots(3)).toEqual([2])
    expect(slots(4)).toEqual([3])
    expect(slots(7)).toEqual([4, 2])
    expect(slots(10)).toEqual([4, 3])
    expect(slots(13)).toEqual([4, 3, 2])
    expect(slots(16)).toEqual([4, 3, 3])
    expect(slots(19)).toEqual([4, 3, 3, 1])
    expect(getSpellSlots('rogue', 20, 'arcane-trickster').slice(0, 5)).toEqual([4, 3, 3, 1, 0])
  })

  it('nível máximo de magia: 1° no 3°, 2° no 7°, 3° no 13°, 4° no 19°', () => {
    expect(getMaxSpellLevel('fighter', 3, 'eldritch-knight')).toBe(1)
    expect(getMaxSpellLevel('fighter', 7, 'eldritch-knight')).toBe(2)
    expect(getMaxSpellLevel('rogue', 13, 'arcane-trickster')).toBe(3)
    expect(getMaxSpellLevel('rogue', 19, 'arcane-trickster')).toBe(4)
  })

  it('truques: Cavaleiro 2 (3 no 10°); Trapaceiro 3 com mãos mágicas (4 no 10°)', () => {
    expect(getCantripsKnownCount('eldritch-knight', 3)).toBe(2)
    expect(getCantripsKnownCount('eldritch-knight', 10)).toBe(3)
    expect(getCantripsKnownCount('arcane-trickster', 3)).toBe(3)
    expect(getCantripsKnownCount('arcane-trickster', 9)).toBe(3)
    expect(getCantripsKnownCount('arcane-trickster', 10)).toBe(4)
  })

  it('magias conhecidas: 3 no 3°, 6 no 8°, 7 no 10°, 13 no 20°', () => {
    for (const id of ['eldritch-knight', 'arcane-trickster']) {
      expect(getSpellsKnownCount(id, 3)).toBe(3)
      expect(getSpellsKnownCount(id, 8)).toBe(6)
      expect(getSpellsKnownCount(id, 10)).toBe(7)
      expect(getSpellsKnownCount(id, 20)).toBe(13)
    }
  })
})

describe('getEntrySpellcasting: conjuração resolvida pela subclasse', () => {
  const fighter = getClass('fighter')!
  const rogue = getClass('rogue')!

  it('Cavaleiro Arcano: lista de mago, INT, sem foco nem rituais, rótulo com a subclasse', () => {
    const casting = getEntrySpellcasting(fighter, 'eldritch-knight')!
    expect(casting.spellList).toBe('wizard')
    expect(casting.casterId).toBe('eldritch-knight')
    expect(casting.label).toBe('Guerreiro (Cavaleiro Arcano)')
    expect(casting.spellcasting.ability).toBe('INT')
    expect(casting.spellcasting.type).toBe('known')
    expect(describeCastingAids(casting.spellcasting)).toEqual({ focus: null, ritual: null })
  })

  it('guerreiro sem subclasse conjuradora não conjura', () => {
    expect(getEntrySpellcasting(fighter, 'champion')).toBeNull()
    expect(getEntrySpellcasting(fighter, null)).toBeNull()
  })

  it('classe conjuradora continua com a própria conjuração e lista', () => {
    const wizard = getClass('wizard')!
    const casting = getEntrySpellcasting(wizard, wizard.subclasses[0].id)!
    expect(casting.casterId).toBe('wizard')
    expect(casting.spellList).toBe('wizard')
    expect(casting.label).toBe('Mago')
  })

  it('CD e ataque de magia do Cavaleiro Arcano usam INT (INT 16, nível 5: CD 14, +6)', () => {
    const sc = getEntrySpellcasting(fighter, 'eldritch-knight')!.spellcasting
    expect(getSpellSaveDC(sc, { INT: 16, STR: 18 }, 5)).toBe(14)
    expect(getSpellAttackBonus(sc, { INT: 16, STR: 18 }, 5)).toBe(6)
  })

  it('Trapaceiro Arcano: mãos mágicas vem de graça e conta nos 3 truques', () => {
    const casting = getEntrySpellcasting(rogue, 'arcane-trickster')!
    expect(getRequiredCantrips(casting.spellcasting)).toEqual(['mage-hand'])
    expect(getCantripsNeeded(casting, 3)).toBe(3)
    expect(getKnownCantrips(casting.spellcasting, { cantrips: ['fire-bolt'], spells: [] }))
      .toEqual(['mage-hand', 'fire-bolt'])
    // escolher mãos mágicas de novo não conta duas vezes
    expect(getKnownCantrips(casting.spellcasting, { cantrips: ['mage-hand', 'fire-bolt'], spells: [] }))
      .toEqual(['mage-hand', 'fire-bolt'])
  })

  it('magias a escolher vêm da tabela da subclasse', () => {
    const casting = getEntrySpellcasting(fighter, 'eldritch-knight')!
    expect(getSpellsToChoose(casting, 3, { INT: 10 })).toBe(3)
    expect(getSpellsToChoose(casting, 20, { INT: 10 })).toBe(13)
  })
})

describe('restrição de escola (Cavaleiro: abjuração/evocação; Trapaceiro: encantamento/ilusão)', () => {
  const ek = getClass('fighter')!.subclasses.find(s => s.id === 'eldritch-knight')!.spellcasting!
  const at = getClass('rogue')!.subclasses.find(s => s.id === 'arcane-trickster')!.spellcasting!

  it('escolhas livres: 1 das 3 iniciais, +1 no 8°, 14° e 20°', () => {
    expect(getSchoolRestrictionStatus(ek, 3, [])!.freeSlots).toBe(1)
    expect(getSchoolRestrictionStatus(ek, 7, [])!.freeSlots).toBe(1)
    expect(getSchoolRestrictionStatus(ek, 8, [])!.freeSlots).toBe(2)
    expect(getSchoolRestrictionStatus(ek, 14, [])!.freeSlots).toBe(3)
    expect(getSchoolRestrictionStatus(ek, 20, [])!.freeSlots).toBe(4)
  })

  it('conta só as magias fora das escolas', () => {
    const status = getSchoolRestrictionStatus(ek, 3, ['shield', 'magic-missile', 'find-familiar'])!
    expect(status).toEqual({ schools: ['abjuração', 'evocação'], freeSlots: 1, freeUsed: 1 })
    expect(getSchoolRestrictionStatus(at, 3, ['sleep', 'disguise-self', 'shield'])!.freeUsed).toBe(1)
  })

  it('fora da escola só entra com escolha livre sobrando', () => {
    const findFamiliar = getSpell('find-familiar')!
    const shield = getSpell('shield')!
    expect(isAllowedBySchoolRestriction(ek, 3, ['shield'], findFamiliar)).toBe(true)
    expect(isAllowedBySchoolRestriction(ek, 3, ['detect-magic'], findFamiliar)).toBe(false)
    expect(isAllowedBySchoolRestriction(ek, 3, ['detect-magic'], shield)).toBe(true)
    expect(isAllowedBySchoolRestriction(ek, 8, ['detect-magic'], findFamiliar)).toBe(true)
  })

  it('truques não têm restrição de escola; sem restrição, tudo passa', () => {
    expect(isOutsideSchoolRestriction(at, getSpell('mage-hand')!)).toBe(false)
    expect(isOutsideSchoolRestriction(ek, getSpell('fire-bolt')!)).toBe(false)
    expect(getSchoolRestrictionStatus(getClass('wizard')!.spellcasting!, 3, ['find-familiar'])).toBeNull()
  })
})

describe('isSpellStepComplete: Cavaleiro Arcano e Trapaceiro Arcano', () => {
  const fighter = getClass('fighter')!
  const rogue = getClass('rogue')!
  const ekCantrips = ['fire-bolt', 'light', 'minor-illusion']

  it('Cavaleiro Arcano 3 sem magias está incompleto', () =>
    expect(isSpellStepComplete(fighter, emptyChoices, 3, 'eldritch-knight')).toBe(false))

  it('Cavaleiro Arcano 3 com 2 truques e 3 magias (1 fora da escola) está completo', () =>
    expect(isSpellStepComplete(fighter, {
      cantrips: ['fire-bolt', 'light'],
      spells: ['shield', 'magic-missile', 'find-familiar'],
    }, 3, 'eldritch-knight')).toBe(true))

  it('2 magias fora da escola no 3° nível é inválido', () =>
    expect(isSpellStepComplete(fighter, {
      cantrips: ['fire-bolt', 'light'],
      spells: ['shield', 'detect-magic', 'find-familiar'],
    }, 3, 'eldritch-knight')).toBe(false))

  it('4 magias fora da escola no 20° nível é válido; a 5ª não', () => {
    const outside = ['find-familiar', 'detect-magic', 'misty-step', 'sleep']
    const inside = ['shield', 'magic-missile', 'burning-hands', 'thunderwave', 'fireball',
      'mage-armor', 'counterspell', 'scorching-ray', 'lightning-bolt']
    expect(isSpellStepComplete(fighter, { cantrips: ekCantrips, spells: [...outside, ...inside] }, 20, 'eldritch-knight')).toBe(true)
    expect(isSpellStepComplete(fighter, {
      cantrips: ekCantrips,
      spells: [...outside, ...inside.slice(0, 8), 'silent-image'],
    }, 20, 'eldritch-knight')).toBe(false)
  })

  it('Guerreiro 2 com Cavaleiro Arcano ainda não conjura (completo)', () =>
    expect(isSpellStepComplete(fighter, emptyChoices, 2, 'eldritch-knight')).toBe(true))

  it('Guerreiro Campeão não tem etapa de magia', () =>
    expect(isSpellStepComplete(fighter, emptyChoices, 5, 'champion')).toBe(true))

  it('Trapaceiro Arcano completa com 2 truques escolhidos (mãos mágicas vem de graça)', () =>
    expect(isSpellStepComplete(rogue, {
      cantrips: ['fire-bolt', 'minor-illusion'],
      spells: ['sleep', 'disguise-self', 'shield'],
    }, 3, 'arcane-trickster')).toBe(true))

  it('Trapaceiro Arcano sem mãos mágicas nas escolhas continua sabendo mãos mágicas', () =>
    expect(isSpellStepComplete(rogue, {
      cantrips: ['fire-bolt', 'light'],
      spells: ['sleep', 'disguise-self', 'charm-person'],
    }, 3, 'arcane-trickster')).toBe(true))

  it('Trapaceiro Arcano com só 1 truque além de mãos mágicas está incompleto', () =>
    expect(isSpellStepComplete(rogue, {
      cantrips: ['fire-bolt'],
      spells: ['sleep', 'disguise-self', 'shield'],
    }, 3, 'arcane-trickster')).toBe(false))
})

// ── Etapa Magias com os atributos finais (raça + aprimoramentos), como a Revisão e o PDF ──

describe('magias preparadas pelos atributos finais', () => {
  const PREPARED = ['bless', 'cure-wounds', 'guiding-bolt', 'healing-word', 'shield-of-faith', 'sanctuary']
  const clerigaAna = (wis: number): CharacterDraft => ({
    ...EMPTY_DRAFT, race: 'dwarf', subrace: 'hill-dwarf', class: 'cleric', level: 3,
    abilityScores: { STR: 10, DEX: 10, CON: 14, INT: 10, WIS: wis, CHA: 10 },
    spellChoices: { cantrips: [], spells: PREPARED },
  })

  it('Clériga Anã da Colina 3 com Sab 15 (+1 racial = 16) prepara 6, não 5', () => {
    const draft = clerigaAna(15)
    const [caster] = getCasterEntries(draft)
    const finalScores = getFinalAbilityScores(draft)
    expect(finalScores.WIS).toBe(16)
    expect(getSpellsToChoose(caster.casting, 3, finalScores)).toBe(6)
    expect(getSpellsToChoose(caster.casting, 3, draft.abilityScores)).toBe(5) // o defeito: atributo base
    expect(getSpellChoiceOverflow(caster, finalScores)).toBeNull()
  })

  it('atributo baixado depois da escolha: nada some, vira aviso com o excesso', () => {
    const draft = clerigaAna(13) // 13 + 1 = 14 → mod +2 → 5 preparadas
    const [caster] = getCasterEntries(draft)
    const overflow = getSpellChoiceOverflow(caster, getFinalAbilityScores(draft))
    expect(caster.spells).toHaveLength(6)
    expect(overflow).toMatchObject({ label: 'Clérigo', chosen: 6, max: 5, excess: 1 })
    expect(overflow?.text).toContain('6 magias preparadas, mas o máximo é 5')
  })
})
