import { useState } from 'react'
import { MAX_DICE } from '../../../../core/dice'
import { usePlayStore } from '../../stores/playStore'
import {
  FREE_ROLL_DICE, FREE_ROLL_MAX_MODIFIER, formatFreeRoll, formatRollCopyText, readFreeRollNumber, rollFree,
  type GuideRoll,
} from './playDice'
import { RollOutcome } from './RollOutcome'

/**
 * Um número do rolador livre: o campo de texto (o type number recusa o sinal digitado; o inputMode
 * mantém o teclado numérico) entre o "−" e o "+", que dão conta do sinal no celular.
 */
function Stepper({ id, label, text, value, min, max, onText }: {
  id: string
  label: string
  text: string
  /** O valor que vale agora (o texto lido e preso entre `min` e `max`). */
  value: number
  min: number
  max: number
  onText: (text: string) => void
}) {
  const button = 'w-10 min-h-10 shrink-0 rounded-lg border border-parchment-800 text-parchment-300 hover:border-parchment-600 disabled:opacity-30'
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[11px] text-parchment-500">{label}</label>
      <div className="mt-0.5 flex gap-1">
        <button onClick={() => onText(String(value - 1))} disabled={value <= min} aria-label={`Diminuir ${label.toLowerCase()}`} className={button}>
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={e => onText(e.target.value)}
          className="w-full min-w-0 min-h-10 rounded-lg border border-parchment-800 bg-surface-base px-2 text-center text-sm text-parchment-100 outline-none focus:border-gold-600"
        />
        <button onClick={() => onText(String(value + 1))} disabled={value >= max} aria-label={`Aumentar ${label.toLowerCase()}`} className={button}>
          +
        </button>
      </div>
    </div>
  )
}

/**
 * O rolador livre (Fase 1): d4 a d100, quantidade e modificador, para a jogada que a ficha não tem
 * (o d4 da Bênção, uma poção, a tabela do Mestre). Só existe com os dados do app ligados; cada
 * rolagem vai ao histórico como as outras do app (`logRoll`: fora do desfazer), e o resultado é o
 * mesmo das receitas, com o "Copiar resultado".
 */
export function FreeRoller() {
  const logRoll = usePlayStore(s => s.logRoll)
  const [sides, setSides] = useState<number>(20)
  const [countText, setCountText] = useState('1')
  const [modifierText, setModifierText] = useState('0')
  const [result, setResult] = useState<(GuideRoll & { formula: string }) | null>(null)
  const free = {
    count: readFreeRollNumber(countText, 1, MAX_DICE, 1),
    sides,
    modifier: readFreeRollNumber(modifierText, -FREE_ROLL_MAX_MODIFIER, FREE_ROLL_MAX_MODIFIER, 0),
  }
  const formula = formatFreeRoll(free)

  function rollIt() {
    const rolled = rollFree(free)
    logRoll(rolled.record)
    setResult({ ...rolled, formula })
    // O campo mostra o que foi rolado: "0" virou 1, "500" virou o teto.
    setCountText(String(free.count))
    setModifierText(String(free.modifier))
  }

  return (
    <div className="rounded-xl border border-parchment-900 bg-surface-raised p-3">
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Dado">
        {FREE_ROLL_DICE.map(d => (
          <button
            key={d}
            onClick={() => setSides(d)}
            aria-pressed={sides === d}
            className={[
              'min-h-10 min-w-0 rounded-lg border px-0.5 text-xs sm:text-sm transition-colors',
              sides === d ? 'border-gold-500 bg-gold-900 text-gold-300' : 'border-parchment-800 text-parchment-300 hover:border-parchment-600',
            ].join(' ')}
          >
            d{d}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stepper id="free-roll-count" label="Quantidade" text={countText} value={free.count} min={1} max={MAX_DICE} onText={setCountText} />
        <Stepper
          id="free-roll-modifier"
          label="Modificador"
          text={modifierText}
          value={free.modifier}
          min={-FREE_ROLL_MAX_MODIFIER}
          max={FREE_ROLL_MAX_MODIFIER}
          onText={setModifierText}
        />
      </div>
      <button
        onClick={rollIt}
        className="mt-3 min-h-10 w-full rounded-lg border border-parchment-800 text-sm text-parchment-200 hover:border-parchment-600 transition-colors"
      >
        Rolar {formula}
      </button>
      {/* A região viva existe antes da primeira rolagem: o leitor de tela anuncia cada resultado. */}
      <div aria-live="polite">
        {result && (
          <RollOutcome
            key={result.record.id}
            record={result.record}
            natural={result.natural}
            copyText={formatRollCopyText({ label: 'Rolagem livre', formula: result.formula, record: result.record })}
          />
        )}
      </div>
    </div>
  )
}
