import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .claude/worktrees: cópias do repositório de sessões paralelas, cada uma com o próprio lint.
  globalIgnores(['**/dist', '.claude']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // O motor de regras não sabe de tela: roda também no servidor que virá. O site importa o motor,
    // nunca o contrário. (API do navegador ele já não compila: o tsconfig do pacote não tem DOM.)
    files: ['packages/rules/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            regex: '^(react|react-dom|zustand)(/|$)',
            message: 'O motor de regras não depende de React nem de zustand: isso é do site (apps/web).',
          },
          {
            regex: '^@rpg/web(/|$)|(^|/)apps/',
            message: 'O motor de regras não importa o site: o site é que importa o motor (@rpg/rules).',
          },
        ],
      }],
    },
  },
])
