import { useState } from 'react'
import { formatDamageSpec, parseDice, rollDamage, rollPool } from '../../core/dice/dice'
import type { LogEntry } from '../../core/play/types'

type Props = {
  onRoll: (entry: Omit<LogEntry, 'id' | 'at'>) => void
}

const POOL_SIZES = [1, 2, 3, 4, 5]

/**
 * Rolador avulso. Cobre tudo que o motor ainda não conhece como ação estruturada — e mesmo
 * depois que conhecer, continua útil: o mestre pede testes que não estão na ficha o tempo todo.
 *
 * Dois modos, porque são duas gramáticas diferentes: o teste do Ordem é um **pool de d20** (N
 * dados, vale o melhor), enquanto dano é **notação** (2d6+3).
 */
export function QuickRoller({ onRoll }: Props) {
  const [mode, setMode] = useState<'pool' | 'notation'>('pool')
  const [dice, setDice] = useState(2)
  const [worst, setWorst] = useState(false)
  const [bonus, setBonus] = useState('')
  const [notation, setNotation] = useState('')

  function rollThePool() {
    const bonusValue = parseInt(bonus, 10)
    const result = rollPool({
      dice,
      mode: worst ? 'worst' : 'best',
      bonus: Number.isFinite(bonusValue) ? bonusValue : 0,
    })
    const label = `${dice}d20${worst ? ' pior' : ''}`
    onRoll({
      kind: 'roll',
      title: `Teste ${label}`,
      detail: result.bonus !== 0
        ? `${result.kept} ${result.bonus > 0 ? '+' : '−'} ${Math.abs(result.bonus)}`
        : undefined,
      total: result.total,
      dice: result.dice,
    })
  }

  function rollTheNotation() {
    const spec = parseDice(notation)
    if (spec.dice.length === 0 && spec.bonus === 0) return
    const result = rollDamage(spec)
    onRoll({
      kind: 'roll',
      title: formatDamageSpec(spec),
      total: result.total,
      dice: [...result.dice, ...result.extra],
    })
  }

  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-3">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h3 className="text-xs font-semibold font-fantasy text-parchment-600 uppercase tracking-widest">
          Rolar
        </h3>
        <div className="flex gap-1">
          <ModeTab active={mode === 'pool'} onClick={() => setMode('pool')}>d20</ModeTab>
          <ModeTab active={mode === 'notation'} onClick={() => setMode('notation')}>notação</ModeTab>
        </div>
      </div>

      {mode === 'pool' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {POOL_SIZES.map(n => (
              <button
                key={n}
                onClick={() => setDice(n)}
                className="w-8 h-8 rounded-lg border text-xs font-fantasy font-bold transition-colors"
                style={dice === n
                  ? { borderColor: 'var(--color-gold-500)', backgroundColor: 'color-mix(in srgb, var(--color-gold-500) 18%, transparent)', color: 'var(--color-gold-400)' }
                  : { borderColor: '#3a2614', color: '#b8946f' }}
              >
                {n}
              </button>
            ))}
            <label className="flex items-center gap-1.5 ml-1 text-[11px] text-parchment-500 cursor-pointer">
              <input type="checkbox" checked={worst} onChange={e => setWorst(e.target.checked)} />
              pior
            </label>
            <input
              type="number"
              value={bonus}
              onChange={e => setBonus(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') rollThePool() }}
              placeholder="+0"
              aria-label="Bônus do teste"
              className="w-16 px-2 py-1 rounded-lg border border-parchment-800 bg-parchment-950 text-parchment-200 text-sm text-center outline-none focus:border-parchment-600"
            />
          </div>
          <RollButton onClick={rollThePool}>
            Rolar {dice}d20{worst ? ' pior' : ''}
          </RollButton>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={notation}
            onChange={e => setNotation(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') rollTheNotation() }}
            placeholder="2d6+3"
            aria-label="Notação de dados"
            className="w-full px-2.5 py-1.5 rounded-lg border border-parchment-800 bg-parchment-950 text-parchment-200 text-sm font-mono outline-none focus:border-parchment-600"
          />
          <RollButton onClick={rollTheNotation}>Rolar</RollButton>
        </div>
      )}
    </div>
  )
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded-md text-[11px] font-fantasy font-semibold transition-colors"
      style={active
        ? { backgroundColor: 'color-mix(in srgb, var(--color-gold-500) 20%, transparent)', color: 'var(--color-gold-400)' }
        : { color: '#8a7368' }}
    >
      {children}
    </button>
  )
}

function RollButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2 rounded-lg font-fantasy font-bold text-sm transition-all hover:brightness-110"
      style={{ backgroundColor: 'var(--color-gold-500)', color: 'var(--color-on-accent)' }}
    >
      {children}
    </button>
  )
}
