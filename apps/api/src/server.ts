import { readFileSync } from 'node:fs'
import { createApp } from './app'
import { loadEnv } from './env'
import { createPrismaAuthRepository } from './modules/auth/auth.repository.prisma'
import { createPrismaCharactersRepository } from './modules/characters/characters.repository.prisma'
import { createPrisma } from './shared/prisma'

const env = loadEnv()

// ../package.json resolve tanto em src/ (dev, pelo tsx) quanto em dist/ (o build do tsup).
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

const prisma = createPrisma(env.DATABASE_URL, { verbose: env.NODE_ENV === 'development' })
const authRepository = createPrismaAuthRepository(prisma)

const app = createApp({
  repositories: { auth: authRepository, characters: createPrismaCharactersRepository(prisma) },
  environment: env.NODE_ENV,
  version,
  appOrigins: env.APP_ORIGIN,
  secureCookies: env.NODE_ENV === 'production',
})

const server = app.listen(env.PORT, () => {
  console.log(`Forja API ouvindo em http://localhost:${env.PORT} [${env.NODE_ENV}]`)
})

// A faxina das sessões vencidas: na largada e uma vez por dia. Sessão vencida já não vale (a
// autenticação confere a validade); isto só evita que a tabela cresça para sempre.
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const sweepSessions = () => {
  authRepository.deleteExpiredSessions(new Date()).catch((error: unknown) => {
    console.error('[sessions] a faxina das sessões vencidas falhou:', error)
  })
}
sweepSessions()
const sweep = setInterval(sweepSessions, ONE_DAY_MS)

// A Render manda SIGTERM ao reciclar a instância. Fechar o servidor e o pool antes de sair evita
// pedido cortado no meio e conexão pendurada na Neon.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} recebido, encerrando.`)
    clearInterval(sweep)
    server.close(() => {
      void prisma.$disconnect().then(() => process.exit(0))
    })
  })
}
