import { Router } from 'express'
import {
  characterIdSchema,
  deleteCharacterQuerySchema,
  putCharacterSchema,
  putPlayStateSchema,
  type WriteResponse,
} from '@rpg/contracts'
import { userOf } from '../../shared/middlewares/require-auth'
import type { CharactersService } from './characters.service'

/**
 * As rotas de ficha, sob /api/characters. Quem as monta (app.ts) põe o `requireAccount` na frente:
 * aqui todo pedido já tem sessão, e os dados do aparelho são da conta dela.
 */
export function characterRoutes(service: CharactersService): Router {
  const router = Router()

  router.put('/:id', async (req, res) => {
    const id = characterIdSchema.parse(req.params.id)
    const body = putCharacterSchema.parse(req.body)
    const result: WriteResponse = await service.putCharacter(userOf(req).id, id, body)
    res.json(result)
  })

  router.delete('/:id', async (req, res) => {
    const id = characterIdSchema.parse(req.params.id)
    const { baseRevision } = deleteCharacterQuerySchema.parse(req.query)
    await service.deleteCharacter(userOf(req).id, id, baseRevision)
    res.status(204).end()
  })

  router.put('/:id/play-state', async (req, res) => {
    const id = characterIdSchema.parse(req.params.id)
    const body = putPlayStateSchema.parse(req.body)
    const result: WriteResponse = await service.putPlayState(userOf(req).id, id, body)
    res.json(result)
  })

  return router
}
