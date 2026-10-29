import { describe, it, expect } from 'vitest'
import tailwindTheme from 'tailwindcss/theme.css?raw'
import appCss from '../index.css?raw'

/**
 * Classe de cor que o tema não tem não gera CSS e não dá erro: o texto só herda a cor do pai, o
 * fundo some, e o contraste combinado vai junto sem ninguém ver (o text-gold-200 da folha da
 * receita, os fundos bg-gold-950 dos selos "Requer"; a escala gold do app vai de 300 a 900). Toda
 * cor de uma família conhecida usada no código do app (fora dos testes) tem de existir na paleta do
 * Tailwind ou nos tokens do `@theme` do index.css.
 */
const sources = import.meta.glob<string>(
  ['../**/*.{ts,tsx}', '!../**/__tests__/**', '!../**/*.test.{ts,tsx}', '!../test/**'],
  { query: '?raw', import: 'default', eager: true },
)

/** Os nomes de cor (`--color-<nome>`) do primeiro bloco `@theme` de um CSS. */
function themeColorNames(css: string): string[] {
  const open = css.indexOf('{', css.indexOf('@theme'))
  let depth = 0
  let end = open
  for (; end < css.length; end++) {
    if (css[end] === '{') depth++
    else if (css[end] === '}' && --depth === 0) break
  }
  return [...css.slice(open, end).matchAll(/--color-([a-z0-9-]+):/g)].map(m => m[1])
}

const COLORS = new Set(['inherit', 'current', 'transparent', ...themeColorNames(tailwindTheme), ...themeColorNames(appCss)])
const FAMILIES = new Set([...COLORS].map(name => name.split('-')[0]))

/** Utilitário de cor (com variantes e opacidade): `hover:text-gold-300`, `bg-red-950/30`. */
const COLOR_UTILITY = /^(?:[\w-]+:)*(?:text|bg|border(?:-[xytrblse])?|divide|ring|outline|accent|caret|fill|stroke|decoration|from|via|to|shadow)-([a-z][\w-]*?)(?:\/\d+)?$/

/** As classes de cor de família conhecida (gold-200, surface-sunken) que o tema não tem. */
function unknownColors(source: string): string[] {
  return source.split(/[\s'"`{}()$,]+/).filter(token => {
    const value = COLOR_UTILITY.exec(token)?.[1]
    return value !== undefined && FAMILIES.has(value.split('-')[0]) && !COLORS.has(value)
  })
}

describe('cores do app', () => {
  it('o tema tem as famílias do app e a paleta do Tailwind', () => {
    for (const name of ['gold-300', 'gold-900', 'parchment-100', 'parchment-950', 'surface-raised', 'on-accent', 'red-950', 'black']) {
      expect(COLORS.has(name), name).toBe(true)
    }
    expect(COLORS.has('gold-200')).toBe(false)
    expect(COLORS.has('gold-950')).toBe(false)
    expect(unknownColors('className="mt-1 text-xs text-gold-100 hover:bg-gold-950/40 text-[11px] border-b-2"'))
      .toEqual(['text-gold-100', 'hover:bg-gold-950/40'])
  })

  it('lê o código de todo o src, dos dois sistemas e do núcleo, sem os testes', () => {
    const files = Object.keys(sources)
    for (const file of [
      '../systems/dnd5e/components/play/PlayScreen.tsx',
      '../systems/dnd5e/components/common/PendingStepsPanel.tsx',
      '../systems/ordem/components/steps/ReviewStep.tsx',
      '../GlobalGallery.tsx',
    ]) {
      expect(files, file).toContain(file)
    }
    expect(files.some(f => f.includes('__tests__') || /\.test\.tsx?$/.test(f))).toBe(false)
  })

  it('toda classe de cor existe no tema', () => {
    const found = Object.entries(sources).flatMap(([file, source]) => unknownColors(source).map(c => `${file}: ${c}`))
    expect(found).toEqual([])
  })
})
