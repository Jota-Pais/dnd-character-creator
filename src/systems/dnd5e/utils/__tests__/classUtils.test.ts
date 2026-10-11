import { describe, it, expect } from 'vitest'
import {
  getHpAtLevel1,
  getHpFormula,
  getAverageHpPerLevel,
  getAverageHpAtLevel,
  getRolledHpAtLevel,
  isActiveCaster,
  isClassStepComplete,
  getExpertiseCount,
  getExpertiseOptions,
  getClassFeaturesUpToLevel,
  hasFeaturesByLevel,
  getClass,
  getSubclass,
} from '../classUtils'
import type { GameClass } from '../../types/class'
import { EMPTY_CLASS_CHOICES } from '../../types/class'

const baseClass: GameClass = {
  id: 'fighter',
  name: 'Guerreiro',
  description: '',
  primaryAbility: ['STR'],
  hitDie: 10,
  savingThrows: ['STR', 'CON'],
  skillChoices: { count: 2, from: ['athletics', 'perception'] },
  toolProficiencies: { granted: [], choices: [] },
  armorProficiencies: [],
  weaponProficiencies: [],
  casterProgression: 'none',
  multiclassPrereq: { mode: 'any', abilities: ['STR', 'DEX'] },
  multiclassProficiencies: { armor: [], weapons: [], tools: [], skills: null, instruments: 0 },
  isCaster: false,
  spellcasting: null,
  features: [],
  subclassLevel: 3,
  subclasses: [],
  hasFightingStyle: true,
  expertise: null,
  startingEquipment: { fixed: [], choices: [], wealthDice: '2d4', wealthMultiplier: 10, wealthUnit: 'po' },
}

const casterClass: GameClass = {
  id: 'cleric',
  name: 'Clérigo',
  description: '',
  primaryAbility: ['WIS'],
  hitDie: 8,
  savingThrows: ['WIS', 'CHA'],
  skillChoices: { count: 2, from: ['history', 'insight'] },
  toolProficiencies: { granted: [], choices: [] },
  armorProficiencies: [],
  weaponProficiencies: [],
  casterProgression: 'full',
  multiclassPrereq: { mode: 'all', abilities: ['WIS'] },
  multiclassProficiencies: { armor: [], weapons: [], tools: [], skills: null, instruments: 0 },
  isCaster: true,
  spellcasting: {
    ability: 'WIS',
    cantripsKnown: 3,
    type: 'prepared',
    spellsAtLevel1: 0,
    preparedFormula: 'mod. de Sabedoria + nível',
    ritualCasting: true,
    focus: 'holy-symbol',
    castingStartsAtLevel: 1,
  },
  features: [],
  subclassLevel: 1,
  subclasses: [
    { id: 'life-domain', name: 'Domínio da Vida', description: '', features: [], extras: null },
  ],
  hasFightingStyle: false,
  expertise: null,
  startingEquipment: { fixed: [], choices: [], wealthDice: '2d4', wealthMultiplier: 10, wealthUnit: 'po' },
}

const lateCasterClass: GameClass = {
  ...casterClass,
  id: 'paladin',
  spellcasting: {
    ...casterClass.spellcasting!,
    castingStartsAtLevel: 2,
  },
  subclassLevel: 3,
  subclasses: [],
}

const rogueClass: GameClass = {
  id: 'rogue',
  name: 'Ladino',
  description: '',
  primaryAbility: ['DEX'],
  hitDie: 8,
  savingThrows: ['DEX', 'INT'],
  skillChoices: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'perception', 'stealth'] },
  toolProficiencies: { granted: ['thieves-tools'], choices: [] },
  armorProficiencies: [],
  weaponProficiencies: [],
  casterProgression: 'none',
  multiclassPrereq: { mode: 'all', abilities: ['DEX'] },
  multiclassProficiencies: { armor: [], weapons: [], tools: [], skills: null, instruments: 0 },
  isCaster: false,
  spellcasting: null,
  features: [],
  subclassLevel: 3,
  subclasses: [],
  hasFightingStyle: false,
  expertise: { grants: [{ level: 1, count: 2 }, { level: 6, count: 2 }], includesThievesTools: true },
  startingEquipment: { fixed: [], choices: [], wealthDice: '2d4', wealthMultiplier: 10, wealthUnit: 'po' },
}

