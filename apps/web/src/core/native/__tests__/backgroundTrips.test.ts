import { describe, it, expect, beforeEach, vi } from 'vitest'
import { markOwnTrip, takeOwnTrip, watchTrips, type Trip } from '../backgroundTrips'

// O documento simulado: a página que some (outro app na frente, a tela apagada) e volta.
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
  takeOwnTrip()
})

describe('watchTrips: as idas ao segundo plano, contadas na volta', () => {
  it('a volta diz quanto tempo a página ficou escondida; sem ida antes, não é volta', () => {
    const doc = fakeDoc()
    let now = 1_000
    const trips: Trip[] = []
    watchTrips(doc, trip => trips.push(trip), () => now)

    turn(doc, 'visible')
    expect(trips).toEqual([])

    turn(doc, 'hidden')
    now += 90_000
    // O WebView pode repetir o aviso de página escondida: a ida continua a mesma.
    turn(doc, 'hidden')
    now += 30_000
    turn(doc, 'visible')
    expect(trips).toEqual([{ awayMs: 120_000, own: false }])
  })

  it('a ida marcada pelo app (o seletor do Importar, o "Salvar como", a impressão) é dele, e a marca se gasta nela', () => {
    const doc = fakeDoc()
    const onReturn = vi.fn()
    watchTrips(doc, onReturn, () => 0)

    markOwnTrip()
    turn(doc, 'hidden')
    turn(doc, 'visible')
    expect(onReturn).toHaveBeenLastCalledWith({ awayMs: 0, own: true })

    turn(doc, 'hidden')
    turn(doc, 'visible')
    expect(onReturn).toHaveBeenLastCalledWith({ awayMs: 0, own: false })
  })

  // O seletor fechado sem sair do app não avisa (o WebView 109 não tem o `cancel`): a marca não
  // tem como sair antes, e não vence com o tempo (o seletor pode demorar a abrir a tela de fora).
  it('a marca que não saiu do app vale para a ida seguinte, quando quer que ela venha', () => {
    const doc = fakeDoc()
    let now = 0
    const onReturn = vi.fn()
    watchTrips(doc, onReturn, () => now)
    markOwnTrip()
    now += 60 * 60 * 1000
    turn(doc, 'hidden')
    now += 5 * 60 * 1000
    turn(doc, 'visible')
    expect(onReturn).toHaveBeenCalledWith({ awayMs: 5 * 60 * 1000, own: true })
  })

  it('takeOwnTrip lê e apaga a marca', () => {
    expect(takeOwnTrip()).toBe(false)
    markOwnTrip()
    expect(takeOwnTrip()).toBe(true)
    expect(takeOwnTrip()).toBe(false)
  })
})
