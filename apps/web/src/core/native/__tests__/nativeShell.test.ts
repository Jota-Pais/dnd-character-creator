import { describe, it, expect, afterEach, vi } from 'vitest'
import { NEEDS_NEW_APK, printNative, saveTextFileNative, type NativeShellPlugin } from '../nativeShell'
import { takeOwnTrip } from '../backgroundTrips'

/** A casca de mentira: o que o "Salvar como" e a impressão do Android responderiam. */
function fakeShell(overrides: Partial<NativeShellPlugin> = {}) {
  return {
    saveFile: vi.fn(async () => ({ saved: true })),
    print: vi.fn(async () => {}),
    ...overrides,
  }
}

/** O que o Capacitor rejeita quando o APK aberto não tem o método (o versionCode 1). */
const unimplemented = () => Object.assign(new Error('"NativeShell.saveFile()" is not implemented on android'), { code: 'UNIMPLEMENTED' })

afterEach(() => vi.restoreAllMocks())

describe('o "Salvar como" do APK', () => {
  it('manda o nome, o tipo e o texto, e diz se o arquivo foi gravado', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const shell = fakeShell()
    expect(await saveTextFileNative('fichas.json', 'application/json', '{"a":1}', shell)).toBe(true)
    expect(shell.saveFile).toHaveBeenCalledWith({ fileName: 'fichas.json', mimeType: 'application/json', text: '{"a":1}' })

    vi.mocked(shell.saveFile).mockResolvedValueOnce({ saved: false })
    expect(await saveTextFileNative('fichas.json', 'application/json', '{}', shell)).toBe(false)
    // Cancelar é escolha da pessoa: nenhum aviso.
    expect(alert).not.toHaveBeenCalled()
  })

  it('no APK velho, sem o método, avisa que precisa do APK novo e não conta como gravado', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const shell = fakeShell({ saveFile: vi.fn(async () => { throw unimplemented() }) })
    expect(await saveTextFileNative('fichas.json', 'application/json', '{}', shell)).toBe(false)
    expect(alert).toHaveBeenCalledWith(NEEDS_NEW_APK)
  })

  it('com erro ao gravar, avisa e não conta como gravado', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const shell = fakeShell({ saveFile: vi.fn(async () => { throw new Error('disco cheio') }) })
    expect(await saveTextFileNative('fichas.json', 'application/json', '{}', shell)).toBe(false)
    expect(alert).toHaveBeenCalledWith('Não deu para salvar o arquivo. Tente de novo.')
  })
})

describe('a impressão do APK', () => {
  it('abre a do Android com o nome da ficha; no APK velho, avisa', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const shell = fakeShell()
    await printNative('Krusk — D&D 5e', shell)
    expect(shell.print).toHaveBeenCalledWith({ name: 'Krusk — D&D 5e' })
    expect(alert).not.toHaveBeenCalled()

    vi.mocked(shell.print).mockRejectedValueOnce(unimplemented())
    await printNative('Krusk — D&D 5e', shell)
    expect(alert).toHaveBeenCalledWith(NEEDS_NEW_APK)
  })
})

// A volta delas não aplica a versão nova (core/pwa/serviceWorker.ts): recarregar perderia o arquivo.
describe('a ida ao segundo plano é do próprio app', () => {
  it('o "Salvar como" e a impressão marcam a ida antes de abrir a tela do Android', async () => {
    takeOwnTrip()
    let markedWhenOpened: boolean | null = null
    const shell = fakeShell({
      saveFile: vi.fn(async () => {
        markedWhenOpened = takeOwnTrip()
        return { saved: true }
      }),
    })
    await saveTextFileNative('fichas.json', 'application/json', '{}', shell)
    expect(markedWhenOpened).toBe(true)

    // A impressão responde antes de a tela dela abrir: a marca fica para a ida que vem.
    await printNative('Krusk — D&D 5e', shell)
    expect(takeOwnTrip()).toBe(true)
  })

  it('recusados antes de abrir (APK velho, erro), a ida não houve, e a marca sai', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    const shell = fakeShell({
      saveFile: vi.fn(async () => { throw unimplemented() }),
      print: vi.fn(async () => { throw new Error('sem impressão') }),
    })
    await saveTextFileNative('fichas.json', 'application/json', '{}', shell)
    expect(takeOwnTrip()).toBe(false)
    await printNative('Krusk — D&D 5e', shell)
    expect(takeOwnTrip()).toBe(false)
  })
})