describe('getHpAtLevel1', () => {
  it('d10 com CON +2 retorna 12', () => expect(getHpAtLevel1(baseClass, 2)).toBe(12))
  it('d10 com CON -1 retorna 9', () => expect(getHpAtLevel1(baseClass, -1)).toBe(9))
  it('d8 com CON 0 retorna 8', () => expect(getHpAtLevel1(casterClass, 0)).toBe(8))
  it('d6 com CON +3 retorna 9', () => {
    const sorcerer = { ...baseClass, hitDie: 6 }
    expect(getHpAtLevel1(sorcerer, 3)).toBe(9)
  })
})

describe('getHpFormula', () => {
  it('retorna fórmula com dado correto para d10', () =>
    expect(getHpFormula(baseClass)).toBe('d10 + mod. de CON'))
  it('retorna fórmula com dado correto para d8', () =>
    expect(getHpFormula(casterClass)).toBe('d8 + mod. de CON'))
})

describe('getAverageHpPerLevel', () => {
  it('d10 retorna 6', () => expect(getAverageHpPerLevel(baseClass)).toBe(6))
  it('d8 retorna 5', () => expect(getAverageHpPerLevel(casterClass)).toBe(5))
  it('d6 retorna 4', () => expect(getAverageHpPerLevel({ ...baseClass, hitDie: 6 })).toBe(4))
  it('d12 retorna 7', () => expect(getAverageHpPerLevel({ ...baseClass, hitDie: 12 })).toBe(7))
})

describe('getAverageHpAtLevel', () => {
  it('nível 1 retorna o HP de nível 1', () =>
    expect(getAverageHpAtLevel(baseClass, 2, 1)).toBe(12))
  it('nível <= 1 não soma níveis extras', () =>
    expect(getAverageHpAtLevel(baseClass, 2, 0)).toBe(12))
  it('d10 CON +2 no nível 5 retorna 44', () =>
    // 12 + (6 + 2) * 4
    expect(getAverageHpAtLevel(baseClass, 2, 5)).toBe(44))
  it('d8 CON 0 no nível 3 retorna 18', () =>
    // 8 + (5 + 0) * 2
    expect(getAverageHpAtLevel(casterClass, 0, 3)).toBe(18))
})

describe('getRolledHpAtLevel', () => {
  it('nível 1 ignora os rolls', () =>
    expect(getRolledHpAtLevel(baseClass, 2, 1, [])).toBe(12))
  it('soma os rolls fornecidos + CON por nível', () =>
    // d10 CON +2, nível 3: 12 + (7+2) + (3+2) = 26
    expect(getRolledHpAtLevel(baseClass, 2, 3, [7, 3])).toBe(26))
  it('usa a média quando o roll está ausente', () =>
    // d10 CON +1, nível 2, roll undefined → média 6: 11 + (6+1) = 18
    expect(getRolledHpAtLevel(baseClass, 1, 2, [])).toBe(18))
})

describe('isActiveCaster', () => {
  it('não conjurador retorna false', () => expect(isActiveCaster(baseClass)).toBe(false))
  it('conjurador nível 1 com castingStartsAtLevel 1 retorna true', () =>
    expect(isActiveCaster(casterClass, 1)).toBe(true))
  it('paladino nível 1 com castingStartsAtLevel 2 retorna false', () =>
    expect(isActiveCaster(lateCasterClass, 1)).toBe(false))
  it('paladino nível 2 com castingStartsAtLevel 2 retorna true', () =>
    expect(isActiveCaster(lateCasterClass, 2)).toBe(true))
})

