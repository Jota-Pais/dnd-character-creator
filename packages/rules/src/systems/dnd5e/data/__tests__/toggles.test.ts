import { describe, it, expect } from 'vitest'
import type { FeatureEffects } from '../../types/effects'
import type { LevelFeature } from '../../types/class'
import { getProgressionOptions } from '../../utils/progressionOptions'
import progressionFeatures from '../class-progression-features.json'
import progressionChoices from '../progression-choices.json'
import featsData from '../feats.json'
import racesData from '../races.json'

/**
 * Os efeitos ligados nos dados (Fase 2, onda `efeitos-ativos`): a Fúria e o que a modifica. A
 * declaração não repete custo nem texto — o custo é da ação que liga, o texto é o da
 * característica —, então o que este teste cobra é que as pontas se encontrem: toda chave de
 * efeito citada existe, o custo é um recurso da mesma característica, e toda declaração diz a
 * página.
 */

type Holder = { where: string; name: string; effects: FeatureEffects }

const features = progressionFeatures as unknown as Record<'classes' | 'subclasses', Record<string, LevelFeature[]>>
const optionLists = [...new Set(Object.values(progressionChoices as Record<string, { optionsListId: string }[]>)
  .flat().map(slot => slot.optionsListId))]
  .filter(id => id !== 'spells')

const FEATURES: Holder[] = (['classes', 'subclasses'] as const).flatMap(group =>
  Object.entries(features[group]).flatMap(([id, list]) => list.flatMap(f =>
    f.effects ? [{ where: `${group === 'classes' ? 'classe' : 'subclasse'} ${id}`, name: f.name, effects: f.effects }] : [])))

const OPTIONS: Holder[] = optionLists.flatMap(id => getProgressionOptions(id).flatMap(o =>
  o.effects ? [{ where: `opção ${id}`, name: o.name, effects: o.effects }] : []))

const HOLDERS = [...FEATURES, ...OPTIONS]

const TOGGLES = FEATURES.flatMap(h => (h.effects.toggle ? [{ ...h, toggle: h.effects.toggle }] : []))
const TOGGLE_IDS = new Set(TOGGLES.map(t => t.toggle.id))

