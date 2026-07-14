import { describe, it, expect } from 'vitest'
import type { AbilityScore } from '../../types/race'
import type { CharacterDraft, ClassEntry } from '../../types/character'
import { EMPTY_DRAFT } from '../../types/character'
import { CLASSES, getClass, getAverageHpAtLevel, getRolledHpAtLevel } from '../classUtils'
import {
  meetsMulticlassPrereq,
  getUnmetPrereqAbilities,
  getCasterProgression,
  MULTICLASS_MIN_SCORE,
  isMulticlassed,
  getPrimaryLevel,
  allClassEntries,
  getTotalHpAverage,
  getTotalHpRolled,
  getHitDicePool,
  getAllArmorProficiencies,
  getAllWeaponProficiencies,
  getAllAsiChoices,
  getCombinedCasterLevel,
} from '../multiclassUtils'
import { getFinalAbilityScores, isImprovementsStepComplete } from '../asiUtils'
import { isStepComplete } from '../draftValidation'
import { getCombinedSpellSlots, getPactSlots } from '../spellUtils'

function makeDraft(over: Partial<CharacterDraft>): CharacterDraft {
  return { ...EMPTY_DRAFT, ...over }
}
function entry(over: Partial<ClassEntry> & { classId: string; level: number }): ClassEntry {
  return {
    classChoices: { ...EMPTY_DRAFT.classChoices },
    spellChoices: { cantrips: [], spells: [] },
    asiChoices: [],
    hpRolls: [],
    ...over,
  }
}

describe('multiclassUtils — pré-requisitos (PHB pág. 166)', () => {
  it('MULTICLASS_MIN_SCORE é 13', () => {
    expect(MULTICLASS_MIN_SCORE).toBe(13)
  })

  it('classe de atributo único (Mago: INT 13)', () => {
    const wiz = getClass('wizard')!
    expect(meetsMulticlassPrereq(wiz, { INT: 13 })).toBe(true)
    expect(meetsMulticlassPrereq(wiz, { INT: 12 })).toBe(false)
    expect(meetsMulticlassPrereq(wiz, {})).toBe(false)
  })

  it('Guerreiro: FOR 13 OU DES 13 (mode any)', () => {
    const f = getClass('fighter')!
    expect(meetsMulticlassPrereq(f, { STR: 13, DEX: 8 })).toBe(true)
    expect(meetsMulticlassPrereq(f, { STR: 8, DEX: 13 })).toBe(true)
    expect(meetsMulticlassPrereq(f, { STR: 12, DEX: 12 })).toBe(false)
  })

  it('Monge: DES 13 E SAB 13 (mode all)', () => {
    const m = getClass('monk')!
    expect(meetsMulticlassPrereq(m, { DEX: 13, WIS: 13 })).toBe(true)
    expect(meetsMulticlassPrereq(m, { DEX: 13, WIS: 12 })).toBe(false)
    expect(meetsMulticlassPrereq(m, { DEX: 12, WIS: 13 })).toBe(false)
  })

  it('getUnmetPrereqAbilities aponta o que falta', () => {
    const monk = getClass('monk')!
    expect(getUnmetPrereqAbilities(monk, { DEX: 13, WIS: 12 })).toEqual(['WIS'])
    expect(getUnmetPrereqAbilities(monk, { DEX: 13, WIS: 13 })).toEqual([])
    // 'any' não cumprido → ambos aparecem (qualquer um resolveria)
    const fighter = getClass('fighter')!
    expect(getUnmetPrereqAbilities(fighter, { STR: 8, DEX: 8 })).toEqual(['STR', 'DEX'])
  })
})

describe('multiclassUtils — progressão de conjurador', () => {
  it('progressão da classe base', () => {
    expect(getCasterProgression(getClass('wizard')!, null)).toBe('full')
    expect(getCasterProgression(getClass('cleric')!, null)).toBe('full')
    expect(getCasterProgression(getClass('bard')!, null)).toBe('full')
    expect(getCasterProgression(getClass('paladin')!, null)).toBe('half')
    expect(getCasterProgression(getClass('ranger')!, null)).toBe('half')
    expect(getCasterProgression(getClass('warlock')!, null)).toBe('pact')
    expect(getCasterProgression(getClass('barbarian')!, null)).toBe('none')
    expect(getCasterProgression(getClass('monk')!, null)).toBe('none')
  })

  it('third-caster SÓ via subclasse Cavaleiro Arcano / Trapaceiro Arcano', () => {
    const fighter = getClass('fighter')!
    expect(getCasterProgression(fighter, null)).toBe('none')
    expect(getCasterProgression(fighter, 'champion')).toBe('none')
    expect(getCasterProgression(fighter, 'eldritch-knight')).toBe('third')
    const rogue = getClass('rogue')!
    expect(getCasterProgression(rogue, 'thief')).toBe('none')
    expect(getCasterProgression(rogue, 'arcane-trickster')).toBe('third')
  })
})

