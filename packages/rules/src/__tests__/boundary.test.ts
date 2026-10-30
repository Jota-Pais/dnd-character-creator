import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { ESLint } from 'eslint'
import ts from 'typescript'

/**
 * A fronteira do motor (CLAUDE.md, "Regra do pacote puro"): o que entra aqui roda também no servidor
 * que virá, sem navegador, sem React e sem o Vite. As duas guardas são o ESLint (o que se importa) e
 * o tsconfig do pacote (o que compila); este teste passa um arquivo de mentira por cada uma, no
 * caminho do motor, e confere que ela recusa.
 */
const root = path.resolve(__dirname, '../../../..')
const probePath = path.join(root, 'packages/rules/src/__probe__.ts')

async function lint(code: string, file = probePath): Promise<string[]> {
  const eslint = new ESLint({ cwd: root })
  const [result] = await eslint.lintText(code, { filePath: file })
  return result.messages.map(m => m.ruleId ?? m.message)
}

/** Os erros de tipo do arquivo de mentira, compilado com o tsconfig do código do motor. */
function typeErrors(code: string): string[] {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    path.join(root, 'packages/rules/tsconfig.json'),
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw new Error(String(d.messageText)) } },
  )!
  const host = ts.createCompilerHost(parsed.options)
  const probe = path.normalize(probePath)
  const getSourceFile = host.getSourceFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  host.getSourceFile = (file, language, ...rest) =>
    path.normalize(file) === probe ? ts.createSourceFile(file, code, language) : getSourceFile(file, language, ...rest)
  host.fileExists = file => path.normalize(file) === probe || fileExists(file)
  const program = ts.createProgram([probePath, path.join(root, 'packages/rules/src/runtime.d.ts')], parsed.options, host)
  return ts.getPreEmitDiagnostics(program, program.getSourceFile(probePath))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

describe('a fronteira do motor', () => {
  it('o ESLint recusa tela, APK e site, também por import() dinâmico', async () => {
    expect(await lint("import { useState } from 'react'\nexport const a = useState\n")).toContain('no-restricted-imports')
    expect(await lint("import { Capacitor } from '@capacitor/core'\nexport const a = Capacitor\n")).toContain('no-restricted-imports')
    expect(await lint("export const a = () => import('react-dom')\n")).toContain('no-restricted-syntax')
    expect(await lint("export const a = () => import('@capacitor/app')\n")).toContain('no-restricted-syntax')
    expect(await lint("export const a = () => import('./core/dice')\n")).toEqual([])
  }, 30_000)

  it('o ESLint recusa .tsx no motor, mesmo sem import', async () => {
    expect(await lint('export const a = 1\n', probePath.replace(/\.ts$/, '.tsx'))).toContain('no-restricted-syntax')
  }, 30_000)

  it('o tsconfig do código não compila o que só o Vite (ou o navegador) tem', () => {
    expect(typeErrors('export const a = import.meta.env.DEV\n').join('\n')).toMatch(/'env' does not exist/)
    expect(typeErrors("import logo from './logo.svg'\nexport const a = logo\n").join('\n')).toMatch(/Cannot find module '.\/logo.svg'/)
    expect(typeErrors("import './x.css'\n")).not.toEqual([])
    expect(typeErrors('export const a = window.localStorage\n').join('\n')).toMatch(/Cannot find name 'window'/)
    expect(typeErrors('export const a = structuredClone({ b: 1 })\n')).toEqual([])
  }, 30_000)
})
