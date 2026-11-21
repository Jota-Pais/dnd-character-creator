import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import type { ApiErrorBody } from '@rpg/contracts'
import { AppError } from '../errors'

/** Rota que não existe devolve o envelope de erro da API, e não o HTML de erro do Express. */
export const notFound: RequestHandler = (req, res) => {
  const body: ApiErrorBody = {
    error: { code: 'NOT_FOUND', message: `A rota ${req.method} ${req.path} não existe.` },
  }
  res.status(404).json(body)
}

/** Um par campo → mensagem a partir das issues do Zod: a primeira mensagem de cada campo. */
function fieldsFromZod(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const field = issue.path.join('.') || '(body)'
    fields[field] ??= issue.message
  }
  return fields
}

/**
 * O tratador central: fica por último na cadeia e precisa dos quatro parâmetros, que é a
 * assinatura pela qual o Express reconhece um tratador de erro. O Express 5 já traz para cá a
 * promise rejeitada de uma rota async.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }

  // O corpo que o express.json recusou: JSON malformado, ou maior que o limite.
  const bodyError = (error as { type?: unknown }).type
  if (bodyError === 'entity.too.large') {
    const body: ApiErrorBody = {
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Esta ficha ficou grande demais para sincronizar.' },
    }
    res.status(413).json(body)
    return
  }
  if (bodyError === 'entity.parse.failed') {
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION',
        message: 'O corpo do pedido não é um JSON válido.',
        fields: { '(body)': 'JSON inválido.' },
      },
    }
    res.status(400).json(body)
    return
  }

  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: { code: 'VALIDATION', message: 'Confira os campos destacados.', fields: fieldsFromZod(error) },
    }
    res.status(400).json(body)
    return
  }

  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) },
    }
    res.status(error.status).json({ ...body, ...error.extras })
    return
  }

  // Aqui é defeito, não regra: o erro inteiro vai para o log do servidor, e nada dele para o cliente.
  console.error(`[500] ${req.method} ${req.originalUrl}`, error)
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL', message: 'Erro no servidor. Tente de novo em instantes.' },
  }
  res.status(500).json(body)
}
