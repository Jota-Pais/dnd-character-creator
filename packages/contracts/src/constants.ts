/**
 * O que o site e a API precisam concordar e que não é schema: nomes, limites e códigos. Este arquivo
 * não importa o Zod, e é por ele que o site lê valores do contrato em tempo de execução
 * (`@rpg/contracts/constants`), sem levar a biblioteca de validação para o navegador. Os schemas
 * moram em `auth.ts` e `sync.ts`, e o site só os usa como tipo.
 */

/** Os sistemas de RPG que têm ficha. O servidor guarda o nome; a regra de cada um é do motor. */
export const SYSTEM_IDS = ['dnd5e', 'ordem'] as const
export type SystemId = (typeof SYSTEM_IDS)[number]

/**
 * Os códigos de erro da API, sempre no envelope `{ error: { code, message, fields? } }`. A mensagem
 * já vem em português, pronta para a tela; o código é para a tela decidir o que fazer.
 */
export const ERROR_CODES = [
  /** 400: entrada recusada; `fields` diz a mensagem de cada campo. */
  'VALIDATION',
  /** 401: e-mail ou senha errados (a resposta não diz qual dos dois). */
  'INVALID_CREDENTIALS',
  /** 401: sem sessão, ou a sessão expirou. */
  'UNAUTHENTICATED',
  /** 403: a página que mandou o pedido não é o site. */
  'FORBIDDEN_ORIGIN',
  /** 403: os dados deste aparelho são de outra conta (duas abas, contas diferentes). */
  'ACCOUNT_MISMATCH',
  /** 404: rota ou recurso que não existe. */
  'NOT_FOUND',
  /** 404: estado de jogo de uma ficha que o servidor ainda não tem. */
  'CHARACTER_NOT_FOUND',
  /** 409: já existe conta com o e-mail. */
  'EMAIL_TAKEN',
  /** 409: o documento mudou no servidor desde a revisão que o aparelho conhecia. */
  'CONFLICT',
  /** 413: o documento passa do tamanho aceito. */
  'PAYLOAD_TOO_LARGE',
  /** 429: tentativas demais; esperar e tentar de novo. */
  'RATE_LIMITED',
  /** 500: erro do servidor. */
  'INTERNAL',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

/**
 * O cabeçalho com o id da conta dona dos dados do aparelho, em toda rota de ficha e de
 * sincronização. Se não for o usuário da sessão, o servidor recusa (`ACCOUNT_MISMATCH`): com duas
 * abas, uma pode trocar de conta enquanto a outra ainda tem na tela as fichas da conta anterior.
 */
export const ACCOUNT_HEADER = 'x-account-id'

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 200
export const EMAIL_MAX_LENGTH = 254

/** Tamanho máximo do corpo de um pedido (o draft ou o estado de jogo, em JSON). */
export const MAX_DOCUMENT_BYTES = 1_000_000

/** Quantos documentos de cada tipo uma página de `/api/sync/changes` traz no máximo. */
export const CHANGES_PAGE_SIZE = 200
