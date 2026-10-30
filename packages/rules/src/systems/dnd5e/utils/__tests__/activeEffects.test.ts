import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import type { PlayState } from '../../types/playState'
import { NO_SESSION } from '../../types/session'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { getFinalAbilityScores } from '../asiUtils'
import { getSheetAttacks } from '../attackUtils'
import { getSheetSession, resolveActiveEffects } from '../activeEffects'
import { buildPlaySheet } from '../playSheet'
import { createPlayState } from '../playState'
import { getConcentrationGuide, getRollGuide } from '../rollGuide'
import { getCastingRestrictions, getSheetActions, getSheetToggles } from '../sheetEffects'

/** Itens comprados pelo método riqueza: as armas e a armadura que a ficha considera equipadas. */
const carrying = (...itemIds: string[]) => ({
  equipment: {
    ...structuredClone(EMPTY_DRAFT.equipment),
    method: 'wealth' as const,
    purchasedItems: itemIds.map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const })),
  },
})

/** Bárbaro meio-orc no nível dado, com um caminho e as escolhas dele. */
function barbarian(level: number, patch: Partial<CharacterDraft> = {}, subclass: string | null = null, picks: Record<string, string[]> = {}): CharacterDraft {
  const base = structuredClone(COMPLETE_DRAFT)
  return {
    ...base, level, ...patch,
    classChoices: { ...base.classChoices, subclass, progressionChoices: picks },
  }
}

const raging = (patch: Partial<PlayState> = {}): PlayState =>
  ({ ...createPlayState('c'), activeEffects: [{ id: 'rage', startedAt: 1 }], ...patch })

const kindsOf = (effects: { effect: { kind: string } }[]) => effects.map(e => e.effect.kind)

describe('getSheetToggles: a Fúria com o que a modifica', () => {
  it('bárbaro 1: o efeito, os benefícios sem armadura pesada e o lembrete do fim prematuro', () => {
    const [rage] = getSheetToggles(barbarian(1))
    expect(rage).toMatchObject({ id: 'rage', label: 'Em fúria', source: 'Fúria', page: 48, endsOn: ['unconscious'], options: [] })
    expect(rage.benefits).toHaveLength(1)
    expect(rage.benefits[0].blockedBy).toBeUndefined()
    expect(kindsOf(rage.benefits[0].effects)).toEqual(['rollMode', 'damageDefenses'])
    expect(rage.earlyEndReminder).toContain('nem sofreu dano')
    // O meio-orc bárbaro não conjura: sem a restrição como efeito de estado.
    expect(rage.effects).toEqual([])
  })

  it('quem conjura ganha a restrição como estado, fora dos benefícios: tiefling bárbaro 1', () => {
    const [rage] = getSheetToggles(barbarian(1, { race: 'tiefling' }))
    expect(rage.effects).toEqual([
      { source: 'Fúria', effect: { kind: 'cannotCast', scope: 'gameState', page: 48 } },
      { source: 'Fúria', effect: { kind: 'endsConcentration', scope: 'gameState', page: 48 } },
    ])
  })

  it('Furioso 6: o Frenesi é a opção, com a exaustão ao fim; a Fúria Inconsciente, imunidade', () => {
    const [rage] = getSheetToggles(barbarian(6, {}, 'berserker'))
    expect(rage.options.map(o => [o.id, o.label, o.source, o.onEnd])).toEqual([['frenzy', 'Frenesi', 'Frenesi', { exhaustion: 1 }]])
    expect(rage.effects).toEqual([
      { source: 'Fúria Inconsciente', effect: { kind: 'conditionImmunity', conditions: ['charmed', 'frightened'], scope: 'gameState' } },
    ])
  })

  it('a Fúria Persistente (15) tira o lembrete do fim prematuro', () => {
    expect(getSheetToggles(barbarian(14))[0].earlyEndReminder).toBeDefined()
    expect('earlyEndReminder' in getSheetToggles(barbarian(15))[0]).toBe(false)
  })

  it('os totens entram com o nome do slot: o mesmo animal pode estar em duas características', () => {
    const totem = barbarian(14, {}, 'totem-warrior', {
      'totem-warrior-totem-3': ['bear'], 'totem-warrior-aspect-6': ['eagle'], 'totem-warrior-attunement-14': ['bear'],
    })
    const [rage] = getSheetToggles(totem)
    expect(rage.effects.map(e => [e.source, e.effect.kind])).toEqual([
      ['Totem Espiritual — Urso', 'damageDefenses'],
      ['Sintonia Totêmica — Urso', 'notice'],
      // O Conselheiro Espiritual conjura (p. 50): a restrição vem junto.
      ['Fúria', 'cannotCast'],
      ['Fúria', 'endsConcentration'],
    ])
  })

  it('sem a Fúria, nada', () => {
    expect(getSheetToggles({ ...structuredClone(EMPTY_DRAFT), class: 'wizard', level: 5 })).toEqual([])
  })
})

