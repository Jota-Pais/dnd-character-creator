import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { registerPendingEdit } from '../../stores/playStore'
import type { ConditionId } from '@rpg/rules/systems/dnd5e/types/condition'
import { CONDITION_NOTE_MAX_LENGTH } from '@rpg/rules/systems/dnd5e/types/playState'
import {
  addCondition, getPlayConditionEffects, isAtZeroHp, removeCondition, setConditionNote, standUp,
} from '@rpg/rules/systems/dnd5e/utils/playState'
import { CONDITIONS, getCondition } from '@rpg/rules/systems/dnd5e/utils/sheetEffects'
import type { PlayTabProps } from './usePlayView'

const names = (ids: ConditionId[]) => ids.map(id => getCondition(id)?.name ?? id).join(', ')

/** O desenho do liga/desliga (só visual; quem tem o papel de switch é o botão em volta). */
function SwitchTrack({ on, muted }: { on: boolean; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        'relative inline-block w-9 h-5 shrink-0 rounded-full border transition-colors',
        on ? (muted ? 'border-parchment-700 bg-parchment-800' : 'border-red-700 bg-red-900') : 'border-parchment-800 bg-surface-base',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all',
          on ? 'left-4.5 bg-parchment-200' : 'left-0.5 bg-parchment-600',
        ].join(' ')}
      />
    </span>
  )
}

/**
 * A nota de duração de uma condição gravada ("até o fim do próximo turno do mago"). O app não
 * conta tempo: é só um lembrete. Grava ao sair do campo ou no Enter, para cada letra não virar
 * um passo do desfazer — e também ao trocar de aba, sair do jogo ou a página sumir (no celular,
 * tocar num botão nem sempre tira o foco do campo).
 */
function ConditionNote({ id, name, stored, run }: {
  id: ConditionId
  name: string
  stored: string
  run: PlayTabProps['run']
}) {
  // null = sem edição em curso: mostra o que está gravado (e acompanha o desfazer).
  const [text, setText] = useState<string | null>(null)
  const pending = useRef<string | null>(null)
  const value = text ?? stored

  const flush = useCallback(() => {
    const typed = pending.current
    if (typed === null) return
    pending.current = null
    // Em segundo plano (não apaga o aviso da última ação). Se a condição saiu enquanto o texto
    // estava pendente, a nota vai junto com ela: nada a gravar.
    run(st => (st.conditions.includes(id) ? setConditionNote(st, id, typed) : { state: st, notices: [] }), { background: true })
  }, [id, run])

  useEffect(() => {
    const unregister = registerPendingEdit(flush)
    return () => {
      unregister()
      flush()
    }
  }, [flush])

  function handleChange(typed: string) {
    pending.current = typed
    setText(typed)
  }

  function commit() {
    flush()
    setText(null)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    commit()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 pl-12">
      <input
        type="text"
        value={value}
        maxLength={CONDITION_NOTE_MAX_LENGTH}
        onChange={e => handleChange(e.target.value)}
        onBlur={commit}
        aria-label={`Duração de ${name} (opcional)`}
        placeholder="Duração (opcional): até o fim do próximo turno…"
        className="min-h-10 w-full rounded-lg border border-parchment-900 bg-surface-base px-3 text-sm text-parchment-200 placeholder:text-parchment-600 outline-none focus:border-gold-700"
      />
    </form>
  )
}

/**
 * As 14 condições do Apêndice A como liga/desliga, com o texto da regra a um toque. As derivadas
 * (Incapacitado por Paralisado, Inconsciente dos 0 PV) aparecem marcadas "por causa de X", sem
 * toggle próprio: saem junto com a origem. Cada condição gravada leva uma nota de duração
 * opcional; o Caído tem o "Levantar" (que confere o deslocamento, págs. 192-193).
 */
