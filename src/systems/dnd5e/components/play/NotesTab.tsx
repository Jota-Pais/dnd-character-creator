import { useCallback, useEffect, useRef, useState } from 'react'
import { keptFaces, type RollRecord } from '../../../../core/dice'
import { formatModifier } from '../../utils/abilityScoreUtils'
import { setNote } from '../../utils/playState'
import type { PlayTabProps } from './usePlayView'

/** Quanto esperar sem digitar antes de gravar a nota: cada pausa vira um passo do desfazer. */
const NOTE_SAVE_DELAY_MS = 800

/** Quantas rolagens o histórico mostra (o estado guarda até 100). */
const HISTORY_SHOWN = 30

/** O d20 natural de uma rolagem de d20 (o que ficou, na vantagem), ou null. */
function d20Natural(record: RollRecord): number | null {
  const first = record.terms[0]
  if (!first || first.term.sides !== 20) return null
  return keptFaces(first)[0] ?? null
}

function RollHistory({ rolls }: { rolls: RollRecord[] }) {
  const recent = [...rolls].reverse().slice(0, HISTORY_SHOWN)
  if (recent.length === 0) {
    return <p className="text-xs text-parchment-500">Nenhuma rolagem ainda. Use o "Rolar" da receita de uma jogada.</p>
  }
  return (
    <ul className="divide-y divide-parchment-900" data-testid="roll-history">
      {recent.map(r => {
        const natural = d20Natural(r)
        const faces = r.terms.flatMap(t => t.dice)
        return (
          <li key={r.id} className="flex items-center gap-3 py-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-parchment-200 truncate">{r.label ?? r.notation}</p>
              <p className="text-[11px] text-parchment-600">
                {faces.map((d, i) => (
                  <span key={i} className={d.kept ? '' : 'line-through'}>{i > 0 ? ', ' : ''}{d.value}</span>
                ))}
                {r.modifierTotal !== 0 && <> ({formatModifier(r.modifierTotal)})</>}
                {' · '}
                {new Date(r.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {natural === 20 && <span className="text-xs font-bold text-gold-300">20 natural</span>}
            {natural === 1 && <span className="text-xs font-bold text-red-400">1 natural</span>}
            <span className="w-10 text-right font-fantasy font-bold text-lg text-parchment-100">{r.total}</span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Aba "Notas": a anotação livre da sessão, gravada sozinha numa pausa da digitação (e ao sair do
 * campo), sem travar quem digita; e, só com os dados do app ligados, o histórico curto das
 * rolagens, das mais recentes para as mais antigas, com o 20 e o 1 naturais em destaque.
 */
export function NotesTab({ state, appDice, run }: PlayTabProps) {
  // O texto em edição ainda não gravado; null mostra o do estado (e acompanha o desfazer).
  const [pending, setPending] = useState<string | null>(null)
  const latest = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const text = latest.current
    if (text === null) return
    latest.current = null
    run(st => setNote(st, text))
    setPending(p => (p === text ? null : p))
  }, [run])

  // Trocar de aba ou sair do jogo não perde o que foi digitado.
  useEffect(() => flush, [flush])

  function handleChange(text: string) {
    setPending(text)
    latest.current = text
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(flush, NOTE_SAVE_DELAY_MS)
  }

  return (
    <div className="space-y-5">
      <section>
        <label htmlFor="play-note" className="block text-[11px] uppercase tracking-wider text-parchment-600 font-fantasy mb-1.5">
          Anotações da sessão
        </label>
        <textarea
          id="play-note"
          value={pending ?? state.note}
          onChange={e => handleChange(e.target.value)}
          onBlur={flush}
          rows={8}
          placeholder="Nomes, pistas, o que o Mestre disse, o ouro que sobrou…"
          className="w-full rounded-xl border border-parchment-800 bg-surface-raised p-3 text-sm text-parchment-100 placeholder:text-parchment-700 outline-none focus:border-gold-600"
        />
        <p className="text-[11px] text-parchment-600">Grava sozinha enquanto você escreve.</p>
      </section>

      {appDice && (
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-parchment-600 font-fantasy mb-1.5">Rolagens recentes</h2>
          <RollHistory rolls={state.rolls} />
        </section>
      )}
    </div>
  )
}