describe('isClassStepComplete', () => {
  it('retorna false se classe for null', () =>
    expect(isClassStepComplete(null, EMPTY_CLASS_CHOICES)).toBe(false))

  it('retorna false se perícias insuficientes', () =>
    expect(isClassStepComplete(baseClass, { ...EMPTY_CLASS_CHOICES, skills: ['athletics'] })).toBe(false))

  it('retorna false se estilo de luta não escolhido (Guerreiro)', () =>
    expect(isClassStepComplete(baseClass, { ...EMPTY_CLASS_CHOICES, skills: ['athletics', 'perception'] })).toBe(false))

  it('retorna true para Guerreiro com perícias e estilo de luta', () =>
    expect(isClassStepComplete(baseClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['athletics', 'perception'],
      fightingStyle: 'defense',
    })).toBe(true))

  it('Guerreiro (subclassLevel 3) nível 1 NÃO exige subclasse', () =>
    expect(isClassStepComplete(baseClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['athletics', 'perception'],
      fightingStyle: 'defense',
    }, 1)).toBe(true))

  it('Guerreiro nível 3 EXIGE subclasse', () =>
    expect(isClassStepComplete(baseClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['athletics', 'perception'],
      fightingStyle: 'defense',
    }, 3)).toBe(false))

  it('Guerreiro nível 3 com subclasse escolhida fica completo', () =>
    expect(isClassStepComplete(baseClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['athletics', 'perception'],
      fightingStyle: 'defense',
      subclass: 'champion',
    }, 3)).toBe(true))

  it('retorna false para Clérigo sem subclasse (subclassLevel 1)', () =>
    expect(isClassStepComplete(casterClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['history', 'insight'],
    })).toBe(false))

  it('retorna true para Clérigo com subclasse sem extras', () =>
    expect(isClassStepComplete(casterClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['history', 'insight'],
      subclass: 'life-domain',
    })).toBe(true))

  it('retorna false para Ladino sem expertise', () =>
    expect(isClassStepComplete(rogueClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['acrobatics', 'athletics', 'deception', 'insight'],
    })).toBe(false))

  it('retorna true para Ladino com 4 perícias e 2 expertise', () =>
    expect(isClassStepComplete(rogueClass, {
      ...EMPTY_CLASS_CHOICES,
      skills: ['acrobatics', 'athletics', 'deception', 'insight'],
      expertiseItems: ['acrobatics', 'thieves-tools'],
    })).toBe(true))
})

// Ladino p. 91 (duas no 1º, mais duas no 6º) e bardo p. 54 (duas no 3º, mais duas no 10º).
describe('Especialização por nível', () => {
  const bard = getClass('bard')!
  const rogue = getClass('rogue')!
  const loreBardChoices = {
    ...EMPTY_CLASS_CHOICES,
    skills: ['deception', 'performance', 'persuasion'],
    tools: ['flute', 'lyre', 'drum'],
    subclass: 'college-of-lore',
    subclassExtras: { skills: ['history', 'insight', 'investigation'] },
  }

  it('o bardo não tem nada antes do 3º nível, 2 do 3º ao 9º e 4 a partir do 10º', () => {
    expect(getExpertiseCount(bard, 2)).toBe(0)
    expect(getExpertiseCount(bard, 3)).toBe(2)
    expect(getExpertiseCount(bard, 9)).toBe(2)
    expect(getExpertiseCount(bard, 10)).toBe(4)
    expect(getExpertiseCount(bard, 20)).toBe(4)
  })

  it('o ladino tem 2 do 1º ao 5º nível e 4 a partir do 6º', () => {
    expect(getExpertiseCount(rogue, 1)).toBe(2)
    expect(getExpertiseCount(rogue, 5)).toBe(2)
    expect(getExpertiseCount(rogue, 6)).toBe(4)
  })

  it('classes sem a característica não concedem nenhuma', () => {
    expect(getExpertiseCount(getClass('fighter')!, 20)).toBe(0)
  })

  it('bardo do 3º nível sem Especialização deixa a etapa pendente', () => {
    expect(isClassStepComplete(bard, loreBardChoices, 3)).toBe(false)
    expect(isClassStepComplete(bard, { ...loreBardChoices, expertiseItems: ['deception', 'persuasion'] }, 3)).toBe(true)
  })

  it('bardo do 10º nível precisa de 4', () => {
    const two = {
      ...loreBardChoices,
      expertiseItems: ['deception', 'persuasion'],
      // Segredos Mágicos do 6º (colégio) e do 10º (classe) também são escolhas da etapa.
      progressionChoices: {
        'lore-magical-secrets-6': ['fireball', 'counterspell'],
        'bard-magical-secrets-10': ['revivify', 'haste'],
      },
    }
    expect(isClassStepComplete(bard, two, 10)).toBe(false)
    expect(isClassStepComplete(bard, { ...two, expertiseItems: ['deception', 'persuasion', 'history', 'insight'] }, 10)).toBe(true)
  })

  it('ladino do 6º nível precisa de 4', () => {
    const choices = {
      ...EMPTY_CLASS_CHOICES,
      skills: ['acrobatics', 'athletics', 'deception', 'insight'],
      subclass: 'thief',
      expertiseItems: ['acrobatics', 'thieves-tools'],
    }
    expect(isClassStepComplete(rogueClass, choices, 5)).toBe(true)
    expect(isClassStepComplete(rogueClass, choices, 6)).toBe(false)
  })
})

