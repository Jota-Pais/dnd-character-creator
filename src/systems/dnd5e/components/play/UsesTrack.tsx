import { useState, type FormEvent } from 'react'
import { ChangeAnnouncer } from './ChangeAnnouncer'

/**
 * Bolinhas de usos: cheia = disponível, vazia = gasta. Tocar numa cheia gasta uma; numa vazia,
 * recupera uma (para corrigir um toque errado sem precisar do desfazer).
 */
export function UsesTrack({ label, total, available, onSpend, onRecover }: {
  /** "Espaços de 1º nível", "Fúria". */
  label: string
  total: number
  available: number
  onSpend: () => void
  onRecover: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`${label}: ${available} de ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const full = i < available
        return (
          <button
            key={i}
            onClick={full ? onSpend : onRecover}
            aria-label={full ? `Gastar: ${label}` : `Recuperar: ${label}`}
            className="w-10 h-10 flex items-center justify-center rounded-full"
          >
            <span
              className={[
                'w-6 h-6 rounded-full border-2 transition-colors',
                full ? 'border-gold-400 bg-gold-500' : 'border-parchment-700 bg-transparent',
              ].join(' ')}
            />
          </button>
        )
      })}
      <span className="ml-1 text-xs text-parchment-500" aria-hidden="true">{available}/{total}</span>
      {/* A bolinha tocada nem sempre muda de nome (gasta-se a última cheia): a contagem é anunciada. */}
      <ChangeAnnouncer text={`${label}: ${available} de ${total}`} />
    </div>
  )
}

/**
 * Poço grande (Chi do monge alto, Cura pelas Mãos em PV): "restam X de Y", com −1/+1 e, quando o
 * gasto vem em quantidades (`amountInput`), um campo para gastar várias de uma vez. Os botões são
 * aria-disabled, não disabled: o −1 que zera, o +1 que enche e o "Gastar" que esvazia o campo
 * apagariam o botão com o foco nele, que cairia no body. Apagados, não fazem nada.
 */
export function RemainingTrack({ label, unitLabel, total, available, amountInput, onSpend, onRecover }: {
  label: string
  /** "PV", "pontos". */
  unitLabel: string
  total: number
  available: number
  amountInput?: boolean
  onSpend: (amount: number) => void
  onRecover: (amount: number) => void
}) {
  const [text, setText] = useState('')
  const amount = /^\d+$/.test(text.trim()) ? Number(text.trim()) : null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (amount === null || amount < 1) return
    onSpend(amount)
    setText('')
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm text-parchment-200" data-testid={`remaining-${label}`}>
          restam <span className="font-fantasy font-bold">{available}</span> de {total} {unitLabel}
        </span>
        <ChangeAnnouncer text={`${label}: restam ${available} de ${total} ${unitLabel}`} />
        <button
          onClick={() => { if (available > 0) onSpend(1) }}
          aria-disabled={available <= 0}
          aria-label={`Gastar 1: ${label}`}
          className="w-10 h-10 rounded-lg border border-parchment-800 text-parchment-300 aria-disabled:opacity-30 hover:border-parchment-600"
        >
          −1
        </button>
        <button
          onClick={() => { if (available < total) onRecover(1) }}
          aria-disabled={available >= total}
          aria-label={`Recuperar 1: ${label}`}
          className="w-10 h-10 rounded-lg border border-parchment-800 text-parchment-300 aria-disabled:opacity-30 hover:border-parchment-600"
        >
          +1
        </button>
      </div>
      {amountInput && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={1}
            value={text}
            onChange={e => setText(e.target.value)}
            aria-label={`Quanto gastar: ${label}`}
            placeholder="Quanto"
            className="min-h-10 w-24 rounded-lg border border-parchment-800 bg-surface-base px-3 text-parchment-100 outline-none focus:border-gold-600"
          />
          <button
            type="submit"
            aria-disabled={amount === null || amount < 1}
            className="min-h-10 rounded-lg border border-parchment-700 px-3 text-sm text-parchment-200 aria-disabled:opacity-40 hover:border-gold-600"
          >
            Gastar
          </button>
        </form>
      )}
    </div>
  )
}
