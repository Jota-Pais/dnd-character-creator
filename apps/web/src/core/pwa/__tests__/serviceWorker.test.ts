import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  applyUpdateNow,
  checkForUpdateOnReturn,
  SKIP_WAITING_MESSAGE,
  startServiceWorker,
  SW_URL,
  UPDATE_CHECK_INTERVAL_MS,
  useAppUpdateStore,
  watchForUpdate,
  type SwContainer,
  type SwRegistration,
} from '../serviceWorker'

// O navegador simulado: o SW, o registro e o `navigator.serviceWorker`, com os eventos de verdade.
class FakeWorker extends EventTarget {
  state: ServiceWorkerState = 'installing'
  postMessage = vi.fn()
  setState(state: ServiceWorkerState) {
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }
}

class FakeRegistration extends EventTarget {
  waiting: FakeWorker | null = null
  installing: FakeWorker | null = null
  update = vi.fn(() => Promise.resolve())
  /** O navegador achou `sw.js` novo: o SW novo começa a baixar o build. */
  startInstall(): FakeWorker {
    const worker = new FakeWorker()
    this.installing = worker
    this.dispatchEvent(new Event('updatefound'))
    return worker
  }
  /** Terminou de baixar: instalado, esperando a página velha sair. */
  finishInstall(worker: FakeWorker) {
    this.installing = null
    this.waiting = worker
    worker.setState('installed')
  }
}

class FakeContainer extends EventTarget {
  controller: object | null = {}
  reg: FakeRegistration
  constructor(reg: FakeRegistration) {
    super()
    this.reg = reg
  }
  register = vi.fn(async () => this.reg as unknown as SwRegistration)
}

const asReg = (r: FakeRegistration) => r as unknown as SwRegistration
const asContainer = (c: FakeContainer) => c as unknown as SwContainer
const fakeDoc = () => {
  const doc = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState }
  doc.visibilityState = 'visible'
  return doc
}

beforeEach(() => {
  useAppUpdateStore.setState({ updateReady: false })
})

describe('startServiceWorker: o registro', () => {
  it('fora do build de produção não registra (no dev, o SW guardaria o código velho)', async () => {
    const container = new FakeContainer(new FakeRegistration())
    const reg = await startServiceWorker({ isProd: false, container: asContainer(container), whenLoaded: Promise.resolve(), doc: fakeDoc() })
    expect(reg).toBeNull()
    expect(container.register).not.toHaveBeenCalled()
  })

  it('em produção, registra /sw.js na raiz depois de a página carregar', async () => {
    const container = new FakeContainer(new FakeRegistration())
    let loaded!: () => void
    const whenLoaded = new Promise<void>(resolve => { loaded = resolve })
    const started = startServiceWorker({ isProd: true, container: asContainer(container), whenLoaded, doc: fakeDoc() })
    await Promise.resolve()
    expect(container.register).not.toHaveBeenCalled()
    loaded()
    expect(await started).not.toBeNull()
    expect(container.register).toHaveBeenCalledWith(SW_URL, { scope: '/' })
  })

  it('sem navigator.serviceWorker (http pelo IP da rede) não faz nada', async () => {
    expect(await startServiceWorker({ isProd: true, container: undefined, whenLoaded: Promise.resolve(), doc: fakeDoc() })).toBeNull()
  })

  it('registro recusado pelo navegador não derruba o app', async () => {
    const container = new FakeContainer(new FakeRegistration())
    container.register.mockRejectedValueOnce(new Error('SecurityError'))
    expect(await startServiceWorker({ isProd: true, container: asContainer(container), whenLoaded: Promise.resolve(), doc: fakeDoc() })).toBeNull()
  })
})

describe('versão nova: espera a próxima abertura', () => {
  it('a versão que termina de baixar fica esperando: avisa, sem recarregar nem trocar o SW da página aberta', async () => {
    const reg = new FakeRegistration()
    const container = new FakeContainer(reg)
    const reload = vi.fn()
    container.addEventListener('controllerchange', reload)
    await startServiceWorker({ isProd: true, container: asContainer(container), whenLoaded: Promise.resolve(), doc: fakeDoc() })
    expect(useAppUpdateStore.getState().updateReady).toBe(false)

    const worker = reg.startInstall()
    expect(useAppUpdateStore.getState().updateReady).toBe(false)
    reg.finishInstall(worker)

    expect(useAppUpdateStore.getState().updateReady).toBe(true)
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('a versão baixada antes, que já esperava ao abrir, também avisa', () => {
    const reg = new FakeRegistration()
    reg.waiting = new FakeWorker()
    const onReady = vi.fn()
    watchForUpdate(asReg(reg), asContainer(new FakeContainer(reg)), onReady)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('a primeira instalação (nenhum SW no controle da página) não é versão nova', () => {
    const reg = new FakeRegistration()
    const container = new FakeContainer(reg)
    container.controller = null
    const onReady = vi.fn()
    watchForUpdate(asReg(reg), asContainer(container), onReady)
    reg.finishInstall(reg.startInstall())
    expect(onReady).not.toHaveBeenCalled()
  })

  it('"Atualizar agora" (só na galeria): o SW novo assume, e a página recarrega quando ele está no controle', () => {
    const reg = new FakeRegistration()
    const container = new FakeContainer(reg)
    const worker = new FakeWorker()
    reg.waiting = worker
    const reload = vi.fn()

    expect(applyUpdateNow(asReg(reg), asContainer(container), reload)).toBe(true)
    expect(worker.postMessage).toHaveBeenCalledWith(SKIP_WAITING_MESSAGE)
    expect(reload).not.toHaveBeenCalled()
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('sem versão esperando, "Atualizar agora" não faz nada', () => {
    const reg = new FakeRegistration()
    const reload = vi.fn()
    expect(applyUpdateNow(asReg(reg), asContainer(new FakeContainer(reg)), reload)).toBe(false)
  })
})

describe('checkForUpdateOnReturn: o app que volta do segundo plano', () => {
  it('procura versão nova ao voltar, no máximo uma vez por intervalo', () => {
    const reg = new FakeRegistration()
    const doc = fakeDoc()
    let now = 1_000_000
    checkForUpdateOnReturn(asReg(reg), doc, () => now)

    const comeBack = () => {
      doc.visibilityState = 'hidden'
      doc.dispatchEvent(new Event('visibilitychange'))
      doc.visibilityState = 'visible'
      doc.dispatchEvent(new Event('visibilitychange'))
    }
    now += UPDATE_CHECK_INTERVAL_MS - 1
    comeBack()
    expect(reg.update).not.toHaveBeenCalled()
    now += 1
    comeBack()
    expect(reg.update).toHaveBeenCalledTimes(1)
    comeBack()
    expect(reg.update).toHaveBeenCalledTimes(1)
  })

  it('a procura que falha (sem rede) não vira erro', async () => {
    const reg = new FakeRegistration()
    reg.update.mockRejectedValueOnce(new Error('offline'))
    const doc = fakeDoc()
    let now = 0
    checkForUpdateOnReturn(asReg(reg), doc, () => now)
    now = UPDATE_CHECK_INTERVAL_MS
    doc.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(reg.update).toHaveBeenCalledTimes(1)
  })
})