describe('getExpertiseOptions', () => {
  it('lista as perícias que o personagem tem + ferramentas de ladrão do ladino', () => {
    const options = getExpertiseOptions(['acrobatics', 'stealth'], ['thieves-tools'], true)
    expect(options.map(o => o.id)).toEqual(['acrobatics', 'stealth', 'thieves-tools'])
  })

  // "Duas das SUAS proficiências em perícia" (p. 54 e 91): não importa de onde vieram.
  it('inclui perícias de outras fontes (antecedente, colégio do conhecimento)', () => {
    const options = getExpertiseOptions(['arcana', 'history', 'performance'], [], false)
    expect(options.map(o => o.id)).toEqual(['arcana', 'history', 'performance'])
  })

  it('não oferece ferramentas de ladrão a quem não é proficiente nelas', () => {
    const options = getExpertiseOptions(['deception'], ['lute'], true)
    expect(options.map(o => o.id)).toEqual(['deception'])
  })

  // A Aptidão do bardo é só de perícias, mesmo para um bardo criminoso que use as ferramentas.
  it('a Aptidão do bardo não oferece ferramentas de ladrão nem a quem é proficiente nelas', () => {
    const options = getExpertiseOptions(['deception'], ['thieves-tools'], false)
    expect(options.map(o => o.id)).toEqual(['deception'])
  })
})

describe('getClassFeaturesUpToLevel', () => {
  const barbarian = getClass('barbarian')!
  // classe sintética que nunca estará na tabela de progressão (testa o fallback)
  const noTableClass: GameClass = {
    ...baseClass,
    id: 'sem-tabela-de-progressao',
    features: [
      { name: 'Feature Fake 1', description: '' },
      { name: 'Feature Fake 2', description: '' },
    ],
  }

  it('hasFeaturesByLevel: bárbaro sim, classe sem tabela não', () => {
    expect(hasFeaturesByLevel('barbarian')).toBe(true)
    expect(hasFeaturesByLevel('sem-tabela-de-progressao')).toBe(false)
  })

  it('bárbaro nv1 mostra só as features de nível 1', () => {
    const f = getClassFeaturesUpToLevel(barbarian, null, 1)
    expect(f.map(x => x.name)).toEqual(['Fúria', 'Defesa sem Armadura'])
    expect(f.every(x => x.level === 1)).toBe(true)
  })

  it('bárbaro nv4 ainda não tem Ataque Extra (nível 5)', () => {
    const nomes = getClassFeaturesUpToLevel(barbarian, null, 4).map(x => x.name)
    expect(nomes).toContain('Ataque Descuidado')
    expect(nomes).not.toContain('Ataque Extra')
  })

  it('bárbaro nv20 inclui Campeão Primitivo e vem ordenado por nível', () => {
    const f = getClassFeaturesUpToLevel(barbarian, null, 20)
    expect(f.map(x => x.name)).toContain('Campeão Primitivo')
    const levels = f.map(x => x.level)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
  })

  it('bárbaro nv3 com Furioso mostra a feature de entrada da subclasse', () => {
    const berserker = getSubclass(barbarian, 'berserker')!
    const nomes = getClassFeaturesUpToLevel(barbarian, berserker, 3).map(x => x.name)
    expect(nomes).toContain('Frenesi')
  })

  it('bárbaro nv10 com Furioso inclui features de subclasse por nível (3/6/10)', () => {
    const berserker = getSubclass(barbarian, 'berserker')!
    const feats = getClassFeaturesUpToLevel(barbarian, berserker, 10)
    const nomes = feats.map(x => x.name)
    expect(nomes).toContain('Frenesi') // nv3
    expect(nomes).toContain('Fúria Inconsciente') // nv6
    expect(nomes).toContain('Presença Intimidante') // nv10
    expect(nomes).not.toContain('Retaliação') // nv14, ainda não
    // features de subclasse aparecem no nível certo
    expect(feats.find(f => f.name === 'Presença Intimidante')?.level).toBe(10)
  })

  it('classe sem tabela cai no fallback: features de nível 1', () => {
    const f = getClassFeaturesUpToLevel(noTableClass, null, 10)
    expect(f.every(x => x.level === 1)).toBe(true)
    expect(f.length).toBe(noTableClass.features.length)
  })
})
