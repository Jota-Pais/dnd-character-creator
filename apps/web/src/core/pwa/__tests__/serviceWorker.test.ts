import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  applyUpdate,
  applyUpdateNow,
  applyUpdateOnReturn,
  AUTO_APPLY_MIN_AWAY_MS,
  checkForUpdateOnReturn,
  isGalleryAtRest,
  SKIP_WAITING_MESSAGE,
  startServiceWorker,
  SW_URL,
  UPDATE_CHECK_INTERVAL_MS,
  useAppUpdateStore,
  watchForUpdate,
  type SwContainer,
  type SwRegistration,
} from '../serviceWorker'
import { markOwnTrip, takeOwnTrip } from '../../native/backgroundTrips'
import { registerBackHandler } from '../../navigation/back'
import { useAppStore } from '../../stores/appStore'

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
type FakeDoc = ReturnType<typeof fakeDoc>
const turn = (doc: FakeDoc, state: DocumentVisibilityState) => {
  doc.visibilityState = state
  doc.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  useAppUpdateStore.setState({ updateReady: false, reloadPending: false })
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

  it('a procura que falha (sem rede) não vira erro nem gasta a hora: a próxima volta procura de novo', async () => {
    const reg = new FakeRegistration()
    reg.update.mockRejectedValueOnce(new Error('offline'))
    const doc = fakeDoc()
    let now = 0
    checkForUpdateOnReturn(asReg(reg), doc, () => now)
    now = UPDATE_CHECK_INTERVAL_MS
    turn(doc, 'hidden')
    turn(doc, 'visible')
    await Promise.resolve()
    expect(reg.update).toHaveBeenCalledTimes(1)

    now += 5 * 60 * 1000
    turn(doc, 'hidden')
    turn(doc, 'visible')
    expect(reg.update).toHaveBeenCalledTimes(2)
    // A que deu certo gasta a hora.
    await Promise.resolve()
    now += 5 * 60 * 1000
    turn(doc, 'hidden')
    turn(doc, 'visible')
    expect(reg.update).toHaveBeenCalledTimes(2)
  })

  // A mesa num porão: sai do app sem sinal, pega sinal e volta antes de uma hora.
  it('no APK, a procura da ida que falha (sem rede, a conexão cortada com o app congelado) não gasta a hora: a volta procura', async () => {
    const reg = new FakeRegistration()
    reg.update.mockRejectedValueOnce(new Error('offline'))
    const doc = fakeDoc()
    let now = 0
    checkForUpdateOnReturn(asReg(reg), doc, () => now, true)
    now = UPDATE_CHECK_INTERVAL_MS
    turn(doc, 'hidden')
    await Promise.resolve()
    expect(reg.update).toHaveBeenCalledTimes(1)
    now += 10 * 60 * 1000
    turn(doc, 'visible')
    expect(reg.update).toHaveBeenCalledTimes(2)
  })

  it('no APK, a ida ao segundo plano também procura, no mesmo limite de uma vez por hora', () => {
    const reg = new FakeRegistration()
    const doc = fakeDoc()
    let now = 0
    checkForUpdateOnReturn(asReg(reg), doc, () => now, true)
    // Antes de completar a hora, nem a ida nem a volta procuram: o mesmo volume de pedidos de antes.
    now = UPDATE_CHECK_INTERVAL_MS - 1
    turn(doc, 'hidden')
    turn(doc, 'visible')
    expect(reg.update).not.toHaveBeenCalled()

    now = UPDATE_CHECK_INTERVAL_MS
    turn(doc, 'hidden')
    expect(reg.update).toHaveBeenCalledTimes(1)
    // A volta logo depois não procura de novo: o download que começou na saída já corre.
    now += AUTO_APPLY_MIN_AWAY_MS
    turn(doc, 'visible')
    expect(reg.update).toHaveBeenCalledTimes(1)
    // Nem a ida seguinte, dentro da hora.
    turn(doc, 'hidden')
    expect(reg.update).toHaveBeenCalledTimes(1)
  })

  it('no navegador e no iPhone, a ida não procura: só a volta', () => {
    const reg = new FakeRegistration()
    const doc = fakeDoc()
    let now = 0
    checkForUpdateOnReturn(asReg(reg), doc, () => now)
    now = UPDATE_CHECK_INTERVAL_MS
    turn(doc, 'hidden')
    expect(reg.update).not.toHaveBeenCalled()
    turn(doc, 'visible')
    expect(reg.update).toHaveBeenCalledTimes(1)
  })
})

