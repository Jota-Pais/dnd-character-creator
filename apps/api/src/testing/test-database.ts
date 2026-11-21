import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { createPrisma, type PrismaClient } from '../shared/prisma'

/**
 * Um Postgres de verdade dentro do processo (o PGlite), para os testes dos repositórios do Prisma:
 * eles conferem o que os testes sobre os repositórios em memória não alcançam (o SQL escrito à mão,
 * a ida e a volta do JSONB e do BIGINT, a migration aplicada). Sem instalar banco, sem rede e sem
 * conta em serviço nenhum; roda no CI como os outros testes.
 *
 * O banco nasce vazio e recebe as migrations de prisma/migrations, na ordem: o que se testa é o
 * mesmo SQL que vai para a Neon. O Prisma fala com ele pelo protocolo do Postgres, numa porta local.
 *
 * Limite: o PGlite atende uma conexão por vez. Serve para conferir cada operação; a disputa entre
 * duas gravações ao mesmo tempo (a trava da conta) só um Postgres de verdade mostra.
 */
export type TestDatabase = {
  prisma: PrismaClient
  /** Esvazia as tabelas, para cada teste começar do zero. */
  reset(): Promise<void>
  close(): Promise<void>
}

const MIGRATIONS = new URL('../../prisma/migrations/', import.meta.url)

function migrationFiles(): URL[] {
  return readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
    .map(name => new URL(`${name}/migration.sql`, MIGRATIONS))
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const database = await PGlite.create()
  for (const file of migrationFiles()) await database.exec(readFileSync(file, 'utf8'))

  // Porta 0: o sistema escolhe uma livre.
  const server = new PGLiteSocketServer({ db: database, port: 0, host: '127.0.0.1' })
  let port = 0
  server.addEventListener('listening', event => {
    port = (event as CustomEvent<{ port: number }>).detail.port
  })
  await server.start()

  // Uma conexão só no pool: é o que o PGlite atende.
  const prisma = createPrisma(`postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`, { maxConnections: 1 })

  return {
    prisma,
    async reset() {
      await database.exec('TRUNCATE play_states, characters, sessions, users')
    },
    async close() {
      await prisma.$disconnect()
      await server.stop()
      await database.close()
    },
  }
}
