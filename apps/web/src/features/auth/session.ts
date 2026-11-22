import type { LoginRequest, RegisterRequest } from '@rpg/contracts'
import * as authApi from '../../core/api/authApi'
import { isRetryable, type ApiClient, type ApiError } from '../../core/api/client'
import type { CycleOutcome } from '../../core/sync/engine'
import { loadSyncMeta, updateSyncMeta, type SyncOwner } from '../../core/sync/syncStorage'
import { loadAccount, saveAccount, type AccountUser } from './accountStorage'
import { useAuthStore } from './authStore'

/**
 * Os fluxos de conta: abrir o app, entrar, criar conta e sair. A regra que todos guardam:
 *
 *   com o portão aberto, quem está conectado é o dono dos dados do aparelho.
 *
 * As fichas ficam no aparelho (o app funciona sem rede), então trocar de conta no mesmo aparelho é
 * o momento em que as fichas de uma pessoa poderiam aparecer para outra, ou subir para a conta
 * errada. Por isso só `enterAs` abre o portão, e ele confere o dono antes.
 *
 * Tudo de que os fluxos dependem entra por `SessionDeps`: os testes os rodam sem rede e sem página.
 */

export type SessionDeps = {
  api: ApiClient
  sync: {
    start(): void
    stop(): void
    /** Um ciclo agora, esperando o resultado. */
    now(): Promise<CycleOutcome>
    /** Quantos documentos do aparelho têm alteração que o servidor não tem. */
    unsent(): number
  }
  local: {
    /** Apaga do aparelho as fichas, os estados de jogo e o diário. */
    wipe(): void
    /** Grava o que a tela ainda não gravou. */
    flush(): void
  }
  /** Recarrega a página: os stores releem o aparelho do zero. */
  reload(): void
  isOnline(): boolean
}

/** O aparelho guarda alterações de outra conta que ainda não subiram: ninguém mais entra por cima. */
export type OtherAccount = { owner: SyncOwner; unsent: number }

export type SignResult =
  | { ok: true }
  /** Recusa com mensagem por campo (e-mail inválido, senha curta, e-mail já usado). */
  | { ok: false; kind: 'fields'; message: string; fields: Record<string, string> }
  /** Recusa com uma mensagem só (senha errada, tentativas demais, sem rede). */
  | { ok: false; kind: 'message'; message: string; offline: boolean }
  | { ok: false; kind: 'otherAccount'; other: OtherAccount }

export type SignOutResult =
  | { ok: true }
  /** Há alterações que ainda não subiram: sair precisa da confirmação de quem está saindo. */
  | { ok: false; unsent: number }

/**
 * Sem resposta do servidor ao entrar ou criar conta. Entrar exige internet (depois, o app abre sem
 * ela); e no plano gratuito a API dorme sem uso, então o primeiro acesso depois de um tempo pode
 * falhar por demora.
 */
export const NO_CONNECTION = 'Não foi possível falar com o servidor. Para entrar é preciso internet; se ela está funcionando, o servidor pode estar acordando: espere um minuto e tente de novo.'

function refusal(error: ApiError): SignResult {
  if (isRetryable(error) && !(error.kind === 'http' && error.status === 429)) {
    return { ok: false, kind: 'message', message: NO_CONNECTION, offline: true }
  }
  if (error.kind === 'http' && Object.keys(error.fields).length > 0) {
    return { ok: false, kind: 'fields', message: error.message, fields: error.fields }
  }
  return { ok: false, kind: 'message', message: error.message, offline: false }
}

