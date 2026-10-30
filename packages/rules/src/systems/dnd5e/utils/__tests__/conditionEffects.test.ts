import { describe, it, expect } from 'vitest'
import {
  CONDITIONS,
  EXHAUSTION,
  getActiveConditionEffects,
  getEffectiveConditions,
  getEffectiveHpMax,
  applyConditionSpeed,
  resolveRollMode,
  withConditionApplied,
  type ConditionState,
} from '../sheetEffects'
import type { ConditionId, ExhaustionLevel } from '../../types/condition'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import type { PlayState } from '../../types/playState'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { getDamageLabel } from '../damageTypes'
import { buildPlaySheet } from '../playSheet'
import { addCondition, applyDamage, createPlayState, getCurrentHp, getPlayEffects } from '../playState'
import { getRollGuide } from '../rollGuide'

const ALL: ConditionId[] = [
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible',
  'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious',
]

function active(conditions: ConditionId[] = [], exhaustion: ExhaustionLevel = 0) {
  const state: ConditionState = { conditions, exhaustion }
  return getActiveConditionEffects(state)
}

const sources = (list: { source: string }[]) => list.map(s => s.source)

describe('catálogo de condições', () => {
  it('tem as 14 condições do Apêndice A e a exaustão com 6 níveis', () => {
    expect(CONDITIONS.map(c => c.id).sort()).toEqual([...ALL].sort())
    expect(EXHAUSTION.id).toBe('exhaustion')
    expect(EXHAUSTION.levels.map(l => l.level)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('todo efeito condicional tem texto para a UI, e todo "implica" aponta para condição existente', () => {
    for (const c of CONDITIONS) {
      for (const e of c.effects) if (e.scope === 'notice') expect(e.text.length).toBeGreaterThan(0)
      for (const id of c.implies) expect(ALL).toContain(id)
    }
  })

  it('imunidade a dano aponta para o tipo; o dano por extenso sai de damage-types.json', () => {
    // A tela usa o texto da tabela ("Imune a dano de veneno"): montar "dano de ${tipo}" daria
    // "dano de elétrico" num tipo adjetivo.
    const immunities = CONDITIONS.flatMap(c => c.effects).filter(e => e.kind === 'damageImmunity')
    expect(immunities.map(e => e.damageType)).toEqual(['poison'])
    expect(immunities.map(e => getDamageLabel(e.damageType))).toEqual(['dano de veneno'])
    expect(active(['petrified']).damageImmunities).toEqual([
      { damageType: 'poison', sources: [{ source: 'condition:petrified', label: 'Petrificado' }] },
    ])
  })

  it('Cego e Surdo trazem "não pode ver" / "não pode ouvir" (decisão 15)', () => {
    const text = (id: ConditionId) => CONDITIONS.find(c => c.id === id)!.text.join(' ')
    expect(text('blinded')).toContain('não pode ver')
    expect(text('deafened')).toContain('não pode ouvir')
  })
})

describe('implicações', () => {
  it.each(['stunned', 'unconscious', 'paralyzed', 'petrified'] as ConditionId[])(
    '%s implica Incapacitado, derivado (não gravado)',
    id => {
      const effective = getEffectiveConditions([id])
      const inc = effective.find(c => c.id === 'incapacitated')
      expect(inc).toEqual({ id: 'incapacitated', name: 'Incapacitado', direct: false, impliedBy: [id] })
    },
  )

  it('não repete: Incapacitado gravado e implicado aparece uma vez, como direto', () => {
    const effective = getEffectiveConditions(['incapacitated', 'paralyzed', 'stunned'])
    expect(effective.filter(c => c.id === 'incapacitated')).toEqual([
      { id: 'incapacitated', name: 'Incapacitado', direct: true, impliedBy: ['paralyzed', 'stunned'] },
    ])
  })

  it('a origem do efeito derivado diz de onde veio', () => {
    const fx = active(['paralyzed'])
    expect(fx.noActions.sources).toEqual([{ source: 'condition:incapacitated', label: 'Incapacitado (por Paralisado)' }])
  })

  it('condição sem implicação não traz Incapacitado', () => {
    expect(getEffectiveConditions(['poisoned', 'prone']).map(c => c.id)).toEqual(['poisoned', 'prone'])
  })

  it('aplicar Inconsciente grava também o Caído (que fica ao acordar)', () => {
    expect(withConditionApplied([], 'unconscious')).toEqual(['unconscious', 'prone'])
    expect(withConditionApplied(['prone'], 'unconscious')).toEqual(['prone', 'unconscious'])
    expect(withConditionApplied(['poisoned'], 'blinded')).toEqual(['poisoned', 'blinded'])
  })
})

describe('exaustão cumulativa', () => {
  it('nível 0: nada', () => {
    const fx = active([], 0)
    expect(fx.abilityChecks.STR.mode).toBe('normal')
    expect(fx.speed.result).toBe('normal')
    expect(fx.hpMax.multiplier).toBe(1)
    expect(fx.dead.active).toBe(false)
  })

  it('nível 1: desvantagem em testes de habilidade, inclusive iniciativa e passivo −5 (decisão 9)', () => {
    const fx = active([], 1)
    for (const a of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const) {
      expect(fx.abilityChecks[a].mode).toBe('disadvantage')
      expect(fx.passiveModifier[a]).toBe(-5)
      expect(fx.savingThrows[a].mode).toBe('normal')
    }
    expect(fx.initiative.mode).toBe('disadvantage')
    expect(sources(fx.initiative.disadvantage)).toEqual(['exhaustion:1'])
    expect(fx.attack.mode).toBe('normal')
    expect(fx.speed.result).toBe('normal')
  })

  it('nível 2: + deslocamento à metade, para baixo na grade de 1,5 m (decisão de 2026-10-25)', () => {
    const fx = active([], 2)
    expect(fx.abilityChecks.WIS.mode).toBe('disadvantage')
    expect(fx.speed.result).toBe('half')
    // 30 pés → 15 (4,5 m); 25 → 10 (3 m), não 12 (3,6 m); 35 → 15.
    expect(applyConditionSpeed(30, fx)).toBe(15)
    expect(applyConditionSpeed(25, fx)).toBe(10)
    expect(applyConditionSpeed(35, fx)).toBe(15)
  })

  it('nível 3: + desvantagem em ataques e em todos os testes de resistência', () => {
    const fx = active([], 3)
    expect(fx.attack.mode).toBe('disadvantage')
    expect(fx.savingThrows.CON.mode).toBe('disadvantage')
    expect(fx.savingThrows.CHA.mode).toBe('disadvantage')
    expect(fx.speed.result).toBe('half')
    expect(fx.hpMax.multiplier).toBe(1)
  })

  it('nível 4: + PV máximo pela metade, arredondado para baixo', () => {
    const fx = active([], 4)
    expect(fx.hpMax).toEqual({ multiplier: 0.5, sources: [{ source: 'exhaustion:4', label: 'Exaustão 4' }] })
    expect(getEffectiveHpMax(41, fx)).toBe(20)
    expect(fx.attack.mode).toBe('disadvantage')
    expect(fx.speed.result).toBe('half')
  })

  it('nível 5: deslocamento 0 prevalece sobre a metade do nível 2', () => {
    const fx = active([], 5)
    expect(fx.speed.result).toBe('zero')
    expect(sources(fx.speed.half)).toEqual(['exhaustion:2'])
    expect(sources(fx.speed.zero)).toEqual(['exhaustion:5'])
    expect(applyConditionSpeed(30, fx)).toBe(0)
    expect(fx.hpMax.multiplier).toBe(0.5)
    expect(fx.dead.active).toBe(false)
  })

  it('nível 6: morte, encerra a concentração e mantém os efeitos anteriores', () => {
    const fx = active([], 6)
    expect(fx.dead).toEqual({ active: true, sources: [{ source: 'exhaustion:6', label: 'Exaustão 6' }] })
    expect(fx.endsConcentration.active).toBe(true)
    expect(sources(fx.endsConcentration.sources)).toEqual(['exhaustion:6'])
    expect(fx.speed.result).toBe('zero')
    expect(fx.hpMax.multiplier).toBe(0.5)
    expect(fx.abilityChecks.DEX.mode).toBe('disadvantage')
  })

  it('nível fora da faixa é limitado a 0–6', () => {
    expect(getActiveConditionEffects({ conditions: [], exhaustion: 9 as ExhaustionLevel }).exhaustion).toBe(6)
    expect(getActiveConditionEffects({ conditions: [], exhaustion: -1 as ExhaustionLevel }).exhaustion).toBe(0)
  })
})

describe('vantagem e desvantagem se anulam', () => {
  it('regra da pág. 175', () => {
    expect(resolveRollMode([], [])).toBe('normal')
    expect(resolveRollMode(['a', 'b'], [])).toBe('advantage')
    expect(resolveRollMode([], ['a', 'b', 'c'])).toBe('disadvantage')
    expect(resolveRollMode(['a'], ['a', 'b', 'c'])).toBe('normal')
  })

  it('Invisível × Envenenado: ataque normal, guardando as duas fontes', () => {
    const fx = active(['invisible', 'poisoned'])
    expect(fx.attack.mode).toBe('normal')
    expect(sources(fx.attack.advantage)).toEqual(['condition:invisible'])
    expect(sources(fx.attack.disadvantage)).toEqual(['condition:poisoned'])
  })

  it('várias desvantagens contra uma vantagem ainda dão normal', () => {
    const fx = active(['invisible', 'poisoned', 'prone', 'restrained', 'blinded'], 3)
    expect(fx.attack.disadvantage).toHaveLength(5)
    expect(fx.attack.mode).toBe('normal')
  })

  it('duas fontes de desvantagem valem uma: Envenenado + Exaustão 1 nos testes', () => {
    const fx = active(['poisoned'], 1)
    expect(fx.abilityChecks.INT.mode).toBe('disadvantage')
    expect(fx.passiveModifier.WIS).toBe(-5)
    expect(sources(fx.abilityChecks.INT.disadvantage)).toEqual(['condition:poisoned', 'exhaustion:1'])
  })

  it('Impedido: desvantagem só no TR de Destreza', () => {
    const fx = active(['restrained'])
    expect(fx.savingThrows.DEX.mode).toBe('disadvantage')
    expect(fx.savingThrows.STR.mode).toBe('normal')
    expect(fx.abilityChecks.DEX.mode).toBe('normal')
  })

  it('Amedrontado é condicional: não mexe no modo, vira linha com a condição', () => {
    const fx = active(['frightened'])
    expect(fx.attack.mode).toBe('normal')
    expect(fx.abilityChecks.WIS.mode).toBe('normal')
    expect(fx.lines.some(l => l.kind === 'rollMode' && l.source.label === 'Amedrontado')).toBe(true)
  })
})

describe('falha automática', () => {
  it.each(['stunned', 'unconscious', 'paralyzed', 'petrified'] as ConditionId[])(
    '%s: falha automática em TR de FOR e DES, não nos outros',
    id => {
      const fx = active([id])
      expect(sources(fx.savingThrows.STR.autoFail)).toEqual([`condition:${id}`])
      expect(sources(fx.savingThrows.DEX.autoFail)).toEqual([`condition:${id}`])
      for (const a of ['CON', 'INT', 'WIS', 'CHA'] as const) expect(fx.savingThrows[a].autoFail).toEqual([])
      expect(fx.abilityChecks.STR.autoFail).toEqual([])
    },
  )

  it('Cego e Surdo: falha só em teste que requer visão/audição, como linha (não automática)', () => {
    const fx = active(['blinded', 'deafened'])
    expect(fx.abilityChecks.WIS.autoFail).toEqual([])
    const autoFailLines = fx.lines.filter(l => l.kind === 'autoFail').map(l => l.source.label)
    expect(autoFailLines).toEqual(['Cego', 'Surdo'])
  })
})

describe('deslocamento', () => {
  it('Agarrado e Impedido zeram e ignoram bônus', () => {
    for (const id of ['grappled', 'restrained'] as ConditionId[]) {
      const fx = active([id])
      expect(fx.speed.result).toBe('zero')
      expect(fx.speed.ignoreBonuses).toBe(true)
      expect(applyConditionSpeed(40, fx)).toBe(0)
    }
  })

  it('"não pode se mover" zera (Atordoado, Inconsciente, Paralisado, Petrificado)', () => {
    for (const id of ['stunned', 'unconscious', 'paralyzed', 'petrified'] as ConditionId[]) {
      expect(active([id]).speed.result).toBe('zero')
    }
  })

  it('zero vence metade em qualquer ordem: Agarrado + Exaustão 2', () => {
    const fx = active(['grappled'], 2)
    expect(fx.speed.result).toBe('zero')
    expect(applyConditionSpeed(30, fx)).toBe(0)
  })

  it('Caído não mexe no número: rastejar vira linha', () => {
    const fx = active(['prone'])
    expect(fx.speed.result).toBe('normal')
    expect(applyConditionSpeed(30, fx)).toBe(30)
    expect(fx.lines.some(l => l.kind === 'notice' && l.page === 192)).toBe(true)
  })
})

describe('concentração e estados', () => {
  it.each(['incapacitated', 'stunned', 'unconscious', 'paralyzed', 'petrified'] as ConditionId[])(
    '%s encerra a concentração e tira ações e reações',
    id => {
      const fx = active([id])
      expect(fx.endsConcentration.active).toBe(true)
      expect(fx.noActions.active).toBe(true)
      expect(fx.noReactions.active).toBe(true)
    },
  )

  it.each(['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'invisible', 'poisoned', 'prone', 'restrained'] as ConditionId[])(
    '%s não encerra a concentração',
    id => {
      expect(active([id]).endsConcentration.active).toBe(false)
    },
  )

  it('várias incapacitantes: a concentração cai uma vez, com uma origem só (Incapacitado)', () => {
    const fx = active(['paralyzed', 'stunned'])
    expect(fx.endsConcentration.sources).toEqual([
      { source: 'condition:incapacitated', label: 'Incapacitado (por Paralisado, Atordoado)' },
    ])
  })

  it('Petrificado: resistência a todo dano; Paralisado/Inconsciente/Petrificado não falam', () => {
    expect(active(['petrified']).resistAllDamage.active).toBe(true)
    expect(active(['paralyzed']).resistAllDamage.active).toBe(false)
    for (const id of ['paralyzed', 'unconscious', 'petrified'] as ConditionId[]) {
      expect(active([id]).cannotSpeak.active).toBe(true)
    }
    expect(active(['stunned']).cannotSpeak.active).toBe(false)
  })

  it('ataques contra você viram linhas, nunca número', () => {
    const fx = active(['unconscious'])
    const against = fx.lines.filter(l => l.kind === 'againstYou').map(l => l.text)
    expect(against).toHaveLength(2)
    expect(against.some(t => t.includes('crítico'))).toBe(true)
  })

  it('sem nada ativo: tudo normal, sem linhas', () => {
    const fx = active()
    expect(fx.conditions).toEqual([])
    expect(fx.lines).toEqual([])
    expect(fx.endsConcentration.active).toBe(false)
    expect(fx.passiveModifier.WIS).toBe(0)
    expect(fx.deathSave).toEqual({ mode: 'normal', advantage: [], disadvantage: [], autoFail: [] })
  })
})

describe('suspensão (Petrificado → Envenenado, regras-condicoes.md 6.3)', () => {
  it('Envenenado fica na lista, marcado como suspenso, e sem efeito nenhum', () => {
    const fx = active(['poisoned', 'petrified'])
    expect(fx.conditions.find(c => c.id === 'poisoned')).toMatchObject({ id: 'poisoned', suspendedBy: ['petrified'] })
    expect(fx.attack.disadvantage).toEqual([])
    for (const a of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const) {
      expect(fx.abilityChecks[a].mode).toBe('normal')
      expect(fx.passiveModifier[a]).toBe(0)
    }
    expect(fx.initiative.mode).toBe('normal')
    expect(fx.lines.some(l => l.source.source === 'condition:petrified' && l.text.includes('Envenenado fica suspenso'))).toBe(true)
    expect(fx.lines.some(l => l.source.source === 'condition:poisoned')).toBe(false)
  })

  it('os efeitos do Petrificado continuam, e sem o Petrificado o Envenenado volta a valer', () => {
    const fx = active(['poisoned', 'petrified'])
    expect(fx.resistAllDamage.active).toBe(true)
    expect(sources(fx.savingThrows.DEX.autoFail)).toEqual(['condition:petrified'])
    const back = active(['poisoned'])
    expect(back.conditions[0].suspendedBy).toBeUndefined()
    expect(back.attack.mode).toBe('disadvantage')
    expect(back.passiveModifier.WIS).toBe(-5)
  })

  it('a suspensão só existe com o Envenenado presente: Petrificado sozinho não gera a linha', () => {
    expect(active(['petrified']).lines.some(l => l.text.includes('fica suspenso enquanto'))).toBe(false)
  })
})

describe('teste contra a morte (regras-dano-e-morte.md, Notas)', () => {
  it('Exaustão 3 + Inconsciente: desvantagem e nenhuma falha automática', () => {
    const fx = active(['unconscious'], 3)
    expect(fx.deathSave.mode).toBe('disadvantage')
    expect(sources(fx.deathSave.disadvantage)).toEqual(['exhaustion:3'])
    expect(fx.deathSave.autoFail).toEqual([])
    // O TR de FOR/DES do Inconsciente segue com a falha automática — o contra a morte não.
    expect(fx.savingThrows.DEX.autoFail.length).toBeGreaterThan(0)
  })

  it('fonte de um atributo só não entra: Impedido (TR de DES) não mexe no teste contra a morte', () => {
    const fx = active(['restrained', 'unconscious'])
    expect(fx.savingThrows.DEX.mode).toBe('disadvantage')
    expect(fx.deathSave.mode).toBe('normal')
    expect(fx.deathSave.disadvantage).toEqual([])
  })
})

// ── Efeitos ligados no mesmo agregador (Fase 2, onda efeitos-ativos) ──────────────

/** Bárbaro meio-orc no nível dado, com um caminho, as escolhas dele e o que carrega. */
function barbarian(level: number, patch: Partial<CharacterDraft> = {}, subclass: string | null = null, picks: Record<string, string[]> = {}): CharacterDraft {
  const base = structuredClone(COMPLETE_DRAFT)
  return { ...base, level, ...patch, classChoices: { ...base.classChoices, subclass, progressionChoices: picks } }
}

const carrying = (...itemIds: string[]) => ({
  equipment: {
    ...structuredClone(EMPTY_DRAFT.equipment),
    method: 'wealth' as const,
    purchasedItems: itemIds.map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const })),
  },
})

const inRage = (patch: Partial<PlayState> = {}): PlayState =>
  ({ ...createPlayState('c'), activeEffects: [{ id: 'rage', startedAt: 1 }], ...patch })

describe('condições e efeitos ligados na mesma escada (p. 175)', () => {
  it('Fúria: vantagem em check:STR, skill:athletics e save:STR, com a origem; nada no ataque', () => {
    const d = barbarian(3, carrying('greataxe'))
    const guide = getRollGuide(d, inRage())
    expect(guide.checks.STR.mode).toBe('advantage')
    expect(guide.checks.STR.advantage).toEqual([{ source: 'toggle:rage', label: 'Fúria' }])
    expect(guide.skills.athletics.mode).toBe('advantage')
    expect(guide.saves.STR.mode).toBe('advantage')
    expect(guide.saves.DEX.mode).toBe('normal')
    expect(guide.deathSave.mode).toBe('normal')
    expect(guide.attacks.map(a => a.attack.mode)).toEqual(['normal', 'normal'])
    // Desligada, o guia volta ao de antes.
    expect(getRollGuide(d, createPlayState('c')).checks.STR.mode).toBe('normal')
  })

  it('a vantagem da Fúria e a desvantagem do Envenenado se anulam, como as das condições', () => {
    const guide = getRollGuide(barbarian(3), inRage({ conditions: ['poisoned'] }))
    expect(guide.checks.STR.mode).toBe('normal')
    expect(guide.checks.STR.advantage.map(r => r.label)).toEqual(['Fúria'])
    expect(guide.checks.STR.disadvantage.map(r => r.label)).toEqual(['Envenenado'])
  })

  it('de Placas: sem os benefícios, mas com cannotCast e endsConcentration (tiefling bárbaro)', () => {
    const sheet = buildPlaySheet(barbarian(3, { race: 'tiefling', ...carrying('plate') }))
    const fx = getPlayEffects(inRage(), sheet)
    expect(fx.savingThrows.STR.mode).toBe('normal')
    expect(fx.defenses).toEqual([])
    expect(fx.cannotCast).toEqual({ active: true, sources: [{ source: 'toggle:rage', label: 'Fúria' }] })
    expect(fx.endsConcentration.active).toBe(true)
    // Sem armadura, os benefícios: a vantagem e as defesas, no formato da ficha.
    const free = getPlayEffects(inRage(), buildPlaySheet(barbarian(3, { race: 'tiefling' })))
    expect(free.savingThrows.STR.mode).toBe('advantage')
    expect(free.defenses).toEqual([{ source: 'Fúria', kind: 'resistance', types: ['bludgeoning', 'piercing', 'slashing'] }])
  })

  it('Fúria Inconsciente suspende o Amedrontado gravado, com linha, e o aplicar recusa o Enfeitiçado', () => {
    const sheet = buildPlaySheet(barbarian(6, {}, 'berserker'))
    const fx = getPlayEffects(inRage({ conditions: ['frightened'] }), sheet)
    expect(fx.conditions).toEqual([expect.objectContaining({ id: 'frightened', immuneBy: ['Fúria Inconsciente'] })])
    // Suspenso, o Amedrontado não dá nem as linhas dele.
    expect(fx.lines.some(l => l.source.label === 'Amedrontado')).toBe(false)
    expect(fx.lines.map(l => l.text)).toContain('Amedrontado fica suspenso: você está imune (Fúria Inconsciente). Sem efeito, mas não removido.')
    const r = addCondition(inRage(), sheet, 'charmed')
    expect(r.state.conditions).toEqual([])
    expect(r.notices).toEqual([{ kind: 'refused', text: 'Imune a Enfeitiçado (Fúria Inconsciente): a condição não foi aplicada.' }])
    // Fora da fúria, o Amedrontado volta a valer e o Enfeitiçado se aplica.
    const calm = getPlayEffects({ ...createPlayState('c'), conditions: ['frightened'] }, sheet)
    expect(calm.conditions[0].immuneBy).toBeUndefined()
    expect(calm.lines.some(l => l.source.label === 'Amedrontado')).toBe(true)
    expect(addCondition(createPlayState('c'), sheet, 'charmed').state.conditions).toEqual(['charmed'])
  })

  it('Monge 10 (Pureza Corporal): addCondition("poisoned") recusa, e o Envenenado já gravado fica suspenso', () => {
    const monk = buildPlaySheet({ ...structuredClone(EMPTY_DRAFT), class: 'monk', level: 10 })
    const r = addCondition(createPlayState('c'), monk, 'poisoned')
    expect(r.notices).toEqual([{ kind: 'refused', text: 'Imune a Envenenado (Pureza Corporal): a condição não foi aplicada.' }])
    const fx = getPlayEffects({ ...createPlayState('c'), conditions: ['poisoned'] }, monk)
    expect(fx.conditions[0].immuneBy).toEqual(['Pureza Corporal'])
    expect(fx.attack.mode).toBe('normal')
  })

  // "Não podem ser amedrontadas enquanto você estiver consciente" (Aura de Coragem, p. 111).
  describe('paladino 10 (Aura de Coragem): imune a Amedrontado só consciente', () => {
    const paladin = buildPlaySheet({ ...structuredClone(EMPTY_DRAFT), class: 'paladin', level: 10 })
    const REFUSED = { kind: 'refused', text: 'Imune a Amedrontado (Aura de Coragem): a condição não foi aplicada.' }

    it('consciente: addCondition recusa, e o Amedrontado gravado fica suspenso', () => {
      expect(addCondition(createPlayState('c'), paladin, 'frightened').notices).toEqual([REFUSED])
      const fx = getPlayEffects({ ...createPlayState('c'), conditions: ['frightened'] }, paladin)
      expect(fx.conditions[0].immuneBy).toEqual(['Aura de Coragem'])
      // Os outros não: a aura é só do Amedrontado.
      expect(addCondition(createPlayState('c'), paladin, 'charmed').state.conditions).toEqual(['charmed'])
    })

    it('a 0 PV, com o Inconsciente gravado ou morto, a aura não vale', () => {
      const down = { ...createPlayState('c'), lifeState: 'dying' as const, damageTaken: paladin.maxHp }
      const asleep = { ...createPlayState('c'), conditions: ['unconscious' as const] }
      const dead = { ...createPlayState('c'), lifeState: 'dead' as const, damageTaken: paladin.maxHp }
      for (const s of [down, { ...down, lifeState: 'stable' as const }, asleep, dead]) {
        const r = addCondition(s, paladin, 'frightened')
        expect(r.state.conditions, s.lifeState).toContain('frightened')
        expect(getPlayEffects(r.state, paladin).conditions.find(c => c.id === 'frightened')?.immuneBy, s.lifeState).toBeUndefined()
      }
      // De volta à consciência, o Amedrontado gravado fica suspenso de novo.
      const awake = getPlayEffects({ ...createPlayState('c'), conditions: ['frightened'] }, paladin)
      expect(awake.conditions[0].immuneBy).toEqual(['Aura de Coragem'])
    })
  })

  it('o Urso resiste a fogo e não a psíquico, inclusive de Placas', () => {
    for (const items of [[], ['plate']]) {
      const sheet = buildPlaySheet(barbarian(3, carrying(...items), 'totem-warrior', { 'totem-warrior-totem-3': ['bear'] }))
      const fire = applyDamage(inRage(), sheet, { amount: 10, damageType: 'fire' })
      expect(getCurrentHp(fire.state, sheet), items.join()).toBe(sheet.maxHp - 5)
      expect(fire.notices.map(n => n.text)).toContain('Resistência a fogo (Totem Espiritual — Urso): 10 → 5.')
      const psychic = applyDamage(inRage(), sheet, { amount: 10, damageType: 'psychic' })
      expect(getCurrentHp(psychic.state, sheet), items.join()).toBe(sheet.maxHp - 10)
    }
  })

  it('a Fúria resiste ao cortante; desligada, não', () => {
    const sheet = buildPlaySheet(barbarian(3))
    expect(getCurrentHp(applyDamage(inRage(), sheet, { amount: 9, damageType: 'slashing' }).state, sheet)).toBe(sheet.maxHp - 4)
    expect(getCurrentHp(applyDamage(createPlayState('c'), sheet, { amount: 9, damageType: 'slashing' }).state, sheet)).toBe(sheet.maxHp - 9)
  })
})
