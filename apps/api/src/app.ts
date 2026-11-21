import cookieParser from 'cookie-parser'
import express, { type Express } from 'express'
import { MAX_DOCUMENT_BYTES } from '@rpg/contracts'
import type { AuthRepository } from './modules/auth/auth.repository'
import { authRoutes } from './modules/auth/auth.routes'
import { createAuthService } from './modules/auth/auth.service'
import { authentication } from './modules/auth/authentication'
import { createLoginThrottle } from './modules/auth/login-throttle'
import { createSessionCookie } from './modules/auth/session-cookie'
import type { CharactersRepository } from './modules/characters/characters.repository'
import { characterRoutes } from './modules/characters/characters.routes'
import { createCharactersService } from './modules/characters/characters.service'
import { healthRoutes } from './modules/health/health.routes'
import { syncRoutes } from './modules/sync/sync.routes'
import { createSyncService } from './modules/sync/sync.service'
import { errorHandler, notFound } from './shared/middlewares/error-handler'
import { requireAccount } from './shared/middlewares/require-auth'
import { sameOrigin } from './shared/middlewares/same-origin'

export type AppOptions = {
  /** O acesso ao banco de cada módulo: o do Prisma em produção, o em memória nos testes. */
  repositories: {
    auth: AuthRepository
    characters: CharactersRepository
  }
  /** Vai no /health: development | test | production. */
  environment?: string
  /** Vai no /health: a versão do package.json. */
  version?: string
  /**
   * As origens do site (`APP_ORIGIN`): só delas vale pedido que grava. Sem lista, vale a origem que
   * bate com o `Host` do pedido (desenvolvimento, pelo proxy do Vite).
   */
  appOrigins?: readonly string[]
  /** O cookie de sessão só por https. Ligado em produção; em desenvolvimento o site abre por http. */
  secureCookies?: boolean
  /** O relógio: os testes o fixam para andar no tempo (sessão que vence, janela de tentativas). */
  clock?: () => Date
  /** O custo do bcrypt; só os testes passam um menor. */
  passwordCost?: number
}

/** Folga sobre o tamanho do documento para o resto do corpo (etapa, revisão, schema). */
const BODY_LIMIT_BYTES = MAX_DOCUMENT_BYTES + 4096

/**
 * Monta a aplicação sem abrir porta. Separada do server.ts para o teste chamar a API em memória,
 * sem rede, sem banco e sem .env: tudo de que ela depende entra por `options`.
 */
export function createApp({
  repositories,
  environment = 'development',
  version = '0.0.0',
  appOrigins,
  secureCookies = false,
  clock = () => new Date(),
  passwordCost,
}: AppOptions): Express {
  const cookie = createSessionCookie({ secure: secureCookies })
  const auth = createAuthService({
    repository: repositories.auth,
    throttle: createLoginThrottle(clock),
    clock,
    passwordCost,
  })
  const characters = createCharactersService({ repository: repositories.characters, clock })
  const sync = createSyncService({ repository: repositories.characters })

  const app = express()
  // A Render (e, na frente dela, a Vercel) é um proxy: o protocolo e o IP de quem pediu vêm nos
  // cabeçalhos X-Forwarded-*.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(express.json({ limit: BODY_LIMIT_BYTES }))
  app.use(cookieParser())

  // Público e a única rota fora de /api.
  app.use('/health', healthRoutes({ environment, version }))

  // Nada de /api fica em cache: nem do navegador, nem da Vercel, nem do service worker do site.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use('/api', sameOrigin(appOrigins))
  // Daqui para baixo todo pedido passa pela autenticação, que nunca recusa: preenche `req.auth`
  // quando há sessão e segue. Quem exige sessão é cada rota (shared/middlewares/require-auth.ts).
  app.use('/api', authentication(auth, cookie))

  app.use('/api/auth', authRoutes(auth, cookie))
  // As fichas e a sincronização exigem sessão e que os dados do aparelho sejam da conta dela.
  app.use('/api/characters', requireAccount, characterRoutes(characters))
  app.use('/api/sync', requireAccount, syncRoutes(sync))

  app.use(notFound)
  app.use(errorHandler)

  return app
}
