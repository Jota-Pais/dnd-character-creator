import { describe, it, expect, afterEach, vi } from 'vitest'
import { isNativeApp, startNativeApp, type NativeAppPlugin } from '../nativeApp'
import { registerBackHandler } from '../../navigation/back'

/** O plugin App de mentira: guarda o ouvinte do voltar. */
function fakeApp() {
  let backListener: (() => void) | null = null
  const app = {
    addListener: vi.fn(async (event: string, listener: () => void) => {
      if (event === 'backButton') backListener = listener
      return { remove: async () => {} }
    }),
    minimizeApp: vi.fn(async () => {}),
  }
  return { app: app as unknown as NativeAppPlugin & typeof app, pressBack: () => backListener?.() }
}

const removers: (() => void)[] = []

afterEach(() => {
  removers.splice(0).forEach(remove => remove())
})

describe('o APK do Android', () => {
  it('no navegador não é o app nativo, e nada é ligado', async () => {
    expect(isNativeApp()).toBe(false)
    const { app } = fakeApp()
    await startNativeApp(app)
    expect(app.addListener).not.toHaveBeenCalled()
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
})
