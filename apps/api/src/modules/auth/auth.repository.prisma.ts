import { Prisma } from '@prisma/client'
import type { PrismaClient } from '../../shared/prisma'
import type { AuthRepository } from './auth.repository'

/** O Postgres recusou por unicidade (o e-mail já tem conta). */
const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'

/** O repositório de conta sobre o Prisma: o de produção. */
export function createPrismaAuthRepository(prisma: PrismaClient): AuthRepository {
  return {
    async findUserByEmail(email) {
      return prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, passwordHash: true, createdAt: true },
      })
    },

    async createUser(data) {
      try {
        return await prisma.user.create({
          data,
          select: { id: true, email: true, passwordHash: true, createdAt: true },
        })
      } catch (error) {
        // Duas pessoas criando a conta do mesmo e-mail ao mesmo tempo: quem decide é o banco.
        if (isUniqueViolation(error)) return null
        throw error
      }
    },

    async setPasswordHash(userId, passwordHash) {
      await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
    },

    async listUsers() {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          email: true,
          createdAt: true,
          _count: { select: { characters: { where: { deletedAt: null } } } },
          sessions: { orderBy: { lastSeenAt: 'desc' }, take: 1, select: { lastSeenAt: true } },
        },
      })
      return users.map(user => ({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        characters: user._count.characters,
        lastSeenAt: user.sessions[0]?.lastSeenAt ?? null,
      }))
    },

    async createSession(data) {
      return prisma.session.create({
        data: {
          userId: data.userId,
          tokenHash: data.tokenHash,
          createdAt: data.createdAt,
          lastSeenAt: data.createdAt,
          expiresAt: data.expiresAt,
          userAgent: data.userAgent,
        },
        select: { id: true, userId: true, tokenHash: true, lastSeenAt: true, expiresAt: true },
      })
    },

    async findSession(tokenHash) {
      const found = await prisma.session.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          tokenHash: true,
          lastSeenAt: true,
          expiresAt: true,
          user: { select: { id: true, email: true, passwordHash: true, createdAt: true } },
        },
      })
      if (!found) return null
      const { user, ...session } = found
      return { session, user }
    },

    async renewSession(id, data) {
      // updateMany: a sessão pode ter sido apagada entre a leitura e a renovação, e isso não é erro.
      await prisma.session.updateMany({ where: { id }, data })
    },

    async deleteSession(id) {
      await prisma.session.deleteMany({ where: { id } })
    },

    async deleteUserSessions(userId) {
      const { count } = await prisma.session.deleteMany({ where: { userId } })
      return count
    },

    async deleteExpiredSessions(now) {
      const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lte: now } } })
      return count
    },
  }
}
