import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { keptFaces, type RollRecord } from '@rpg/rules/core/dice'
import { registerPendingEdit, usePlayStore } from '../../stores/playStore'
import { formatModifier } from '@rpg/rules/systems/dnd5e/utils/abilityScoreUtils'
import { setNote } from '@rpg/rules/systems/dnd5e/utils/playState'
import { FreeRoller } from './FreeRoller'
import type { PlayTabProps } from './usePlayView'

/** Quanto esperar sem digitar antes de gravar a nota: cada pausa vira um passo do desfazer. */
const NOTE_SAVE_DELAY_MS = 800

/** Quantas rolagens o histórico mostra (o estado guarda até 100). */
const HISTORY_SHOWN = 30

/**
 * O d20 natural de uma rolagem de d20 (o que ficou, na vantagem), ou null. Vários d20 que valem
 * todos (o 3d20 do rolador livre) não têm um natural.
 */
function d20Natural(record: RollRecord): number | null {
  const first = record.terms[0]
  if (!first || first.term.sides !== 20) return null
  const kept = keptFaces(first)
  return kept.length === 1 ? kept[0] : null
}

function RollHistory({ rolls }: { rolls: RollRecord[] }) {
  const recent = [...rolls].reverse().slice(0, HISTORY_SHOWN)
  if (recent.length === 0) {
    return <p className="text-xs text-parchment-500">Nenhuma rolagem ainda. Use o "Rolar" da receita de uma jogada ou o rolador livre.</p>
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
 * campo), sem travar quem digita; e, só com os dados do app ligados, o rolador livre e o histórico
 * curto das rolagens, das mais recentes para as mais antigas, com o 20 e o 1 naturais em destaque
 * e o "Nova sessão", que o esvazia.
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
    // Em segundo plano: o autosave não apaga o aviso da última ação (a CD da concentração).
    run(st => setNote(st, text), { background: true })
    setPending(p => (p === text ? null : p))
  }, [run])

  // Trocar de aba, sair do jogo ou esconder a página não perde o que foi digitado: o playStore
  // chama o flush ao fechar e ao a tela sumir; o desmontar grava o que restar.
  useEffect(() => {
    const unregister = registerPendingEdit(flush)
    return () => {
      unregister()
      flush()
    }
  }, [flush])

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
          className="w-full rounded-xl border border-parchment-800 bg-surface-raised p-3 text-sm text-parchment-100 placeholder:text-parchment-600 outline-none focus:border-gold-600"
        />
        <p className="text-[11px] text-parchment-600">Grava sozinha enquanto você escreve.</p>
      </section>

      {appDice && (
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-parchment-600 font-fantasy mb-1.5">Rolador livre</h2>
          <FreeRoller />
        </section>
      )}

      {appDice && (
        <section>
          <RollHistoryHeader count={state.rolls.length} />
          <RollHistory rolls={state.rolls} />
        </section>
      )}
    </div>
  )
}

/**
 * O título do histórico com o "Nova sessão" (decisão 10.2.20), que esvazia o histórico e só ele.
 * O histórico fica fora do desfazer (`clearRolls`), então apagar pede confirmação ali mesmo, no
 * padrão dos descansos. O foco nunca cai no body: abrir a pergunta leva ao "Cancelar" (a saída
 * segura), cancelar volta ao "Nova sessão" e apagar vai ao título, porque o botão some com as
 * rolagens.
 */
function RollHistoryHeader({ count }: { count: number }) {
  const clearRolls = usePlayStore(s => s.clearRolls)
  const [asking, setAsking] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const newSessionRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  function ask() {
    flushSync(() => setAsking(true))
    cancelRef.current?.focus()
  }
  function cancel() {
    flushSync(() => setAsking(false))
    newSessionRef.current?.focus()
  }
  function confirm() {
    flushSync(() => {
      clearRolls()
      setAsking(false)
    })
    titleRef.current?.focus()
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h2 ref={titleRef} tabIndex={-1} className="text-[11px] uppercase tracking-wider text-parchment-600 font-fantasy">
          Rolagens recentes
        </h2>
        {count > 0 && !asking && (
          <button
            ref={newSessionRef}
            onClick={ask}
            className="min-h-10 rounded-lg border border-parchment-700 px-3 text-xs text-parchment-200 hover:border-gold-600"
          >
            Nova sessão
          </button>
        )}
      </div>
      {asking && (
        <div role="group" aria-labelledby="new-session-question" className="mb-3 rounded-xl border border-parchment-800 bg-surface-raised p-3">
          <p id="new-session-question" className="text-sm text-parchment-200 leading-snug">
            Começar uma nova sessão apaga {count === 1 ? 'a rolagem' : `as ${count} rolagens`} do histórico. PV, espaços,
            condições e anotações ficam como estão.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={confirm}
              className="min-h-10 rounded-lg border border-red-800 px-3 text-xs text-red-200 hover:border-red-600"
            >
              Apagar o histórico
            </button>
            <button
              ref={cancelRef}
              onClick={cancel}
              className="min-h-10 rounded-lg px-3 text-xs text-parchment-500 hover:text-parchment-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