export function ConditionsSection({ state, run }: PlayTabProps) {
  const [openRule, setOpenRule] = useState<ConditionId | null>(null)
  const effective = getPlayConditionEffects(state).conditions
  const atZero = isAtZeroHp(state)
  // O switch e o "regra" de cada linha: recebem o foco quando o controle em que ele estava some
  // com a própria ação. Síncrono (flushSync): a tela já sem ele.
  const switches = useRef(new Map<ConditionId, HTMLButtonElement | null>())
  const ruleButtons = useRef(new Map<ConditionId, HTMLButtonElement | null>())

  // Desligar a condição que outra também dá (o Incapacitado com o Paralisado ligado) a deixa só
  // derivada, sem switch: o foco vai ao "regra" da mesma linha.
  function toggle(id: ConditionId, recorded: boolean) {
    flushSync(() => run(st => (recorded ? removeCondition(st, id) : addCondition(st, id))))
    if (!switches.current.get(id)) ruleButtons.current.get(id)?.focus()
  }

  // O "Levantar" some com o Caído: o foco vai ao switch dele (ou, só derivado, ao "regra").
  // Recusado (o aviso diz por quê), o foco fica.
  function standUpFrom(id: ConditionId) {
    const result = flushSync(() => run((st, sh) => standUp(st, sh)))
    if (result && !result.state.conditions.includes(id)) (switches.current.get(id) ?? ruleButtons.current.get(id))?.focus()
  }

  // Do md para cima, duas colunas lidas de cima para baixo. Em grade (não `columns`): abrir a
  // regra de uma condição só estica a linha dela, sem mandar condições de uma coluna para a outra.
  return (
    <ul
      className="divide-y divide-parchment-900 md:grid md:grid-cols-2 md:grid-flow-col md:gap-x-6"
      style={{ gridTemplateRows: `repeat(${Math.ceil(CONDITIONS.length / 2)}, auto)` }}
    >
      {CONDITIONS.map(cond => {
        const recorded = state.conditions.includes(cond.id)
        const eff = effective.find(c => c.id === cond.id)
        const fromZeroHp = cond.id === 'unconscious' && atZero && !recorded
        const derivedOnly = !recorded && eff !== undefined
        const because = fromZeroHp
          ? 'por causa dos 0 PV'
          : eff && eff.impliedBy.length > 0 ? `${recorded ? 'também ' : ''}por causa de ${names(eff.impliedBy)}` : null
        const ruleOpen = openRule === cond.id

        return (
          <li key={cond.id} className="py-1.5 md:border-b md:border-parchment-900" data-testid={`condition-${cond.id}`}>
            <div className="flex items-center gap-2">
              {derivedOnly ? (
                <div className="flex-1 min-w-0 flex items-center gap-3 min-h-10">
                  <SwitchTrack on muted />
                  <span className="text-sm text-parchment-300">{cond.name}</span>
                </div>
              ) : (
                <button
                  ref={el => { switches.current.set(cond.id, el) }}
                  role="switch"
                  aria-checked={recorded}
                  onClick={() => toggle(cond.id, recorded)}
                  className="flex-1 min-w-0 flex items-center gap-3 min-h-10 text-left"
                >
                  <SwitchTrack on={recorded} />
                  <span className={`text-sm ${recorded ? 'text-red-200' : 'text-parchment-300'}`}>{cond.name}</span>
                </button>
              )}
              <button
                ref={el => { ruleButtons.current.set(cond.id, el) }}
                onClick={() => setOpenRule(ruleOpen ? null : cond.id)}
                aria-expanded={ruleOpen}
                aria-label={`Regra de ${cond.name}`}
                className="min-h-10 px-2 shrink-0 text-xs text-parchment-500 hover:text-parchment-200"
              >
                regra {ruleOpen ? '▴' : '▾'}
              </button>
            </div>

            {(because || eff?.suspendedBy) && (
              <p className="pl-12 text-[11px] text-parchment-500 leading-snug">
                {because}
                {because && eff?.suspendedBy && ' · '}
                {eff?.suspendedBy && `suspensa enquanto durar ${names(eff.suspendedBy)}`}
              </p>
            )}

            {ruleOpen && (
              <div className="mt-1 ml-12 rounded-lg border border-parchment-900 bg-surface-raised p-2.5">
                <ul className="space-y-1">
                  {cond.text.map((t, i) => <li key={i} className="text-xs text-parchment-300 leading-snug">• {t}</li>)}
                </ul>
                <p className="mt-1 text-[10px] text-parchment-600">PHB, pág. {cond.page}</p>
              </div>
            )}

            {recorded && cond.id === 'prone' && (
              <div className="pl-12">
                <button
                  onClick={() => standUpFrom(cond.id)}
                  className="mt-1 min-h-10 rounded-lg border border-parchment-700 px-3 text-sm text-parchment-200 hover:border-gold-600"
                >
                  Levantar
                </button>
              </div>
            )}
            {recorded && (
              <ConditionNote id={cond.id} name={cond.name} stored={state.conditionNotes?.[cond.id] ?? ''} run={run} />
            )}
          </li>
        )
      })}
    </ul>
  )
}
