import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .claude/worktrees: cópias do repositório de sessões paralelas, cada uma com o próprio lint.
  // apps/mobile/android: o projeto nativo; o JS de lá é o do Capacitor, copiado pelo build.
  globalIgnores(['**/dist', '.claude', 'apps/mobile/android']),
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
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
    // nunca o contrário. (API do navegador ele já não compila: o tsconfig do pacote não tem DOM nem
    // os tipos do Vite.) Vale para toda extensão e também para o import() dinâmico.
    files: ['packages/rules/**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            regex: '^(react|react-dom|zustand)(/|$)',
            message: 'O motor de regras não depende de React nem de zustand: isso é do site (apps/web).',
          },
          {
            regex: '^@capacitor/',
            message: 'O motor de regras não conhece o APK: o Capacitor é do site (apps/web/src/core/native).',
          },
          {
            regex: '^@rpg/web(/|$)|(^|/)apps/',
            message: 'O motor de regras não importa o site: o site é que importa o motor (@rpg/rules).',
          },
        ],
      }],
      'no-restricted-syntax': ['error', {
        selector: 'ImportExpression[source.value=/^(react|react-dom|zustand)(\\u002F|$)|^@capacitor\\u002F|^@rpg\\u002Fweb(\\u002F|$)|(^|\\u002F)apps\\u002F/]',
        message: 'O motor de regras não carrega tela, APK nem site, nem por import(): isso é do site (apps/web).',
      }],
    },
  },
  {
    // Componente de tela (.tsx) não mora no motor.
    files: ['packages/rules/**/*.tsx'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'Program',
        message: 'O motor de regras não tem .tsx: componente de tela é do site (apps/web).',
      }],
    },
  },
])
