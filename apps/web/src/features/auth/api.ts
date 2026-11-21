import { createApiClient } from '../../core/api/client'
import { loadSyncMeta } from '../../core/sync/syncStorage'
import { useAuthStore } from './authStore'

/**
 * O cliente da API do app: o de `core/api/client.ts`, ligado ao que só o app sabe.
 *
 *  - o cabeçalho da conta leva o dono dos dados DESTE aparelho (o diário), e não quem está
 *    conectado: é a diferença entre os dois que o servidor recusa (duas abas, contas diferentes);
 *  - todo 401 de sessão marca a sessão como expirada. O uso do aparelho segue; a sincronização
 *    para, e a galeria pede para entrar de novo.
 */
export const api = createApiClient({
  // Embrulhado, para os testes poderem trocar o `fetch` global depois de este módulo carregar.
  fetch: (input, init) => fetch(input, init),
  getAccountId: () => loadSyncMeta().owner?.id ?? null,
  onUnauthorized: () => {
    if (useAuthStore.getState().user) useAuthStore.setState({ session: 'expired' })
  },
})
