import { defineConfig } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // CSS lido como texto (?raw) chega inteiro: sem isso, o Vitest entrega todo CSS vazio. O resto
    // do CSS continua de fora dos testes.
    css: { include: [/\.css\?raw$/] },
  },
})