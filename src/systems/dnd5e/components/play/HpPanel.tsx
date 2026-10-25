import { useState, type FormEvent } from 'react'
import type { PlayResult } from '../../types/playState'
import {
  applyDamage, applyHealing, grantTempHp, isAtZeroHp, suggestTempHpChoice,
} from '../../utils/playState'
import type { PlayView } from './usePlayView'

type HpAction = 'damage' | 'heal' | 'temp'

const ACTIONS: { id: HpAction; label: string; field: string; help: string }[] = [
  {
    id: 'damage', label: 'Dano', field: 'Quanto de dano',
    help: 'O dano total que você sofreu (quem atacou diz o valor). Os PV temporários são gastos primeiro.',
  },
  {
    id: 'heal', label: 'Cura', field: 'Quanto de cura',
    help: 'Quanto você recuperou. Não passa do seu máximo; o que sobrar se perde.',
  },
  {
    id: 'temp', label: 'PV temporários', field: 'Quantos PV temporários',
    help: 'Uma reserva que some antes dos seus PV. Não se soma a outra: se já tiver, você escolhe com qual ficar.',
  },
]

const wasRefused = (result: PlayResult | null) => !result || result.notices.some(n => n.kind === 'refused')

/** Lê o número digitado: inteiro de 0 para cima, ou null. */
function parseAmount(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  return Number(text.trim())
}

/**
 * Ações de PV: dano, cura e PV temporários, com o número digitado pelo jogador (o dano vem do
 * inimigo: nada de rolar aqui, mesmo com os dados do app). As regras ficam nas funções puras de
 * `utils/playState.ts`; os avisos (resistência, concentração, queda a 0 PV) saem pelo playStore.
 */
export function HpPanel({ view }: { view: PlayView }) {
  const { state, run } = view
  const [action, setAction] = useState<HpAction | null>(null)
  const [text, setText] = useState('')
  const [resisted, setResisted] = useState(false)
  const [critical, setCritical] = useState(false)
  const atZero = isAtZeroHp(state)
  const amount = parseAmount(text)
  const current = ACTIONS.find(a => a.id === action)
  // PV temporários já presentes: o jogador escolhe manter ou trocar (pág. 200).
  const askTempChoice = action === 'temp' && state.tempHp > 0 && amount !== null && amount > 0

  function reset() {
    setAction(null)
    setText('')
    setResisted(false)
    setCritical(false)
  }

  function choose(next: HpAction) {
    if (next === action) return reset()
    setAction(next)
    setText('')
    setResisted(false)
    setCritical(false)
  }

  function apply(choice?: 'keep' | 'replace') {
    if (amount === null || !action) return
    let result: PlayResult | null
    if (action === 'damage') {
      result = run((st, sh) => applyDamage(st, sh, { amount, resisted, critical: atZero && critical }))
    } else if (action === 'heal') {
      result = run((st, sh) => applyHealing(st, sh, amount))
    } else {
      result = run(st => grantTempHp(st, amount, choice))
    }
    if (!wasRefused(result)) reset()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!askTempChoice) apply()
  }

  const suggested = askTempChoice ? suggestTempHpChoice(state, amount) : null

  return (
    <div className="rounded-xl border border-parchment-900 bg-surface-raised p-3">
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Pontos de vida">
        {ACTIONS.map(a => (
          <button
            key={a.id}
            onClick={() => choose(a.id)}
            aria-pressed={action === a.id}
            className={[
              'min-h-10 rounded-lg border px-1.5 py-1 text-sm leading-tight transition-colors',
              action === a.id
                ? 'border-gold-500 bg-gold-900 text-gold-300'
                : 'border-parchment-800 text-parchment-300 hover:border-parchment-600',
            ].join(' ')}
          >
            {a.label}
          </button>
        ))}
      </div>

      {current && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <p className="text-xs text-parchment-500 leading-snug">{current.help}</p>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              step={1}
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              aria-label={current.field}
              placeholder="0"
              className="min-h-10 w-full min-w-0 rounded-lg border border-parchment-800 bg-surface-base px-3 text-lg text-parchment-100 outline-none focus:border-gold-600"
            />
            {!askTempChoice && (
              <button
                type="submit"
                disabled={amount === null}
                className="min-h-10 shrink-0 rounded-lg bg-gold-500 px-4 font-fantasy font-bold text-sm text-on-accent disabled:opacity-40 hover:bg-gold-400 transition-colors"
              >
                Aplicar
              </button>
            )}
          </div>

          {action === 'damage' && (
            <div className="space-y-1">
              <label className="flex items-center gap-2 min-h-10 text-sm text-parchment-300 cursor-pointer">
                <input type="checkbox" checked={resisted} onChange={e => setResisted(e.target.checked)} className="w-5 h-5 accent-gold-500" />
                Tenho resistência a esse dano (sofro a metade)
              </label>
              {atZero && (
                <label className="flex items-center gap-2 min-h-10 text-sm text-parchment-300 cursor-pointer">
                  <input type="checkbox" checked={critical} onChange={e => setCritical(e.target.checked)} className="w-5 h-5 accent-gold-500" />
                  Foi acerto crítico (conta 2 fracassos)
                </label>
              )}
            </div>
          )}

          {askTempChoice && suggested && (
            <div className="space-y-1.5">
              <p className="text-sm text-parchment-300">
                Você já tem {state.tempHp} PV temporários. Eles não se somam: com quais fica?
              </p>
              {/* A sugestão (o maior) ganha a borda dourada; a escolha é do jogador. */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => apply('keep')}
                  className={`min-h-10 rounded-lg border px-3 text-sm text-parchment-200 hover:border-gold-600 ${suggested === 'keep' ? 'border-gold-700' : 'border-parchment-700'}`}
                >
                  Manter {state.tempHp}{state.tempHp > amount ? ' (maior)' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => apply('replace')}
                  className={`min-h-10 rounded-lg border px-3 text-sm text-parchment-200 hover:border-gold-600 ${suggested === 'replace' ? 'border-gold-700' : 'border-parchment-700'}`}
                >
                  Ficar com {amount}{amount > state.tempHp ? ' (maior)' : ''}
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
