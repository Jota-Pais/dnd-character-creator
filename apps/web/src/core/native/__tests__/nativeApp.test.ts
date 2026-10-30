import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import appVersionRaw from '../../../../public/app-version.json?raw'
import { isNativeApp, startNativeApp, type NativeAppPlugin } from '../nativeApp'
import {
  checkNativeVersion,
  parseVersionCode,
  readMinAndroidVersionCode,
  useNativeVersionStore,
} from '../appVersion'
import { registerBackHandler } from '../../navigation/back'

/** O plugin App de mentira: guarda o ouvinte do voltar e responde a versão do APK. */
function fakeApp(build = '1') {
  let backListener: (() => void) | null = null
  const app = {
    addListener: vi.fn(async (event: string, listener: () => void) => {
      if (event === 'backButton') backListener = listener
      return { remove: async () => {} }
    }),
    minimizeApp: vi.fn(async () => {}),
    getInfo: vi.fn(async () => ({ name: 'Forja de Heróis', id: 'io.github.jotapais.forja', build, version: '0.1.0' })),
  }
  return { app: app as unknown as NativeAppPlugin & typeof app, pressBack: () => backListener?.() }
}

const removers: (() => void)[] = []

beforeEach(() => {
  useNativeVersionStore.setState({ outdated: false })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ android: { minVersionCode: 1 } }))))
})
afterEach(() => {
  removers.splice(0).forEach(remove => remove())
  vi.unstubAllGlobals()
})

describe('o APK do Android', () => {
  it('no navegador não é o app nativo, e nada é ligado', async () => {
    expect(isNativeApp()).toBe(false)
    const { app } = fakeApp()
    await startNativeApp(app)
    expect(app.addListener).not.toHaveBeenCalled()
    expect(app.getInfo).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('o voltar do aparelho faz o voltar do app; sem para onde voltar, minimiza', async () => {
    const { app, pressBack } = fakeApp()
    await startNativeApp(app, true)
    expect(app.addListener).toHaveBeenCalledWith('backButton', expect.any(Function))

    pressBack()
    expect(app.minimizeApp).toHaveBeenCalledTimes(1)

    const closeSheet = vi.fn()
    removers.push(registerBackHandler('overlay', closeSheet))
    pressBack()
    expect(closeSheet).toHaveBeenCalledTimes(1)
    expect(app.minimizeApp).toHaveBeenCalledTimes(1)
  })

  it('ao abrir, confere a versão do APK com o mínimo publicado, sempre pela rede', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ android: { minVersionCode: 2 } }))))
    const { app } = fakeApp('1')
    await startNativeApp(app, true)
    expect(fetch).toHaveBeenCalledWith('/app-version.json', { cache: 'no-store' })
    expect(useNativeVersionStore.getState().outdated).toBe(true)
  })
})

describe('versão mínima do APK', () => {
  it('lê o mínimo do arquivo publicado; o que não for um inteiro positivo não vale', () => {
    expect(readMinAndroidVersionCode({ android: { minVersionCode: 3 } })).toBe(3)
    expect(readMinAndroidVersionCode({ android: { minVersionCode: '3' } })).toBeNull()
    expect(readMinAndroidVersionCode({ android: { minVersionCode: 0 } })).toBeNull()
    expect(readMinAndroidVersionCode({ android: {} })).toBeNull()
    expect(readMinAndroidVersionCode(null)).toBeNull()
    expect(readMinAndroidVersionCode('<!doctype html>')).toBeNull()
  })

  it('lê o versionCode do APK aberto (texto no Android)', () => {
    expect(parseVersionCode('12')).toBe(12)
    expect(parseVersionCode('')).toBeNull()
    expect(parseVersionCode('0.1.0')).toBeNull()
    expect(parseVersionCode(undefined)).toBeNull()
  })

  it('avisa só com o APK abaixo do mínimo', async () => {
    const info = (build: string) => async () => ({ build })
    expect(await checkNativeVersion(info('1'), async () => ({ android: { minVersionCode: 2 } }))).toBe(true)
    expect(await checkNativeVersion(info('2'), async () => ({ android: { minVersionCode: 2 } }))).toBe(false)
    expect(await checkNativeVersion(info('3'), async () => ({ android: { minVersionCode: 2 } }))).toBe(false)
    expect(useNativeVersionStore.getState().outdated).toBe(false)
  })

  it('sem rede, sem o arquivo ou sem a versão do APK, fica quieto', async () => {
    expect(await checkNativeVersion(async () => ({ build: '1' }), async () => null)).toBe(false)
    expect(await checkNativeVersion(() => Promise.reject(new Error('sem plugin')), async () => ({ android: { minVersionCode: 9 } }))).toBe(false)

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await checkNativeVersion(async () => ({ build: '1' }))).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('não achei', { status: 404 })))
    expect(await checkNativeVersion(async () => ({ build: '1' }))).toBe(false)
    expect(useNativeVersionStore.getState().outdated).toBe(false)
  })

  it('o arquivo publicado tem um mínimo válido', () => {
    // A conferência com o versionCode do APK de agora está nos testes do apps/mobile.
    const manifest = JSON.parse(appVersionRaw)
    expect(readMinAndroidVersionCode(manifest)).not.toBeNull()
  })
})
