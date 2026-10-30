import { defineConfig } from 'vitest/config'

// Um projeto por workspace, cada um com o próprio ambiente; a lista é explícita para a suíte não
// entrar nos worktrees de sessões paralelas (.claude/worktrees), que têm a própria.
export default defineConfig({
  test: {
    projects: [
      // O motor roda também no Node (o servidor que virá): os testes dele não têm jsdom.
      { test: { name: 'rules', root: './packages/rules', environment: 'node' } },
      './apps/web',
      // A casca do APK: confere a configuração do Capacitor e o projeto Android, sem o Gradle.
      { test: { name: 'mobile', root: './apps/mobile', environment: 'node', include: ['test/**/*.test.ts'] } },
    ],
  },
})
