import { describe, it, expect, afterEach } from 'vitest'
import { Suspense } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { lazyScreen, preloadLazyScreens } from '../lazyScreen'

afterEach(() => {
  cleanup()
})

function Screen() {
  return <p>A tela</p>
}

/** Um `import()` de mentira, que só responde quando o teste manda. */
function deferredLoad() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  let calls = 0
  const load = () => {
    calls++
    return new Promise<typeof Screen>((ok, fail) => {
      resolve = () => ok(Screen)
      reject = fail
    })
  }
  return { load, resolve: () => resolve(), reject: (error: Error) => reject(error), calls: () => calls }
}

function show(Lazy: ReturnType<typeof lazyScreen>) {
  return render(
    <Suspense fallback={<p>Carregando…</p>}>
      <Lazy />
    </Suspense>,
  )
}

describe('lazyScreen', () => {
  it('antes de o pedaço descer, o Suspense segura a vez; depois, a tela', async () => {
    const pending = deferredLoad()
    const Lazy = lazyScreen(pending.load)
    show(Lazy)
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
    expect(screen.queryByText('A tela')).toBeNull()

    pending.resolve()
    expect(await screen.findByText('A tela')).toBeInTheDocument()
    expect(screen.queryByText('Carregando…')).toBeNull()
  })

  // A tela já carregada (o preloadLazyScreens depois do load) não pisca o "Carregando…".
  it('já carregada, monta no mesmo render, sem o fallback', async () => {
    const pending = deferredLoad()
    const Lazy = lazyScreen(pending.load)
    const preloading = preloadLazyScreens()
    pending.resolve()
    await preloading

    show(Lazy)
    expect(screen.getByText('A tela')).toBeInTheDocument()
    expect(screen.queryByText('Carregando…')).toBeNull()
  })

  it('o pedaço desce uma vez só, no preload e no toque', async () => {
    const pending = deferredLoad()
    const Lazy = lazyScreen(pending.load)
    const preloading = preloadLazyScreens()
    show(Lazy)
    pending.resolve()
    await preloading
    expect(await screen.findByText('A tela')).toBeInTheDocument()
    expect(pending.calls()).toBe(1)
  })

  // Sem rede antes de o SW guardar o build: o preload falha em silêncio, e o toque tenta de novo.
  it('o preload que falha não fica guardado: o toque baixa de novo', async () => {
    const pending = deferredLoad()
    const Lazy = lazyScreen(pending.load)
    const preloading = preloadLazyScreens()
    pending.reject(new Error('sem rede'))
    await expect(preloading).resolves.toBeDefined()

    show(Lazy)
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
    pending.resolve()
    expect(await screen.findByText('A tela')).toBeInTheDocument()
    expect(pending.calls()).toBe(2)
  })
})
