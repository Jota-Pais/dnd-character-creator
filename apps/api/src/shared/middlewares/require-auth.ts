import type { Request, RequestHandler } from 'express'
import { ACCOUNT_HEADER, type User } from '@rpg/contracts'
import { accountMismatch, unauthenticated } from '../errors'

/** Exige sessão válida: sem ela, 401. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  next(req.auth ? undefined : unauthenticated())
}

/**
 * Exige que os dados do aparelho sejam da conta conectada: o cabeçalho `x-account-id` diz de quem
 * são as fichas que o aparelho guarda, e tem de ser o usuário da sessão. Com duas abas, uma pode
 * trocar de conta enquanto a outra ainda tem as fichas da conta anterior; sem esta conferência, ela
 * as gravaria na conta nova.
 */
export const requireAccount: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(unauthenticated())
    return
  }
  next(req.get(ACCOUNT_HEADER) === req.auth.user.id ? undefined : accountMismatch())
}

/** O usuário do pedido, para uso DENTRO de rota que já passou por `requireAuth`/`requireAccount`. */
export function userOf(req: Request): User {
  if (!req.auth) throw new Error('Rota sem requireAuth: req.auth não foi preenchido.')
  return req.auth.user
}
