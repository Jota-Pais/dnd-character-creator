import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { CycleOutcome } from '../engine'
import {
  BACKOFF_MS, CHARACTER_DELAY_MS, PLAY_DELAY_MS, PLAY_MAX_WAIT_MS, POLL_MS, createSyncScheduler,
} from '../scheduler'
import { characterKey, playKey } from '../syncStorage'

const SHEET = characterKey('dnd5e', 'k1')
const PLAY = playKey('k1')

/** O agendador sobre o relógio de mentira do Vitest, com um ciclo que o teste controla. */
function setup(outcomes: CycleOutcome[] = []) {
  let online = true
  const runs: number[] = []
  let release: (() => void) | null = null
  let hold = false
  const scheduler = createSyncScheduler({
    async run() {
      runs.push(Date.now())
      if (hold) await new Promise<void>(resolve => { release = resolve })
      return outcomes.shift() ?? 'synced'
    },
    isOnline: () => online,
    timers: {
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
      now: () => Date.now(),
    },
  })
  return {
    scheduler,
    runs,
    setOnline(value: boolean) { online = value },
    /** O próximo ciclo fica no ar até o teste soltar. */
    holdNext() { hold = true },
    finish() { hold = false; release?.(); release = null },
  }
}

/** Anda no tempo e deixa as promessas do ciclo terminarem. */
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
})

afterEach(() => vi.useRealTimers())

describe('alteração de ficha', () => {
  it('o ciclo sai 3 s depois da última alteração: várias seguidas viram um envio só', async () => {
    const { scheduler, runs } = setup()
    scheduler.notifyLocalChange(SHEET)
    await advance(CHARACTER_DELAY_MS - 1)
    scheduler.notifyLocalChange(SHEET)
    await advance(CHARACTER_DELAY_MS - 1)
    expect(runs).toEqual([])
    await advance(1)
    expect(runs).toEqual([2 * CHARACTER_DELAY_MS - 1])
  })
})

describe('alteração do jogo', () => {
  it('espera 15 s depois do último toque', async () => {
    const { scheduler, runs } = setup()
    scheduler.notifyLocalChange(PLAY)
    await advance(10_000)
    scheduler.notifyLocalChange(PLAY)
    await advance(PLAY_DELAY_MS - 1)
    expect(runs).toEqual([])
    await advance(1)
    expect(runs).toEqual([10_000 + PLAY_DELAY_MS])
  })

  it('numa rodada de toques seguidos, não passa de 60 s depois do primeiro', async () => {
    const { scheduler, runs } = setup()
    for (let t = 0; t < 120_000; t += 5_000) {
      scheduler.notifyLocalChange(PLAY)
      await advance(5_000)
    }
    expect(runs[0]).toBe(PLAY_MAX_WAIT_MS)
    expect(runs.length).toBeGreaterThanOrEqual(2)
  })

  it('um envio de ficha já marcado para antes leva o jogo junto', async () => {
    const { scheduler, runs } = setup()
    scheduler.notifyLocalChange(SHEET)
    scheduler.notifyLocalChange(PLAY)
    await advance(CHARACTER_DELAY_MS)
    expect(runs).toEqual([CHARACTER_DELAY_MS])
    await advance(PLAY_DELAY_MS * 2)
    expect(runs).toHaveLength(1)
  })
})

describe('um ciclo por vez', () => {
  it('pedido que chega durante um ciclo roda outro em seguida, e só um', async () => {
    const { scheduler, runs, holdNext, finish } = setup()
    holdNext()
    scheduler.requestNow()
    await advance(0)
    scheduler.requestNow()
    scheduler.requestNow()
    expect(runs).toHaveLength(1)
    finish()
    await advance(0)
    expect(runs).toHaveLength(2)
    await advance(POLL_MS * 2)
    expect(runs).toHaveLength(2)
  })
})

