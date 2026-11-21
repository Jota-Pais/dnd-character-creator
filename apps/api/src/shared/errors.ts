import type { ErrorCode } from '@rpg/contracts'

/**
 * Erro de regra da API, sempre no envelope `{ error: { code, message, fields? } }`. Quem lança é o
 * serviço; quem responde é o tratador central (middlewares/error-handler.ts). A mensagem vai em
 * português, pronta para a tela.
 */
export class AppError extends Error {
  readonly status: number
  readonly code: ErrorCode
  /** A mensagem de cada campo, só em `VALIDATION`. */
  readonly fields?: Record<string, string>
  /** O que vai ao lado do erro no corpo da resposta (o `current` do 409). */
  readonly extras?: Record<string, unknown>

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details: { fields?: Record<string, string>; extras?: Record<string, unknown> } = {},
  ) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.fields = details.fields
    this.extras = details.extras
  }
}

/** 400: um campo com problema; a mensagem vai no campo, que o formulário destaca. */
export const invalidField = (field: string, message: string) =>
  new AppError(400, 'VALIDATION', 'Confira os campos destacados.', { fields: { [field]: message } })

/** 401: e-mail ou senha errados. A resposta não diz qual dos dois, nem se a conta existe. */
export const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')

/** 401: sem cookie de sessão válido. */
export const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.')

/** 403: o pedido que grava veio de uma página que não é o site. */
export const forbiddenOrigin = () => new AppError(403, 'FORBIDDEN_ORIGIN', 'Pedido recusado: ele não veio do site.')

/** 403: os dados do aparelho são de outra conta. */
export const accountMismatch = () =>
  new AppError(403, 'ACCOUNT_MISMATCH', 'As fichas deste aparelho são de outra conta. Recarregue a página.')

/** 404: a ficha do estado de jogo não existe no servidor (ou foi apagada). */
export const characterNotFound = () => new AppError(404, 'CHARACTER_NOT_FOUND', 'Ficha não encontrada.')

/** 409: já existe conta com o e-mail. */
export const emailTaken = () =>
  new AppError(409, 'EMAIL_TAKEN', 'Já existe uma conta com esse e-mail.', {
    fields: { email: 'Já existe uma conta com esse e-mail. Entre com ela.' },
  })

/** 409: o documento mudou no servidor desde a revisão que o aparelho conhecia. */
export const conflict = (current: unknown) =>
  new AppError(409, 'CONFLICT', 'Esta ficha mudou em outro aparelho.', { extras: { current } })

/** 429: tentativas demais de entrar. */
export const rateLimited = (minutes: number) =>
  new AppError(
    429,
    'RATE_LIMITED',
    `Muitas tentativas. Espere ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'} e tente de novo.`,
  )
