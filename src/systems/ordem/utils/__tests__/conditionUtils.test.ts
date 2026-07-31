import { describe, it, expect } from 'vitest'
import {
  CONDITIONS,
  escalateCondition,
  expandConditions,
  getBlockingConditions,
  getCondition,
  getConditionDefense,
  getConditionDefenseVs,
  getConditionDicePenalty,
  getConditionPeCostDelta,
  getSelectableConditions,
} from '../conditionUtils'

describe('dados de condições', () => {
  it('tem as 36 condições do glossário (p. 310-311)', () => {
    expect(CONDITIONS).toHaveLength(36)
  })

  it('toda condição implicada existe', () => {
    for (const condition of CONDITIONS) {
      for (const implied of condition.implies ?? []) {
        expect(getCondition(implied), `${condition.id} implica ${implied}`).toBeDefined()
      }
    }
  })

  it('todo agravamento aponta pra uma condição existente', () => {
    for (const condition of CONDITIONS) {
      if (!condition.escalatesTo) continue
      expect(getCondition(condition.escalatesTo), `${condition.id} → ${condition.escalatesTo}`).toBeDefined()
    }
  })

  it('Machucado e Morrendo são derivadas, não escolhíveis', () => {
    expect(getCondition('machucado')?.derived).toBe(true)
    expect(getCondition('morrendo')?.derived).toBe(true)
    const selectable = getSelectableConditions().map(c => c.id)
    expect(selectable).not.toContain('machucado')
    expect(selectable).not.toContain('morrendo')
  })
})

describe('expandConditions', () => {
  it('resolve a cascata em profundidade', () => {
    // Paralisado → imóvel + indefeso; indefeso NÃO implica desprevenido no dado (o texto diz
    // "é considerado desprevenido", mas com −10 no lugar do −5, então não encadeamos).
    expect(expandConditions(['paralisado']).sort()).toEqual(['imovel', 'indefeso', 'paralisado'])
  })

  it('resolve Exausto até o fim', () => {
    const out = expandConditions(['exausto'])
    expect(out).toContain('debilitado')
    expect(out).toContain('lento')
    expect(out).toContain('vulneravel')
  })

  it('Morrendo arrasta inconsciente e indefeso', () => {
    const out = expandConditions(['morrendo'])
    expect(out).toContain('inconsciente')
    expect(out).toContain('indefeso')
  })

  it('não duplica quando duas condições implicam a mesma', () => {
    const out = expandConditions(['fatigado', 'enredado'])
    expect(out.filter(id => id === 'vulneravel')).toHaveLength(1)
  })

  it('ignora id desconhecido', () => {
    expect(expandConditions(['inexistente'])).toEqual([])
  })
})

describe('escalateCondition', () => {
  it('primeira aplicação mantém a condição', () => {
    expect(escalateCondition('abalado', [])).toBe('abalado')
  })

  it('segunda aplicação agrava (Abalado → Apavorado)', () => {
    expect(escalateCondition('abalado', ['abalado'])).toBe('apavorado')
  })

  it('cadeia da fadiga: Fatigado → Exausto → Inconsciente', () => {
    expect(escalateCondition('fatigado', ['fatigado'])).toBe('exausto')
    expect(escalateCondition('exausto', ['exausto'])).toBe('inconsciente')
  })

  it('condição sem agravamento repete ela mesma', () => {
    expect(escalateCondition('vulneravel', ['vulneravel'])).toBe('vulneravel')
  })
})