describe('isGalleryAtRest: a galeria parada', () => {
  const removers: (() => void)[] = []

  beforeEach(() => {
    useAppStore.setState({ activeSystemId: null })
  })
  afterEach(() => {
    removers.splice(0).forEach(remove => remove())
  })

  it('a galeria aberta, sem nada registrado no voltar', () => {
    expect(isGalleryAtRest()).toBe(true)
  })

  it('o criador e o jogo (um sistema aberto) não são a galeria', () => {
    useAppStore.setState({ activeSystemId: 'dnd5e' })
    expect(isGalleryAtRest()).toBe(false)
  })

  it('o menu "Novo personagem" e o "Excluir?" abertos registram o voltar: não está parada', () => {
    const closeMenu = registerBackHandler('overlay', () => {})
    removers.push(closeMenu)
    expect(isGalleryAtRest()).toBe(false)
    closeMenu()
    expect(isGalleryAtRest()).toBe(true)
  })

  // A lista do Agrupar/Ordenar é um diálogo do WebView: fica aberta na volta, sem registrar o voltar.
  it('o "Agrupar" ou o "Ordenar" com o foco (a lista aberta) não está parada', () => {
    const picker = document.createElement('select')
    document.body.appendChild(picker)
    removers.push(() => picker.remove())
    picker.focus()
    expect(isGalleryAtRest()).toBe(false)
    picker.blur()
    expect(isGalleryAtRest()).toBe(true)
  })
})

