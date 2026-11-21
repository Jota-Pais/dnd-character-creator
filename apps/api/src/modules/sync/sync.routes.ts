import { Router } from 'express'
import { changesQuerySchema, type ChangesResponse } from '@rpg/contracts'
import { userOf } from '../../shared/middlewares/require-auth'
import type { SyncService } from './sync.service'

/** As rotas de sincronização, sob /api/sync, atrás do `requireAccount` (ver characters.routes.ts). */
export function syncRoutes(service: SyncService): Router {
  const router = Router()

  router.get('/changes', async (req, res) => {
    const { since } = changesQuerySchema.parse(req.query)
    const body: ChangesResponse = await service.listChanges(userOf(req).id, since)
    res.json(body)
  })

  return router
}
