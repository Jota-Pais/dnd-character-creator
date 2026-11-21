import { readFileSync } from 'node:fs'
import { createApp } from './app'
import { loadEnv } from './env'
import { createPrisma } from './shared/prisma'

const env = loadEnv()

// ../package.json resolve tanto em src/ (dev, pelo tsx) quanto em dist/ (o build do tsup).
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

const prisma = createPrisma(env.DATABASE_URL, { verbose: env.NODE_ENV === 'development' })

const app = createApp({
  environment: env.NODE_ENV,
  version,
  appOrigins: env.APP_ORIGIN,
})

const server = app.listen(env.PORT, () => {
  console.log(`Forja API ouvindo em http://localhost:${env.PORT} [${env.NODE_ENV}]`)
})

// A Render manda SIGTERM ao reciclar a instância. Fechar o servidor e o pool antes de sair evita
// pedido cortado no meio e conexão pendurada na Neon.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} recebido, encerrando.`)
    server.close(() => {
      void prisma.$disconnect().then(() => process.exit(0))
    })
  })
}