describe('getSheetActions', () => {
  it('as duas ações da Fúria, com a origem', () => {
    expect(getSheetActions(barbarian(1)).map(a => [a.id, a.source, a.cost?.[0]?.resource ?? null])).toEqual([
      ['rage-enter', 'Fúria', 'rage'],
      ['rage-end', 'Fúria', null],
    ])
  })
})

describe('resolveActiveEffects', () => {
  it('a Fúria de Placas liga, mas fica com blockedBy e sem os benefícios; a restrição vale assim mesmo', () => {
    const toggles = getSheetToggles(barbarian(1, { race: 'tiefling', ...carrying('plate') }))
    const [rage] = resolveActiveEffects([{ id: 'rage', startedAt: 1 }], toggles)
    expect(rage.blockedBy).toBe('Placas')
    expect(kindsOf(rage.effects)).toEqual(['cannotCast', 'endsConcentration'])
  })

  it('o Urso, sem cláusula de armadura, resiste mesmo de Placas', () => {
    const toggles = getSheetToggles(barbarian(3, carrying('plate'), 'totem-warrior', { 'totem-warrior-totem-3': ['bear'] }))
    const [rage] = resolveActiveEffects([{ id: 'rage', startedAt: 1 }], toggles)
    expect(rage.blockedBy).toBe('Placas')
    expect(rage.effects.map(e => [e.source, e.effect.kind])).toEqual([
      ['Totem Espiritual — Urso', 'damageDefenses'],
      ['Fúria', 'cannotCast'],
      ['Fúria', 'endsConcentration'],
    ])
  })

  it('a opção escolhida ao ligar entra com os efeitos dela; a que não existe, não', () => {
    const toggles = getSheetToggles(barbarian(3, {}, 'berserker'))
    const [frenzy] = resolveActiveEffects([{ id: 'rage', startedAt: 1, option: 'frenzy' }], toggles)
    expect(frenzy.option?.id).toBe('frenzy')
    expect(frenzy.effects.at(-1)?.source).toBe('Frenesi')
    const [plain] = resolveActiveEffects([{ id: 'rage', startedAt: 1, option: 'inventada' }], toggles)
    expect(plain.option).toBeUndefined()
  })

  it('efeito que a ficha não tem fica de fora', () => {
    expect(resolveActiveEffects([{ id: 'rage', startedAt: 1 }], getSheetToggles({ ...structuredClone(EMPTY_DRAFT), class: 'fighter' }))).toEqual([])
  })

  it('getSheetSession resolve o estado contra a ficha, como o PlaySheet', () => {
    const d = barbarian(3, {}, 'berserker')
    const session = getSheetSession(d, raging())
    expect(session.active).toEqual(resolveActiveEffects(raging().activeEffects, buildPlaySheet(d).toggles))
    expect(getSheetSession(d, createPlayState('c')).active).toEqual([])
  })
})

// Duas portas, sem conta paralela: sem sessão, NO_SESSION e a sessão de um estado sem efeito
// ligado dão a mesma ficha. A Revisão e o PDF nunca passam sessão.
describe('sem sessão ≡ NO_SESSION ≡ estado sem efeito ligado', () => {
  const drafts: [string, CharacterDraft][] = [
    ['a ficha de fixtures (Krusk, bárbaro 1)', COMPLETE_DRAFT],
    ['bárbaro 3 com machado grande, rapieira e machadinha', barbarian(3, carrying('greataxe', 'rapier', 'handaxe'))],
    ['tiefling bárbaro 5 de Placas', barbarian(5, { race: 'tiefling', ...carrying('plate', 'greatsword') })],
    ['Guerreiro Totêmico 14 (Urso, Águia, Águia)', barbarian(14, {}, 'totem-warrior', {
      'totem-warrior-totem-3': ['bear'], 'totem-warrior-aspect-6': ['eagle'], 'totem-warrior-attunement-14': ['eagle'],
    })],
  ]

  it.each(drafts)('%s: linhas de ataque, restrições e guia inteiro', (_, d) => {
    const scores = getFinalAbilityScores(d)
    expect(getSheetAttacks(d, scores, NO_SESSION)).toEqual(getSheetAttacks(d, scores))
    expect(getCastingRestrictions(d, NO_SESSION)).toEqual(getCastingRestrictions(d))
    const empty = createPlayState('c')
    // Um id que a ficha não tem não muda nada.
    const unknown = { ...empty, activeEffects: [{ id: 'spell:bless', startedAt: 1 }] }
    expect(getRollGuide(d, unknown)).toEqual(getRollGuide(d, empty))
    expect(getConcentrationGuide(d, unknown, 10)).toEqual(getConcentrationGuide(d, empty, 10))
  })
})
