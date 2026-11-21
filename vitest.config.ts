import { defineConfig } from 'vitest/config'

// Um projeto por workspace, cada um com o próprio ambiente; a lista é explícita para a suíte não
// entrar nos worktrees de sessões paralelas (.claude/worktrees), que têm a própria.
export default defineConfig({
  test: {
    projects: [
      // O motor roda também no Node (a API usa o que é dele sem tela): os testes dele não têm jsdom.
      { test: { name: 'rules', root: './packages/rules', environment: 'node' } },
      './apps/web',
      // A API: as rotas em memória (supertest) e os serviços sobre repositórios em memória, sem banco.
      { test: { name: 'api', root: './apps/api', environment: 'node', include: ['src/**/*.test.ts'] } },
      // A casca do APK: confere a configuração do Capacitor e o projeto Android, sem o Gradle.
      { test: { name: 'mobile', root: './apps/mobile', environment: 'node', include: ['test/**/*.test.ts'] } },
    ],
  },
})
