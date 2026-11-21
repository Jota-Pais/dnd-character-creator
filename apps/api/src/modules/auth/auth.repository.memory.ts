import { randomUUID } from 'node:crypto'
import type { AuthRepository, SessionRecord, UserRecord } from './auth.repository'

/**
 * O repositório de conta em memória: o dos testes de serviço e de rota, que assim rodam sem banco.
 * Segue as mesmas regras que o banco garante (e-mail único, sessão some com a conta).
 */
export type MemoryAuthRepository = AuthRepository & {
  /** Para o teste olhar o que ficou guardado. */
  readonly users: Map<string, UserRecord>
  readonly sessions: Map<string, SessionRecord>
}

export function createMemoryAuthRepository(): MemoryAuthRepository {
  const users = new Map<string, UserRecord>()
  const sessions = new Map<string, SessionRecord>()

  return {
    users,
    sessions,

    async findUserByEmail(email) {
      return [...users.values()].find(user => user.email === email) ?? null
    },

    async createUser(data) {
      if ([...users.values()].some(user => user.email === data.email)) return null
      const user: UserRecord = { id: randomUUID(), ...data }
      users.set(user.id, user)
      return user
    },

    async setPasswordHash(userId, passwordHash) {
      const user = users.get(userId)
      if (user) users.set(userId, { ...user, passwordHash })
    },

    async listUsers() {
      return [...users.values()].map(user => {
        const seen = [...sessions.values()].filter(s => s.userId === user.id).map(s => s.lastSeenAt.getTime())
        return {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
          characters: 0,
          lastSeenAt: seen.length > 0 ? new Date(Math.max(...seen)) : null,
        }
      })
    },

    async createSession(data) {
      const session: SessionRecord = {
        id: randomUUID(),
        userId: data.userId,
        tokenHash: data.tokenHash,
        lastSeenAt: data.createdAt,
        expiresAt: data.expiresAt,
      }
      sessions.set(session.id, session)
      return session
    },

    async findSession(tokenHash) {
      const session = [...sessions.values()].find(s => s.tokenHash === tokenHash)
      const user = session ? users.get(session.userId) : undefined
      return session && user ? { session, user } : null
    },

    async renewSession(id, data) {
      const session = sessions.get(id)
      if (session) sessions.set(id, { ...session, ...data })
    },

    async deleteSession(id) {
      sessions.delete(id)
    },

    async deleteUserSessions(userId) {
      const own = [...sessions.values()].filter(s => s.userId === userId)
      for (const session of own) sessions.delete(session.id)
      return own.length
    },

    async deleteExpiredSessions(now) {
      const expired = [...sessions.values()].filter(s => s.expiresAt.getTime() <= now.getTime())
      for (const session of expired) sessions.delete(session.id)
      return expired.length
    },
  }
}
