// O "esqueci a senha" do Forja: grava uma senha nova para uma conta e desconecta os aparelhos dela.
//
//   npm run user:password -w @rpg/api -- ana@exemplo.com              (gera uma senha e a mostra)
//   npm run user:password -w @rpg/api -- ana@exemplo.com "senha nova" (grava a que você escolher)
//
// A senha não é legível no banco (fica só o hash), então não dá para "olhar" a senha de ninguém:
// o caminho é gravar uma nova e passá-la à pessoa. Usa o banco do .env de apps/api.
import { randomBytes } from 'node:crypto'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@rpg/contracts'
import { loadEnv } from '../src/env'
import { createPrismaAuthRepository } from '../src/modules/auth/auth.repository.prisma'
import { createAuthService } from '../src/modules/auth/auth.service'
import { createLoginThrottle } from '../src/modules/auth/login-throttle'
import { createPrisma } from '../src/shared/prisma'

const [emailArg, passwordArg] = process.argv.slice(2)

if (!emailArg) {
  console.error('Uso: npm run user:password -w @rpg/api -- <e-mail> ["senha nova"]')
  process.exit(1)
}

const email = emailArg.trim().toLowerCase()
// 12 caracteres de letras, números, "-" e "_": dá para ditar e é forte o bastante.
const password = passwordArg ?? randomBytes(9).toString('base64url')

if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
  console.error(`A senha precisa ter de ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres.`)
  process.exit(1)
}

const env = loadEnv()
const prisma = createPrisma(env.DATABASE_URL)
const clock = () => new Date()
const service = createAuthService({
  repository: createPrismaAuthRepository(prisma),
  throttle: createLoginThrottle(clock),
  clock,
})

try {
  if (await service.resetPassword(email, password)) {
    console.log(`Senha nova de ${email}: ${password}`)
    console.log('Os aparelhos dessa conta foram desconectados: ela entra de novo com a senha nova.')
    console.log('As fichas que estavam nos aparelhos continuam neles e voltam a sincronizar depois de entrar.')
  } else {
    console.error(`Não há conta com o e-mail ${email}. Veja as contas com: npm run user:list -w @rpg/api`)
    process.exitCode = 1
  }
} finally {
  await prisma.$disconnect()
}
