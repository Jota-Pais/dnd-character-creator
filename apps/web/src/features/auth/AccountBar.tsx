import { useState } from 'react'
import { useBackHandler } from '../../core/navigation/back'
import { requestSync } from '../sync/start'
import { useSyncStore } from '../sync/syncStore'
import { describeSync } from '../sync/syncText'
import { session as appSession } from './account'
import { useAuthStore } from './authStore'
import type { Session } from './session'

/**
 * A linha de conta da galeria: quem está conectado, em que pé está a sincronização e o "Sair".
 *
 * O estado da sincronização é um botão (o toque pede um ciclo agora) e NÃO é região viva: ele muda
 * a cada ciclo, e anunciar isso seria ruído. O que pede ação do jogador (a sessão que expirou, a
 * cópia de conflito) é aviso da galeria (`features/gallery/GalleryNotices.tsx`), esse sim anunciado.
 */
export function AccountBar({ session = appSession, onSync = requestSync }: {
  /** Os fluxos de conta; os testes passam os deles. */
  session?: Pick<Session, 'signOut'>
  onSync?: () => void
}) {
  const user = useAuthStore(state => state.user)
  const sessionState = useAuthStore(state => state.session)
  const status = useSyncStore(state => state.status)
  const [leaving, setLeaving] = useState(false)
  /** Quantas alterações não subiram, quando sair precisa de confirmação; null fora dela. */
  const [unsent, setUnsent] = useState<number | null>(null)

  // O voltar do Android fecha a confirmação (e, com ela aberta, a galeria não está "parada").
  useBackHandler(unsent !== null ? () => setUnsent(null) : null, 'overlay')

  if (!user) return null

  async function leave(keepUnsent: boolean) {
    // O botão apagado ainda recebe o toque (`aria-disabled`): quem segura o segundo é esta conferência.
    if (leaving) return
    setLeaving(true)
    const result = await session.signOut({ keepUnsent })
    setLeaving(false)
    // Saindo de verdade, a página recarrega; só volta aqui quando há o que confirmar.
    setUnsent(result.ok ? null : result.unsent)
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]" style={{ color: '#a39685' }}>
        <span style={{ color: '#cbbfae' }}>{user.email}</span>
        <button
          type="button"
          onClick={onSync}
          className="min-h-10 px-1 text-left"
          style={{ color: '#a39685' }}
          title="Sincronizar agora"
        >
          {describeSync(status, sessionState)}
        </button>
        <button
          type="button"
          onClick={() => void leave(false)}
          aria-disabled={leaving}
          className="min-h-10 px-3 rounded-lg ml-auto"
          style={{ border: '1px solid #3a332b', color: '#cbbfae', opacity: leaving ? 0.6 : 1 }}
        >
          {leaving ? 'Saindo…' : 'Sair'}
        </button>
      </div>

      {/* Montada vazia: a confirmação chega depois do toque em "Sair", e precisa ser anunciada. */}
      <div aria-live="polite">
        {unsent !== null && (
          <div className="mt-2 rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ border: '1px solid #5c5245', backgroundColor: '#131110' }}>
            <p className="flex-1 basis-60 text-[13px] leading-relaxed" style={{ color: '#cbbfae' }}>
              {unsent === 1 ? '1 alteração ainda não foi enviada.' : `${unsent} alterações ainda não foram enviadas.`}{' '}
              {unsent === 1 ? 'Ela fica guardada' : 'Elas ficam guardadas'} neste aparelho e {unsent === 1 ? 'sobe' : 'sobem'} quando você entrar de novo com esta conta.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void leave(true)} className="min-h-10 px-3 rounded-lg text-[13px]" style={{ border: '1px solid #7f1d1d', color: '#fca5a5' }}>
                Sair mesmo assim
              </button>
              <button type="button" onClick={() => setUnsent(null)} className="min-h-10 px-3 rounded-lg text-[13px]" style={{ color: '#a39685' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
