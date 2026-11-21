import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ApiClient, ApiResult } from '../../../core/api/client'
import type { CycleOutcome } from '../../../core/sync/engine'
import { characterKey, loadSyncMeta, updateSyncMeta } from '../../../core/sync/syncStorage'
import { ACCOUNT_KEY, emptyAccount, loadAccount, saveAccount } from '../accountStorage'
import { useAuthStore } from '../authStore'
import { NO_CONNECTION, createSession } from '../session'

const ANA = { id: 'conta-da-ana', email: 'ana@forja.dev' }
const BIA = { id: 'conta-da-bia', email: 'bia@forja.dev' }
const LOGIN = { email: 'ana@forja.dev', password: 'dado-de-vinte' }

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data })
const offline: ApiResult<never> = { ok: false, error: { kind: 'network', message: 'sem rede' } }

/** Os fluxos de conta com tudo de mentira: a API responde o que o teste mandar. */
function setup() {
  const calls: string[] = []
  const responses: Record<string, ApiResult<unknown>> = {}
  const api: ApiClient = {
    async request<T>(method: string, path: string) {
      calls.push(`${method} ${path}`)
      return (responses[path] ?? ok(undefined)) as ApiResult<T>
    },
  }
  const sync = {
    started: 0,
    stopped: 0,
    unsentCount: 0,
    outcome: 'synced' as CycleOutcome,
    cycles: 0,
    start() { this.started += 1 },
    stop() { this.stopped += 1 },
    async now() { this.cycles += 1; return this.outcome },
    unsent() { return this.unsentCount },
  }
  const local = { wiped: 0, flushed: 0, wipe() { this.wiped += 1; updateSyncMeta(meta => { meta.owner = null; meta.docs = {}; meta.cursor = null }) }, flush() { this.flushed += 1 } }
  const page = { reloads: 0, online: true }
  const session = createSession({ api, sync, local, reload: () => { page.reloads += 1 }, isOnline: () => page.online })
  return { session, calls, responses, sync, local, page }
}

const ownedBy = (owner: typeof ANA | null) => updateSyncMeta(meta => { meta.owner = owner })

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ user: null, session: 'unknown' })
})