describe('sem conseguir falar com o servidor', () => {
  it('tenta de novo com espera crescente, e fica no último degrau', async () => {
    const { scheduler, runs } = setup(Array<CycleOutcome>(8).fill('retry'))
    scheduler.requestNow()
    await advance(0)
    // Tempo de sobra para os quatro degraus e mais duas voltas no último.
    await advance(BACKOFF_MS.reduce((sum, ms) => sum + ms, 0) + 2 * BACKOFF_MS.at(-1)!)
    const waits = runs.slice(1).map((at, i) => at - runs[i])
    expect(waits).toEqual([...BACKOFF_MS, BACKOFF_MS.at(-1), BACKOFF_MS.at(-1)])
  })

  it('alteração nova não encurta a espera; a rede voltando, sim', async () => {
    const { scheduler, runs } = setup(['retry', 'retry', 'synced'])
    scheduler.requestNow()
    await advance(0)
    await advance(BACKOFF_MS[0])
    expect(runs).toHaveLength(2)

    // Está na espera de 15 s: o jogador segue mexendo.
    scheduler.notifyLocalChange(SHEET)
    scheduler.notifyLocalChange(PLAY)
    await advance(CHARACTER_DELAY_MS * 2)
    expect(runs).toHaveLength(2)

    scheduler.notifyOnline()
    await advance(0)
    expect(runs).toHaveLength(3)
  })

  it('depois de um ciclo bom, a espera crescente recomeça do primeiro degrau', async () => {
    const { scheduler, runs } = setup(['retry', 'retry', 'synced', 'retry'])
    scheduler.requestNow()
    await advance(BACKOFF_MS[0] + BACKOFF_MS[1])
    expect(runs).toHaveLength(3)
    scheduler.requestNow()
    await advance(0)
    const failedAt = runs.at(-1)!
    await advance(BACKOFF_MS[0])
    expect(runs.at(-1)! - failedAt).toBe(BACKOFF_MS[0])
  })

  it('sem rede, nem começa: espera o aviso de que ela voltou', async () => {
    const { scheduler, runs, setOnline } = setup()
    setOnline(false)
    scheduler.requestNow()
    scheduler.notifyLocalChange(SHEET)
    await advance(60_000)
    expect(runs).toEqual([])

    setOnline(true)
    scheduler.notifyOnline()
    await advance(0)
    expect(runs).toHaveLength(1)
  })
})

describe('a leitura periódica', () => {
  it('com a galeria na tela, um ciclo por minuto; fora dela, nenhum', async () => {
    const { scheduler, runs } = setup()
    scheduler.setPolling(true)
    await advance(POLL_MS * 3)
    expect(runs).toEqual([POLL_MS, POLL_MS * 2, POLL_MS * 3])

    scheduler.setPolling(false)
    await advance(POLL_MS * 3)
    expect(runs).toHaveLength(3)
  })

  it('o ciclo pedido na hora recomeça a contagem do minuto', async () => {
    const { scheduler, runs } = setup()
    scheduler.setPolling(true)
    await advance(POLL_MS / 2)
    scheduler.requestNow()
    await advance(0)
    await advance(POLL_MS - 1)
    expect(runs).toHaveLength(1)
    await advance(1)
    expect(runs).toHaveLength(2)
  })
})

describe('parar', () => {
  it('o ciclo que para (sessão expirada) não agenda mais nada, nem a leitura periódica', async () => {
    const { scheduler, runs } = setup(['stopped'])
    scheduler.setPolling(true)
    scheduler.requestNow()
    await advance(0)
    await advance(POLL_MS * 3)
    expect(runs).toHaveLength(1)
  })

  it('parado, ignora alteração e rede; pedir de novo o religa', async () => {
    const { scheduler, runs } = setup()
    scheduler.notifyLocalChange(SHEET)
    scheduler.stop()
    await advance(CHARACTER_DELAY_MS * 2)
    scheduler.notifyLocalChange(SHEET)
    scheduler.notifyOnline()
    await advance(CHARACTER_DELAY_MS * 2)
    expect(runs).toEqual([])

    scheduler.requestNow()
    await advance(0)
    expect(runs).toHaveLength(1)
  })
})
