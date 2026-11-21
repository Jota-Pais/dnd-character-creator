import express, { type Express } from 'express'
import { MAX_DOCUMENT_BYTES } from '@rpg/contracts'
import { healthRoutes } from './modules/health/health.routes'
import { errorHandler, notFound } from './shared/middlewares/error-handler'
import { sameOrigin } from './shared/middlewares/same-origin'

export type AppOptions = {
  /** Vai no /health: development | test | production. */
  environment?: string
  /** Vai no /health: a versão do package.json. */
  version?: string
  /**
   * As origens do site (`APP_ORIGIN`): só delas vale pedido que grava. Sem lista, vale a origem que
   * bate com o `Host` do pedido (desenvolvimento, pelo proxy do Vite).
   */
  appOrigins?: readonly string[]
}

/** Folga sobre o tamanho do documento para o resto do corpo (etapa, revisão, schema). */
const BODY_LIMIT_BYTES = MAX_DOCUMENT_BYTES + 4096

/**
 * Monta a aplicação sem abrir porta. Separada do server.ts para o teste chamar a API em memória,
 * sem rede, sem banco e sem .env: tudo de que ela depende entra por `options`.
 */
export function createApp({ environment = 'development', version = '0.0.0', appOrigins }: AppOptions = {}): Express {
  const app = express()
  // A Render (e, na frente dela, a Vercel) é um proxy: o protocolo e o IP de quem pediu vêm nos
  // cabeçalhos X-Forwarded-*.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(express.json({ limit: BODY_LIMIT_BYTES }))

  // Público e a única rota fora de /api.
  app.use('/health', healthRoutes({ environment, version }))

  // Nada de /api fica em cache: nem do navegador, nem da Vercel, nem do service worker do site.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use('/api', sameOrigin(appOrigins))

  app.use(notFound)
  app.use(errorHandler)

  return app
}
