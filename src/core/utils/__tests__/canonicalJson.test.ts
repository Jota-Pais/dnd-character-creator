import { describe, it, expect } from 'vitest'
import { canonicalJson } from '../canonicalJson'

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
