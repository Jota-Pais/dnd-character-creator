import { describe, it, expect } from 'vitest'
import { cryptoRoller, rollDie, sequenceRoller } from '../rng'
import { formatNotation, parseNotation } from '../notation'
import { doubleDice, keptFaces, roll } from '../roll'
import type { RollFormula } from '../types'

const fixed = { id: 'r1', at: 0 }

describe('rollDie', () => {
  it('mapeia [0, 1) nas faces 1..lados', () => {
    expect(rollDie(20, () => 0)).toBe(1)
    expect(rollDie(20, () => 0.999999)).toBe(20)
    expect(rollDie(6, () => 0.5)).toBe(4)
  })

  it('recusa fonte fora de [0, 1) e dado inválido', () => {
    expect(() => rollDie(6, () => 1)).toThrow()
    expect(() => rollDie(6, () => -0.1)).toThrow()
    expect(() => rollDie(0)).toThrow()
    expect(() => rollDie(2.5)).toThrow()
  })

  it('o sorteio padrão fica dentro do dado e cobre todas as faces', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const v = cryptoRoller(6)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
      seen.add(v)
    }
    expect(seen.size).toBe(6)
  })
})

describe('sequenceRoller', () => {
  it('devolve as faces em ordem e erra quando acabam ou não cabem', () => {
    const r = sequenceRoller([3, 20])
    expect(r(6)).toBe(3)
    expect(() => r(6)).toThrow()
    expect(() => sequenceRoller([7])(6)).toThrow()
    expect(() => sequenceRoller([])(6)).toThrow()
  })
})

describe('parseNotation', () => {
  it('lê dados, modificadores e sinais', () => {
    expect(parseNotation('2d6+3')).toEqual({ dice: [{ count: 2, sides: 6 }], modifiers: [{ value: 3 }] })
    expect(parseNotation('d20')).toEqual({ dice: [{ count: 1, sides: 20 }], modifiers: [] })
    expect(parseNotation(' 1d8 + 1d6 - 1 ')).toEqual({
      dice: [{ count: 1, sides: 8 }, { count: 1, sides: 6 }],
      modifiers: [{ value: -1 }],
    })
    expect(parseNotation('1d20-1d4')).toEqual({
      dice: [{ count: 1, sides: 20 }, { count: 1, sides: 4, sign: -1 }],
      modifiers: [],
    })
    expect(parseNotation('-2')).toEqual({ dice: [], modifiers: [{ value: -2 }] })
  })

  it('lê d%, maiúsculas e regras de manter', () => {
    expect(parseNotation('d%').dice[0]).toEqual({ count: 1, sides: 100 })
    expect(parseNotation('2D20KH1').dice[0]).toEqual({ count: 2, sides: 20, keep: { mode: 'highest', count: 1 } })
    expect(parseNotation('2d20kl1').dice[0].keep).toEqual({ mode: 'lowest', count: 1 })
    expect(parseNotation('4d6kh3').dice[0].keep).toEqual({ mode: 'highest', count: 3 })
  })

  it('recusa entrada inválida', () => {
    for (const bad of ['', '   ', 'abc', '2d', 'd', '2d6+', '2d6 3', '2d6++3', '0d6', '1d0', '3d6kh4', '2d6kh0', '101d6', '1d1001']) {
      expect(() => parseNotation(bad), bad).toThrow()
    }
  })

  it('volta para a notação somando os modificadores', () => {
    expect(formatNotation(parseNotation('2d6 + 1 + 2'))).toBe('2d6+3')
    expect(formatNotation(parseNotation('1d20-1d4-1'))).toBe('1d20-1d4-1')
    expect(formatNotation(parseNotation('d20+0'))).toBe('1d20')
    expect(formatNotation(parseNotation('2d20kl1'))).toBe('2d20kl1')
    expect(formatNotation({ dice: [], modifiers: [] })).toBe('0')
  })
})

