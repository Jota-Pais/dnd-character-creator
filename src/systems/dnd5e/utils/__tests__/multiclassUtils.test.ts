import { describe, it, expect } from 'vitest'
import type { AbilityScore } from '../../types/race'
import { CLASSES, getClass } from '../classUtils'
import {
  meetsMulticlassPrereq,
  getUnmetPrereqAbilities,
  getCasterProgression,
  MULTICLASS_MIN_SCORE,
} from '../multiclassUtils'

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
