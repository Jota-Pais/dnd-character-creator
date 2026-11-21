import { defineConfig } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    // O service worker do app instalável (docs/app-instalavel.md): guarda o build inteiro, para
    // abrir sem rede, e só o que é do próprio site (as fontes saem daqui, não do Google). O
    // registro é nosso (src/core/pwa/serviceWorker.ts), sem o do plugin: a versão nova espera a
    // próxima abertura, e só a galeria a aplica antes (pelo toque; no APK, também na volta do segundo
    // plano), nunca com ficha ou jogo aberto. O manifesto é o de public/.
    VitePWA({
      injectRegister: false,
      registerType: 'prompt',
      manifest: false,
      workbox: {
        // O `js` pega também os pedaços sob demanda (o Ordem, as fichas imprimíveis): sem rede, eles
        // saem daqui como o resto.
        globPatterns: ['**/*.{html,js,css,woff2,webp,png,svg,webmanifest}'],
        // Subconjuntos das fontes que um texto em português não usa: ficam no build (o navegador
        // os baixa se aparecer um nome em cirílico, com rede), fora do que se guarda.
        globIgnores: ['**/*-cyrillic-*', '**/*-vietnamese-*'],
        // O app tem uma página só: toda navegação (inclusive com ?fbclid de link do WhatsApp)
        // abre o index.html guardado. Menos a de /api, que é do servidor: o service worker nunca
        // responde por ela, nem com o index.html nem com cache (não há runtimeCaching, e o cliente
        // pede com cache: 'no-store').
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // O padrão (2 MiB) deixaria de fora, só com um aviso no build, um JS que crescesse além
        // dele: o app abriria sem rede quebrado. O build de hoje tem o maior JS (o da abertura) em 1,9 MB.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: {
    // A API (apps/api) atende em /api na mesma origem do site: em produção, por um rewrite da Vercel
    // para a Render; aqui, por este proxy (o `vite preview` o herda). O cookie de sessão fica de
    // primeira parte e não há CORS. O Host do pedido segue sendo o da página (sem changeOrigin): é
    // por ele que a API confere, em desenvolvimento, que o pedido veio do site, por localhost ou
    // pelo IP da rede. Outra porta: API_PROXY_TARGET=http://localhost:4000 npm run dev.
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3333' },
    },
  },
  build: {
    // O aviso voltou em 2026-10-31 com o JS num arquivo só em 2.083 kB (578 kB comprimido). O Ordem e
    // as fichas imprimíveis passaram a descer sob demanda (src/core/utils/lazyScreen.ts), e o JS da
    // abertura ficou em 1.891 kB (529 kB comprimido; os dados dos dois sistemas são a maior parte).
    // Medido no celular (docs/app-instalavel.md, seção 5), a galeria da primeira abertura passou de
    // 1,30 s para 1,25 s no 4G rápido e de 4,96 s para 4,76 s no lento; as seguintes saem do service
    // worker. O aviso volta acima de 2 MB: medir de novo (o próximo corte medido é o do D&D).
    chunkSizeWarningLimit: 2048,
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // CSS lido como texto (?raw) chega inteiro: sem isso, o Vitest entrega todo CSS vazio. O resto
    // do CSS continua de fora dos testes.
    css: { include: [/\.css\?raw$/] },
  },
})
