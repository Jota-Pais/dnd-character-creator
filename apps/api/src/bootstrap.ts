import { readFileSync } from 'node:fs'
import type { Server } from 'node:http'
import { createApp } from './app'
import type { Env } from './env'
import { createPrismaAuthRepository } from './modules/auth/auth.repository.prisma'
import { createPrismaCharactersRepository } from './modules/characters/characters.repository.prisma'
import { createPrisma, type PrismaClient } from './shared/prisma'

/**
 * Sobe a API de verdade: o Prisma sobre o Postgres, os repositórios dele, o servidor ouvindo, a
 * faxina das sessões e o encerramento limpo. Quem chama é o `server.ts` (com o ambiente do .env) e o
 * modo local (`scripts/dev-local.ts`, com um Postgres dentro do processo).
 */
export type RunningServer = {
  server: Server
  prisma: PrismaClient
  /** Fecha o servidor e o pool. */
  close(): Promise<void>
}

export type StartOptions = {
  env: Env
  /** O tamanho do pool de conexões; sem ele, o padrão do driver. */
  maxConnections?: number
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

// ../package.json resolve tanto em src/ (dev, pelo tsx) quanto em dist/ (o build do tsup).
const readVersion = () =>
  (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version

export function startServer({ env, maxConnections }: StartOptions): RunningServer {
  const prisma = createPrisma(env.DATABASE_URL, { verbose: env.NODE_ENV === 'development', maxConnections })
  const authRepository = createPrismaAuthRepository(prisma)

  const app = createApp({
    repositories: { auth: authRepository, characters: createPrismaCharactersRepository(prisma) },
    environment: env.NODE_ENV,
    version: readVersion(),
    appOrigins: env.APP_ORIGIN,
    secureCookies: env.NODE_ENV === 'production',
  })

  const server = app.listen(env.PORT, () => {
    console.log(`Forja API ouvindo em http://localhost:${env.PORT} [${env.NODE_ENV}]`)
  })

  // A faxina das sessões vencidas: na largada e uma vez por dia. Sessão vencida já não vale (a
  // autenticação confere a validade); isto só evita que a tabela cresça para sempre.
  const sweepSessions = () => {
    authRepository.deleteExpiredSessions(new Date()).catch((error: unknown) => {
      console.error('[sessions] a faxina das sessões vencidas falhou:', error)
    })
  }
  sweepSessions()
  const sweep = setInterval(sweepSessions, ONE_DAY_MS)

  const close = () =>
    new Promise<void>(resolve => {
      clearInterval(sweep)
      server.close(() => {
        void prisma.$disconnect().then(() => resolve())
      })
    })

  return { server, prisma, close }
}

/**
 * A Render manda SIGTERM ao reciclar a instância. Fechar o servidor e o pool antes de sair evita
 * pedido cortado no meio e conexão pendurada na Neon.
 */
export function closeOnSignal(close: () => Promise<void>): void {
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      console.log(`\n${signal} recebido, encerrando.`)
      void close().then(() => process.exit(0))
    })
  }
}
