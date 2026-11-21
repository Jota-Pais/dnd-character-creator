import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

export type { PrismaClient }

/**
 * Abre o cliente do Prisma sobre o driver adapter do Postgres. Uma instância só por processo: cada
 * PrismaClient abre o próprio pool, e o plano gratuito da Neon tem limite de conexão. Quem chama é
 * o server.ts e os scripts do dono; os testes usam os repositórios em memória e nunca chegam aqui.
 */
export function createPrisma(
  databaseUrl: string,
  options: { verbose?: boolean; maxConnections?: number } = {},
): PrismaClient {
  return new PrismaClient({
    // `max` é o tamanho do pool do driver; sem ele vale o padrão do `pg` (10).
    adapter: new PrismaPg({ connectionString: databaseUrl, max: options.maxConnections }),
    log: options.verbose ? ['warn', 'error'] : ['error'],
    // O padrão do Prisma (2 s para pegar a conexão, 5 s para a transação) não cobre a Neon gratuita
    // acordando depois de parada.
    transactionOptions: { maxWait: 10_000, timeout: 20_000 },
  })
}
