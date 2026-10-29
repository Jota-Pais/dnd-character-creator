import { describe, it, expect } from 'vitest'
import manifestRaw from '../../public/manifest.webmanifest?raw'
import indexHtml from '../../index.html?raw'

/**
 * O app instalável (docs/app-instalavel.md): o manifesto tem o que o Chrome e o Android pedem para
 * instalar, os ícones dele existem em public/ com o tamanho declarado, e o index.html liga o
 * manifesto e o ícone do iPhone. Ícone que falta não dá erro no build: só a instalação deixa de
 * ser oferecida.
 */
const manifest = JSON.parse(manifestRaw) as {
  name: string
  short_name: string
  start_url: string
  scope: string
  display: string
  lang: string
  theme_color: string
  background_color: string
  icons: { src: string; sizes: string; type: string; purpose: string }[]
}

/** Os PNGs de public/, em data URL (base64), pelo caminho a partir de public/ ("/icons/x.png"). */
const pngs = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../../public/**/*.png', { query: '?inline', import: 'default', eager: true }))
    .map(([path, dataUrl]) => [path.replace('../../public', ''), dataUrl]),
)

/** A largura e a altura de um PNG, lidas do cabeçalho IHDR; null se não há o arquivo. */
function pngSize(src: string): string | null {
  const dataUrl = pngs[src]
  if (!dataUrl) return null
  const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1, 200)), c => c.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  return `${view.getUint32(16)}x${view.getUint32(20)}`
}

describe('manifesto do app instalável', () => {
  it('tem nome, início, escopo e modo de tela cheia', () => {
    expect(manifest.name).toBe('Forja de Heróis')
    expect(manifest.short_name.length).toBeGreaterThan(0)
    // O iPhone e o Android cortam o rótulo da tela de início por volta de 12 caracteres.
    expect(manifest.short_name.length).toBeLessThanOrEqual(12)
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.lang).toBe('pt-BR')
  })

  it('as cores são o fundo do tema (surface-base), como o theme-color do index.html', () => {
    expect(manifest.theme_color).toBe('#0e0a06')
    expect(manifest.background_color).toBe('#0e0a06')
    expect(indexHtml).toContain('<meta name="theme-color" content="#0e0a06" />')
  })

  it('tem ícones 192 e 512, comuns e maskable, e cada um existe com o tamanho declarado', () => {
    for (const purpose of ['any', 'maskable']) {
      const sizes = manifest.icons.filter(i => i.purpose === purpose).map(i => i.sizes)
      expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    }
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png')
      expect(pngSize(icon.src), icon.src).toBe(icon.sizes)
    }
  })

  it('o index.html liga o manifesto e o ícone da tela de início do iPhone (180 px)', () => {
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    const appleIcon = indexHtml.match(/<link rel="apple-touch-icon" href="([^"]+)"/)?.[1]
    expect(appleIcon).toBe('/icons/apple-touch-icon.png')
    expect(pngSize('/icons/apple-touch-icon.png')).toBe('180x180')
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />')
  })
})