describe('multiclassUtils — integridade dos dados das 12 classes', () => {
  const PREREQ: Record<string, { mode: 'all' | 'any'; abilities: AbilityScore[] }> = {
    barbarian: { mode: 'all', abilities: ['STR'] },
    bard: { mode: 'all', abilities: ['CHA'] },
    warlock: { mode: 'all', abilities: ['CHA'] },
    cleric: { mode: 'all', abilities: ['WIS'] },
    druid: { mode: 'all', abilities: ['WIS'] },
    sorcerer: { mode: 'all', abilities: ['CHA'] },
    fighter: { mode: 'any', abilities: ['STR', 'DEX'] },
    rogue: { mode: 'all', abilities: ['DEX'] },
    wizard: { mode: 'all', abilities: ['INT'] },
    monk: { mode: 'all', abilities: ['DEX', 'WIS'] },
    paladin: { mode: 'all', abilities: ['STR', 'CHA'] },
    ranger: { mode: 'all', abilities: ['DEX', 'WIS'] },
  }
  const ARMOR = new Set(['light', 'medium', 'heavy', 'shields'])

  it('as 12 classes têm os campos e o pré-requisito bate com o doc', () => {
    expect(CLASSES).toHaveLength(12)
    for (const c of CLASSES) {
      expect(c.multiclassPrereq, `prereq ${c.id}`).toEqual(PREREQ[c.id])
      expect(['full', 'half', 'third', 'pact', 'none']).toContain(c.casterProgression)
      c.armorProficiencies.forEach(a => expect(ARMOR.has(a), `${c.id} armadura ${a}`).toBe(true))
      c.multiclassProficiencies.armor.forEach(a => expect(ARMOR.has(a)).toBe(true))
      expect(Array.isArray(c.weaponProficiencies)).toBe(true)
    }
  })

  it('multiclasse: só Bardo/Ladino/Patrulheiro concedem perícia; Feiticeiro/Mago não concedem nada', () => {
    const skillGivers = CLASSES.filter(c => c.multiclassProficiencies.skills).map(c => c.id).sort()
    expect(skillGivers).toEqual(['bard', 'ranger', 'rogue'])
    for (const id of ['sorcerer', 'wizard']) {
      const mc = getClass(id)!.multiclassProficiencies
      expect(mc.armor).toEqual([])
      expect(mc.weapons).toEqual([])
      expect(mc.tools).toEqual([])
      expect(mc.skills).toBeNull()
      expect(mc.instruments).toBe(0)
    }
    expect(getClass('rogue')!.multiclassProficiencies.tools).toEqual(['thieves-tools'])
    expect(getClass('bard')!.multiclassProficiencies.instruments).toBe(1)
    expect(getClass('bard')!.multiclassProficiencies.skills).toEqual({ count: 1, from: 'any' })
  })

  it('guerreiro multiclasse NÃO concede armadura pesada (só a classe base concede)', () => {
    expect(getClass('fighter')!.armorProficiencies).toContain('heavy')
    expect(getClass('fighter')!.multiclassProficiencies.armor).not.toContain('heavy')
  })
})

