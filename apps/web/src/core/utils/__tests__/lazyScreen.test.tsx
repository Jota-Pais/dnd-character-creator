import { describe, it, expect, afterEach } from 'vitest'
import { Suspense } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { lazyScreen, preloadAfterOpening, preloadLazyScreens } from '../lazyScreen'

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

describe('preloadAfterOpening', () => {
  /** Uma promessa que o teste cumpre quando quer. */
  function gate() {
    let open!: () => void
    const promise = new Promise<void>(resolve => { open = resolve })
    return { promise, open: () => open() }
  }
  const flush = () => new Promise(resolve => setTimeout(resolve, 0))
  /** O `document` de mentira: a visibilidade e o evento dela. */
  function fakeDoc(state: DocumentVisibilityState = 'visible') {
    const doc = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState }
    doc.visibilityState = state
    return doc
  }
  const never = <T,>() => new Promise<T>(() => {})

  // No 4G lento, os pedaços disputavam a rede com as fontes da primeira tela, pedidas depois do load.
  it('os pedaços só descem com a página carregada, a primeira tela no ar e as fontes dela na mão', async () => {
    const pending = deferredLoad()
    lazyScreen(pending.load)
    const loaded = gate()
    const fontsReady = gate()
    let drawn = false
    let paints = 0
    const opening = preloadAfterOpening({
      fromServiceWorker: false,
      doc: fakeDoc(),
      whenLoaded: loaded.promise,
      root: { hasChildNodes: () => drawn },
      fonts: { ready: fontsReady.promise.then(() => ({}) as FontFaceSet) },
      nextPaint: () => new Promise(resolve => { paints++; setTimeout(resolve, 0) }),
    })

    await flush()
    expect(pending.calls()).toBe(0) // antes do load

    loaded.open()
    await flush()
    expect(paints).toBeGreaterThan(0) // espera a primeira tela, quadro a quadro
    expect(pending.calls()).toBe(0)

    drawn = true
    await flush()
    expect(pending.calls()).toBe(0) // a tela no ar, as fontes ainda descendo

    fontsReady.open()
    await flush()
    expect(pending.calls()).toBe(1)
    pending.resolve()
    await expect(opening).resolves.toBeDefined()
  })

  // Esperando a abertura, o toque logo na galeria via o "Carregando…", que antes da divisão não havia.
  it('com a página vinda do SW, os pedaços descem na hora, sem esperar a abertura', async () => {
    const pending = deferredLoad()
    lazyScreen(pending.load)
    const opening = preloadAfterOpening({
      fromServiceWorker: true,
      doc: fakeDoc(),
      whenLoaded: never(),
      root: { hasChildNodes: () => false },
      fonts: { ready: never() },
      nextPaint: never,
    })

    expect(pending.calls()).toBe(1)
    pending.resolve()
    await expect(opening).resolves.toBeDefined()
  })

  // O navegador não desenha quadro em página escondida: esperando, ela ficaria sem os pedaços até
  // voltar à vista, e o "Atualizar agora" de outra aba trocaria a versão nesse meio.
  it('aberta em segundo plano, os pedaços descem na hora, sem esperar o quadro que não vem', async () => {
    const pending = deferredLoad()
    lazyScreen(pending.load)
    const opening = preloadAfterOpening({
      fromServiceWorker: false,
      doc: fakeDoc('hidden'),
      whenLoaded: never(),
      root: { hasChildNodes: () => false },
      fonts: { ready: never() },
      nextPaint: never,
    })

    await flush()
    expect(pending.calls()).toBe(1)
    pending.resolve()
    await expect(opening).resolves.toBeDefined()
  })

  it('escondida no meio da abertura, os pedaços descem ali', async () => {
    const pending = deferredLoad()
    lazyScreen(pending.load)
    const doc = fakeDoc()
    const opening = preloadAfterOpening({
      fromServiceWorker: false,
      doc,
      whenLoaded: Promise.resolve(),
      root: { hasChildNodes: () => true },
      fonts: { ready: never() },
      nextPaint: never, // o quadro parado, como o requestAnimationFrame da página escondida
    })

    await flush()
    expect(pending.calls()).toBe(0)

    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(pending.calls()).toBe(1)
    pending.resolve()
    await expect(opening).resolves.toBeDefined()
  })
})
