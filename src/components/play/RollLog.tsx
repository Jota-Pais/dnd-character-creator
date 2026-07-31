import type { LogEntry } from '../../core/play/types'

const KIND_MARK: Record<LogEntry['kind'], { icon: string; color: string }> = {
  roll: { icon: '🎲', color: '#cbb8a8' },
  damage: { icon: '🩸', color: '#fca5a5' },
  heal: { icon: '✚', color: '#86efac' },
  rest: { icon: '🌙', color: '#93c5fd' },
  note: { icon: '✎', color: '#a08b80' },
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Histórico da sessão — o que substitui o rascunho no papel. Mostra os dados individuais, não só
 * o total: numa mesa, "rolei 3d20 e deu 4, 17, 9" é informação que a mesa inteira confere.
 */
export function RollLog({ entries, onClear }: { entries: LogEntry[]; onClear: () => void }) {
  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 flex flex-col min-h-0">
      <div className="flex items-baseline justify-between gap-2 px-3 py-2 border-b border-parchment-900">
        <h3 className="text-xs font-semibold font-fantasy text-parchment-600 uppercase tracking-widest">
          Histórico
        </h3>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="text-[11px] text-parchment-700 hover:text-parchment-400 transition-colors"
          >
            limpar
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="px-3 py-6 text-center text-parchment-700 text-xs">
          Nada rolado ainda nesta sessão.
        </p>
      ) : (
        <ul className="overflow-y-auto divide-y divide-parchment-900/60">
          {entries.map(entry => {
            const mark = KIND_MARK[entry.kind]
            return (
              <li key={entry.id} className="px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span aria-hidden className="text-xs shrink-0">{mark.icon}</span>
                  <span className="font-fantasy text-[13px] flex-1 min-w-0" style={{ color: mark.color }}>
                    {entry.title}
                  </span>
                  {entry.total !== undefined && (
                    <span className="font-mono font-bold text-base shrink-0 text-parchment-100">
                      {entry.total}
                    </span>
                  )}
                  <span className="text-[10px] text-parchment-800 shrink-0 tabular-nums">
                    {formatTime(entry.at)}
                  </span>
                </div>

                {entry.dice && entry.dice.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 ml-5">
                    {entry.dice.map((die, i) => (
                      <span
                        key={i}
                        title={`d${die.sides}`}
                        className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border"
                        style={die.kept
                          ? { borderColor: '#7d5c3c', backgroundColor: '#3a261440', color: '#f5e8cc' }
                          : { borderColor: '#2a2014', color: '#5a3e24', textDecoration: 'line-through' }}
                      >
                        {die.value}
                      </span>
                    ))}
                  </div>
                )}

                {entry.detail && (
                  <p className="text-[11px] text-parchment-600 mt-0.5 ml-5">{entry.detail}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