describe('entrar', () => {
  it('num aparelho sem dono: as fichas passam a ser de quem entra, o portão abre e a sincronização liga', async () => {
    const { session, responses, sync, local, page } = setup()
    updateSyncMeta(meta => { meta.docs[characterKey('dnd5e', 'k1')] = { revision: 0, dirty: true } })
    responses['/api/auth/login'] = ok({ user: ANA })

    expect(await session.signIn(LOGIN)).toEqual({ ok: true })
    expect(useAuthStore.getState()).toEqual({ user: ANA, session: 'valid' })
    expect(loadAccount()).toEqual({ version: 1, user: ANA, signOutPending: false })
    expect(loadSyncMeta().owner).toEqual(ANA)
    // Nada foi apagado nem copiado: o que estava por enviar continua lá.
    expect(loadSyncMeta().docs).toEqual({ [characterKey('dnd5e', 'k1')]: { revision: 0, dirty: true } })
    expect(local.wiped).toBe(0)
    expect(page.reloads).toBe(0)
    expect(sync.started).toBe(1)
  })

  it('criar conta segue o mesmo caminho', async () => {
    const { session, calls, responses } = setup()
    responses['/api/auth/register'] = ok({ user: ANA })
    expect(await session.signUp(LOGIN)).toEqual({ ok: true })
    expect(calls).toEqual(['POST /api/auth/register'])
    expect(useAuthStore.getState().user).toEqual(ANA)
  })

  it('a mesma conta de novo (a sessão tinha expirado): só volta a valer', async () => {
    const { session, responses, sync, local } = setup()
    ownedBy(ANA)
    useAuthStore.setState({ user: ANA, session: 'expired' })
    responses['/api/auth/login'] = ok({ user: ANA })

    expect(await session.signIn(LOGIN)).toEqual({ ok: true })
    expect(useAuthStore.getState().session).toBe('valid')
    expect(local.wiped).toBe(0)
    expect(sync.started).toBe(1)
  })

  it('outra conta, com tudo da anterior já no servidor: o aparelho é limpo e a página recarrega', async () => {
    const { session, responses, sync, local, page } = setup()
    ownedBy(BIA)
    responses['/api/auth/login'] = ok({ user: ANA })

    expect(await session.signIn(LOGIN)).toEqual({ ok: true })
    expect(local.wiped).toBe(1)
    expect(loadSyncMeta().owner).toEqual(ANA)
    expect(loadAccount().user).toEqual(ANA)
    expect(page.reloads).toBe(1)
    // O portão abre na página nova, pelo que ficou gravado; nesta, nada.
    expect(useAuthStore.getState().user).toBeNull()
    expect(sync.started).toBe(0)
  })

  it('outra conta, com alterações da anterior por enviar: não entra, e a sessão aberta é encerrada', async () => {
    const { session, calls, responses, sync, local, page } = setup()
    ownedBy(BIA)
    sync.unsentCount = 3
    responses['/api/auth/login'] = ok({ user: ANA })

    expect(await session.signIn(LOGIN)).toEqual({ ok: false, kind: 'otherAccount', other: { owner: BIA, unsent: 3 } })
    expect(calls).toEqual(['POST /api/auth/login', 'POST /api/auth/logout'])
    expect(local.wiped).toBe(0)
    expect(loadSyncMeta().owner).toEqual(BIA)
    expect(loadAccount().user).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(page.reloads).toBe(0)
  })

  it('descartar o que era da outra conta, depois de confirmar: limpa, entra e recarrega', async () => {
    const { session, responses, sync, local, page } = setup()
    ownedBy(BIA)
    sync.unsentCount = 3
    responses['/api/auth/login'] = ok({ user: ANA })

    expect(await session.discardAndSignIn(LOGIN)).toEqual({ ok: true })
    expect(local.wiped).toBe(1)
    expect(loadSyncMeta().owner).toEqual(ANA)
    expect(loadAccount().user).toEqual(ANA)
    expect(page.reloads).toBe(1)
  })

  it('senha errada no descarte não apaga nada', async () => {
    const { session, responses, local } = setup()
    ownedBy(BIA)
    responses['/api/auth/login'] = { ok: false, error: { kind: 'http', status: 401, code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.', fields: {} } }
    expect(await session.discardAndSignIn(LOGIN)).toEqual({ ok: false, kind: 'message', message: 'E-mail ou senha incorretos.', offline: false })
    expect(local.wiped).toBe(0)
  })
})

describe('as recusas de entrar', () => {
  it('senha errada e tentativas demais vêm com a mensagem do servidor', async () => {
    const { session, responses } = setup()
    responses['/api/auth/login'] = { ok: false, error: { kind: 'http', status: 401, code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.', fields: {} } }
    expect(await session.signIn(LOGIN)).toEqual({ ok: false, kind: 'message', message: 'E-mail ou senha incorretos.', offline: false })

    responses['/api/auth/login'] = { ok: false, error: { kind: 'http', status: 429, code: 'RATE_LIMITED', message: 'Muitas tentativas. Espere 15 minutos e tente de novo.', fields: {} } }
    expect(await session.signIn(LOGIN)).toEqual({ ok: false, kind: 'message', message: 'Muitas tentativas. Espere 15 minutos e tente de novo.', offline: false })
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('o que é de um campo vai para o campo', async () => {
    const { session, responses } = setup()
    responses['/api/auth/register'] = { ok: false, error: { kind: 'http', status: 409, code: 'EMAIL_TAKEN', message: 'Já existe uma conta com esse e-mail.', fields: { email: 'Já existe uma conta com esse e-mail. Entre com ela.' } } }
    expect(await session.signUp(LOGIN)).toEqual({
      ok: false, kind: 'fields', message: 'Já existe uma conta com esse e-mail.', fields: { email: 'Já existe uma conta com esse e-mail. Entre com ela.' },
    })
  })

  it('sem rede, ou com o servidor fora do ar, diz que entrar precisa de internet', async () => {
    const { session, responses } = setup()
    responses['/api/auth/login'] = offline
    expect(await session.signIn(LOGIN)).toEqual({ ok: false, kind: 'message', message: NO_CONNECTION, offline: true })
    responses['/api/auth/login'] = { ok: false, error: { kind: 'http', status: 502, code: null, message: 'x', fields: {} } }
    expect(await session.signIn(LOGIN)).toMatchObject({ kind: 'message', offline: true })
  })
})

describe('sair', () => {
  function signedIn() {
    const world = setup()
    ownedBy(ANA)
    saveAccount({ user: ANA })
    useAuthStore.setState({ user: ANA, session: 'valid' })
    return world
  }

  it('com tudo no servidor: grava o que faltava, sincroniza, encerra a sessão, limpa o aparelho e recarrega', async () => {
    const { session, calls, sync, local, page } = signedIn()
    expect(await session.signOut()).toEqual({ ok: true })
    expect(local.flushed).toBe(1)
    expect(sync.cycles).toBe(1)
    expect(sync.stopped).toBe(1)
    expect(calls).toEqual(['POST /api/auth/logout'])
    expect(local.wiped).toBe(1)
    expect(loadAccount()).toEqual({ version: 1, user: null, signOutPending: false })
    expect(page.reloads).toBe(1)
  })

  it('com alteração que não subiu: não sai sem a confirmação, e nada é tocado', async () => {
    const { session, calls, sync, local, page } = signedIn()
    sync.unsentCount = 2
    expect(await session.signOut()).toEqual({ ok: false, unsent: 2 })
    expect(calls).toEqual([])
    expect(local.wiped).toBe(0)
    expect(sync.stopped).toBe(0)
    expect(page.reloads).toBe(0)
    expect(loadAccount().user).toEqual(ANA)
  })

  it('confirmado: sai sem apagar nada, e as fichas continuam sendo da conta que saiu', async () => {
    const { session, sync, local, page } = signedIn()
    sync.unsentCount = 2
    expect(await session.signOut({ keepUnsent: true })).toEqual({ ok: true })
    expect(local.wiped).toBe(0)
    expect(loadSyncMeta().owner).toEqual(ANA)
    expect(loadAccount().user).toBeNull()
    expect(page.reloads).toBe(1)
  })

  it('sem rede: nem tenta sincronizar, e a saída do servidor fica pendente', async () => {
    const { session, responses, sync, page } = signedIn()
    page.online = false
    sync.unsentCount = 1
    responses['/api/auth/logout'] = offline
    expect(await session.signOut({ keepUnsent: true })).toEqual({ ok: true })
    expect(sync.cycles).toBe(0)
    expect(loadAccount()).toEqual({ version: 1, user: null, signOutPending: true })
  })
})

describe('a abertura do app', () => {
  it('com conta lembrada e a sessão confirmada: liga a sincronização', async () => {
    const { session, calls, responses, sync } = setup()
    ownedBy(ANA)
    saveAccount({ user: ANA })
    useAuthStore.setState({ user: ANA, session: 'unknown' })
    responses['/api/auth/session'] = ok({ user: ANA })

    await session.start()
    expect(calls).toEqual(['GET /api/auth/session'])
    expect(useAuthStore.getState().session).toBe('valid')
    expect(sync.started).toBe(1)
  })

  it('com conta lembrada e sem rede: o que o aparelho lembra continua valendo', async () => {
    const { session, responses, sync } = setup()
    ownedBy(ANA)
    saveAccount({ user: ANA })
    useAuthStore.setState({ user: ANA, session: 'unknown' })
    responses['/api/auth/session'] = offline

    await session.start()
    expect(useAuthStore.getState()).toEqual({ user: ANA, session: 'unknown' })
    expect(sync.started).toBe(0)
  })

  it('o servidor diz que não há sessão (ou que é de outra pessoa): expirou, sem mexer nas fichas', async () => {
    for (const user of [null, BIA]) {
      const { session, responses, sync, local } = setup()
      ownedBy(ANA)
      saveAccount({ user: ANA })
      useAuthStore.setState({ user: ANA, session: 'unknown' })
      responses['/api/auth/session'] = ok({ user })

      await session.start()
      expect(useAuthStore.getState()).toEqual({ user: ANA, session: 'expired' })
      expect(sync.started).toBe(0)
      expect(local.wiped).toBe(0)
    }
  })

  it('sem conta lembrada, mas com o cookie vivo: entra sem pedir a senha', async () => {
    const { session, responses, sync } = setup()
    responses['/api/auth/session'] = ok({ user: ANA })
    await session.start()
    expect(useAuthStore.getState()).toEqual({ user: ANA, session: 'valid' })
    expect(loadSyncMeta().owner).toEqual(ANA)
    expect(sync.started).toBe(1)
  })

  it('sem conta e sem cookie: fica na tela de entrar', async () => {
    const { session, responses, sync } = setup()
    responses['/api/auth/session'] = ok({ user: null })
    await session.start()
    expect(useAuthStore.getState().user).toBeNull()
    expect(sync.started).toBe(0)
  })

  it('o diário perdeu o dono, mas a conta é lembrada e o servidor a confirma: o dono volta', async () => {
    const { session, responses } = setup()
    saveAccount({ user: ANA })
    useAuthStore.setState({ user: ANA, session: 'unknown' })
    responses['/api/auth/session'] = ok({ user: ANA })
    await session.start()
    expect(loadSyncMeta().owner).toEqual(ANA)
  })

  it('a saída que ficou pendente é concluída antes de tudo, e o cookie vivo não reconecta ninguém', async () => {
    const { session, calls, responses } = setup()
    saveAccount({ user: null, signOutPending: true })
    responses['/api/auth/session'] = ok({ user: null })
    await session.start()
    expect(calls).toEqual(['POST /api/auth/logout', 'GET /api/auth/session'])
    expect(loadAccount().signOutPending).toBe(false)
  })

  it('a saída pendente e ainda sem rede: não pergunta a sessão, para não reconectar quem saiu', async () => {
    const { session, calls, responses } = setup()
    saveAccount({ user: null, signOutPending: true })
    responses['/api/auth/logout'] = offline
    responses['/api/auth/session'] = ok({ user: ANA })
    await session.start()
    expect(calls).toEqual(['POST /api/auth/logout'])
    expect(loadAccount().signOutPending).toBe(true)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('a conta lembrada não é a dona dos dados do aparelho: o portão fecha', async () => {
    const { session, calls } = setup()
    ownedBy(BIA)
    saveAccount({ user: ANA })
    useAuthStore.setState({ user: ANA, session: 'unknown' })
    await session.start()
    expect(useAuthStore.getState().user).toBeNull()
    expect(loadAccount().user).toBeNull()
    expect(calls).toEqual([])
  })
})

describe('a conta lembrada no aparelho', () => {
  it('vai e volta, e JSON quebrado ou versão diferente valem "ninguém"', () => {
    expect(loadAccount()).toEqual(emptyAccount())
    saveAccount({ user: ANA })
    expect(loadAccount()).toEqual({ version: 1, user: ANA, signOutPending: false })
    localStorage.setItem(ACCOUNT_KEY, '{quebrado')
    expect(loadAccount()).toEqual(emptyAccount())
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ version: 9, user: ANA }))
    expect(loadAccount()).toEqual(emptyAccount())
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ version: 1, user: { id: '', email: 'x' }, signOutPending: 'sim' }))
    expect(loadAccount()).toEqual(emptyAccount())
  })

  it('não guarda senha nem token', () => {
    saveAccount({ user: ANA })
    expect(Object.keys(JSON.parse(localStorage.getItem(ACCOUNT_KEY)!)).sort()).toEqual(['signOutPending', 'user', 'version'])
  })

  it('sem onde gravar, não é erro', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cota') })
    expect(() => saveAccount({ user: ANA })).not.toThrow()
    spy.mockRestore()
  })
})
