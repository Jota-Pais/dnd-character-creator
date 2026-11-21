import { z } from 'zod'
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './constants'

/**
 * A conta: e-mail e senha, sem confirmação de e-mail e sem "esqueci a senha" (decisão do dono de
 * 2026-11-21: o app é para a turma, e quem esquecer a senha pede a ele, que a redefine por comando).
 */

/** O e-mail como a API o guarda: sem espaço em volta e em minúsculas. */
const email = z
  .string({ error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .min(1, { error: 'Informe o e-mail.' })
  .max(EMAIL_MAX_LENGTH, { error: 'E-mail longo demais.' })
  .pipe(z.email({ error: 'E-mail inválido.' }))

/** Criar conta: a senha tem tamanho mínimo. */
export const registerSchema = z.object({
  email,
  password: z
    .string({ error: 'Informe a senha.' })
    .min(PASSWORD_MIN_LENGTH, { error: `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` })
    .max(PASSWORD_MAX_LENGTH, { error: 'Senha longa demais.' }),
})
export type RegisterRequest = z.infer<typeof registerSchema>

/** Entrar: qualquer senha não vazia chega à conferência (a regra de tamanho é só do cadastro). */
export const loginSchema = z.object({
  email,
  password: z
    .string({ error: 'Informe a senha.' })
    .min(1, { error: 'Informe a senha.' })
    .max(PASSWORD_MAX_LENGTH, { error: 'Senha longa demais.' }),
})
export type LoginRequest = z.infer<typeof loginSchema>

/** Quem está conectado, como a API devolve. */
export type User = { id: string; email: string }

/** Resposta de criar conta e de entrar. */
export type AuthResponse = { user: User }

/**
 * Resposta de `GET /api/auth/session`: sempre 200. `user: null` é "ninguém conectado", e não um
 * erro: a abertura do app pergunta isso toda vez, e um 401 ali sujaria o console de quem ainda não
 * entrou.
 */
export type SessionResponse = { user: User | null }
