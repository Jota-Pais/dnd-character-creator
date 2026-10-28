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

  it('imunidade a dano guarda o dano por extenso, como a tabela do Ancestral Dracônico', () => {
    // A tela usa o texto direto ("Imune a dano de veneno"): montar "dano de ${tipo}" daria
    // "dano de elétrico" num tipo adjetivo.
    const immunities = CONDITIONS.flatMap(c => c.effects).filter(e => e.kind === 'damageImmunity')
    expect(immunities.map(e => [e.damageType, e.damageLabel])).toEqual([['poison', 'dano de veneno']])
    expect(active(['petrified']).damageImmunities).toEqual([
      { damageType: 'poison', damageLabel: 'dano de veneno', sources: [{ source: 'condition:petrified', label: 'Petrificado' }] },
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
