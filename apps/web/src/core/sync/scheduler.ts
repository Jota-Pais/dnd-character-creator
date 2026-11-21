import type { CycleOutcome } from './engine'
import type { DocKey } from './syncStorage'

/**
 * Quando a sincronização roda: junta os motivos para rodar um ciclo (o jogador mudou algo, a rede
 * voltou, a galeria abriu) e decide a hora. O motor (`engine.ts`) só sabe fazer um ciclo; aqui só
 * há relógio. Os temporizadores entram por fora, para os testes andarem no tempo.
 *
 *  - alteração de ficha: o ciclo sai `CHARACTER_DELAY_MS` depois da última (várias seguidas viram
 *    um envio só);
 *  - alteração do jogo, que grava a cada toque: `PLAY_DELAY_MS` depois da última, e no máximo
 *    `PLAY_MAX_WAIT_MS` depois da primeira (numa rodada de toques seguidos, o envio não fica
 *    adiado para sempre);
 *  - sem conseguir falar com o servidor: tenta de novo com espera crescente (`BACKOFF_MS`), sem
 *    sorteio (o app tem uma fonte só de aleatoriedade, e aqui ela não faz falta). Enquanto essa
 *    espera corre, alteração nova não a encurta: quem a encurta é a rede voltar;
 *  - um ciclo por vez; o que chega durante um ciclo roda outro em seguida.
 */

export const CHARACTER_DELAY_MS = 3_000
export const PLAY_DELAY_MS = 15_000
export const PLAY_MAX_WAIT_MS = 60_000
export const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000] as const
/** Com a galeria na tela, uma leitura por minuto: é como o que mudou em outro aparelho chega. */
export const POLL_MS = 60_000

export type SchedulerTimers = {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
  now(): number
}

export type SyncSchedulerDeps = {
  /** Um ciclo do motor. */
  run(): Promise<CycleOutcome>
  /** Há rede, até onde o navegador sabe. Sem ela, nem tenta: espera o aviso de que voltou. */
  isOnline(): boolean
  timers: SchedulerTimers
}

export type SyncScheduler = {
  /** Roda um ciclo agora (entrou na conta, a galeria abriu, o jogador pediu). */
  requestNow(): void
  /** O jogador mudou um documento: agenda o envio. */
  notifyLocalChange(key: DocKey): void
  /** A rede voltou: zera a espera crescente e roda. */
  notifyOnline(): void
  /** Liga ou desliga a leitura periódica (a galeria na tela e a página visível). */
  setPolling(on: boolean): void
  /** Cancela tudo o que estava agendado (saiu da conta, a sessão expirou). */
  stop(): void
}

type Reason = 'change' | 'play' | 'backoff' | 'poll'

export function createSyncScheduler({ run, isOnline, timers }: SyncSchedulerDeps): SyncScheduler {
  let due: { at: number; reason: Reason; handle: unknown } | null = null
  let running = false
  let again = false
  let failures = 0
  let polling = false
  /** Quando começou a espera do envio do jogo que ainda não saiu; null se não há. */
  let playWaitingSince: number | null = null
  let stopped = false

  function clear(): void {
    if (due) timers.clearTimeout(due.handle)
    due = null
  }

  function schedule(at: number, reason: Reason): void {
    clear()
    const handle = timers.setTimeout(() => {
      due = null
      void start()
    }, Math.max(0, at - timers.now()))
    due = { at, reason, handle }
  }

  async function start(): Promise<void> {
    if (stopped) return
    if (running) {
      again = true
      return
    }
    // Sem rede, o ciclo nem começa: o que mudou continua marcado, e o aviso de que a rede voltou
    // (`notifyOnline`) roda o ciclo.
    if (!isOnline()) return
    clear()
    running = true
    again = false
    playWaitingSince = null

    let outcome: CycleOutcome
    try {
      outcome = await run()
    } catch {
      outcome = 'retry'
    }
    running = false
    if (stopped) return

    if (outcome === 'retry') {
      const wait = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)]
      failures += 1
      schedule(timers.now() + wait, 'backoff')
      return
    }
    failures = 0
    if (outcome === 'stopped') {
      clear()
      return
    }
    if (again) void start()
    else if (polling && !due) schedule(timers.now() + POLL_MS, 'poll')
  }

  return {
    requestNow() {
      stopped = false
      void start()
    },

    notifyLocalChange(key) {
      if (stopped) return
      if (due?.reason === 'backoff') return
      const now = timers.now()
      if (!key.startsWith('play:')) {
        schedule(now + CHARACTER_DELAY_MS, 'change')
        return
      }
      playWaitingSince ??= now
      const at = Math.min(now + PLAY_DELAY_MS, playWaitingSince + PLAY_MAX_WAIT_MS)
      // Um envio de ficha já marcado para antes leva o estado de jogo junto.
      if (due?.reason === 'change' && due.at <= at) return
      schedule(at, 'play')
    },

    notifyOnline() {
      if (stopped) return
      failures = 0
      void start()
    },

    setPolling(on) {
      polling = on
      if (stopped) return
      if (!on) {
        if (due?.reason === 'poll') clear()
      } else if (!running && !due) {
        schedule(timers.now() + POLL_MS, 'poll')
      }
    },

    stop() {
      stopped = true
      clear()
      again = false
      failures = 0
      playWaitingSince = null
    },
  }
}
