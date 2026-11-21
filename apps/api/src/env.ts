import 'dotenv/config'
import { z } from 'zod'

/** Variável vazia no .env ('CHAVE=', como no .env.example) conta como ausente, não como texto. */
const optional = <T extends z.ZodType>(type: T) =>
  z.preprocess(value => (typeof value === 'string' && value.trim() === '' ? undefined : value), type.optional())

/** 'https://site.app/, http://localhost:5173' → as origens (esquema + host + porta), sem barra. */
const origins = z
  .string()
  .transform(value => value.split(',').map(item => item.trim()).filter(Boolean))
  .pipe(z.array(z.url({ error: 'deve ser a URL do site' })))
  .transform(list => list.map(item => new URL(item).origin))

// Zod no boot: se a configuração está errada, o processo não sobe. Erro de ambiente aparece na
// largada, e não no meio de um pedido.
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3333),
    DATABASE_URL: z
      .string({ error: 'obrigatória: a URL pooled do Postgres na Neon' })
      .min(1)
      .startsWith('postgres', { error: 'deve ser uma URL postgresql:// da Neon' }),
    APP_ORIGIN: optional(origins),
  })
  .superRefine((values, context) => {
    // Em produção a origem do site é obrigatória: sem ela, pedido que grava vindo de qualquer
    // página passaria (ver shared/middlewares/same-origin.ts).
    if (values.NODE_ENV === 'production' && (values.APP_ORIGIN === undefined || values.APP_ORIGIN.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['APP_ORIGIN'],
        message: 'obrigatória em production: a origem do site (https://…, sem barra no final)',
      })
    }
  })

export type Env = z.infer<typeof envSchema>

/** Lê e valida o ambiente. Chamada só pelo server.ts e pelos scripts: os testes não precisam de .env. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    console.error('Variáveis de ambiente inválidas. Confira o .env (modelo em .env.example):\n')
    console.error(z.prettifyError(result.error))
    process.exit(1)
  }
  return result.data
}
