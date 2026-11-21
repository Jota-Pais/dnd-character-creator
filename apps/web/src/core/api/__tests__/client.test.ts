import { describe, it, expect, vi } from 'vitest'
import { ACCOUNT_HEADER } from '@rpg/contracts/constants'
import { NETWORK_MESSAGE, createApiClient, isRetryable, type ApiError } from '../client'

type FetchCall = { url: string; init: RequestInit }

/** Um fetch de mentira: guarda os pedidos e responde o que o teste mandar. */
function fakeFetch(respond: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = []
  const fetch = (async (url: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(url), init }
    calls.push(call)
    return respond(call)
  }) as typeof globalThis.fetch
  return { fetch, calls }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const errorOf = async (promise: Promise<{ ok: boolean; error?: ApiError }>): Promise<ApiError> => {
  const result = await promise
  expect(result.ok).toBe(false)
  return result.error as ApiError
}

describe('o pedido', () => {
  it('vai com o corpo em JSON, o cookie da mesma origem e sem cache', async () => {
    const { fetch, calls } = fakeFetch(() => json(200, { revision: 2 }))
    const api = createApiClient({ fetch })
    const result = await api.request('PUT', '/api/characters/k1', { body: { step: 'name' } })

    expect(result).toEqual({ ok: true, data: { revision: 2 } })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/characters/k1')
    expect(calls[0].init).toMatchObject({
      method: 'PUT',
      body: '{"step":"name"}',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal)
  })

  it('sem corpo não diz que é JSON, e o 204 volta sem dado', async () => {
    const { fetch, calls } = fakeFetch(() => new Response(null, { status: 204 }))
    const result = await createApiClient({ fetch }).request('POST', '/api/auth/logout')
    expect(result).toEqual({ ok: true, data: undefined })
    expect(calls[0].init.headers).toEqual({})
    expect(calls[0].init.body).toBeUndefined()
  })

  it('o cabeçalho da conta só vai quando a rota pede, e só se o aparelho tem dono', async () => {
    const { fetch, calls } = fakeFetch(() => json(200, {}))
    let owner: string | null = 'conta-da-ana'
    const api = createApiClient({ fetch, getAccountId: () => owner })

    await api.request('GET', '/api/auth/session')
    await api.request('GET', '/api/sync/changes', { account: true })
    owner = null
    await api.request('GET', '/api/sync/changes', { account: true })

    expect(calls.map(c => (c.init.headers as Record<string, string>)[ACCOUNT_HEADER])).toEqual([undefined, 'conta-da-ana', undefined])
  })

  it('o keepalive do envio de saída chega ao fetch', async () => {
    const { fetch, calls } = fakeFetch(() => json(200, {}))
    await createApiClient({ fetch }).request('PUT', '/api/x', { body: {}, keepalive: true })
    expect(calls[0].init.keepalive).toBe(true)
  })
})

describe('sem resposta', () => {
  it('rede caída vira resultado, não exceção', async () => {
    const fetch = (async () => { throw new TypeError('Failed to fetch') }) as typeof globalThis.fetch
    const error = await errorOf(createApiClient({ fetch }).request('GET', '/api/auth/session'))
    expect(error).toEqual({ kind: 'network', message: NETWORK_MESSAGE })
    expect(isRetryable(error)).toBe(true)
  })

  it('o tempo esgotado também', async () => {
    const fetch = ((_url: RequestInfo | URL, init: RequestInit = {}) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'TimeoutError')))
      })) as typeof globalThis.fetch
    const error = await errorOf(createApiClient({ fetch, timeoutMs: 5 }).request('GET', '/api/auth/session'))
    expect(error.kind).toBe('network')
  })
})

describe('a recusa', () => {
  it('401 de sessão avisa o app; senha errada não', async () => {
    const onUnauthorized = vi.fn()
    const expired = fakeFetch(() => json(401, { error: { code: 'UNAUTHENTICATED', message: 'Entre na sua conta para continuar.' } }))
    expect(await errorOf(createApiClient({ fetch: expired.fetch, onUnauthorized }).request('GET', '/api/sync/changes')))
      .toEqual({ kind: 'unauthorized', message: 'Entre na sua conta para continuar.' })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    const wrong = fakeFetch(() => json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' } }))
    const error = await errorOf(createApiClient({ fetch: wrong.fetch, onUnauthorized }).request('POST', '/api/auth/login', { body: {} }))
    expect(error).toEqual({ kind: 'http', status: 401, code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.', fields: {} })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(isRetryable(error)).toBe(false)
  })

  it('409 de conflito traz a versão do servidor; outro 409 é recusa comum, com os campos', async () => {
    const current = { id: 'k1', revision: 2 }
    const conflicted = fakeFetch(() => json(409, { error: { code: 'CONFLICT', message: 'Esta ficha mudou em outro aparelho.' }, current }))
    expect(await errorOf(createApiClient({ fetch: conflicted.fetch }).request('PUT', '/api/characters/k1', { body: {} })))
      .toEqual({ kind: 'conflict', message: 'Esta ficha mudou em outro aparelho.', current })

    const gone = fakeFetch(() => json(409, { error: { code: 'CONFLICT', message: 'x' } }))
    expect(await errorOf(createApiClient({ fetch: gone.fetch }).request('PUT', '/api/characters/k1', { body: {} })))
      .toMatchObject({ kind: 'conflict', current: null })

    const taken = fakeFetch(() => json(409, { error: { code: 'EMAIL_TAKEN', message: 'Já existe uma conta com esse e-mail.', fields: { email: 'Entre com ela.', n: 3 } } }))
    expect(await errorOf(createApiClient({ fetch: taken.fetch }).request('POST', '/api/auth/register', { body: {} })))
      .toEqual({ kind: 'http', status: 409, code: 'EMAIL_TAKEN', message: 'Já existe uma conta com esse e-mail.', fields: { email: 'Entre com ela.' } })
  })

  it('página de erro do proxy (a API fora do ar) é recusa sem código, e vale tentar de novo', async () => {
    const { fetch } = fakeFetch(() => new Response('<html>502 Bad Gateway</html>', { status: 502 }))
    const error = await errorOf(createApiClient({ fetch }).request('GET', '/api/auth/session'))
    expect(error).toMatchObject({ kind: 'http', status: 502, code: null, fields: {} })
    expect(isRetryable(error)).toBe(true)
  })

  it('tentar de novo sozinho só no que pode passar: 5xx e 429, não 400 nem 403', () => {
    const http = (status: number): ApiError => ({ kind: 'http', status, code: null, message: '', fields: {} })
    expect([500, 503, 429].map(s => isRetryable(http(s)))).toEqual([true, true, true])
    expect([400, 403, 404, 413].map(s => isRetryable(http(s)))).toEqual([false, false, false, false])
    expect(isRetryable({ kind: 'unauthorized', message: '' })).toBe(false)
    expect(isRetryable({ kind: 'conflict', message: '', current: null })).toBe(false)
  })
})
