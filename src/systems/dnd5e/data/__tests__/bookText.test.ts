import { describe, it, expect } from 'vitest'

/**
 * A digitalização do PHB vem de um PDF que usa Wingdings para os marcadores de lista: o extrator
 * devolve U+F0B7 — área de uso privado do Unicode, que nenhuma fonte do app tem — e o navegador
 * desenhava um quadrado vazio no meio da descrição dos talentos.
 *
 * A convenção do projeto é "- " no início da linha (ver `RuleText`). Este teste guarda os JSONs
 * contra qualquer caractere de uso privado voltando numa próxima digitalização.
 */
const PRIVATE_USE_START = 0xe000
const PRIVATE_USE_END = 0xf8ff

/** Índice do primeiro caractere de uso privado, ou -1. Sem regex: o padrão em si seria invisível. */
function findPrivateUse(text: string): number {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= PRIVATE_USE_START && code <= PRIVATE_USE_END) return i
  }
  return -1
}

const DATA = import.meta.glob('../*.json', { eager: true }) as Record<string, { default: unknown }>

describe('dados do livro', () => {
  const files = Object.keys(DATA)

  it('encontra os JSONs de dados', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s não tem marcador de lista do PDF (caractere de uso privado)', file => {
    const content = JSON.stringify(DATA[file].default)
    const at = findPrivateUse(content)
    const context = at >= 0 ? content.slice(Math.max(0, at - 60), at + 60) : ''
    expect(at, `caractere de uso privado em ${file}: ...${context}...`).toBe(-1)
  })
})