describe('multiclassUtils — nível e entradas de classe', () => {
  it('getPrimaryLevel: total menos as adicionais, nunca abaixo de 1', () => {
    expect(getPrimaryLevel(makeDraft({ class: 'fighter', level: 5 }))).toBe(5)
    expect(getPrimaryLevel(makeDraft({ class: 'fighter', level: 5, additionalClasses: [entry({ classId: 'wizard', level: 2 })] }))).toBe(3)
    expect(getPrimaryLevel(makeDraft({ class: 'fighter', level: 3, additionalClasses: [entry({ classId: 'wizard', level: 5 })] }))).toBe(1)
  })

  it('allClassEntries: primária derivada + adicionais; vazio sem classe', () => {
    expect(allClassEntries(makeDraft({ class: null }))).toEqual([])
    const single = allClassEntries(makeDraft({ class: 'fighter', level: 5 }))
    expect(single).toHaveLength(1)
    expect(single[0]).toMatchObject({ classId: 'fighter', level: 5 })
    const multi = allClassEntries(makeDraft({ class: 'fighter', level: 5, additionalClasses: [entry({ classId: 'wizard', level: 2 })] }))
    expect(multi.map(e => `${e.classId}${e.level}`)).toEqual(['fighter3', 'wizard2'])
  })

  it('isMulticlassed', () => {
    expect(isMulticlassed(makeDraft({ class: 'fighter', level: 5 }))).toBe(false)
    expect(isMulticlassed(makeDraft({ class: 'fighter', level: 5, additionalClasses: [entry({ classId: 'wizard', level: 2 })] }))).toBe(true)
  })
})

describe('multiclassUtils — PV em poço', () => {
  it('classe única equivale a getAverageHpAtLevel / getRolledHpAtLevel', () => {
    const fighter = getClass('fighter')!
    const single = makeDraft({ class: 'fighter', level: 5 })
    expect(getTotalHpAverage(single, 2)).toBe(getAverageHpAtLevel(fighter, 2, 5))
    const rolled = makeDraft({ class: 'fighter', level: 3, hpRolls: [7, 7] })
    expect(getTotalHpRolled(rolled, 0)).toBe(getRolledHpAtLevel(fighter, 0, 3, [7, 7]))
  })

  it('média: 1º nível só da primária no dado máximo; adicionais sempre na média', () => {
    // Guerreiro 3 (d10: 10 + 2×6) + Mago 2 (d6: 2×4) = 22 + 8 = 30 (CON 0)
    const d = makeDraft({ class: 'fighter', level: 5, additionalClasses: [entry({ classId: 'wizard', level: 2 })] })
    expect(getTotalHpAverage(d, 0)).toBe(30)
  })

  it('rolagem: hpRolls por classe (primária níveis 2..L; adicional 1..L)', () => {
    // Guerreiro 3 [8,8] (10+8+8=26) + Mago 2 [5,5] (5+5=10) = 36 (CON 0)
    const d = makeDraft({
      class: 'fighter', level: 5, hpMethod: 'roll', hpRolls: [8, 8],
      additionalClasses: [entry({ classId: 'wizard', level: 2, hpRolls: [5, 5] })],
    })
    expect(getTotalHpRolled(d, 0)).toBe(36)
  })

  it('getHitDicePool agrupa por tipo de dado, do maior pro menor', () => {
    const d = makeDraft({ class: 'fighter', level: 5, additionalClasses: [entry({ classId: 'wizard', level: 2 })] })
    expect(getHitDicePool(d)).toEqual([{ die: 10, count: 3 }, { die: 6, count: 2 }])
  })
})

describe('multiclassUtils — proficiências agregadas', () => {
  it('armadura: completas da primária + subconjunto de multiclasse das adicionais', () => {
    // Mago (nenhuma) + Clérigo adicional (leve/média/escudos pela tabela de multiclasse)
    const d = makeDraft({ class: 'wizard', level: 3, additionalClasses: [entry({ classId: 'cleric', level: 1 })] })
    expect(getAllArmorProficiencies(d).sort()).toEqual(['light', 'medium', 'shields'])
    // Guerreiro primário mantém armadura pesada
    expect(getAllArmorProficiencies(makeDraft({ class: 'fighter', level: 1 }))).toContain('heavy')
  })

  it('armas: base da primária + subconjunto de multiclasse das adicionais', () => {
    // Mago (adagas, dardos...) + Bárbaro adicional (simples, marciais pela multiclasse)
    const d = makeDraft({ class: 'wizard', level: 3, additionalClasses: [entry({ classId: 'barbarian', level: 1 })] })
    const w = getAllWeaponProficiencies(d)
    expect(w).toContain('daggers') // base do mago
    expect(w).toContain('martial') // concedida pelo bárbaro na multiclasse
  })
})

