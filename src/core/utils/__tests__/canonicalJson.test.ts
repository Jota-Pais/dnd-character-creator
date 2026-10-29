import { describe, it, expect } from 'vitest'
import { canonicalJson, jsonFingerprint } from '../canonicalJson'

describe('canonicalJson', () => {
  it('a ordem das chaves não muda o texto, em qualquer profundidade', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 0 }], c: null } }))
      .toBe(canonicalJson({ a: { c: null, d: [2, { x: 0, y: 1 }] }, b: 1 }))
  })

  it('a ordem dos itens de uma lista muda, e o undefined some como no JSON', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]))
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}')
  })
})

describe('jsonFingerprint', () => {
  it('oito dígitos hexadecimais, iguais para o mesmo valor em qualquer ordem de chaves', () => {
    const a = jsonFingerprint({ name: 'Krusk', level: 3, scores: { STR: 16, DEX: 12 } })
    expect(a).toMatch(/^[0-9a-f]{8}$/)
    expect(jsonFingerprint({ scores: { DEX: 12, STR: 16 }, level: 3, name: 'Krusk' })).toBe(a)
  })

  it('muda com qualquer valor', () => {
    const a = jsonFingerprint({ name: 'Krusk', level: 3 })
    expect(jsonFingerprint({ name: 'Krusk', level: 4 })).not.toBe(a)
    expect(jsonFingerprint({ name: 'Krüsk', level: 3 })).not.toBe(a)
    // o FNV-1a de 32 bits da cadeia vazia (o valor conhecido do algoritmo)
    expect(jsonFingerprint(undefined)).toBe('811c9dc5')
  })
})
