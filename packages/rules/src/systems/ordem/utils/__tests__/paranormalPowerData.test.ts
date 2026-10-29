import { describe, it, expect } from 'vitest'
import { PARANORMAL_POWERS } from '../paranormalPowerUtils'
import { CLASS_POWERS, getPower } from '../powerUtils'
import { getSkill } from '../skillUtils'
import { PARANORMAL_ELEMENTS } from '../../types/ritual'

describe('PARANORMAL_POWERS — integridade estrutural', () => {
  it('tem 22 poderes (2 gerais + 5 por elemento × 4 elementos)', () => {
    expect(PARANORMAL_POWERS).toHaveLength(22)
  })

  it('nenhum id duplicado', () => {
    const ids = PARANORMAL_POWERS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cada elemento tem exatamente 5 poderes; 2 gerais sem elemento fixo; nenhum de Medo', () => {
    for (const element of PARANORMAL_ELEMENTS) {
      expect(PARANORMAL_POWERS.filter(p => p.element === element)).toHaveLength(5)
    }
    const generals = PARANORMAL_POWERS.filter(p => p.element === null)
    expect(generals.map(p => p.id).sort()).toEqual(['learn-ritual', 'resist-element'])
    expect(PARANORMAL_POWERS.some(p => (p.element as string) === 'fear')).toBe(false)
  })

  it('os 2 gerais resolvem o elemento pela sub-escolha (elementFrom + choice)', () => {
    const learnRitual = PARANORMAL_POWERS.find(p => p.id === 'learn-ritual')!
    expect(learnRitual.elementFrom).toBe('ritual-param')
    expect(learnRitual.choice).toEqual({ kind: 'ritual' })
    const resistElement = PARANORMAL_POWERS.find(p => p.id === 'resist-element')!
    expect(resistElement.elementFrom).toBe('element-param')
    expect(resistElement.choice).toEqual({ kind: 'element' })
  })

  it('todo poder tem nome e descrição não vazios', () => {
    for (const p of PARANORMAL_POWERS) {
      expect(p.name.length, p.id).toBeGreaterThan(0)
      expect(p.description.length, p.id).toBeGreaterThan(0)
    }
  })

  it('prerequisite (texto) e prereqs (estruturado) andam juntos', () => {
    for (const p of PARANORMAL_POWERS) {
      expect(Boolean(p.prerequisite), p.id).toBe(Boolean(p.prereqs?.length))
    }
  })

  it('pré-requisitos "Elemento N" batem com o elemento fixo do próprio poder', () => {
    // Na lista do livro, todo pré-requisito de contagem é do MESMO elemento do poder.
    for (const p of PARANORMAL_POWERS) {
      for (const prereq of p.prereqs ?? []) {
        if (prereq.kind === 'elementCount') {
          expect(prereq.element, p.id).toBe(p.element)
          expect(prereq.count, p.id).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it('só Aprender Ritual é repetível', () => {
    expect(PARANORMAL_POWERS.filter(p => p.repeatable).map(p => p.id)).toEqual(['learn-ritual'])
  })

  it('todo poder tem linha de Afinidade, exceto Aprender Ritual', () => {
    for (const p of PARANORMAL_POWERS) {
      if (p.id === 'learn-ritual') expect(p.affinityDescription).toBeNull()
      else expect(p.affinityDescription?.length, p.id).toBeGreaterThan(0)
    }
  })

  it('skillBonus de effects/affinityEffects aponta para perícias existentes', () => {
    for (const p of PARANORMAL_POWERS) {
      for (const effects of [p.effects, p.affinityEffects]) {
        for (const skillId of Object.keys(effects?.skillBonus ?? {})) {
          expect(getSkill(skillId), `${p.id} → ${skillId}`).toBeDefined()
        }
      }
    }
  })

  it('os efeitos numéricos do livro estão amarrados', () => {
    const byId = Object.fromEntries(PARANORMAL_POWERS.map(p => [p.id, p]))
    expect(byId['iron-blood'].effects).toEqual({ hpPerNexStep: 2 })
    expect(byId['improved-potential'].effects).toEqual({ pePerNexStep: 1 })
    expect(byId['improved-potential'].affinityEffects).toEqual({ pePerNexStep: 1 })
    expect(byId['resist-element'].effects).toEqual({ chosenElementResistance: 10 })
    expect(byId['resist-element'].affinityEffects).toEqual({ chosenElementResistance: 10 })
    expect(byId['face-death'].effects).toEqual({ peLimitBonus: 1 })
    expect(byId['face-death'].affinityEffects).toEqual({ peLimitBonus: 2 })
    expect(byId['precognition'].effects).toEqual({ defenseBonus: 2, resistanceTestsBonus: 2 })
    expect(byId['lucky-strike'].effects).toEqual({ threatMarginBonus: 1 })
    expect(byId['lucky-strike'].affinityEffects).toEqual({ critMultiplierBonus: 1 })
  })
})

describe('CLASS_POWERS — pré-requisitos estruturados', () => {
  it('todo poder de classe com prerequisite textual tem prereqs estruturado (e vice-versa)', () => {
    for (const p of CLASS_POWERS) {
      expect(Boolean(p.prerequisite), p.id).toBe(Boolean(p.prereqs?.length))
    }
  })

  it('são 18 poderes de classe com pré-requisito', () => {
    expect(CLASS_POWERS.filter(p => p.prereqs?.length)).toHaveLength(18)
  })

  it('prereqs kind classPower apontam para poderes existentes', () => {
    for (const p of CLASS_POWERS) {
      for (const prereq of p.prereqs ?? []) {
        if (prereq.kind === 'classPower') {
          expect(getPower(prereq.powerId), `${p.id} → ${prereq.powerId}`).toBeDefined()
        }
      }
    }
  })

  it('prereqs kind trainedSkill apontam para perícias existentes', () => {
    for (const p of CLASS_POWERS) {
      for (const prereq of p.prereqs ?? []) {
        if (prereq.kind === 'trainedSkill') {
          expect(prereq.anyOf.length, p.id).toBeGreaterThan(0)
          for (const skillId of prereq.anyOf) {
            expect(getSkill(skillId), `${p.id} → ${skillId}`).toBeDefined()
          }
        }
      }
    }
  })

  it('casos-chave do data-fill', () => {
    expect(getPower('element-master')!.prereqs).toEqual([
      { kind: 'classPower', powerId: 'element-specialist', sameElementParam: true },
      { kind: 'nex', min: 45 },
    ])
    expect(getPower('two-weapon-fighting')!.prereqs).toEqual([
      { kind: 'attribute', attribute: 'agility', min: 3 },
      { kind: 'trainedSkill', anyOf: ['fighting', 'aim'] },
    ])
    expect(getPower('war-tank')!.prereqs).toEqual([{ kind: 'classPower', powerId: 'heavy-armor-proficiency' }])
    expect(getPower('transcend')!.prereqs).toBeUndefined()
  })
})
