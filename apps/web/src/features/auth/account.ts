import { flushLocalEdits, wipeLocalSheets } from '../sync/syncLocal'
import { countUnsentChanges, startSync, stopSync, syncNow } from '../sync/start'
import { api } from './api'
import { useAuthStore } from './authStore'
import { createSession } from './session'

/**
 * A conta do app: os fluxos de `session.ts` ligados ao app de verdade (a API, a sincronização, as
 * camadas de storage e a página). As telas usam este `session`; os testes dos fluxos montam o deles,
 * com tudo de mentira.
 */
export const session = createSession({
  api,
  sync: { start: startSync, stop: stopSync, now: syncNow, unsent: countUnsentChanges },
  local: { wipe: wipeLocalSheets, flush: flushLocalEdits },
  reload: () => window.location.reload(),
  // Sem a informação, vale tentar: quem decide é a resposta do servidor.
  isOnline: () => navigator.onLine !== false,
})

/**
 * A abertura da conta, chamada uma vez pelo `main.tsx` depois de a primeira tela estar no ar (nunca
 * de um efeito de componente: montar o app não fala com o servidor). O portão já abriu, ou não, pelo
 * que o aparelho lembra; aqui o servidor confirma, em segundo plano. Sem rede, a pergunta é refeita
 * quando ela voltar.
 */
export function startAccount(): void {
  void session.start()
  window.addEventListener('online', () => {
    const { user, session: state } = useAuthStore.getState()
    if (!user || state === 'unknown') void session.start()
  })
}