describe('applyUpdateOnReturn: no APK, a versão que espera entra sozinha na volta à galeria', () => {
  beforeEach(() => {
    takeOwnTrip()
  })

  /**
   * O APK com uma versão esperando, e a ida ao segundo plano com o relógio andando. A galeria parada
   * é a de `atRest` (a de verdade, `isGalleryAtRest`, tem os testes dela).
   */
  function waitingVersion() {
    const reg = new FakeRegistration()
    const container = new FakeContainer(reg)
    const worker = new FakeWorker()
    reg.waiting = worker
    useAppUpdateStore.setState({ updateReady: true })
    const doc = fakeDoc()
    let now = 0
    const reload = vi.fn()
    const gallery = { atRest: true }
    applyUpdateOnReturn(asReg(reg), asContainer(container), doc, { now: () => now, reload, isAtRest: () => gallery.atRest })
    const away = (ms: number) => {
      turn(doc, 'hidden')
      now += ms
      turn(doc, 'visible')
    }
    /** O SW novo recebeu a mensagem e assumiu a página. */
    const takeOver = () => container.dispatchEvent(new Event('controllerchange'))
    return { reg, worker, reload, away, gallery, doc, takeOver }
  }

  it('volta à galeria parada depois de um minuto fora: o SW novo assume, e a página recarrega quando ele está no controle', () => {
    const { worker, reload, away, takeOver } = waitingVersion()
    away(AUTO_APPLY_MIN_AWAY_MS)
    expect(worker.postMessage).toHaveBeenCalledWith(SKIP_WAITING_MESSAGE)
    expect(reload).not.toHaveBeenCalled()
    takeOver()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // O SW novo leva de dezenas de ms a perto de 1 s para assumir, e a galeria responde ao toque nesse meio.
  it('o toque logo na volta que tira a galeria do lugar (o "Abrir", o "Jogar", um menu): não recarrega, e a recarga fica para a próxima volta à galeria parada', () => {
    const { worker, reload, away, gallery, takeOver } = waitingVersion()
    away(AUTO_APPLY_MIN_AWAY_MS)
    gallery.atRest = false
    takeOver()
    expect(reload).not.toHaveBeenCalled()
    expect(useAppUpdateStore.getState()).toEqual({ updateReady: true, reloadPending: true })

    away(60 * 60 * 1000)
    expect(reload).not.toHaveBeenCalled()
    gallery.atRest = true
    away(AUTO_APPLY_MIN_AWAY_MS)
    expect(reload).toHaveBeenCalledTimes(1)
    // O SW novo já estava no controle: a volta só recarrega, sem pedir de novo.
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
  })

  it('o "Importar" ou o "Exportar" tocado logo na volta: a marca pedida segura a recarga, e a volta do seletor também não recarrega', () => {
    const { reload, away, takeOver } = waitingVersion()
    away(AUTO_APPLY_MIN_AWAY_MS)
    markOwnTrip()
    takeOver()
    expect(reload).not.toHaveBeenCalled()
    away(5 * 60 * 1000)
    expect(reload).not.toHaveBeenCalled()
    away(AUTO_APPLY_MIN_AWAY_MS)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('o seletor já aberto quando o SW novo assume (a página escondida, a marca gasta na ida): não recarrega por trás dele', () => {
    const { reload, away, doc, takeOver } = waitingVersion()
    away(AUTO_APPLY_MIN_AWAY_MS)
    markOwnTrip()
    turn(doc, 'hidden')
    takeOver()
    expect(reload).not.toHaveBeenCalled()
    turn(doc, 'visible')
    expect(reload).not.toHaveBeenCalled()
    away(AUTO_APPLY_MIN_AWAY_MS)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('com a recarga pendente, o "Atualizar agora" só recarrega (não há mais versão esperando)', () => {
    useAppUpdateStore.setState({ updateReady: true, reloadPending: true })
    const reload = vi.fn()
    expect(applyUpdate(reload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a olhada rápida em outro app (menos de um minuto fora) não pisca a tela', () => {
    const { worker, away } = waitingVersion()
    away(AUTO_APPLY_MIN_AWAY_MS - 1)
    expect(worker.postMessage).not.toHaveBeenCalled()
  })

  // Voltar do seletor do Importar, do "Salvar como" ou da impressão e recarregar perderia o arquivo.
  it('a volta de uma ida do próprio app não aplica, por mais longa; a ida seguinte, sim', () => {
    const { worker, away } = waitingVersion()
    markOwnTrip()
    away(60 * 60 * 1000)
    expect(worker.postMessage).not.toHaveBeenCalled()
    away(AUTO_APPLY_MIN_AWAY_MS)
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
  })

  it('nunca fora da galeria parada (o criador, o jogo, algo aberto nela): a versão espera a volta que dê nela', () => {
    const { worker, away, gallery } = waitingVersion()
    gallery.atRest = false
    away(60 * 60 * 1000)
    expect(worker.postMessage).not.toHaveBeenCalled()
    gallery.atRest = true
    away(AUTO_APPLY_MIN_AWAY_MS)
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
  })

  it('sem versão esperando, nada; o aviso que ficou sem versão (outra aba já aplicou) sai', () => {
    const { reg, worker, reload, away } = waitingVersion()
    useAppUpdateStore.setState({ updateReady: false })
    away(AUTO_APPLY_MIN_AWAY_MS)
    expect(worker.postMessage).not.toHaveBeenCalled()

    useAppUpdateStore.setState({ updateReady: true })
    reg.waiting = null
    away(AUTO_APPLY_MIN_AWAY_MS)
    expect(useAppUpdateStore.getState().updateReady).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('startServiceWorker: o APK e o navegador', () => {
  beforeEach(() => {
    useAppStore.setState({ activeSystemId: null })
    takeOwnTrip()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** Abre com uma versão esperando, sai depois de uma hora e volta um minuto depois, na galeria. */
  async function leaveAndReturn(native: boolean) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(0)
    const reg = new FakeRegistration()
    const worker = new FakeWorker()
    reg.waiting = worker
    const container = new FakeContainer(reg)
    const doc = fakeDoc()
    await startServiceWorker({ isProd: true, container: asContainer(container), whenLoaded: Promise.resolve(), doc, native })
    expect(useAppUpdateStore.getState().updateReady).toBe(true)
    vi.setSystemTime(UPDATE_CHECK_INTERVAL_MS)
    turn(doc, 'hidden')
    const checkedOnLeave = reg.update.mock.calls.length > 0
    vi.setSystemTime(UPDATE_CHECK_INTERVAL_MS + AUTO_APPLY_MIN_AWAY_MS)
    turn(doc, 'visible')
    return { checkedOnLeave, applied: worker.postMessage.mock.calls.length > 0 }
  }

  it('no APK, a ida procura versão nova e a volta à galeria aplica a que espera', async () => {
    expect(await leaveAndReturn(true)).toEqual({ checkedOnLeave: true, applied: true })
  })

  it('no navegador e no iPhone, como antes: a ida não procura, e só o toque aplica', async () => {
    expect(await leaveAndReturn(false)).toEqual({ checkedOnLeave: false, applied: false })
  })
})
