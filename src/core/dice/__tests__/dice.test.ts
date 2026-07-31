import { describe, it, expect } from 'vitest'
import {
  createSeededRng,
  rollDie,
  rollPool,
  rollDamage,
  parseDice,
  rollNotation,
  formatDamageSpec,
  type Rng,
} from '../dice'

/** Rng que devolve valores combinados, na ordem — cada `rollDie` consome um. */
function scripted(...values: number[]): Rng {
  let i = 0
  return () => {
    const v = values[i % values.length]
    i++
    return v
  }
}

/** Faz `rollDie(sides)` devolver exatamente `value`. */
function exact(sides: number, value: number): number {
  return (value - 1) / sides + 1e-9
}

describe('rollDie', () => {
  it('devolve dentro da faixa do dado', () => {
    const rng = createSeededRng(42)
    for (let i = 0; i < 500; i++) {
      const v = rollDie(20, rng)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(20)
    }
  })

  it('alcança os dois extremos', () => {
    expect(rollDie(6, () => 0)).toBe(1)
    expect(rollDie(6, () => 0.999999)).toBe(6)
  })

  it('rejeita dado inválido', () => {
    expect(() => rollDie(0)).toThrow()
    expect(() => rollDie(-4)).toThrow()
    expect(() => rollDie(2.5)).toThrow()
  })
})

describe('createSeededRng', () => {
  it('mesma semente, mesma sequência', () => {
    const a = createSeededRng(7)
    const b = createSeededRng(7)
    const seqA = Array.from({ length: 20 }, () => rollDie(20, a))
    const seqB = Array.from({ length: 20 }, () => rollDie(20, b))
    expect(seqA).toEqual(seqB)
  })

  it('sementes diferentes divergem', () => {
    const a = createSeededRng(1)
    const b = createSeededRng(2)
    const seqA = Array.from({ length: 20 }, () => rollDie(20, a))
    const seqB = Array.from({ length: 20 }, () => rollDie(20, b))
    expect(seqA).not.toEqual(seqB)
  })
})

describe('rollPool', () => {
  it('pega o MELHOR quando mode = best', () => {
    const rng = scripted(exact(20, 4), exact(20, 17), exact(20, 9))
    const r = rollPool({ dice: 3, mode: 'best' }, rng)
    expect(r.dice.map(d => d.value)).toEqual([4, 17, 9])
    expect(r.kept).toBe(17)
    expect(r.total).toBe(17)
  })

  it('pega o PIOR quando mode = worst (atributo 0, p. 16)', () => {
    const rng = scripted(exact(20, 4), exact(20, 17))
    const r = rollPool({ dice: 2, mode: 'worst' }, rng)
    expect(r.kept).toBe(4)
  })

  it('soma o bônus ao dado que valeu, não a cada dado', () => {
    const rng = scripted(exact(20, 4), exact(20, 17))
    const r = rollPool({ dice: 2, mode: 'best', bonus: 5 }, rng)
    expect(r.kept).toBe(17)
    expect(r.total).toBe(22)
  })

  it('marca exatamente um dado como mantido, mesmo com valores repetidos', () => {
    const rng = scripted(exact(20, 12), exact(20, 12), exact(20, 3))
    const r = rollPool({ dice: 3, mode: 'best' }, rng)
    expect(r.dice.filter(d => d.kept)).toHaveLength(1)
    expect(r.kept).toBe(12)
  })

  it('nunca rola menos de um dado', () => {
    const r = rollPool({ dice: 0, mode: 'best' }, createSeededRng(1))
    expect(r.dice).toHaveLength(1)
  })

  it('bônus ausente conta como zero', () => {
    const rng = scripted(exact(20, 11))
    expect(rollPool({ dice: 1, mode: 'best' }, rng).total).toBe(11)
  })
})

