import { useState, type FormEvent } from 'react'
import type { PlayResult } from '../../types/playState'
import {
  adjustMaxHp, applyDamage, applyHealing, formatHpAdjustment, grantTempHp, isAtZeroHp, suggestTempHpChoice,
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
              'min-h-10 min-w-0 break-words rounded-lg border px-1.5 py-1 text-xs sm:text-sm leading-tight transition-colors',
              action === a.id
                ? 'border-gold-500 bg-gold-900 text-gold-300'
                : 'border-parchment-800 text-parchment-300 hover:border-parchment-600',
            ].join(' ')}
          >
            {a.label}
          </button>
        ))}
      </div>

      <MaxHpAdjustment view={view} />

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
                <input type="checkbox" checked={resisted} onChange={e => setResisted(e.target.checked)} className="w-5 h-5 shrink-0 accent-gold-500" />
                Tenho resistência a esse dano (sofro a metade)
              </label>
              {atZero && (
                <label className="flex items-center gap-2 min-h-10 text-sm text-parchment-300 cursor-pointer">
                  <input type="checkbox" checked={critical} onChange={e => setCritical(e.target.checked)} className="w-5 h-5 shrink-0 accent-gold-500" />
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

/**
 * O ajuste temporário do PV máximo, discreto: um link abre o campo. Aumentar sobe o máximo e o
 * atual juntos (a magia Ajuda); diminuir só corta o que passar do máximo. O descanso longo zera, e
 * "encerrar" desfaz o ajuste quando o efeito acaba antes. Cada mudança é um passo do desfazer.
 */
function MaxHpAdjustment({ view }: { view: PlayView }) {
  const { state, run } = view
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const amount = parseAmount(text)
  const adjustment = state.maxHpAdjustment

  function apply(sign: 1 | -1) {
    if (amount === null || amount === 0) return
    const result = run((st, sh) => adjustMaxHp(st, sh, sign * amount))
    // Recusado (o aviso diz por quê): o campo fica aberto com o valor.
    if (result && result.state !== state) {
      setText('')
      setOpen(false)
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-3">
        {adjustment !== 0 && (
          <span className="text-xs text-sky-300">
            Máximo {formatHpAdjustment(adjustment)} até o descanso longo
            <button
              onClick={() => run((st, sh) => adjustMaxHp(st, sh, -st.maxHpAdjustment))}
              className="min-h-10 px-2 text-xs text-parchment-400 underline hover:text-parchment-200"
            >
              encerrar
            </button>
          </span>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="min-h-10 text-xs text-parchment-500 underline hover:text-parchment-300"
        >
          ± PV máximo
        </button>
      </div>
      {open && (
        <div className="mt-1 space-y-2">
          <p className="text-xs text-parchment-500 leading-snug">
            Efeito que muda o seu PV máximo por um tempo, como a magia Ajuda (+5 no máximo e no atual, pág. 215).
            Aumentar sobe os dois; diminuir só corta o que passar do máximo. O descanso longo zera.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              step={1}
              value={text}
              onChange={e => setText(e.target.value)}
              aria-label="Quanto muda o PV máximo"
              placeholder="0"
              className="min-h-10 w-full min-w-0 rounded-lg border border-parchment-800 bg-surface-base px-3 text-lg text-parchment-100 outline-none focus:border-gold-600"
            />
            <button
              onClick={() => apply(1)}
              disabled={!amount}
              className="min-h-10 min-w-0 whitespace-nowrap rounded-lg border border-parchment-700 px-1 text-xs sm:text-sm text-parchment-200 disabled:opacity-40 hover:border-gold-600"
            >
              + Aumentar
            </button>
            <button
              onClick={() => apply(-1)}
              disabled={!amount}
              className="min-h-10 min-w-0 whitespace-nowrap rounded-lg border border-parchment-700 px-1 text-xs sm:text-sm text-parchment-200 disabled:opacity-40 hover:border-gold-600"
            >
              − Diminuir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}