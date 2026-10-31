import { describe, it, expect, vi } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft, type ClassEntry } from '../../types/character'
import type { ActionDeclaration } from '../../types/actions'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { getSheetActions, groupActionsByTiming } from '../actionUtils'
import { buildPlaySheet } from '../playSheet'

/**
 * Nenhum talento, traço, invocação ou manobra declara ação ainda (chegam com as ondas das ações
 * marciais, divinas e arcanas e de talentos e raças): os dados aqui ganham uma ação de mentira em
 * cada um, para conferir que `getSheetActions` os lê, e só quando valem.
 */
type Loose = { id?: string; name?: string; effects?: Record<string, unknown> }
// O vi.mock sobe para o topo do arquivo: o ajudante sobe junto (vi.hoisted).
const { withAction } = vi.hoisted(() => ({
  withAction: <T extends Loose>(item: T, id: string): T => {
    const action: ActionDeclaration = { id, name: `Ação de teste ${id}`, timing: 'action', page: 1 }
    return { ...item, effects: { ...item.effects, actions: [action] } }
  },
}))

vi.mock('../../data/feats.json', async importOriginal => {
  const { default: feats } = await importOriginal<{ default: Loose[] }>()
  return { default: feats.map(f => (f.id === 'alerta' ? withAction(f, 'test-feat') : f)) }
})
vi.mock('../../data/races.json', async importOriginal => {
  const { default: races } = await importOriginal<{ default: (Loose & { traits: Loose[] })[] }>()
  return {
    default: races.map(r => (r.id === 'half-orc'
      ? { ...r, traits: r.traits.map(t => (t.name === 'Resistência Implacável' ? withAction(t, 'test-trait') : t)) }
      : r)),
  }
})
vi.mock('../../data/eldritch-invocations.json', async importOriginal => {
  const { default: options } = await importOriginal<{ default: Loose[] }>()
  return { default: options.map(o => (o.id === 'lamina-sedenta' ? withAction(o, 'test-invocation') : o)) }
})
vi.mock('../../data/battle-master-maneuvers.json', async importOriginal => {
  const { default: options } = await importOriginal<{ default: Loose[] }>()
  return { default: options.map(o => (o.id === 'aparar' ? withAction(o, 'test-maneuver') : o)) }
})

/** A ficha completa (meio-orc bárbaro) numa classe e nível, com outra classe ao lado. */
function draftOf(classId: string, level: number, extra?: { classId: string; level: number }, patch: Partial<CharacterDraft> = {}): CharacterDraft {
  const base = structuredClone(COMPLETE_DRAFT)
  const entry = (id: string, lv: number): ClassEntry => ({
    classId: id, level: lv,
    classChoices: structuredClone(EMPTY_DRAFT.classChoices),
    spellChoices: { cantrips: [], spells: [] },
    asiChoices: [], hpRolls: [],
  })
  return {
    ...base,
    class: classId,
    level: level + (extra?.level ?? 0),
    ...(extra ? { multiclass: true, additionalClasses: [entry(extra.classId, extra.level)] } : {}),
    ...patch,
  }
}

const ids = (draft: CharacterDraft) => getSheetActions(draft).map(a => a.id)

describe('getSheetActions', () => {
  it('bárbaro 1: as duas ações da Fúria, com a origem e o texto da característica no "?"', () => {
    const actions = getSheetActions(draftOf('barbarian', 1)).filter(a => a.id.startsWith('rage'))
    expect(actions.map(a => [a.id, a.source, a.cost?.[0]?.resource ?? null])).toEqual([
      ['rage-enter', 'Fúria', 'rage'],
      ['rage-end', 'Fúria', null],
    ])
    expect(actions[0].description).toMatch(/^No seu turno, como ação bônus, entre em fúria por 1 minuto./)
  })

  it('cada classe no nível que tem NELA: guerreiro 3 / mago 2 não tem a Fúria; mago 4 / bárbaro 1, sim', () => {
    expect(ids(draftOf('fighter', 3, { classId: 'wizard', level: 2 }))).not.toContain('rage-enter')
    expect(ids(draftOf('wizard', 4, { classId: 'barbarian', level: 1 }))).toContain('rage-enter')
  })

  it('talento e traço racial, no nível de personagem, com quem os dá', () => {
    const actions = getSheetActions(draftOf('barbarian', 4, undefined, {
      asiChoices: [{ kind: 'feat', featId: 'alerta' }],
    }))
    expect(actions.filter(a => a.id.startsWith('test-')).map(a => [a.id, a.source])).toEqual([
      ['test-feat', 'Alerta'],
      ['test-trait', 'Resistência Implacável'],
    ])
  })

  it('opção escolhida em slot: a invocação vale com o pré-requisito; sem o Pacto da Lâmina, fica de fora', () => {
    const warlock = (pact: string) => draftOf('warlock', 5, undefined, {
      classChoices: {
        ...structuredClone(EMPTY_DRAFT.classChoices),
        skills: ['arcana', 'deception'],
        subclass: 'fiend',
        progressionChoices: {
          'warlock-invocations-2': ['armadura-de-sombras', 'visao-diabolica'],
          'warlock-pact-boon-3': [pact],
          'warlock-invocations-5': ['lamina-sedenta'],
        },
      },
    })
    const blade = getSheetActions(warlock('pact-of-the-blade')).find(a => a.id === 'test-invocation')
    expect(blade?.source).toBe('Invocações Místicas — Lâmina Sedenta')
    expect(ids(warlock('pact-of-the-chain'))).not.toContain('test-invocation')
  })

  it('a manobra do talento (Adepto Marcial) entra com o talento na origem', () => {
    const actions = getSheetActions(draftOf('barbarian', 4, undefined, {
      asiChoices: [{ kind: 'feat', featId: 'adepto-marcial' }],
      featSelections: { 'adepto-marcial': { maneuvers: ['aparar', 'ataque-de-finta'] } },
    }))
    expect(actions.find(a => a.id === 'test-maneuver')?.source).toBe('Adepto Marcial — Aparar')
  })

  it('o PlaySheet leva a mesma lista', () => {
    const draft = draftOf('barbarian', 1)
    expect(buildPlaySheet(draft).actions).toEqual(getSheetActions(draft))
  })
})

describe('groupActionsByTiming', () => {
  it('Ação, Ação Bônus, Reação e Outras (livre, movimento, especial), todos presentes', () => {
    const groups = groupActionsByTiming([
      { id: 'a', timing: 'bonusAction' as const },
      { id: 'b', timing: 'movement' as const },
      { id: 'c', timing: 'action' as const },
      { id: 'd', timing: 'free' as const },
    ])
    expect(Object.fromEntries(Object.entries(groups).map(([g, list]) => [g, list.map(a => a.id)]))).toEqual({
      action: ['c'], bonusAction: ['a'], reaction: [], other: ['b', 'd'],
    })
  })
})
