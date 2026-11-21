/**
 * O acesso ao banco do módulo de conta, atrás de uma interface: o serviço só conhece estas
 * operações. A implementação de verdade é a do Prisma (`auth.repository.prisma.ts`); os testes usam
 * a que guarda em memória (`auth.repository.memory.ts`), e por isso rodam sem banco.
 */

export type UserRecord = {
  id: string
  email: string
  passwordHash: string
  createdAt: Date
}

export type SessionRecord = {
  id: string
  userId: string
  /** O SHA-256 do token do cookie: o token em si nunca é guardado. */
  tokenHash: string
  lastSeenAt: Date
  expiresAt: Date
}

export type NewSession = {
  userId: string
  tokenHash: string
  createdAt: Date
  expiresAt: Date
  userAgent: string | null
}

/** Uma conta na listagem do dono (`npm run user:list`). */
export type UserSummary = {
  id: string
  email: string
  createdAt: Date
  /** As fichas que a conta tem hoje, sem as apagadas. */
  characters: number
  /** A última vez que algum aparelho da conta falou com a API; null se não há aparelho conectado. */
  lastSeenAt: Date | null
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>
  /** Cria a conta. `null` quando o e-mail já tem conta: quem garante a unicidade é o banco. */
  createUser(data: { email: string; passwordHash: string; createdAt: Date }): Promise<UserRecord | null>
  setPasswordHash(userId: string, passwordHash: string): Promise<void>
  listUsers(): Promise<UserSummary[]>

  createSession(data: NewSession): Promise<SessionRecord>
  /** A sessão do token, com a conta dela. Não confere a validade: isso é regra, do serviço. */
  findSession(tokenHash: string): Promise<{ session: SessionRecord; user: UserRecord } | null>
  renewSession(id: string, data: { lastSeenAt: Date; expiresAt: Date }): Promise<void>
  deleteSession(id: string): Promise<void>
  /** Desconecta todos os aparelhos da conta; devolve quantos eram. */
  deleteUserSessions(userId: string): Promise<number>
  /** Apaga as sessões vencidas; devolve quantas eram. */
  deleteExpiredSessions(now: Date): Promise<number>
}
