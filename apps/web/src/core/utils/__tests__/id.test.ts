import { describe, it, expect, afterEach, vi } from 'vitest'
import { createId } from '../id'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createId', () => {
  it('usa crypto.randomUUID quando o ambiente tem', () => {
    const id = createId('char')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(createId('char')).not.toBe(id)
  })

  it('sem randomUUID (http fora de contexto seguro): prefixo, momento e a fonte comum de aleatoriedade', () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
    vi.stubGlobal('crypto', { getRandomValues })
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    expect(createId('roll', () => 0.25)).toBe('roll-1000-250000000')
    expect(createId('char')).toMatch(/^char-1000-\d{1,9}$/)
  })
})

/**
 * O sorteio do app tem uma fonte só: o `cryptoRng` do motor de dados (Web Crypto, com o
 * `Math.random` só como último recurso). Dado e id que chamassem o `Math.random` direto voltariam a
 * espalhar a fonte que a Fase 0 juntou.
 */
const sources = import.meta.glob<string>(
  ['../../../**/*.{ts,tsx}', '!../../../**/__tests__/**', '!../../../test/**'],
  { query: '?raw', import: 'default', eager: true },
)

describe('fonte de aleatoriedade', () => {
  it('o código lido cobre o app inteiro', () => {
    const paths = Object.keys(sources)
    expect(paths).toContain('../../dice/rng.ts')
    expect(paths.some(p => p.includes('/systems/dnd5e/'))).toBe(true)
    expect(paths.some(p => p.includes('/systems/ordem/'))).toBe(true)
  })

  it('só o cryptoRng chama o Math.random', () => {
    const callers = Object.entries(sources)
      .filter(([, text]) => /Math\.random\s*\(/.test(text))
      .map(([path]) => path)
    expect(callers).toEqual(['../../dice/rng.ts'])
  })
})
