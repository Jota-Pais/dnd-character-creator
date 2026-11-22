import { closeOnSignal, startServer } from './bootstrap'
import { loadEnv } from './env'

// A API de produção (a Render) e a de desenvolvimento contra a Neon (`npm run dev`): o ambiente vem
// do .env, validado no boot. Sem banco nenhum por perto, use o modo local: `npm run dev:local`.
const running = startServer({ env: loadEnv() })
closeOnSignal(running.close)
