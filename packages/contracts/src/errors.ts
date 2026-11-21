import type { ErrorCode } from './constants'

/** O corpo de toda resposta de erro da API. */
export type ApiErrorBody = {
  error: {
    code: ErrorCode
    /** Em português, pronta para mostrar. */
    message: string
    /** Só em `VALIDATION`: a mensagem de cada campo, pelo caminho dele (`email`, `draft`). */
    fields?: Record<string, string>
  }
}

/**
 * O corpo do 409 `CONFLICT`: além do erro, a versão que o servidor tem do documento, para o aparelho
 * decidir sem um segundo pedido. `null` quando o documento não existe mais no servidor.
 */
export type ConflictBody<TCurrent> = ApiErrorBody & { current: TCurrent | null }