describe('rollDamage', () => {
  it('soma dados e bônus', () => {
    const rng = scripted(exact(6, 3), exact(6, 5))
    const r = rollDamage({ dice: [{ count: 2, sides: 6 }], bonus: 2 }, {}, rng)
    expect(r.dice.map(d => d.value)).toEqual([3, 5])
    expect(r.total).toBe(10)
    expect(r.critMultiplier).toBe(1)
  })

  it('crítico multiplica os DADOS e não o bônus (p. 84)', () => {
    // 1d8+4, crítico x3 → rola 3d8 e soma +4 uma única vez.
    const rng = scripted(exact(8, 7))
    const r = rollDamage({ dice: [{ count: 1, sides: 8 }], bonus: 4 }, { critMultiplier: 3 }, rng)
    expect(r.dice).toHaveLength(3)
    expect(r.total).toBe(7 * 3 + 4)
  })

  it('crítico NÃO multiplica os dados extras (p. 84)', () => {
    // Arma 1d8 + extra 2d6, crítico x2 → 2d8 rolados, mas ainda 2d6 de extra.
    const rng = scripted(exact(8, 5), exact(8, 5), exact(6, 2), exact(6, 2))
    const r = rollDamage(
      { dice: [{ count: 1, sides: 8 }], bonus: 0, extra: [{ count: 2, sides: 6 }] },
      { critMultiplier: 2 },
      rng,
    )
    expect(r.dice).toHaveLength(2)
    expect(r.extra).toHaveLength(2)
    expect(r.total).toBe(5 + 5 + 2 + 2)
  })

  it('multiplicador 1 e ausente dão o mesmo resultado', () => {
    const a = rollDamage({ dice: [{ count: 2, sides: 6 }], bonus: 1 }, { critMultiplier: 1 }, scripted(exact(6, 4)))
    const b = rollDamage({ dice: [{ count: 2, sides: 6 }], bonus: 1 }, {}, scripted(exact(6, 4)))
    expect(a.total).toBe(b.total)
  })

  it('não devolve total negativo com bônus negativo grande', () => {
    const rng = scripted(exact(4, 1))
    const r = rollDamage({ dice: [{ count: 1, sides: 4 }], bonus: -10 }, {}, rng)
    expect(r.total).toBe(0)
  })

  it('sem dados, devolve só o bônus', () => {
    const r = rollDamage({ dice: [], bonus: 5 }, {}, createSeededRng(1))
    expect(r.total).toBe(5)
  })
})

describe('parseDice', () => {
  it('lê a notação simples', () => {
    expect(parseDice('2d6+3')).toEqual({ dice: [{ count: 2, sides: 6 }], bonus: 3 })
  })

  it('lê bônus negativo', () => {
    expect(parseDice('1d12-2')).toEqual({ dice: [{ count: 1, sides: 12 }], bonus: -2 })
  })

  it('assume 1 dado quando a contagem é omitida', () => {
    expect(parseDice('d8')).toEqual({ dice: [{ count: 1, sides: 8 }], bonus: 0 })
  })

  it('ignora o tipo de dano por escrito, como vem da ficha do Ordem', () => {
    expect(parseDice('3d6+2 balístico')).toEqual({ dice: [{ count: 3, sides: 6 }], bonus: 2 })
  })

  it('junta os termos extras grudados no fim da string da ficha', () => {
    // Munição explosiva e maldições entram como " +2d6" depois do tipo de dano.
    expect(parseDice('1d8 corte +2d6')).toEqual({
      dice: [{ count: 1, sides: 8 }, { count: 2, sides: 6 }],
      bonus: 0,
    })
  })

  it('lê dano fixo sem dado', () => {
    expect(parseDice('5 impacto')).toEqual({ dice: [], bonus: 5 })
  })

  it('devolve vazio para string sem nada rolável', () => {
    expect(parseDice('especial')).toEqual({ dice: [], bonus: 0 })
  })
})

describe('rollNotation', () => {
  it('rola direto da notação (1d6 de Em Chamas)', () => {
    const r = rollNotation('1d6', {}, scripted(exact(6, 4)))
    expect(r.total).toBe(4)
  })
})

describe('formatDamageSpec', () => {
  it('formata dados e bônus', () => {
    expect(formatDamageSpec({ dice: [{ count: 2, sides: 6 }], bonus: 3 })).toBe('2d6+3')
  })
  it('omite o bônus zero', () => {
    expect(formatDamageSpec({ dice: [{ count: 1, sides: 8 }], bonus: 0 })).toBe('1d8')
  })
  it('inclui os dados extras', () => {
    expect(formatDamageSpec({
      dice: [{ count: 1, sides: 8 }], bonus: 2, extra: [{ count: 2, sides: 6 }],
    })).toBe('1d8+2d6+2')
  })
  it('formata só o bônus quando não há dados', () => {
    expect(formatDamageSpec({ dice: [], bonus: 5 })).toBe('0+5')
  })
})
