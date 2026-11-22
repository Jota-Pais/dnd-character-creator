// As contas do Criador de Ficha: quem tem conta, desde quando, quantas fichas e quando usou por último.
//
//   npm run user:list -w @rpg/api
//
// Usa o banco do .env de apps/api (DATABASE_URL). Para olhar o de produção, rode com as URLs do
// branch `main` da Neon no .env, ou na linha: DATABASE_URL=… npm run user:list -w @rpg/api
import { loadEnv } from '../src/env'
import { createPrismaAuthRepository } from '../src/modules/auth/auth.repository.prisma'
import { createPrisma } from '../src/shared/prisma'

const env = loadEnv()
const prisma = createPrisma(env.DATABASE_URL)

const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : '—')

try {
  const users = await createPrismaAuthRepository(prisma).listUsers()
  if (users.length === 0) {
    console.log('Nenhuma conta ainda.')
  } else {
    console.table(users.map(user => ({
      'e-mail': user.email,
      'criada em': day(user.createdAt),
      fichas: user.characters,
      'último uso': day(user.lastSeenAt),
    })))
    console.log(`${users.length} ${users.length === 1 ? 'conta' : 'contas'}.`)
  }
} finally {
  await prisma.$disconnect()
}
