import { Router } from 'express'

export type HealthInfo = {
  /** development | test | production */
  environment: string
  /** A versão do package.json da API. */
  version: string
}

/**
 * O healthcheck: público e a única rota fora de /api. É por ele que a Render sabe que a instância
 * subiu, e é o que se confere depois de publicar. Não toca o banco, para responder mesmo com a Neon
 * ainda acordando.
 */
export function healthRoutes(info: HealthInfo): Router {
  const router = Router()
  router.get('/', (_req, res) => {
    res.json({ status: 'ok', ...info })
  })
  return router
}
