import 'dotenv/config'

import { defineConfig } from 'prisma/config'

// A partir do Prisma 7 a URL do banco sai do schema.prisma e vive aqui. Este arquivo só é lido pela
// CLI (generate, migrate, studio): a aplicação abre a conexão pelo driver adapter, em
// src/shared/prisma.ts.
//
// A CLI usa a conexão DIRETA, sem -pooler: o PgBouncer da Neon quebra o lock consultivo e o prepared
// statement de que o migrate precisa. A aplicação usa a pooled (DATABASE_URL).
//
// Lida do process.env, e não pelo env() do Prisma, que recusa variável ausente: o `prisma generate`
// roda no postinstall de todo `npm ci` (CI, Vercel, clone novo), onde não há banco nem .env, e ele
// não precisa de URL nenhuma. Quem precisa (migrate, studio) falha com a mensagem do próprio Prisma.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
})
