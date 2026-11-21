import type { DocMeta } from './syncStorage'

/**
 * A decisão da sincronização para UM documento: o que fazer quando o servidor tem uma versão dele
 * que o aparelho ainda não conhece. Pura, e a mesma nos dois caminhos por onde a versão do servidor
 * chega: a leitura das mudanças e a resposta 409 de um envio.
 *
 * As regras (decisões do dono, 2026-11-21):
 *  - quem não mexeu no documento só recebe a versão do servidor;
 *  - dois lados mexeram: ganha a alteração mais recente (pelo relógio de cada aparelho), e a que
 *    perdeu NUNCA some em silêncio: vira uma cópia;
 *  - a edição ganha da exclusão, nos dois sentidos;
 *  - nada é escrito por cima de um documento que está aberto na tela: a troca espera a galeria.
 */

export type RemoteVersion = {
  revision: number
  /** O servidor tem a lápide do documento. */
  deleted: boolean
  /** O momento da alteração no aparelho que a gravou. */
  clientUpdatedAt: number
}

export type ReconcileInput = {
  /** O que o diário sabe do documento; `undefined` se nunca ouviu falar dele. */
  meta: DocMeta | undefined
  /** O documento no aparelho (só a data importa aqui); `null` se não existe. */
  local: { updatedAt: number } | null
  remote: RemoteVersion
  /** O conteúdo do aparelho e o do servidor são o mesmo. Só é lido quando os dois existem. */
  sameContent: boolean
  /** A galeria está na tela: nenhum documento está aberto no criador nem no jogo. */
  atRest: boolean
  /** Este app entende a forma (`schema`) em que o servidor tem o documento. */
  supported: boolean
}

export type ReconcileAction =
  /** O aparelho já conhece esta revisão (é o eco da própria gravação): nada a fazer. */
  | 'ignore'
  /** O servidor tem o documento numa forma mais nova que a deste app: nem aplica, nem envia. */
  | 'outdated'
  /** Grava a versão do servidor no aparelho; o documento fica em dia. */
  | 'apply'
  /** Apaga o documento do aparelho (foi apagado em outro, e aqui não havia alteração). */
  | 'remove'
  /** Os dois lados apagaram, ou não há o que apagar aqui: o diário só esquece o documento. */
  | 'forget'
  /** Os dois lados chegaram ao mesmo conteúdo: o aparelho adota a revisão e fica em dia. */
  | 'adopt'
  /**
   * A versão do aparelho ganha. A do servidor, se existe, vira cópia; o aparelho passa a partir da
   * revisão do servidor e envia a dele (sobre a lápide, isso ressuscita a ficha).
   */
  | 'keepLocal'
  /** A versão do servidor ganha: a do aparelho vira cópia, e a do servidor é gravada. */
  | 'takeRemote'
  /** A do servidor ganha, mas o documento está aberto: fica à espera da volta à galeria. */
  | 'wait'

export function decideRemote({ meta, local, remote, sameContent, atRest, supported }: ReconcileInput): ReconcileAction {
  if (remote.revision <= (meta?.revision ?? 0)) return 'ignore'
  if (!supported) return 'outdated'

  const pendingDelete = meta?.deleted === true
  const exists = local !== null && !pendingDelete
  // Documento do aparelho que o diário não conhece (fichas de antes da conta, diário perdido)
  // conta como alterado: nunca é trocado pela versão do servidor sem conferir.
  const dirty = exists && (meta ? meta.dirty : true)

  if (remote.deleted) {
    if (!exists) return 'forget'
    return dirty ? 'keepLocal' : 'remove'
  }

  // A exclusão daqui perde para a edição de lá: a ficha volta.
  if (!exists || !dirty) return 'apply'
  if (sameContent) return 'adopt'
  if (local.updatedAt > remote.clientUpdatedAt) return 'keepLocal'
  return atRest ? 'takeRemote' : 'wait'
}
