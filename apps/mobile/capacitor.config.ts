import type { CapacitorConfig } from '@capacitor/cli'

/**
 * O APK do Android (docs/app-android.md): uma casca nativa que abre o site publicado, em vez de
 * levar uma cópia do build. Cada push na main chega ao celular pela Vercel, sem APK novo, e sem rede
 * o service worker do site abre a última versão guardada. As fichas moram no localStorage desta
 * origem: ela não pode mudar, nem aqui nem na Vercel (domínio novo é app novo, com a galeria vazia).
 */
export const PRODUCTION_URL = 'https://dnd-character-creator-gamma.vercel.app'

/**
 * O Chrome mínimo do build do site (o alvo `baseline-widely-available` do Vite 8 e o Tailwind 4).
 * WebView mais velho abre a página de erro, que pede a atualização dele, em vez do site quebrado.
 */
export const MIN_WEBVIEW_VERSION = 111

const config: CapacitorConfig = {
  // O pacote do app no Android: trocar depois é publicar outro app, sem as fichas deste.
  appId: 'io.github.jotapais.forja',
  appName: 'Forja de Heróis',
  // Só a página de erro: com o server.url, nada mais desta pasta é aberto.
  webDir: 'www',
  server: {
    url: PRODUCTION_URL,
    // O esquema da página de erro local (https://localhost/index.html), fora da origem do site.
    androidScheme: 'https',
    // Só o site navega dentro do app; link para outro endereço abre no navegador do celular.
    allowNavigation: [new URL(PRODUCTION_URL).host],
    cleartext: false,
    // Sem rede e sem a cópia guardada (a primeira abertura), ou com o WebView velho demais.
    errorPath: 'index.html',
  },
  // O fundo do tema (surface-base) antes de a página pintar: sem o clarão branco ao abrir.
  backgroundColor: '#0e0a06',
  android: {
    minWebViewVersion: MIN_WEBVIEW_VERSION,
  },
  plugins: {
    // O tema é escuro: ícones claros nas barras. Com o WebView 140 ou mais novo, a página vai até
    // as bordas e as margens são as env(safe-area-inset-*) do site (viewport-fit=cover); no mais
    // velho, o Capacitor encolhe a página para dentro das barras, que ficam com o fundo do tema.
    // `native`, não `css`: o site usa o env() e não as variáveis --safe-area-inset-* que o `css`
    // injeta (e que, injetadas antes de a página existir, dão erro no console).
    SystemBars: {
      style: 'DARK',
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
    },
  },
}

export default config
