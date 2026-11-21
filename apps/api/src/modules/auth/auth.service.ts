import type { LoginRequest, RegisterRequest, User } from '@rpg/contracts'
import { emailTaken, invalidCredentials, rateLimited } from '../../shared/errors'
import type { AuthRepository, UserRecord } from './auth.repository'
import type { LoginThrottle } from './login-throttle'
import { PASSWORD_COST, hashPassword, verifyPassword } from './password'
import { SESSION_RENEW_AFTER_MS, SESSION_TTL_MS, hashSessionToken, newSessionToken } from './session-cookie'

/** Uma sessão recém-aberta: o token vai para o cookie e não aparece em nenhum outro lugar. */
export type OpenedSession = { user: User; token: string; expiresAt: Date }

/** Quem o pedido é, depois de lido o cookie. `renewedUntil` pede para reenviar o cookie. */
export type Authenticated = { user: User; sessionId: string; renewedUntil: Date | null }

export type AuthService = {
  register(data: RegisterRequest, device: { userAgent: string | null }): Promise<OpenedSession>
  login(data: LoginRequest, device: { userAgent: string | null }): Promise<OpenedSession>
  logout(token: string | undefined): Promise<void>
  authenticate(token: string | undefined): Promise<Authenticated | null>
  /**
   * Grava uma senha nova e desconecta todos os aparelhos da conta. É o "esqueci a senha" do app: o
   * dono roda por comando (`npm run user:password`). `false` se não há conta com o e-mail.
   */
  resetPassword(email: string, password: string): Promise<boolean>
  /** Faxina das sessões vencidas; devolve quantas saíram. */
  sweepExpiredSessions(): Promise<number>
}

export type AuthServiceDeps = {
  repository: AuthRepository
  throttle: LoginThrottle
  clock: () => Date
  /** O custo do bcrypt; só os testes passam um menor. */
  passwordCost?: number
}

const toUser = (record: UserRecord): User => ({ id: record.id, email: record.email })

export function createAuthService({ repository, throttle, clock, passwordCost = PASSWORD_COST }: AuthServiceDeps): AuthService {
  async function openSession(user: UserRecord, userAgent: string | null): Promise<OpenedSession> {
    const now = clock()
    const token = newSessionToken()
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
    await repository.createSession({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      createdAt: now,
      expiresAt,
      userAgent: userAgent?.slice(0, 300) ?? null,
    })
    return { user: toUser(user), token, expiresAt }
  }

  // O hash contra o qual se confere a senha de um e-mail sem conta: a resposta leva o mesmo tempo
  // de uma conta que existe, e ninguém descobre pelo relógio quais e-mails têm conta.
  let decoyHash: Promise<string> | undefined

  return {
    async register({ email, password }, { userAgent }) {
      const user = await repository.createUser({
        email,
        passwordHash: await hashPassword(password, passwordCost),
        createdAt: clock(),
      })
      if (!user) throw emailTaken()
      return openSession(user, userAgent)
    },

    async login({ email, password }, { userAgent }) {
      const minutes = throttle.minutesToWait(email)
      if (minutes > 0) throw rateLimited(minutes)

      const user = await repository.findUserByEmail(email)
      decoyHash ??= hashPassword('senha de ninguém', passwordCost)
      const matches = await verifyPassword(password, user?.passwordHash ?? (await decoyHash))
      if (!user || !matches) {
        throttle.fail(email)
        throw invalidCredentials()
      }
      throttle.reset(email)
      return openSession(user, userAgent)
    },

    async logout(token) {
      if (token === undefined) return
      const found = await repository.findSession(hashSessionToken(token))
      if (found) await repository.deleteSession(found.session.id)
    },

    async authenticate(token) {
      if (token === undefined) return null
      const found = await repository.findSession(hashSessionToken(token))
      if (!found) return null
      const now = clock()
      if (found.session.expiresAt.getTime() <= now.getTime()) {
        await repository.deleteSession(found.session.id)
        return null
      }
      let renewedUntil: Date | null = null
      if (now.getTime() - found.session.lastSeenAt.getTime() >= SESSION_RENEW_AFTER_MS) {
        renewedUntil = new Date(now.getTime() + SESSION_TTL_MS)
        await repository.renewSession(found.session.id, { lastSeenAt: now, expiresAt: renewedUntil })
      }
      return { user: toUser(found.user), sessionId: found.session.id, renewedUntil }
    },

    async resetPassword(email, password) {
      const user = await repository.findUserByEmail(email)
      if (!user) return false
      await repository.setPasswordHash(user.id, await hashPassword(password, passwordCost))
      await repository.deleteUserSessions(user.id)
      throttle.reset(email)
      return true
    },

    sweepExpiredSessions() {
      return repository.deleteExpiredSessions(clock())
    },
  }
}