describe('roll', () => {
  it('soma dados e modificadores, guardando a origem de cada parcela', () => {
    const r = roll(
      { dice: [{ count: 2, sides: 6, label: 'Espada grande' }], modifiers: [{ value: 3, label: 'Força' }] },
      { ...fixed, roller: sequenceRoller([4, 6]), label: 'Dano' },
    )
    expect(r.total).toBe(13)
    expect(r.modifierTotal).toBe(3)
    expect(r.terms[0].subtotal).toBe(10)
    expect(r.terms[0].term.label).toBe('Espada grande')
    expect(r.notation).toBe('2d6+3')
    expect(r.label).toBe('Dano')
    expect(r.id).toBe('r1')
  })

  it('termo negativo subtrai', () => {
    const r = roll('1d20-1d4+2', { ...fixed, roller: sequenceRoller([15, 3]) })
    expect(r.terms.map(t => t.subtotal)).toEqual([15, -3])
    expect(r.total).toBe(14)
  })

  it('manter o maior/menor marca o descartado e não o soma', () => {
    const high = roll('2d20kh1', { ...fixed, roller: sequenceRoller([7, 18]) })
    expect(high.total).toBe(18)
    expect(high.terms[0].dice).toEqual([
      { value: 7, kept: false, manual: false },
      { value: 18, kept: true, manual: false },
    ])
    expect(keptFaces(high.terms[0])).toEqual([18])

    const low = roll('2d20kl1', { ...fixed, roller: sequenceRoller([7, 18]) })
    expect(low.total).toBe(7)
  })

  it('no empate na fronteira da regra de manter, fica o primeiro dado', () => {
    const kept = (notation: string, faces: number[]) =>
      roll(notation, { ...fixed, roller: sequenceRoller(faces) }).terms[0].dice.map(d => d.kept)
    expect(kept('2d20kh1', [5, 5])).toEqual([true, false])
    expect(kept('2d20kl1', [5, 5])).toEqual([true, false])
    expect(kept('3d6kh2', [6, 6, 6])).toEqual([true, true, false])
  })

  it('aceita faces de dado físico por termo e sorteia o resto', () => {
    const r = roll('1d20+1d6+1', { ...fixed, manual: [[17]], roller: sequenceRoller([2]) })
    expect(r.terms[0].dice[0]).toEqual({ value: 17, kept: true, manual: true })
    expect(r.terms[1].dice[0]).toEqual({ value: 2, kept: true, manual: false })
    expect(r.total).toBe(20)
  })

  it('recusa faces manuais em quantidade ou valor errados', () => {
    expect(() => roll('2d6', { ...fixed, manual: [[3]] })).toThrow()
    expect(() => roll('1d6', { ...fixed, manual: [[7]] })).toThrow()
    expect(() => roll('1d6', { ...fixed, manual: [[0]] })).toThrow()
  })

  it('recusa array manual esparso (dado que faltou digitar)', () => {
    const faces: number[] = []
    faces[1] = 5
    expect(() => roll('2d6', { ...fixed, manual: [faces] })).toThrow()
  })

  it('recusa faces manuais sem termo correspondente, mas aceita `undefined` sobrando', () => {
    expect(() => roll('1d20+5', { ...fixed, manual: [[17], [3]] })).toThrow()
    expect(roll('1d20+5', { ...fixed, manual: [[17], undefined] }).total).toBe(22)
  })

  it('recusa modificador que não seja inteiro exato, pela notação ou pelo objeto', () => {
    expect(() => parseNotation('1d20+' + '9'.repeat(400))).toThrow()
    expect(() => parseNotation('1d20+99999999999999999999')).toThrow()
    for (const value of [NaN, Infinity, 2.5]) {
      expect(() => roll({ dice: [{ count: 1, sides: 20 }], modifiers: [{ value }] }, fixed), String(value)).toThrow()
    }
  })

  it('recusa termo de objeto malformado', () => {
    const bad = [
      { count: 1, sides: 6, sign: 0 },
      { count: 2, sides: 20, keep: { mode: 'max', count: 1 } },
      { count: 0, sides: 6 },
    ] as unknown as RollFormula['dice']
    for (const term of bad) {
      expect(() => roll({ dice: [term], modifiers: [] }, fixed), JSON.stringify(term)).toThrow()
    }
  })

  it('o registro não muda se quem chamou mexer na fórmula depois', () => {
    const formula: RollFormula = { dice: [{ count: 1, sides: 6, label: 'Adaga' }], modifiers: [{ value: 2 }] }
    const r = roll(formula, { ...fixed, roller: sequenceRoller([4]) })
    formula.dice[0].count = 9
    formula.dice[0].label = 'outra'
    formula.modifiers[0].value = 99
    expect(r.formula).toEqual({ dice: [{ count: 1, sides: 6, label: 'Adaga' }], modifiers: [{ value: 2 }] })
    expect(r.terms[0].term.count).toBe(1)
    expect(r.notation).toBe('1d6+2')
  })

  it('o registro é JSON puro (vai direto para o histórico)', () => {
    const r = roll('2d20kh1+5', { ...fixed, roller: sequenceRoller([1, 20]) })
    expect(JSON.parse(JSON.stringify(r))).toEqual(r)
  })

  it('sem id/at fixos, gera um id e marca o momento', () => {
    const a = roll('1d4')
    const b = roll('1d4')
    expect(a.id).not.toBe(b.id)
    expect(typeof a.at).toBe('number')
  })
})

describe('doubleDice', () => {
  it('repete cada termo com a mesma origem e mantém os modificadores', () => {
    const f: RollFormula = {
      dice: [{ count: 1, sides: 8, label: 'Rapieira' }, { count: 3, sides: 6, label: 'Ataque Furtivo' }],
      modifiers: [{ value: 4, label: 'Destreza' }],
    }
    const d = doubleDice(f)
    expect(d.dice.map(t => `${t.count}d${t.sides} ${t.label}`)).toEqual([
      '1d8 Rapieira', '1d8 Rapieira', '3d6 Ataque Furtivo', '3d6 Ataque Furtivo',
    ])
    expect(d.modifiers).toEqual([{ value: 4, label: 'Destreza' }])
    expect(f.dice).toHaveLength(2)
    const r = roll(d, { ...fixed, roller: sequenceRoller([8, 1, 6, 6, 6, 1, 1, 1]) })
    expect(r.total).toBe(8 + 1 + 18 + 3 + 4)
  })

  it('o crítico de um termo no teto continua rolável', () => {
    const r = roll(doubleDice(parseNotation('100d6')), fixed)
    expect(r.terms).toHaveLength(2)
    expect(r.terms.every(t => t.dice.length === 100)).toBe(true)
  })

  it('recusa termo com regra de manter', () => {
    expect(() => doubleDice(parseNotation('2d20kh1'))).toThrow()
  })
})
