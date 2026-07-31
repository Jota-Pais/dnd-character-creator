import { useState } from 'react'
import type { DyingState, PlayRuntime, RestOption, RestQuality } from '../../core/play/types'

const QUALITIES: { id: RestQuality; label: string }[] = [
  { id: 'poor', label: 'Precária' },
  { id: 'normal', label: 'Normal' },
  { id: 'comfortable', label: 'Confortável' },
  { id: 'luxurious', label: 'Luxuosa' },
]

type Props = {
  runtime: PlayRuntime
  dying: DyingState
  /** Opções de descanso já calculadas para a qualidade escolhida. */
  restOptions: (quality: RestQuality) => RestOption[]
  onNextTurn: () => void
  onNewScene: () => void
  onStabilizeRoll: () => void
  onRest: (option: RestOption) => void
  onUndoDeath: () => void
}

/**
 * O relógio da mesa: turno, cena, a contagem regressiva de morrendo e o descanso.
 *
 * O turno é botão porque o app não conhece a iniciativa (não há inimigos no escopo) — quem sabe
 * que a vez chegou é o jogador. O contador de morte anda junto, que é o que o livro exige.
 */
export function TurnPanel({
  runtime, dying, restOptions, onNextTurn, onNewScene, onStabilizeRoll, onRest, onUndoDeath,
}: Props) {
  const [restOpen, setRestOpen] = useState(false)
  const [quality, setQuality] = useState<RestQuality>('normal')

  if (runtime.dead) {
    return (
      <div
        className="rounded-xl border p-4 text-center"
        style={{ borderColor: 'var(--color-gold-700)', backgroundColor: 'color-mix(in srgb, var(--color-gold-900) 60%, transparent)' }}
      >
        <p className="font-fantasy font-bold text-lg text-parchment-100">☠ Morreu</p>
        <p className="text-xs text-parchment-500 mt-1">
          Iniciou {dying.limit} turnos morrendo na mesma cena (Cap. 4, p. 87).
        </p>
        <button
          onClick={onUndoDeath}
          title="Erro de clique acontece, e o mestre pode decidir diferente"
          className="mt-3 px-4 py-1.5 rounded-lg text-xs font-fantasy font-bold border border-parchment-700 text-parchment-300 hover:border-parchment-500 transition-colors"
        >
          Desfazer morte
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold font-fantasy text-parchment-600 uppercase tracking-widest">
          Turno {runtime.turn}
        </span>
        <div className="flex-1" />
        <button
          onClick={onNextTurn}
          className="px-3 py-1.5 rounded-lg text-xs font-fantasy font-bold transition-all hover:brightness-110"
          style={{ backgroundColor: 'var(--color-gold-500)', color: 'var(--color-on-accent)' }}
        >
          Novo turno →
        </button>
        <button
          onClick={onNewScene}
          title="Zera turno, contador de morte e as condições (que duram a cena)"
          className="px-3 py-1.5 rounded-lg text-xs font-fantasy border border-parchment-800 text-parchment-400 hover:border-parchment-600 hover:text-parchment-200 transition-colors"
        >
          Nova cena
        </button>
        <button
          onClick={() => setRestOpen(v => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-fantasy border border-parchment-800 text-parchment-400 hover:border-parchment-600 hover:text-parchment-200 transition-colors"
        >
          Interlúdio
        </button>
      </div>

      {dying.dying && (
        <div
          className="rounded-lg border p-2.5"
          style={{ borderColor: 'var(--color-gold-700)', backgroundColor: 'color-mix(in srgb, var(--color-gold-900) 50%, transparent)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-fantasy font-bold text-sm" style={{ color: 'var(--color-gold-300)' }}>
              Morrendo
            </span>
            <span className="flex gap-1">
              {Array.from({ length: dying.limit }, (_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="w-2.5 h-2.5 rounded-full border"
                  style={i < dying.turnsStarted
                    ? { backgroundColor: 'var(--color-gold-500)', borderColor: 'var(--color-gold-500)' }
                    : { borderColor: 'var(--color-gold-800)' }}
                />
              ))}
            </span>
            <span className="text-[11px] text-parchment-500">
              {dying.turnsStarted}/{dying.limit} turnos
            </span>
          </div>
          <p className="text-[11px] text-parchment-500 leading-snug mb-2">
            Curar PV tira a inconsciência, mas <strong>não</strong> para o sangramento — só um
            teste de {dying.stabilizeCheck.skillName} (DT {dying.stabilizeCheck.dt}) estabiliza.
          </p>
          <button
            onClick={onStabilizeRoll}
            className="px-3 py-1.5 rounded-lg text-xs font-fantasy font-bold transition-all hover:brightness-110"
            style={{ backgroundColor: 'var(--color-gold-500)', color: 'var(--color-on-accent)' }}
          >
            Rolar {dying.stabilizeCheck.skillName} (DT {dying.stabilizeCheck.dt})
          </button>
        </div>
      )}

      {runtime.stabilized && !dying.dying && (
        <p className="text-[11px]" style={{ color: '#86efac' }}>
          ✚ Estabilizado — em 0 PV, mas fora de perigo.
        </p>
      )}

      {restOpen && (
        <div className="rounded-lg border border-parchment-800 p-2.5 space-y-2">
          <div className="flex flex-wrap gap-1">
            {QUALITIES.map(q => (
              <button
                key={q.id}
                onClick={() => setQuality(q.id)}
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors"
                style={quality === q.id
                  ? { borderColor: 'var(--color-gold-600)', color: 'var(--color-gold-400)' }
                  : { borderColor: '#3d2a2c', color: '#8a7368' }}
              >
                {q.label}
              </button>
            ))}
          </div>
          {restOptions(quality).map(option => (
            <button
              key={option.id}
              onClick={() => { onRest(option); setRestOpen(false) }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg border border-parchment-800 hover:border-parchment-600 transition-colors"
            >
              <span className="font-fantasy text-[13px] font-bold text-parchment-200">{option.label}</span>
              {option.hint && (
                <p className="text-[11px] text-parchment-600 leading-snug mt-0.5">{option.hint}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
