/**
 * O limite de tentativas de entrar, por e-mail: depois de `maxFailures` senhas erradas dentro da
 * janela, a conta fica sem poder tentar até a janela passar. É o que segura a força bruta numa API
 * de cadastro aberto.
 *
 * Em memória, como no Nidus: a API é uma instância só na Render, e reiniciar zera a contagem, o que
 * só ajuda quem errou a senha. A chave é o e-mail, e não o IP: atrás da Vercel e da Render, o IP que
 * chega é o do proxy, igual para todo mundo.
 */
export type LoginThrottle = {
  /** Minutos que faltam para poder tentar de novo; 0 se pode. */
  minutesToWait(email: string): number
  fail(email: string): void
  reset(email: string): void
}

export const LOGIN_MAX_FAILURES = 5
export const LOGIN_WINDOW_MS = 15 * 60 * 1000

/** Acima disto, as entradas vencidas são varridas: e-mails inventados não enchem a memória. */
const SWEEP_ABOVE = 5_000

export function createLoginThrottle(
  clock: () => Date,
  { maxFailures = LOGIN_MAX_FAILURES, windowMs = LOGIN_WINDOW_MS } = {},
): LoginThrottle {
  const attempts = new Map<string, { count: number; firstAt: number }>()

  const current = (email: string) => {
    const entry = attempts.get(email)
    if (entry && clock().getTime() - entry.firstAt >= windowMs) {
      attempts.delete(email)
      return undefined
    }
    return entry
  }

  return {
    minutesToWait(email) {
      const entry = current(email)
      if (!entry || entry.count < maxFailures) return 0
      return Math.max(1, Math.ceil((entry.firstAt + windowMs - clock().getTime()) / 60_000))
    },

    fail(email) {
      const now = clock().getTime()
      const entry = current(email)
      attempts.set(email, entry ? { ...entry, count: entry.count + 1 } : { count: 1, firstAt: now })
      if (attempts.size > SWEEP_ABOVE) {
        for (const [key, value] of attempts) {
          if (now - value.firstAt >= windowMs) attempts.delete(key)
        }
      }
    },

    reset(email) {
      attempts.delete(email)
    },
  }
}
