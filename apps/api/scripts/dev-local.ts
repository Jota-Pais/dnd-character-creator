// A API inteira no seu computador, sem Neon e sem internet: um Postgres de verdade dentro do
// processo (o PGlite, o mesmo dos testes), com as migrations de prisma/migrations aplicadas.
//
//   npm run dev:local -w @rpg/api        (da raiz: npm run dev:api:local)
//
// Com o site rodando ao lado (`npm run dev`, que repassa /api para a porta 3333), dá para criar
// conta, entrar e sincronizar entre duas janelas do navegador. O banco mora na memória: ao parar
// este comando, as contas e as fichas dele somem. É o que se quer para experimentar e para os
// roteiros de teste; para guardar de verdade, use a Neon (`npm run dev`, com o .env preenchido).
import { closeOnSignal, startServer } from '../src/bootstrap'
import { envSchema } from '../src/env'
import { createTestDatabase } from '../src/testing/test-database'

const port = Number(process.env.PORT ?? 3333)

const database = await createTestDatabase()
// O PGlite atende uma conexão por vez: o pool da API fica com uma só.
const env = envSchema.parse({ NODE_ENV: 'development', PORT: port, DATABASE_URL: database.url })
const running = startServer({ env, maxConnections: 1 })

console.log('Banco local em memória (PGlite): some ao parar este comando.')

closeOnSignal(async () => {
  await running.close()
  await database.close()
})
