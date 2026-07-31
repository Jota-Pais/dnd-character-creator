import { useState } from 'react'
import type { ResourceTrack } from '../../core/play/types'

const TONE: Record<ResourceTrack['tone'], { fill: string; text: string }> = {
  vitality: { fill: '#dc2626', text: '#fca5a5' },
  effort: { fill: '#2563eb', text: '#93c5fd' },
  sanity: { fill: '#7c3aed', text: '#c4b5fd' },
}

type Props = {
  track: ResourceTrack
  /** Delta negativo é dano, positivo é cura. */
  onAdjust: (delta: number) => void
  onSet: (value: number) => void
}

/**
 * Uma trilha de recurso na mesa. O que importa aqui é velocidade: em combate, aplicar 7 de dano
 * tem que ser digitar 7 e apertar Enter, não clicar sete vezes num "−1".
 */
export function ResourceBar({ track, onAdjust, onSet }: Props) {
  const [amount, setAmount] = useState('')
  const tone = TONE[track.tone]
  const pct = track.max > 0 ? Math.max(0, Math.min(100, (track.current / track.max) * 100)) : 0
  // Limiar é comparação estrita: "menos da metade dos PV totais" (p. 311).
  const belowThreshold = track.threshold !== undefined && track.current < track.threshold.at
  const thresholdPct = track.threshold && track.max > 0
    ? Math.max(0, Math.min(100, (track.threshold.at / track.max) * 100))
    : null

  function apply(sign: 1 | -1) {
    const n = parseInt(amount, 10)
    if (!Number.isFinite(n) || n <= 0) return
    onAdjust(sign * n)
    setAmount('')
  }

  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="font-fantasy font-bold text-sm" style={{ color: tone.text }} title={track.label}>
          {track.short}
        </span>
        <span className="font-mono text-sm">
          <input
            type="number"
            value={track.current}
            onChange={e => {
              const v = parseInt(e.target.value, 10)
              if (Number.isFinite(v)) onSet(Math.max(0, Math.min(track.max, v)))
            }}
            aria-label={`${track.label} atual`}
            className="w-14 text-right bg-transparent font-bold outline-none focus:bg-parchment-900/60 rounded px-1"
            style={{ color: tone.text }}
          />
          <span className="text-parchment-600"> / {track.max}</span>
        </span>
      </div>

      <div className="relative h-2.5 rounded-full overflow-hidden bg-parchment-900 mb-2">
        <div
          className="h-full transition-all duration-200"
          style={{ width: `${pct}%`, backgroundColor: tone.fill }}
        />
        {thresholdPct !== null && (
          <div
            aria-hidden
            className="absolute top-0 bottom-0 w-px bg-parchment-400/70"
            style={{ left: `${thresholdPct}%` }}
          />
        )}
      </div>

      {belowThreshold && track.threshold && (
        <p className="text-[11px] mb-2" style={{ color: '#c9a05a' }}>
          ⚠ {track.threshold.label}
        </p>
      )}

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onAdjust(-1)}
          className="w-7 h-7 rounded-lg border border-parchment-800 text-parchment-400 hover:border-parchment-600 hover:text-parchment-200 transition-colors"
          aria-label={`Perder 1 de ${track.label}`}
        >
          −
        </button>
        <button
          onClick={() => onAdjust(1)}
          className="w-7 h-7 rounded-lg border border-parchment-800 text-parchment-400 hover:border-parchment-600 hover:text-parchment-200 transition-colors"
          aria-label={`Recuperar 1 de ${track.label}`}
        >
          +
        </button>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => {
            if (e.key !== 'Enter') return
            // Enter aplica dano (o caso comum em combate); Shift+Enter cura.
            apply(e.shiftKey ? 1 : -1)
          }}
          placeholder="0"
          aria-label={`Quantidade a aplicar em ${track.label}`}
          className="w-14 px-2 py-1 rounded-lg border border-parchment-800 bg-parchment-950 text-parchment-200 text-sm text-center outline-none focus:border-parchment-600"
        />
        <button
          onClick={() => apply(-1)}
          className="px-2 py-1 rounded-lg text-xs font-fantasy font-bold border transition-colors"
          style={{ borderColor: `${tone.fill}66`, color: tone.text }}
          title="Aplicar como dano (Enter)"
        >
          dano
        </button>
        <button
          onClick={() => apply(1)}
          className="px-2 py-1 rounded-lg text-xs font-fantasy font-bold border border-parchment-800 text-parchment-400 hover:text-parchment-200 hover:border-parchment-600 transition-colors"
          title="Aplicar como cura (Shift+Enter)"
        >
          curar
        </button>
      </div>
    </div>
  )
}