describe('efeitos ligados nos dados', () => {
  it('a Fúria declara o efeito, as duas ações e as chaves dos condicionais', () => {
    const rage = FEATURES.find(h => h.where === 'classe barbarian' && h.name === 'Fúria')?.effects
    expect(rage?.toggle).toMatchObject({ id: 'rage', label: 'Em fúria', page: 48, endsOn: ['unconscious', 'shortRest', 'longRest'] })
    expect(rage?.toggle?.benefits?.requires).toBe('noHeavyArmor')
    expect(rage?.actions?.map(a => [a.id, a.timing])).toEqual([['rage-enter', 'bonusAction'], ['rage-end', 'bonusAction']])
    expect(rage?.weaponAttacks?.[0].conditionalDamage?.toggle).toBe('rage')
    // A restrição fica fora dos benefícios: vale mesmo de armadura pesada (linhas 3647-3661).
    expect(rage?.castingRestriction).toMatchObject({ toggle: 'rage', blocks: ['cast', 'concentrate'] })
  })

  it('ids de efeito ligado e de ação são únicos', () => {
    expect(TOGGLES.length).toBe(TOGGLE_IDS.size)
    const actionIds = HOLDERS.flatMap(h => (h.effects.actions ?? []).map(a => a.id))
    expect(new Set(actionIds).size).toBe(actionIds.length)
  })

  it('todo efeito citado em conditionalDamage, castingRestriction, ações e modificadores existe', () => {
    const cited = HOLDERS.flatMap(h => {
      const label = `${h.where}: ${h.name}`
      return [
        ...(h.effects.weaponAttacks ?? []).flatMap(w => (w.conditionalDamage?.toggle ? [[label, w.conditionalDamage.toggle]] : [])),
        ...(h.effects.castingRestriction?.toggle ? [[label, h.effects.castingRestriction.toggle]] : []),
        ...(h.effects.actions ?? []).flatMap(a => [
          ...(a.requiresToggle ? [[label, a.requiresToggle]] : []),
          ...a.outcomes.map(o => [label, o.toggle]),
        ]),
        ...(h.effects.toggleModifiers ?? []).map(m => [label, m.toggle]),
      ]
    })
    expect(cited.length).toBeGreaterThan(0)
    expect(cited.filter(([, id]) => !TOGGLE_IDS.has(id))).toEqual([])
  })

  it('o custo de toda ação é um recurso declarado na mesma característica', () => {
    const missing = HOLDERS.flatMap(h => (h.effects.actions ?? []).flatMap(a => (a.cost ?? [])
      .filter(c => !(h.effects.resources ?? []).some(r => r.id === c.resource))
      .map(c => `${h.where}: ${h.name} → ${a.id} (${c.resource})`)))
    expect(missing).toEqual([])
  })

  it('toda declaração tem página: o efeito ligado e cada ação', () => {
    for (const { where, name, toggle } of TOGGLES) expect(toggle.page, `${where}: ${name}`).toBeGreaterThan(0)
    for (const h of HOLDERS) {
      for (const a of h.effects.actions ?? []) expect(a.page, `${h.where}: ${a.id}`).toBeGreaterThan(0)
    }
  })

  it('as opções de um efeito ligado têm id único e rótulo', () => {
    for (const id of TOGGLE_IDS) {
      const options = HOLDERS.flatMap(h => (h.effects.toggleModifiers ?? []).filter(m => m.toggle === id).flatMap(m => m.options ?? []))
      expect(new Set(options.map(o => o.id)).size, id).toBe(options.length)
      for (const o of options) expect(o.label, `${id}: ${o.id}`).not.toBe('')
    }
    expect(HOLDERS.find(h => h.name === 'Frenesi')?.effects.toggleModifiers?.[0].options?.[0])
      .toMatchObject({ id: 'frenzy', onEnd: { exhaustion: 1 } })
  })

  it('os totens modificam a Fúria pela tabela das opções: o Urso resiste a tudo menos psíquico, sem cláusula de armadura', () => {
    const bear = OPTIONS.find(h => h.where === 'opção totem-spirits' && h.name === 'Urso')
    expect(bear?.effects.toggleModifiers).toEqual([{
      toggle: 'rage',
      effects: [{ kind: 'damageDefenses', defenses: { resistances: { allExcept: ['psychic'] } }, scope: 'sheet' }],
    }])
    expect(OPTIONS.find(h => h.where === 'opção totem-spirits' && h.name === 'Águia')?.effects.toggleModifiers?.[0].benefits?.requires)
      .toBe('noHeavyArmor')
    expect(OPTIONS.find(h => h.where === 'opção totem-attunements' && h.name === 'Águia')?.effects.toggleModifiers?.[0].effects?.[0])
      .toEqual({ kind: 'flySpeed', feet: 'walking', scope: 'sheet' })
    // O Aspecto da Besta não depende da Fúria.
    expect(OPTIONS.some(h => h.where === 'opção totem-aspects')).toBe(false)
  })

  it('efeito ligado, modificador e ação só nas features de classe e nas opções, onde a ficha os lê', () => {
    type Loose = { name: string; effects?: Record<string, unknown> }
    const races = racesData as unknown as { traits: Loose[]; subraces: { traits: Loose[] }[] }[]
    const elsewhere = [
      ...(featsData as unknown as Loose[]),
      ...races.flatMap(r => [...r.traits, ...r.subraces.flatMap(s => s.traits)]),
    ].filter(x => x.effects && ['toggle', 'toggleModifiers', 'actions'].some(k => k in x.effects!))
    expect(elsewhere.map(x => x.name)).toEqual([])
    // O efeito ligado é de feature de classe; opção só o modifica.
    expect(OPTIONS.filter(h => h.effects.toggle || h.effects.actions).map(h => h.name)).toEqual([])
  })
})
