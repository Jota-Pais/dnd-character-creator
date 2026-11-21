/**
 * A conta lembrada neste aparelho (a chave `app-account`): quem está conectado aqui, para o app
 * abrir sem rede, direto na galeria ou no jogo, sem perguntar ao servidor. Não guarda senha nem
 * token: a sessão de verdade é um cookie `HttpOnly`, que o JavaScript não lê. Isto é só o "quem".
 *
 * É outra coisa que a conta dona dos dados do aparelho (`owner`, no diário de
 * `core/sync/syncStorage.ts`): as duas divergem quando alguém sai da conta deixando alterações por
 * enviar, e é essa diferença que impede as fichas de uma pessoa de aparecerem para outra.
 */

export const ACCOUNT_KEY = 'app-account'
export const ACCOUNT_VERSION = 1

export type AccountUser = { id: string; email: string }

export type AccountState = {
  version: number
  /** Quem está conectado neste aparelho; `null` se ninguém. */
  user: AccountUser | null
  /**
   * A pessoa saiu sem rede: o cookie de sessão continua valendo no servidor, e o app precisa
   * encerrá-lo assim que conseguir falar com ele.
   */
  signOutPending: boolean
}

export const emptyAccount = (): AccountState => ({ version: ACCOUNT_VERSION, user: null, signOutPending: false })

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

function toAccount(raw: unknown): AccountState {
  if (!isRecord(raw) || raw.version !== ACCOUNT_VERSION) return emptyAccount()
  const user = isRecord(raw.user) && typeof raw.user.id === 'string' && raw.user.id !== '' && typeof raw.user.email === 'string'
    ? { id: raw.user.id, email: raw.user.email }
    : null
  return { version: ACCOUNT_VERSION, user, signOutPending: raw.signOutPending === true }
}

/** A conta lembrada. JSON quebrado ou localStorage fora valem "ninguém conectado": a tela de entrar. */
export function loadAccount(): AccountState {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    return raw ? toAccount(JSON.parse(raw)) : emptyAccount()
  } catch {
    return emptyAccount()
  }
}

/** Grava os campos dados sobre o que está salvo; devolve o estado novo. */
export function saveAccount(patch: Partial<Omit<AccountState, 'version'>>): AccountState {
  const next = toAccount({ ...loadAccount(), ...patch })
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next))
  } catch {
    // Sem onde gravar, a conta só não é lembrada: a próxima abertura pede para entrar de novo.
  }
  return next
}
