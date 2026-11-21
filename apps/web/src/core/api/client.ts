import type { ApiErrorBody, ErrorCode } from '@rpg/contracts'
import { ACCOUNT_HEADER } from '@rpg/contracts/constants'

/**
 * O cliente HTTP do site: o único ponto de saída para a API (`/api`, na mesma origem do site). Não
 * conhece conta, ficha nem sistema: quem o usa são as funções de `authApi.ts` e `syncApi.ts`.
 *
 * Nunca lança: toda chamada devolve `{ ok: true, data }` ou `{ ok: false, error }`. O app funciona
 * sem rede, então "não deu para falar com o servidor" é um resultado comum, e não uma exceção.
 */

export type ApiError =
  /** Sem resposta: sem rede, servidor acordando, tempo esgotado. Vale tentar de novo depois. */
  | { kind: 'network'; message: string }
  /** 401 de sessão: ninguém conectado, ou a sessão expirou. */
  | { kind: 'unauthorized'; message: string }
  /** 409 de conflito: o documento mudou no servidor; `current` é a versão dele (ou null). */
  | { kind: 'conflict'; message: string; current: unknown }
  /** Qualquer outra recusa. `code` é null quando a resposta não veio da API (página de erro do proxy). */
  | { kind: 'http'; status: number; code: ErrorCode | null; message: string; fields: Record<string, string> }

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export type RequestOptions = {
  body?: unknown
  /** Manda o cabeçalho com a conta dona dos dados do aparelho (as rotas de ficha e de sincronização). */
  account?: boolean
  /** O pedido sobrevive à página fechando (o envio do `pagehide`). O navegador limita o corpo a ~64 KB. */
  keepalive?: boolean
  timeoutMs?: number
}

export type ApiClient = {
  request<T>(method: ApiMethod, path: string, options?: RequestOptions): Promise<ApiResult<T>>
}

export type ApiClientDeps = {
  fetch: typeof fetch
  /** A conta dona dos dados deste aparelho, para o cabeçalho; null se não há. */
  getAccountId?: () => string | null
  /** Chamado em todo 401 de sessão: é como o app fica sabendo que a sessão expirou. */
  onUnauthorized?: () => void
  timeoutMs?: number
}

/** O bastante para o plano gratuito da Render responder depois de acordar a instância. */
export const DEFAULT_TIMEOUT_MS = 30_000

export const NETWORK_MESSAGE = 'Não foi possível falar com o servidor. Confira a internet e tente de novo.'
const UNEXPECTED_MESSAGE = 'O servidor respondeu algo inesperado. Tente de novo em instantes.'

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** O `error` do envelope da API, se o corpo for um. */
function envelopeOf(body: unknown): ApiErrorBody['error'] | null {
  if (!isRecord(body) || !isRecord(body.error)) return null
  const { code, message, fields } = body.error
  if (typeof code !== 'string' || typeof message !== 'string') return null
  return {
    code: code as ErrorCode,
    message,
    ...(isRecord(fields) ? { fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => typeof v === 'string')) as Record<string, string> } : {}),
  }
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    // O proxy devolvendo HTML (a API fora do ar, acordando): o corpo não é do contrato.
    return undefined
  }
}

export function createApiClient(deps: ApiClientDeps): ApiClient {
  return {
    async request<T>(method: ApiMethod, path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
      const headers: Record<string, string> = {}
      if (options.body !== undefined) headers['Content-Type'] = 'application/json'
      const accountId = options.account ? deps.getAccountId?.() : null
      if (accountId) headers[ACCOUNT_HEADER] = accountId

      let response: Response
      let body: unknown
      try {
        response = await deps.fetch(path, {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          // O cookie de sessão é da mesma origem; nada de /api fica em cache.
          credentials: 'same-origin',
          cache: 'no-store',
          keepalive: options.keepalive,
          signal: AbortSignal.timeout(options.timeoutMs ?? deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        })
        body = await readJson(response)
      } catch {
        return { ok: false, error: { kind: 'network', message: NETWORK_MESSAGE } }
      }

      if (response.ok) return { ok: true, data: body as T }

      const envelope = envelopeOf(body)
      if (response.status === 401 && envelope?.code === 'UNAUTHENTICATED') {
        deps.onUnauthorized?.()
        return { ok: false, error: { kind: 'unauthorized', message: envelope.message } }
      }
      if (response.status === 409 && envelope?.code === 'CONFLICT') {
        const current = isRecord(body) ? body.current ?? null : null
        return { ok: false, error: { kind: 'conflict', message: envelope.message, current } }
      }
      return {
        ok: false,
        error: {
          kind: 'http',
          status: response.status,
          code: envelope?.code ?? null,
          message: envelope?.message ?? UNEXPECTED_MESSAGE,
          fields: envelope?.fields ?? {},
        },
      }
    },
  }
}

/** A recusa que vale tentar de novo sozinho: sem resposta, erro do servidor ou do proxy, limite. */
export function isRetryable(error: ApiError): boolean {
  return error.kind === 'network' || (error.kind === 'http' && (error.status >= 500 || error.status === 429))
}
