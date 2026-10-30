// Gera os ícones do app instalável (manifesto e tela de início do iPhone) e do APK do Android a
// partir do d20 do favicon (apps/web/public/favicon.svg), a identidade que o site já tem. O d20 entra
// sobre o fundo escuro do tema (surface-base, o mesmo do theme_color do manifesto), porque o ícone de
// tela de início é opaco: o iPhone preenche a transparência de preto e o Android, de branco.
//
// Os PNGs ficam versionados em apps/web/public/icons e em apps/mobile/android/app/src/main/res;
// rode de novo só quando o favicon mudar (só um dos dois: `web` ou `android`):
//   node scripts/make-icons.mjs [web|android]
// Precisa do Edge (ou do Chrome) instalado: o Playwright desenha o SVG no navegador do sistema.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../apps/web/public')
const webIconsDir = path.join(publicDir, 'icons')
const androidResDir = path.resolve(__dirname, '../apps/mobile/android/app/src/main/res')

const BACKGROUND = '#0e0a06'
const favicon = fs.readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8')

/**
 * `scale`: o lado do d20 sobre o lado do ícone. O vértice mais afastado do d20 fica a 51,5% do
 * lado da caixa dele a partir do centro; no maskable, ele precisa caber no círculo de 40% (a zona
 * segura, que todo recorte do Android preserva): 0,72 × 51,5% = 37%.
 * `background`: o brilho do tema por trás (`glow`) ou nada (`none`, a camada da frente do ícone
 * adaptável do Android). `shape`: o recorte do ícone (o legado do Android já vem com a forma).
 */
const WEB_ICONS = [
  { file: 'icon-192.png', size: 192, scale: 0.86 },
  { file: 'icon-512.png', size: 512, scale: 0.86 },
  { file: 'icon-maskable-192.png', size: 192, scale: 0.72 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72 },
  // O iPhone arredonda os cantos sozinho; a margem acompanha a dos ícones do sistema.
  { file: 'apple-touch-icon.png', size: 180, scale: 0.78 },
].map(icon => ({ ...icon, dir: webIconsDir, background: 'glow', shape: 'square' }))

/** As densidades do Android: o multiplicador de dp para px. */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

/**
 * O APK: o ícone adaptável (Android 8+) é a camada da frente sobre a de trás, 108 dp, das quais o
 * aparelho mostra os 72 do meio com a forma dele (círculo, gota, quadrado). O d20 fica na proporção
 * do maskable do PWA, com o vértice a 37% dos 72 dp à vista: 51,5% × 0,48 × 108 = 26,7 dp de raio,
 * folgado no círculo de 33 dp que toda forma preserva (com 0,58, encostava no recorte redondo do
 * Pixel). O mesmo d20 é o da abertura do app (o tema de splash). Os legados (48 dp, Android 7) já
 * vêm com a forma: quadrado arredondado e redondo.
 */
const ANDROID_ICONS = Object.entries(DENSITIES).flatMap(([density, factor]) => {
  const dir = path.join(androidResDir, `mipmap-${density}`)
  return [
    { dir, file: 'ic_launcher_foreground.png', size: 108 * factor, scale: 0.48, background: 'none', shape: 'square' },
    { dir, file: 'ic_launcher_background.png', size: 108 * factor, scale: 0, background: 'glow', shape: 'square' },
    { dir, file: 'ic_launcher.png', size: 48 * factor, scale: 0.8, background: 'glow', shape: 'rounded' },
    { dir, file: 'ic_launcher_round.png', size: 48 * factor, scale: 0.72, background: 'glow', shape: 'circle' },
  ]
})

function iconHtml({ size, scale, background, shape }) {
  const inner = Math.round(size * scale)
  const offset = Math.round((size - inner) / 2)
  // O favicon tem o próprio <svg> com viewBox: aninhado, ele se ajusta à caixa dada.
  const d20 = scale > 0 ? favicon.replace('<svg ', `<svg x="${offset}" y="${offset}" width="${inner}" height="${inner}" `) : ''
  const clip = shape === 'circle'
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/>`
    : `<rect width="${size}" height="${size}" rx="${shape === 'rounded' ? size * 0.16 : 0}"/>`
  const fill = background === 'glow' ? `<rect width="${size}" height="${size}" fill="url(#glow)"/>` : ''
  return `<!doctype html><html><body style="margin:0;background:transparent">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#3a2614"/>
      <stop offset="100%" stop-color="${BACKGROUND}"/>
    </radialGradient>
    <clipPath id="shape">${clip}</clipPath>
  </defs>
  <g clip-path="url(#shape)">
    ${fill}
    ${d20}
  </g>
</svg></body></html>`
}

const only = process.argv[2]
const icons = [...(only !== 'android' ? WEB_ICONS : []), ...(only !== 'web' ? ANDROID_ICONS : [])]

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const icon of icons) {
    fs.mkdirSync(icon.dir, { recursive: true })
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 })
    await page.setContent(iconHtml(icon))
    // Fundo transparente: a camada da frente e os cantos dos legados não podem sair brancos.
    await page.locator('svg').first().screenshot({ path: path.join(icon.dir, icon.file), omitBackground: true })
    await page.close()
    console.log(`${path.relative(path.resolve(__dirname, '..'), path.join(icon.dir, icon.file))} (${icon.size}×${icon.size})`)
  }
} finally {
  await browser.close()
}
