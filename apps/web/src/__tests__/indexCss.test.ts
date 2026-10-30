import { describe, it, expect } from 'vitest'
import appCss from '../index.css?raw'

/**
 * O que o index.css faz com a primeira abertura do app (docs/app-instalavel.md). A capa da barra de
 * status (`body::before`, área segura) não tem texto, mas o `content` dela abre uma linha, e a linha
 * pede a fonte do body: com a Lora do site, o navegador a baixava junto com o JS, antes de haver
 * texto na tela, e no 4G lento a galeria abria ~0,4 s depois. Com uma fonte genérica, nada desce.
 */
describe('index.css', () => {
  it('a capa da barra de status (body::before) usa fonte genérica, não a do site', () => {
    const block = appCss.match(/body::before\s*\{([^}]*)\}/)?.[1]
    expect(block).toBeDefined()
    expect(block).toMatch(/font-family:\s*(sans-serif|serif|system-ui|monospace);/)
  })
})
