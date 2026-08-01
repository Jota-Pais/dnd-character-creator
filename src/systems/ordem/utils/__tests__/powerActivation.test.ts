import { describe, it, expect } from 'vitest'
import { CLASS_POWERS } from '../powerUtils'
import { getExpertDie, getSpecialAttackTier } from '../characterUtils'

/** Reduções passivas de custo: não são ativáveis, a redução já entra em getRitualCost. */
const COST_REDUCTIONS = ['element-master', 'favored-ritual', 'ritualistic-tattoo']

describe('activation dos poderes de classe', () => {
  it('todo poder que menciona custo em PE tem ativação, exceto as reduções passivas', () => {
    const missing = CLASS_POWERS
      .filter(p => /\d+\s*PE/.test(p.description))
      .filter(p => !p.activation && !COST_REDUCTIONS.includes(p.id))
    expect(missing.map(p => p.id)).toEqual([])
  })

  it('nenhuma redução passiva foi marcada como ativável por engano', () => {
    for (const id of COST_REDUCTIONS) {
      expect(CLASS_POWERS.find(p => p.id === id)?.activation, id).toBeUndefined()
    }
  })

  it('todo poder COM ativação realmente menciona PE no texto do livro', () => {
    const suspicious = CLASS_POWERS.filter(p => p.activation && !/\d+\s*PE/.test(p.description))
    expect(suspicious.map(p => p.id)).toEqual([])
  })

  it('o custo anotado bate com o número que aparece na descrição', () => {
    for (const power of CLASS_POWERS) {
      if (!power.activation) continue
      const costs = [...power.description.matchAll(/(\d+)\s*PE/g)].map(m => Number(m[1]))
      expect(costs, power.id).toContain(power.activation.peCost)
    }
  })

  it('frequência anotada bate com o texto ("uma vez por cena/rodada")', () => {
    for (const power of CLASS_POWERS) {
      const frequency = power.activation?.frequency
      const text = power.description.toLowerCase()
      if (frequency === 'per-scene') expect(text, power.id).toContain('uma vez por cena')
      if (frequency === 'per-round') expect(text, power.id).toContain('uma vez por rodada')
      // O inverso: texto com "uma vez por X" e sem a frequência anotada é anotação faltando.
      if (/uma vez por cena/.test(text) && power.activation) {
        expect(frequency, power.id).toBe('per-scene')
      }
    }
  })

  it('tipo de ação anotado aparece no texto', () => {
    const PHRASE: Record<string, RegExp> = {
      standard: /ação padrão/i,
      movement: /ação de movimento/i,
      full: /ação completa/i,
      free: /ação livre/i,
      reaction: /reação/i,
    }
    for (const power of CLASS_POWERS) {
      const actionType = power.activation?.actionType
      if (!actionType) continue
      expect(PHRASE[actionType].test(power.description), `${power.id} → ${actionType}`).toBe(true)
    }
  })

  it('exatamente 15 poderes são ativáveis hoje', () => {
    expect(CLASS_POWERS.filter(p => p.activation)).toHaveLength(15)
  })
})

describe('getSpecialAttackTier', () => {
  it('escala com o NEX igual à tabela do Combatente', () => {
    expect(getSpecialAttackTier(5)).toEqual({ pe: 2, bonus: 5 })
    expect(getSpecialAttackTier(20)).toEqual({ pe: 2, bonus: 5 })
    expect(getSpecialAttackTier(25)).toEqual({ pe: 3, bonus: 10 })
    expect(getSpecialAttackTier(55)).toEqual({ pe: 4, bonus: 15 })
    expect(getSpecialAttackTier(85)).toEqual({ pe: 5, bonus: 20 })
    expect(getSpecialAttackTier(99)).toEqual({ pe: 5, bonus: 20 })
  })

  it('usa os mesmos degraus de NEX do Perito (Tabela 1.4)', () => {
    for (const nex of [5, 25, 55, 85]) {
      expect(getSpecialAttackTier(nex).pe, `NEX ${nex}`).toBe(getExpertDie(nex).pe)
    }
  })
})
