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
    // registro é nosso (src/core/pwa/serviceWorker.ts), sem o do plugin: a versão nova espera e só vale
    // na próxima abertura, nunca recarregando a página aberta. O manifesto é o de public/.
    VitePWA({
      injectRegister: false,
      registerType: 'prompt',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{html,js,css,woff2,webp,png,svg,webmanifest}'],
        // Subconjuntos das fontes que um texto em português não usa: ficam no build (o navegador
        // os baixa se aparecer um nome em cirílico, com rede), fora do que se guarda.
        globIgnores: ['**/*-cyrillic-*', '**/*-vietnamese-*'],
        // O app tem uma página só: toda navegação (inclusive com ?fbclid de link do WhatsApp)
        // abre o index.html guardado.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // O padrão (2 MiB) deixaria de fora, só com um aviso no build, um JS que crescesse além
        // dele: o app abriria sem rede quebrado. O build de hoje tem o maior JS em 1,9 MB.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    // O JS é um arquivo só (~1,9 MB, 530 kB comprimido; os dados dos dois sistemas são a maior
    // parte). Medido em 2026-10-30 (docs/app-instalavel.md): no celular com 4G rápido, a primeira
    // abertura mostra a galeria em ~1,3 s, longe dos ~3 s a partir dos quais vale dividir o código,
    // e as aberturas seguintes saem do service worker. O aviso volta acima de 2 MB: medir de novo.
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