describe('multiclassUtils — ASI agregado e nível de conjurador combinado', () => {
  it('getAllAsiChoices junta primária + adicionais', () => {
    const d = makeDraft({
      class: 'fighter', level: 8, asiChoices: [{ kind: 'asi', abilities: ['STR', 'STR'] }],
      additionalClasses: [entry({ classId: 'wizard', level: 4, asiChoices: [{ kind: 'feat', featId: 'alert' }] })],
    })
    expect(getAllAsiChoices(d)).toHaveLength(2)
    expect(getAllAsiChoices(d)[1]).toEqual({ kind: 'feat', featId: 'alert' })
  })

  it('nível de conjurador combinado: full×1 + half⌊÷2⌋ + third⌊÷3⌋; pact e none = 0', () => {
    // Paladino 6 (half→3) / Feiticeiro 4 (full→4) = 7
    expect(getCombinedCasterLevel(makeDraft({ class: 'paladin', level: 10, additionalClasses: [entry({ classId: 'sorcerer', level: 4 })] }))).toBe(7)
    // Cavaleiro Arcano nível 6 → third → 2
    expect(getCombinedCasterLevel(makeDraft({ class: 'fighter', level: 6, classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'eldritch-knight' } }))).toBe(2)
    // Guerreiro sem subclasse conjuradora → 0
    expect(getCombinedCasterLevel(makeDraft({ class: 'fighter', level: 6 }))).toBe(0)
    // Bruxo (Pacto) não entra no pool combinado → 0
    expect(getCombinedCasterLevel(makeDraft({ class: 'warlock', level: 5 }))).toBe(0)
    // "dip" de meio-conjurador nível 1 conta 0: Mago 5 + Patrulheiro 1 = 5
    expect(getCombinedCasterLevel(makeDraft({ class: 'wizard', level: 6, additionalClasses: [entry({ classId: 'ranger', level: 1 })] }))).toBe(5)
    // classe única plena = o próprio nível
    expect(getCombinedCasterLevel(makeDraft({ class: 'wizard', level: 5 }))).toBe(5)
  })
})

describe('multiclasse — ASI aplicado e validado por classe', () => {
  it('getFinalAbilityScores soma o ASI de TODAS as classes', () => {
    const d = makeDraft({
      class: 'fighter', level: 8,
      abilityScores: { STR: 15, DEX: 10, CON: 10, INT: 12, WIS: 10, CHA: 10 },
      asiChoices: [{ kind: 'asi', abilities: ['STR', 'STR'] }],
      additionalClasses: [entry({ classId: 'wizard', level: 4, asiChoices: [{ kind: 'asi', abilities: ['INT', 'INT'] }] })],
    })
    const final = getFinalAbilityScores(d)
    expect(final.STR).toBe(17) // +2 do ASI do guerreiro
    expect(final.INT).toBe(14) // +2 do ASI do mago (antes era ignorado)
  })

  it('isImprovementsStepComplete valida os espaços de cada classe no nível dela', () => {
    const base = {
      class: 'fighter' as const, level: 8,
      abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      asiChoices: [{ kind: 'asi' as const, abilities: ['STR', 'DEX'] as AbilityScore[] }], // guerreiro 4 → 1 espaço
    }
    // Mago 4 também tem 1 espaço de ASI — sem preencher, incompleto
    const incomplete = makeDraft({ ...base, additionalClasses: [entry({ classId: 'wizard', level: 4, asiChoices: [] })] })
    expect(isImprovementsStepComplete(incomplete)).toBe(false)
    // Preenchido, completo
    const complete = makeDraft({ ...base, additionalClasses: [entry({ classId: 'wizard', level: 4, asiChoices: [{ kind: 'asi', abilities: ['INT', 'CON'] }] })] })
    expect(isImprovementsStepComplete(complete)).toBe(true)
  })
})