export function createSession(deps: SessionDeps) {
  const { api, sync, local } = deps

  /**
   * Abre o portão para o usuário que o servidor acabou de confirmar. É o único lugar que faz isso.
   * Se o aparelho guarda dados de outra conta com alterações por enviar, não abre: devolve de quem
   * são, e a sessão recém-aberta é encerrada.
   */
  async function enterAs(user: AccountUser): Promise<{ ok: true } | { ok: false; other: OtherAccount }> {
    const owner = loadSyncMeta().owner

    if (owner && owner.id !== user.id) {
      const unsent = sync.unsent()
      if (unsent > 0) {
        await authApi.logout(api)
        return { ok: false, other: { owner, unsent } }
      }
      // Dados de outra conta, todos já no servidor: o aparelho é limpo, e a página recarrega para
      // nenhuma tela guardar ficha da conta anterior.
      local.wipe()
      updateSyncMeta(meta => { meta.owner = user })
      saveAccount({ user, signOutPending: false })
      deps.reload()
      return { ok: true }
    }

    // Sem dono (as fichas de antes da conta, ou o aparelho vazio), elas passam a ser de quem entra:
    // nada é copiado nem apagado, e a sincronização as envia.
    updateSyncMeta(meta => {
      if (meta.owner?.id === user.id && meta.owner.email === user.email) return false
      meta.owner = user
    })
    saveAccount({ user, signOutPending: false })
    useAuthStore.setState({ user, session: 'valid' })
    sync.start()
    return { ok: true }
  }

  async function enterWith(result: Awaited<ReturnType<typeof authApi.login>>): Promise<SignResult> {
    if (!result.ok) return refusal(result.error)
    const entered = await enterAs(result.data.user)
    return entered.ok ? { ok: true } : { ok: false, kind: 'otherAccount', other: entered.other }
  }

  /**
   * Pergunta ao servidor quem o cookie deste navegador diz que está conectado, e acerta o estado.
   * Roda em segundo plano: o portão já decidiu pelo que o aparelho lembra.
   */
  async function checkSession(): Promise<void> {
    const result = await authApi.getSession(api)
    const remembered = useAuthStore.getState().user

    // Sem resposta: o que o aparelho lembra continua valendo, e a pergunta é refeita quando a rede
    // voltar.
    if (!result.ok) return

    if (!remembered) {
      // O aparelho não lembra de ninguém, mas o cookie está vivo (o navegador apagou o que o site
      // guardava e manteve o cookie): a pessoa entra sem digitar a senha de novo.
      if (result.data.user) await enterAs(result.data.user)
      return
    }
    if (result.data.user?.id === remembered.id) {
      updateSyncMeta(meta => {
        if (meta.owner) return false
        meta.owner = remembered
      })
      useAuthStore.setState({ session: 'valid' })
      sync.start()
    } else {
      useAuthStore.setState({ session: 'expired' })
    }
  }

  return {
    enterAs,
    checkSession,

    async signIn(data: LoginRequest): Promise<SignResult> {
      return enterWith(await authApi.login(api, data))
    },

    async signUp(data: RegisterRequest): Promise<SignResult> {
      return enterWith(await authApi.register(api, data))
    },

    /**
     * Entra descartando o que o aparelho guardava de outra conta e ainda não tinha subido. Só
     * depois de a pessoa confirmar que quer perder aquelas alterações.
     */
    async discardAndSignIn(data: LoginRequest): Promise<SignResult> {
      const result = await authApi.login(api, data)
      if (!result.ok) return refusal(result.error)
      local.wipe()
      updateSyncMeta(meta => { meta.owner = result.data.user })
      saveAccount({ user: result.data.user, signOutPending: false })
      deps.reload()
      return { ok: true }
    },

    /**
     * Sai da conta neste aparelho. Antes, tenta mandar o que falta. Com tudo no servidor, as fichas
     * saem do aparelho. Com alteração que não subiu, só sai com `keepUnsent` (a confirmação de quem
     * está saindo), e aí nada é apagado: as fichas ficam guardadas, fora da vista, e voltam a
     * sincronizar quando a mesma conta entrar de novo.
     */
    async signOut(options: { keepUnsent?: boolean } = {}): Promise<SignOutResult> {
      local.flush()
      if (deps.isOnline()) await sync.now()
      const unsent = sync.unsent()
      if (unsent > 0 && !options.keepUnsent) return { ok: false, unsent }

      sync.stop()
      const result = await authApi.logout(api)
      // Sem conseguir falar com o servidor, o cookie de lá continua valendo: fica anotado para o
      // app encerrá-lo na próxima abertura com rede.
      const signOutPending = !result.ok && isRetryable(result.error)
      if (unsent === 0) local.wipe()
      saveAccount({ user: null, signOutPending })
      deps.reload()
      return { ok: true }
    },

    /**
     * A abertura do app, chamada uma vez pelo `main.tsx` depois de a primeira tela estar no ar. O
     * portão não espera por isto: ele abre pelo que o aparelho lembra, e aqui o servidor confirma.
     */
    async start(): Promise<void> {
      const account = loadAccount()

      if (account.signOutPending) {
        const result = await authApi.logout(api)
        // Ainda sem rede: a saída continua pendente, e o cookie vivo não pode reconectar ninguém.
        if (!result.ok && isRetryable(result.error)) return
        saveAccount({ signOutPending: false })
      }

      // O aparelho lembra de uma conta, mas os dados dele são de outra: o estado ficou incoerente
      // (o localStorage foi mexido por fora). O portão fecha, e entrar de novo resolve com as
      // conferências de `enterAs`.
      const owner = loadSyncMeta().owner
      if (account.user && owner && owner.id !== account.user.id) {
        saveAccount({ user: null })
        useAuthStore.setState({ user: null, session: 'unknown' })
        return
      }

      // Para quem o aparelho lembra, a sincronização liga já, sem esperar o servidor confirmar a
      // sessão: aberto sem rede, o app precisa contar o que o jogador muda (a linha de conta diz
      // quantas alterações estão guardadas só aqui) e enviar assim que a rede voltar. Se a sessão
      // não valer mais, quem descobre é o primeiro ciclo (o 401 a marca como expirada).
      if (account.user) sync.start()

      await checkSession()
    },
  }
}

export type Session = ReturnType<typeof createSession>
