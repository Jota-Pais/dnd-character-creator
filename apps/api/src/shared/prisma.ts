import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

export type { PrismaClient }

/**
 * A URL que a Neon entrega vem com `sslmode=require`. O driver (`pg`) hoje trata `require` como
 * `verify-full` (confere o certificado e o nome do servidor), mas avisa a cada largada que na
 * próxima versão maior `require` passa a valer como no libpq, que não confere o certificado. A
 * recomendação dele é dizer `verify-full` por extenso: é o que se faz aqui, para a conferência do
 * certificado não depender da versão do driver (e o aviso não encher o log).
 */
export function withVerifiedTls(databaseUrl: string): string {
  return databaseUrl.replace(/([?&])sslmode=require(?=&|$)/, '$1sslmode=verify-full')
}

/**
 * Abre o cliente do Prisma sobre o driver adapter do Postgres. Uma instância só por processo: cada
 * PrismaClient abre o próprio pool, e o plano gratuito da Neon tem limite de conexão. Quem chama é
 * o `bootstrap.ts` e os scripts do dono; os testes de serviço e de rota usam os repositórios em
 * memória e nunca chegam aqui.
 */
export function createPrisma(
  databaseUrl: string,
  options: { verbose?: boolean; maxConnections?: number } = {},
): PrismaClient {
  return new PrismaClient({
    // `max` é o tamanho do pool do driver; sem ele vale o padrão do `pg` (10).
    adapter: new PrismaPg({ connectionString: withVerifiedTls(databaseUrl), max: options.maxConnections }),
    log: options.verbose ? ['warn', 'error'] : ['error'],
    // O padrão do Prisma (2 s para pegar a conexão, 5 s para a transação) não cobre a Neon gratuita
    // acordando depois de parada.
    transactionOptions: { maxWait: 10_000, timeout: 20_000 },
  })
}
