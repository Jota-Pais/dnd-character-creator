import { useState, type FormEvent, type ReactNode } from 'react'
import { endConcentration, setExhaustion, startConcentration } from '../../utils/playState'
import { EXHAUSTION } from '../../utils/sheetEffects'
import { ConditionsSection } from './ConditionsSection'
import type { PlayTabProps } from './usePlayView'

const EXHAUSTION_LEVELS = [0, 1, 2, 3, 4, 5, 6] as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-wider text-parchment-600 font-fantasy mb-1.5">{title}</h2>
      {children}
    </section>
  )
}

/** Exaustão de 0 a 6 (pág. 292): cada nível inclui os anteriores; o texto acompanha o nível. */
function ExhaustionSection({ state, run }: PlayTabProps) {
  const level = state.exhaustionLevel
  const rows = EXHAUSTION.levels.filter(l => l.level <= level)
  return (
    <div>
      <div role="radiogroup" aria-label="Nível de exaustão" className="grid grid-cols-7 gap-1">
        {EXHAUSTION_LEVELS.map(n => (
          <button
            key={n}
            role="radio"
            aria-checked={level === n}
            aria-label={n === 6 ? 'Exaustão 6 (morte)' : `Exaustão ${n}`}
            onClick={() => run((st, sh) => setExhaustion(st, sh, n))}
            className={[
              'min-h-10 rounded-lg border text-sm font-fantasy transition-colors',
              level === n
                ? n === 0 ? 'border-gold-500 bg-gold-900 text-gold-300' : 'border-amber-500 bg-amber-950 text-amber-200'
                : 'border-parchment-800 text-parchment-400 hover:border-parchment-600',
            ].join(' ')}
          >
            {n}
          </button>
        ))}
      </div>
      {level === 0 ? (
        <p className="mt-1.5 text-xs text-parchment-500">Sem exaustão.</p>
      ) : (
        <ul className="mt-1.5 space-y-0.5" data-testid="exhaustion-effects">
          {rows.map(r => (
            <li key={r.level} className="text-xs text-amber-200 leading-snug">
              <span className="text-parchment-500">{r.level}:</span> {r.text}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-parchment-600 leading-snug">
        Cada nível inclui os efeitos dos anteriores. O descanso longo tira 1 nível, se você comeu e bebeu.
      </p>
    </div>
  )
}

/** Concentração: iniciar com o nome da magia (texto livre) e encerrar. Uma por vez (pág. 205). */
function ConcentrationSection({ state, run }: PlayTabProps) {
  const [label, setLabel] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = run(st => startConcentration(st, { label }, Date.now()))
    if (result && result.state.concentration?.label === label.trim()) setLabel('')
  }

  if (state.concentration) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-violet-200">Concentrado em <span className="font-bold">{state.concentration.label}</span></p>
        <button
          onClick={() => run(st => endConcentration(st))}
          className="min-h-10 rounded-lg border border-violet-800 px-3 text-sm text-violet-200 hover:border-violet-500"
        >
          Encerrar concentração
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="flex gap-2">
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          aria-label="Magia em que vai se concentrar"
          placeholder="Ex.: Bênção"
          className="min-h-10 w-full min-w-0 rounded-lg border border-parchment-800 bg-surface-base px-3 text-sm text-parchment-100 outline-none focus:border-gold-600"
        />
        <button
          type="submit"
          disabled={!label.trim()}
          className="min-h-10 shrink-0 rounded-lg border border-violet-800 px-3 text-sm text-violet-200 disabled:opacity-40 hover:border-violet-500"
        >
          Concentrar
        </button>
      </div>
      <p className="text-[11px] text-parchment-600 leading-snug">
        Ao sofrer dano, o app lembra do teste de Constituição para manter a concentração.
      </p>
    </form>
  )
}

/**
 * Aba "Estado": as condições (liga/desliga, regra a um toque, nota de duração), a exaustão, a
 * concentração e os descansos.
 */
export function StatusTab(view: PlayTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Condições">
        <ConditionsSection {...view} />
      </Section>
      <Section title="Exaustão">
        <ExhaustionSection {...view} />
      </Section>
      <Section title="Concentração">
        <ConcentrationSection {...view} />
      </Section>
    </div>
  )
}