describe('getConditionDicePenalty', () => {
  const skill = (skillId: string, attribute: 'agility' | 'strength' | 'intellect' | 'presence' | 'vigor') =>
    ({ kind: 'skill', skillId, attribute }) as const
  const attack = (melee: boolean, attribute: 'agility' | 'strength') =>
    ({ kind: 'attack', melee, attribute }) as const

  it('Abalado penaliza qualquer teste', () => {
    expect(getConditionDicePenalty(['abalado'], skill('athletics', 'strength'))).toBe(1)
    expect(getConditionDicePenalty(['abalado'], attack(true, 'strength'))).toBe(1)
  })

  it('Apavorado (–OO em perícia) pega ATAQUE também — ataque é teste de perícia (p. 84)', () => {
    expect(getConditionDicePenalty(['apavorado'], skill('athletics', 'strength'))).toBe(2)
    expect(getConditionDicePenalty(['apavorado'], attack(true, 'strength'))).toBe(2)
  })

  it('Enredado (–O em ataque) NÃO pega perícia comum — o escopo de ataque é o mais estreito', () => {
    expect(getConditionDicePenalty(['enredado'], attack(false, 'agility'))).toBe(1)
    expect(getConditionDicePenalty(['enredado'], skill('athletics', 'strength'))).toBe(0)
  })

  it('Caído só penaliza ataque corpo a corpo', () => {
    expect(getConditionDicePenalty(['caido'], attack(true, 'strength'))).toBe(2)
    expect(getConditionDicePenalty(['caido'], attack(false, 'agility'))).toBe(0)
  })

  it('Cego pega perícias de Agilidade e Força, não de Intelecto', () => {
    expect(getConditionDicePenalty(['cego'], skill('acrobatics', 'agility'))).toBe(2)
    expect(getConditionDicePenalty(['cego'], skill('science', 'intellect'))).toBe(0)
  })

  it('Surdo penaliza só Iniciativa', () => {
    expect(getConditionDicePenalty(['surdo'], skill('initiative', 'agility'))).toBe(2)
    expect(getConditionDicePenalty(['surdo'], skill('acrobatics', 'agility'))).toBe(0)
  })

  it('penalidades de condições diferentes somam', () => {
    // Abalado (–O em tudo) + Apavorado (–OO em perícia) = –3 dados numa perícia.
    expect(getConditionDicePenalty(['abalado', 'apavorado'], skill('athletics', 'strength'))).toBe(3)
  })

  it('pega a penalidade de condição implicada, não só da declarada', () => {
    // Exausto implica debilitado (–OO em AGI/FOR/VIG).
    expect(getConditionDicePenalty(['exausto'], skill('athletics', 'strength'))).toBe(2)
    // Cego implica desprevenido (–O em Reflexos).
    expect(getConditionDicePenalty(['cego'], skill('reflexes', 'agility'))).toBe(1 + 2)
  })
})

describe('getConditionDefense', () => {
  it('Vulnerável é −5', () => {
    expect(getConditionDefense(['vulneravel'])).toBe(-5)
  })

  it('Indefeso é −10', () => {
    expect(getConditionDefense(['indefeso'])).toBe(-10)
  })

  it('Inconsciente arrasta o −10 do Indefeso', () => {
    expect(getConditionDefense(['inconsciente'])).toBe(-10)
  })

  it('Caído não entra na Defesa geral (é por tipo de ataque)', () => {
    expect(getConditionDefense(['caido'])).toBe(0)
    expect(getConditionDefenseVs(['caido'])).toEqual({ melee: -5, ranged: 5 })
  })
})

describe('getConditionPeCostDelta', () => {
  it('Alquebrado encarece tudo em 1 PE', () => {
    expect(getConditionPeCostDelta(['alquebrado'])).toBe(1)
  })
  it('sem Alquebrado, não muda nada', () => {
    expect(getConditionPeCostDelta(['abalado', 'caido'])).toBe(0)
  })
})

describe('getBlockingConditions', () => {
  it('Atordoado impede agir', () => {
    expect(getBlockingConditions(['atordoado'])).toContain('Atordoado')
  })
  it('Morrendo impede agir via inconsciente', () => {
    expect(getBlockingConditions(['morrendo'])).toContain('Inconsciente')
  })
  it('condição sem trava devolve vazio', () => {
    expect(getBlockingConditions(['abalado'])).toEqual([])
  })
})
