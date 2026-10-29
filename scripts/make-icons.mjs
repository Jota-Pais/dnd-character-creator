// Gera os ícones do app instalável (manifesto e tela de início do iPhone) a partir do d20 do
// favicon (apps/web/public/favicon.svg), a identidade que o site já tem. O d20 entra sobre o fundo
// escuro do tema (surface-base, o mesmo do theme_color do manifesto), porque o ícone de tela de
// início é opaco: o iPhone preenche a transparência de preto e o Android, de branco.
//
// Os PNGs ficam versionados em apps/web/public/icons; rode de novo só quando o favicon mudar:
//   node scripts/make-icons.mjs
// Precisa do Edge (ou do Chrome) instalado: o Playwright desenha o SVG no navegador do sistema.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../apps/web/public')
const outDir = path.join(publicDir, 'icons')

const BACKGROUND = '#0e0a06'
const favicon = fs.readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8')

/**
 * `scale`: o lado do d20 sobre o lado do ícone. O vértice mais afastado do d20 fica a 51,5% do
 * lado da caixa dele a partir do centro; no maskable, ele precisa caber no círculo de 40% (a zona
 * segura, que todo recorte do Android preserva): 0,72 × 51,5% = 37%.
 */
const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 0.86 },
  { file: 'icon-512.png', size: 512, scale: 0.86 },
  { file: 'icon-maskable-192.png', size: 192, scale: 0.72 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72 },
  // O iPhone arredonda os cantos sozinho; a margem acompanha a dos ícones do sistema.
  { file: 'apple-touch-icon.png', size: 180, scale: 0.78 },
]

function iconHtml(size, scale) {
  const inner = Math.round(size * scale)
  const offset = Math.round((size - inner) / 2)
  // O favicon tem o próprio <svg> com viewBox: aninhado, ele se ajusta à caixa dada.
  const d20 = favicon.replace('<svg ', `<svg x="${offset}" y="${offset}" width="${inner}" height="${inner}" `)
  return `<!doctype html><html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#3a2614"/>
      <stop offset="100%" stop-color="${BACKGROUND}"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#glow)"/>
  ${d20}
</svg></body></html>`
}

fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const { file, size, scale } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await page.setContent(iconHtml(size, scale))
    await page.locator('svg').first().screenshot({ path: path.join(outDir, file) })
    await page.close()
    console.log(`${file} (${size}×${size})`)
  }
} finally {
  await browser.close()
}