describe('multiclasse — validação do passo Classe (isStepComplete)', () => {
  // Guerreiro primário nível 3 (2 perícias + estilo + subclasse no nível 3) + Bárbaro adicional nível 1.
  const primaryChoices = { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'acrobatics'], fightingStyle: 'defense', subclass: 'champion' }

  it('multiclasse completa: primária no nível dela + adicional com o subconjunto de multiclasse', () => {
    const d = makeDraft({
      class: 'fighter', level: 4, classChoices: primaryChoices,
      additionalClasses: [entry({ classId: 'barbarian', level: 1 })],
    })
    expect(getPrimaryLevel(d)).toBe(3)
    expect(isStepComplete(d, 'class')).toBe(true)
  })

  it('orçamento estourado (adicionais ≥ total) reprova o passo Classe', () => {
    const d = makeDraft({
      class: 'fighter', level: 4, classChoices: primaryChoices,
      additionalClasses: [entry({ classId: 'barbarian', level: 4 })],
    })
    expect(isStepComplete(d, 'class')).toBe(false)
  })

  it('adicional incompleta reprova: Ladino adicional exige 1 perícia (multiclasse) + 2 de especialização', () => {
    const base = { class: 'fighter' as const, level: 4, classChoices: primaryChoices }
    // Ladino nível 1: multiclasse dá 1 perícia; Especialização (feature) exige 2 itens.
    const semPericia = makeDraft({ ...base, additionalClasses: [entry({ classId: 'rogue', level: 1, classChoices: { ...EMPTY_DRAFT.classChoices, expertiseItems: ['a', 'b'] } })] })
    expect(isStepComplete(semPericia, 'class')).toBe(false)
    const completo = makeDraft({ ...base, additionalClasses: [entry({ classId: 'rogue', level: 1, classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['stealth'], expertiseItems: ['stealth', 'a'] } })] })
    expect(isStepComplete(completo, 'class')).toBe(true)
  })
})

describe('multiclasse — bloqueio de pré-requisitos na Revisão', () => {
  const mc = (str: number) => makeDraft({
    class: 'wizard', level: 5,
    abilityScores: { STR: str, DEX: 12, CON: 10, INT: 13, WIS: 10, CHA: 10 },
    additionalClasses: [entry({ classId: 'fighter', level: 2 })],
    multiclass: true,
  })

  it('reprova quando uma classe não cumpre o mínimo (Guerreiro exige FOR 13 ou DES 13)', () => {
    expect(isStepComplete(mc(12), 'review')).toBe(false)
  })

  it('aprova quando todas cumprem (Mago INT 13, Guerreiro FOR 13)', () => {
    expect(isStepComplete(mc(13), 'review')).toBe(true)
  })

  it('classe única nunca é bloqueada por pré-requisito de multiclasse', () => {
    const single = makeDraft({ class: 'wizard', level: 5, abilityScores: { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 } })
    expect(isStepComplete(single, 'review')).toBe(true)
  })
})

describe('multiclasse — pool de espaços de magia combinado', () => {
  it('classe única plena usa a tabela própria', () => {
    expect(getCombinedSpellSlots(makeDraft({ class: 'wizard', level: 5 })).slice(0, 3)).toEqual([4, 3, 2])
  })

  it('UMA conjuradora numa multiclasse usa a tabela DELA, não a combinada (Paladino 5 / Guerreiro 3)', () => {
    const d = makeDraft({ class: 'paladin', level: 8, additionalClasses: [entry({ classId: 'fighter', level: 3 })] })
    expect(getPrimaryLevel(d)).toBe(5)
    // meio-conjurador nv5 = 4×1º + 2×2º (tabela do paladino), NÃO ⌊5/2⌋=2 → [3] da tabela combinada
    expect(getCombinedSpellSlots(d).slice(0, 3)).toEqual([4, 2, 0])
  })

  it('DUAS plenas somam níveis inteiros (Mago 3 / Clérigo 1 = nível de conjurador 4)', () => {
    const d = makeDraft({ class: 'wizard', level: 4, additionalClasses: [entry({ classId: 'cleric', level: 1 })] })
    expect(getCombinedSpellSlots(d).slice(0, 3)).toEqual([4, 3, 0])
  })

  it('meio + pleno: Paladino 6 / Feiticeiro 4 → ⌊6/2⌋ + 4 = 7', () => {
    const d = makeDraft({ class: 'paladin', level: 10, additionalClasses: [entry({ classId: 'sorcerer', level: 4 })] })
    expect(getCombinedSpellSlots(d).slice(0, 4)).toEqual([4, 3, 3, 1])
  })

  it('Bruxo fica fora do pool combinado; o Pacto é separado', () => {
    const w = makeDraft({ class: 'warlock', level: 5 })
    expect(getCombinedSpellSlots(w).every(n => n === 0)).toBe(true)
    expect(getPactSlots(w)).not.toBeNull()
    // Mago 5 / Bruxo 3: pool = só o mago (tabela própria); Pacto à parte
    const mix = makeDraft({ class: 'wizard', level: 8, additionalClasses: [entry({ classId: 'warlock', level: 3 })] })
    expect(getCombinedSpellSlots(mix).slice(0, 3)).toEqual([4, 3, 2])
    expect(getPactSlots(mix)).not.toBeNull()
  })
})
