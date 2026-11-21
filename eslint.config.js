import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// As camadas do site (apps/web/src), num sentido só: core ← systems ← features ← app. Cada camada
// só importa as que estão à esquerda dela, e um sistema não importa o outro. A regra olha o caminho
// relativo do import (e do import() dinâmico); os testes ficam de fora, porque montam o app inteiro.
const WEB = 'apps/web/src'
const WEB_TESTS = [`${WEB}/**/__tests__/**`, `${WEB}/**/*.test.{ts,tsx}`, `${WEB}/test/**`]
/** O import relativo que passa por uma destas pastas: '../../features/gallery', './app/App'. */
const through = folders => `^\\.{1,2}/(?:.*/)?(?:${folders})(?:/|$)`
/** A mesma expressão para o seletor do import() dinâmico, onde a barra vai escapada. */
const inSelector = regex => regex.replaceAll('/', '\\u002F')

function webLayer(files, forbidden) {
  return {
    files,
    ignores: WEB_TESTS,
    rules: {
      'no-restricted-imports': ['error', { patterns: forbidden.map(({ regex, message }) => ({ regex, message })) }],
      'no-restricted-syntax': ['error', ...forbidden.map(({ regex, message }) => ({
        selector: `ImportExpression[source.value=/${inSelector(regex)}/]`,
        message,
      }))],
    },
  }
}

const ABOVE_CORE = {
  regex: through('systems|features|app'),
  message: 'O núcleo (core) não importa sistema, fluxo nem a casca do app: é o contrário que vale.',
}
const SYSTEM_RULES_IN_CORE = {
  regex: '^@rpg/rules/systems/',
  message: 'O núcleo (core) é agnóstico: regra de um sistema entra pelo módulo dele, em systems/<sistema>.',
}
const ABOVE_SYSTEMS = {
  regex: through('features|app'),
  message: 'Um sistema não importa os fluxos do app (features) nem a casca (app).',
}
const otherSystem = name => ({
  regex: `${through(name)}|^@rpg/rules/systems/${name}(?:/|$)`,
  message: `Um sistema não importa o outro: o que os dois usam mora no núcleo (core). (${name})`,
})
const ABOVE_FEATURES = {
  regex: through('app'),
  message: 'Um fluxo (features) não importa a casca do app: é ela que monta os fluxos.',
}

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
    // O motor de regras não sabe de tela: roda também no servidor (apps/api). O site importa o motor,
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
    // A API roda no Node: os globais são os dele, não os do navegador. Ela não importa tela, APK
    // nem o site; do repositório, só o contrato (@rpg/contracts) e o que o motor tem sem tela.
    files: ['apps/api/**/*.{ts,mts,cts}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            regex: '^(react|react-dom|zustand)(/|$)|^@capacitor/',
            message: 'A API não tem tela nem APK: isso é do site (apps/web).',
          },
          {
            regex: '^@rpg/(web|mobile)(/|$)|(^|/)apps/(web|mobile)(/|$)',
            message: 'A API não importa o site nem o app: o que os dois lados trocam mora no contrato (@rpg/contracts).',
          },
        ],
      }],
    },
  },
  {
    // O contrato é lido pelo navegador e pelo Node: só importa o Zod e os próprios arquivos.
    files: ['packages/contracts/**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '^(?!\\.{1,2}/|zod(/|$))',
          message: 'O contrato (@rpg/contracts) só depende do Zod: nada de React, Node, motor, site ou API.',
        }],
      }],
    },
  },
  {
    // O site não importa a API, e do contrato só leva os tipos: os schemas trazem o Zod, que é
    // validação do servidor. Valor do contrato em tempo de execução vem de @rpg/contracts/constants.
    files: [`${WEB}/**/*.{ts,tsx}`],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [
          {
            regex: '^@rpg/api(/|$)|(^|/)apps/api(/|$)',
            message: 'O site não importa a API: os dois falam por HTTP, pelo contrato (@rpg/contracts).',
          },
          {
            regex: '^@rpg/contracts(/(?!constants$).*)?$',
            allowTypeImports: true,
            message: 'Do contrato o site só importa tipos (import type) e os valores de @rpg/contracts/constants: os schemas trazem o Zod.',
          },
          {
            regex: '^zod(/|$)',
            message: 'O Zod é a validação do servidor: o site não o carrega.',
          },
        ],
      }],
    },
  },
  // As camadas do site. O sistema leva as duas regras num bloco só: no flat config, a regra do bloco
  // mais específico substitui a do mais geral, não soma.
  webLayer([`${WEB}/core/**/*.{ts,tsx}`], [ABOVE_CORE, SYSTEM_RULES_IN_CORE]),
  webLayer([`${WEB}/systems/*.{ts,tsx}`], [ABOVE_SYSTEMS]),
  webLayer([`${WEB}/systems/dnd5e/**/*.{ts,tsx}`], [ABOVE_SYSTEMS, otherSystem('ordem')]),
  webLayer([`${WEB}/systems/ordem/**/*.{ts,tsx}`], [ABOVE_SYSTEMS, otherSystem('dnd5e')]),
  webLayer([`${WEB}/features/**/*.{ts,tsx}`], [ABOVE_FEATURES]),
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
