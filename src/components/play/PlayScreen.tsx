import { useMemo, useState } from 'react'
import { SYSTEMS } from '../../core/systems/registry'
import { usePlayStore } from '../../core/play/playStore'
import { ResourceBar } from './ResourceBar'
import { RollLog } from './RollLog'
import { QuickRoller } from './QuickRoller'

/** Cada sistema pinta a mesa com o próprio tema, igual ao wizard. */
const THEME_CLASS: Record<string, string> = { ordem: 'theme-ordem' }

/**
 * A mesa: a ficha do jogador rodando. Substitui papel, lápis, borracha e dados.
 *
 * Isolada do fluxo de criação de propósito — não usa o WizardShell nem os stores de criação, e a
 * ficha é lida como **somente leitura**. Jogar nunca altera um personagem salvo.
 */
export function PlayScreen() {
  const session = usePlayStore(s => s.session)
  const exit = usePlayStore(s => s.exit)
  const discard = usePlayStore(s => s.discard)
  const setResource = usePlayStore(s => s.setResource)
  const adjustResource = usePlayStore(s => s.adjustResource)
  const addLog = usePlayStore(s => s.addLog)
  const clearLog = usePlayStore(s => s.clearLog)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const system = session ? SYSTEMS[session.systemId] : undefined
  const adapter = system?.play

  // A ficha é lida uma vez por render da sessão: ela é imutável durante o jogo.
  const character = useMemo(
    () => (adapter && session ? adapter.loadCharacter(session.characterId) : null),
    [adapter, session],
  )

  if (!session) return null

  if (!adapter || !character) {
    return (
      <Frame systemId={session.systemId} onExit={exit} title={session.characterName} subtitle="">
        <div className="max-w-md mx-auto text-center py-16">
          <div className="text-5xl mb-3">🔍</div>
          <h2 className="font-fantasy text-xl font-bold text-parchment-200 mb-2">
            Ficha não encontrada
          </h2>
          <p className="text-parchment-500 text-sm mb-6">
            O personagem desta sessão foi excluído ou pertence a um sistema que não está mais
            disponível. A sessão em si continua salva.
          </p>
          <button
            onClick={exit}
            className="px-5 py-2 rounded-xl font-fantasy font-bold text-sm"
            style={{ backgroundColor: 'var(--color-gold-500)', color: 'var(--color-on-accent)' }}
          >
            Voltar
          </button>
        </div>
      </Frame>
    )
  }

  const resources = adapter.getResources(character.draft, session.runtime)
  const stats = adapter.getStats(character.draft)

  return (
    <Frame
      systemId={session.systemId}
      onExit={exit}
      title={character.name}
      subtitle={adapter.describeCharacter(character.draft)}
      onDiscard={() => setConfirmDiscard(true)}
    >
      {confirmDiscard && (
        <div className="mb-4 rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: 'var(--color-gold-800)', backgroundColor: 'color-mix(in srgb, var(--color-gold-900) 55%, transparent)' }}>
          <p className="text-sm text-parchment-300">
            Zerar a sessão apaga vitais e histórico. <strong>A ficha não é tocada.</strong>
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setConfirmDiscard(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-fantasy text-parchment-400 hover:text-parchment-200"
            >
              Cancelar
            </button>
            <button
              onClick={discard}
              className="px-3 py-1.5 rounded-lg text-xs font-fantasy font-bold"
              style={{ backgroundColor: 'var(--color-gold-500)', color: 'var(--color-on-accent)' }}
            >
              Zerar sessão
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="space-y-4">
          {stats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {stats.map(stat => (
                <div
                  key={stat.label}
                  title={stat.hint}
                  className="rounded-xl border border-parchment-900 bg-parchment-950/60 px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-widest text-parchment-600">{stat.label}</p>
                  <p className="font-fantasy font-bold text-lg text-gold-400">{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {resources.map(track => (
              <ResourceBar
                key={track.id}
                track={track}
                onAdjust={delta => {
                  const changed = adjustResource(track.id, delta, track.max)
                  if (changed === 0) return
                  addLog({
                    kind: changed < 0 ? 'damage' : 'heal',
                    title: `${changed < 0 ? '−' : '+'}${Math.abs(changed)} ${track.short}`,
                    detail: `${track.current + changed}/${track.max}`,
                  })
                }}
                onSet={value => setResource(track.id, value)}
              />
            ))}
          </div>

          <QuickRoller onRoll={addLog} />
        </div>

        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] flex flex-col min-h-0">
          <RollLog entries={session.log} onClear={clearLog} />
        </div>
      </div>
    </Frame>
  )
}

function Frame({
  systemId, title, subtitle, onExit, onDiscard, children,
}: {
  systemId: string
  title: string
  subtitle: string
  onExit: () => void
  onDiscard?: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`${THEME_CLASS[systemId] ?? ''} min-h-screen bg-surface-base`}>
      <header className="border-b border-parchment-900 bg-surface-raised">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            onClick={onExit}
            className="text-sm font-fantasy text-parchment-500 hover:text-parchment-200 transition-colors shrink-0"
          >
            ← Sair da mesa
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-fantasy font-bold text-parchment-100 truncate">{title}</h1>
              <span
                className="shrink-0 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded font-bold border"
                style={{ color: 'var(--color-gold-400)', borderColor: 'var(--color-gold-800)' }}
                title="Modo de jogo em desenvolvimento — regras sendo implementadas por fase"
              >
                beta
              </span>
            </div>
            {subtitle && <p className="text-xs text-parchment-600 truncate">{subtitle}</p>}
          </div>

          {onDiscard && (
            <button
              onClick={onDiscard}
              className="text-xs font-fantasy text-parchment-700 hover:text-parchment-400 transition-colors shrink-0"
            >
              Zerar sessão
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-5">{children}</main>
    </div>
  )
}
