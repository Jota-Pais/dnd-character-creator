import { describe, it, expect } from 'vitest'
import { createTestClock, only } from '../../../testing/test-app'
import { AppError } from '../../../shared/errors'
import { createMemoryAuthRepository } from '../auth.repository.memory'
import { createAuthService } from '../auth.service'
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, createLoginThrottle } from '../login-throttle'
import { SESSION_RENEW_AFTER_MS, SESSION_TTL_MS, hashSessionToken } from '../session-cookie'

const DEVICE = { userAgent: 'vitest' }
const ANA = { email: 'ana@forja.dev', password: 'dado-de-vinte' }

function setup() {
  const clock = createTestClock()
  const repository = createMemoryAuthRepository()
  const service = createAuthService({ repository, throttle: createLoginThrottle(clock.now), clock: clock.now, passwordCost: 4 })
  return { clock, repository, service }
}

/** O código do erro de regra que a promessa rejeita. */
async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(AppError)
  return (error as AppError).code
}

describe('criar conta', () => {
  it('cria a conta, abre a sessão e guarda só o hash da senha e do token', async () => {
    const { repository, service } = setup()
    const session = await service.register(ANA, DEVICE)

    expect(session.user.email).toBe('ana@forja.dev')
    const user = only(repository.users.values())
    expect(user.passwordHash).not.toContain(ANA.password)
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/)

    const stored = only(repository.sessions.values())
    expect(stored.tokenHash).toBe(hashSessionToken(session.token))
    expect(stored.tokenHash).not.toBe(session.token)
    expect(session.expiresAt.getTime() - stored.lastSeenAt.getTime()).toBe(SESSION_TTL_MS)
  })

  it('recusa o e-mail que já tem conta', async () => {
    const { service } = setup()
    await service.register(ANA, DEVICE)
    expect(await codeOf(service.register({ ...ANA, password: 'outra-senha-qualquer' }, DEVICE))).toBe('EMAIL_TAKEN')
  })
})

describe('entrar', () => {
  it('entra com a senha certa, e cada aparelho tem a sua sessão', async () => {
    const { repository, service } = setup()
    const first = await service.register(ANA, DEVICE)
    const second = await service.login(ANA, { userAgent: 'celular' })
    expect(second.user).toEqual(first.user)
    expect(second.token).not.toBe(first.token)
    expect(repository.sessions.size).toBe(2)
  })

  it('senha errada e e-mail sem conta dão o mesmo erro', async () => {
    const { service } = setup()
    await service.register(ANA, DEVICE)
    expect(await codeOf(service.login({ ...ANA, password: 'senha-errada' }, DEVICE))).toBe('INVALID_CREDENTIALS')
    expect(await codeOf(service.login({ email: 'ninguem@forja.dev', password: 'qualquer-coisa' }, DEVICE))).toBe('INVALID_CREDENTIALS')
  })

  it('trava depois de errar a senha vezes demais, mesmo com a senha certa, até a janela passar', async () => {
    const { clock, service } = setup()
    await service.register(ANA, DEVICE)
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await codeOf(service.login({ ...ANA, password: 'senha-errada' }, DEVICE))
    }
    expect(await codeOf(service.login(ANA, DEVICE))).toBe('RATE_LIMITED')

    clock.advance(LOGIN_WINDOW_MS)
    expect((await service.login(ANA, DEVICE)).user.email).toBe(ANA.email)
  })

  it('acertar a senha zera a contagem de erros', async () => {
    const { service } = setup()
    await service.register(ANA, DEVICE)
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) {
        await codeOf(service.login({ ...ANA, password: 'senha-errada' }, DEVICE))
      }
      await service.login(ANA, DEVICE)
    }
  })
})

describe('a sessão', () => {
  it('o token do cookie diz quem é; token inventado ou ausente, ninguém', async () => {
    const { service } = setup()
    const session = await service.register(ANA, DEVICE)
    expect((await service.authenticate(session.token))?.user).toEqual(session.user)
    expect(await service.authenticate('token-inventado')).toBeNull()
    expect(await service.authenticate(undefined)).toBeNull()
  })

  it('renova a validade com o uso, no máximo uma vez por dia', async () => {
    const { clock, repository, service } = setup()
    const session = await service.register(ANA, DEVICE)

    clock.advance(SESSION_RENEW_AFTER_MS - 1)
    expect((await service.authenticate(session.token))?.renewedUntil).toBeNull()

    clock.advance(1)
    const renewed = await service.authenticate(session.token)
    expect(renewed?.renewedUntil?.getTime()).toBe(clock.now().getTime() + SESSION_TTL_MS)
    expect(only(repository.sessions.values()).expiresAt).toEqual(renewed?.renewedUntil)

    // Acabou de renovar: o pedido seguinte não grava de novo.
    expect((await service.authenticate(session.token))?.renewedUntil).toBeNull()
  })

  it('sem uso, vence, e a sessão vencida é apagada', async () => {
    const { clock, repository, service } = setup()
    const session = await service.register(ANA, DEVICE)
    clock.advance(SESSION_TTL_MS)
    expect(await service.authenticate(session.token)).toBeNull()
    expect(repository.sessions.size).toBe(0)
  })

  it('quem usa o app toda semana nunca é desconectado', async () => {
    const { clock, service } = setup()
    const session = await service.register(ANA, DEVICE)
    for (let week = 0; week < 60; week++) {
      clock.advance(7 * 24 * 60 * 60 * 1000)
      expect(await service.authenticate(session.token)).not.toBeNull()
    }
  })

  it('sair encerra só a sessão daquele aparelho', async () => {
    const { service } = setup()
    const computer = await service.register(ANA, DEVICE)
    const phone = await service.login(ANA, { userAgent: 'celular' })
    await service.logout(phone.token)
    expect(await service.authenticate(phone.token)).toBeNull()
    expect(await service.authenticate(computer.token)).not.toBeNull()
    // Sair sem cookie, ou com um token que já não vale, não é erro.
    await service.logout(undefined)
    await service.logout(phone.token)
  })

  it('a faxina apaga só as sessões vencidas', async () => {
    const { clock, repository, service } = setup()
    await service.register(ANA, DEVICE)
    clock.advance(SESSION_TTL_MS - 1000)
    await service.login(ANA, DEVICE)
    clock.advance(1000)
    expect(await service.sweepExpiredSessions()).toBe(1)
    expect(repository.sessions.size).toBe(1)
  })
})

describe('redefinir a senha (o comando do dono)', () => {
  it('grava a senha nova, desconecta todos os aparelhos e libera quem estava travado', async () => {
    const { service } = setup()
    const session = await service.register(ANA, DEVICE)
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await codeOf(service.login({ ...ANA, password: 'senha-errada' }, DEVICE))
    }

    expect(await service.resetPassword(ANA.email, 'senha-nova-da-ana')).toBe(true)
    expect(await service.authenticate(session.token)).toBeNull()
    expect(await codeOf(service.login(ANA, DEVICE))).toBe('INVALID_CREDENTIALS')
    expect((await service.login({ ...ANA, password: 'senha-nova-da-ana' }, DEVICE)).user).toEqual(session.user)
  })

  it('diz que não achou quando o e-mail não tem conta', async () => {
    const { service } = setup()
    expect(await service.resetPassword('ninguem@forja.dev', 'qualquer-senha')).toBe(false)
  })
})
