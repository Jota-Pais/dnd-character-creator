import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import type { RollRecord } from '../../../../core/dice'
import { usePlayStore, type ShortRestSpend } from '../../stores/playStore'
import type { PlayNotice, PlaySheet, PlayState } from '../../types/playState'
import {
  completeShortRest, getCurrentHp, getEffectiveMaxHp, getHitDiceAvailable, getShortRestSlotRecovery, isAtZeroHp,
  previewShortRest, recordRoll, spendHitDie,
} from '../../utils/playState'
import type { RollGuideEntry } from '../../utils/rollGuide'
import { countLabel, pluralize } from '../../utils/textUtils'
import { ChangeAnnouncer } from './ChangeAnnouncer'
import { rollGuideEntry } from './playDice'
import type { PlayTabProps } from './usePlayView'

type Simulation = { state: PlayState; lines: string[]; warnings: string[]; refused: string | null }

const isRefused = (notices: PlayNotice[]) => notices.some(n => n.kind === 'refused')

/**
 * Aplica o rascunho ao estado atual, só para mostrar (nada é gravado): a conta de cada dado, o PV
 * parcial e o que ainda resta. Para no primeiro dado recusado.
 */
function simulate(state: PlayState, sheet: PlaySheet, spends: ShortRestSpend[]): Simulation {
  let current = state
  const lines: string[] = []
  const warnings: string[] = []
  for (const s of spends) {
    const r = spendHitDie(current, sheet, { die: s.die, value: s.value })
    const refusal = r.notices.find(n => n.kind === 'refused')
    if (refusal) return { state: current, lines, warnings, refused: refusal.text }
    current = r.state
    for (const n of r.notices) {
      if (n.kind === 'hitDie') lines.push(n.text)
      else if (n.kind === 'warning' && !warnings.includes(n.text)) warnings.push(n.text)
    }
  }
  return { state: current, lines, warnings, refused: null }
}

/**
 * O campo de um tipo de Dado de Vida: a face tirada (digitada, ou "rolar" com os dados do app). A
 * linha do dado (`lineRef`) recebe o foco quando o campo e o "Gastar" somem (tabIndex -1).
 */
function HitDieInput({ die, available, entry, appDice, onAdd, lineRef }: {
  die: number
  available: number
  entry: RollGuideEntry | undefined
  appDice: boolean
  onAdd: (value: number, record: RollRecord | null) => boolean
  lineRef: (el: HTMLParagraphElement | null) => void
}) {
  const [text, setText] = useState('')
  const [rolled, setRolled] = useState<RollRecord | null>(null)
  const value = /^\d+$/.test(text.trim()) ? Number(text.trim()) : null
  const valid = value !== null && value >= 1 && value <= die

  function handleRoll() {
    if (!entry) return
    const { record } = rollGuideEntry(entry)
    setRolled(record)
    setText(String(record.terms[0]?.dice[0]?.value ?? ''))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const record = rolled && rolled.terms[0]?.dice[0]?.value === value ? rolled : null
    if (onAdd(value, record)) {
      setText('')
      setRolled(null)
    }
  }

  return (
    <li className="py-2">
      <p ref={lineRef} tabIndex={-1} className="text-sm text-parchment-200">
        d{die}: <span className="font-fantasy font-bold">{available}</span> {pluralize(available, 'disponível', 'disponíveis')}
        {entry && <span className="ml-1.5 text-xs text-parchment-500">cada um cura {entry.formula}</span>}
      </p>
      {entry?.notes.map((n, i) => <p key={i} className="text-[11px] text-parchment-500 leading-snug">{n}</p>)}
      {available > 0 && (
        <form onSubmit={handleSubmit} className="mt-1.5 flex flex-wrap gap-2">
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={1}
            max={die}
            value={text}
            onChange={e => { setText(e.target.value); setRolled(null) }}
            aria-label={`Quanto tirou no d${die}`}
            placeholder={`d${die}`}
            className="min-h-10 w-24 rounded-lg border border-parchment-800 bg-surface-base px-3 text-lg text-parchment-100 outline-none focus:border-gold-600"
          />
          {appDice && entry && (
            <button
              type="button"
              onClick={handleRoll}
              className="min-h-10 rounded-lg border border-parchment-800 px-3 text-sm text-parchment-400 hover:text-parchment-200"
            >
              rolar
            </button>
          )}
          {/* aria-disabled, não disabled: gastar esvazia o campo, e o botão desabilitado largaria o
              foco de quem o acionou no body. Sem face válida, o envio não faz nada. */}
          <button
            type="submit"
            aria-disabled={!valid}
            className="min-h-10 rounded-lg border border-gold-700 px-3 text-sm text-gold-300 aria-disabled:opacity-40 hover:border-gold-500"
          >
            Gastar d{die}
          </button>
        </form>
      )}
      {/* A região viva existe antes do aviso: inserida já com o texto, pode não ser anunciada. */}
      <div aria-live="polite">
        {available > 0 && text.trim() !== '' && !valid && (
          <p className="mt-1 text-[11px] text-red-300 leading-snug">
            Digite só o que saiu no d{die} (1 a {die}); o app soma o modificador de Constituição.
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * Descanso curto (pág. 188) num rascunho, como pede `regras-descanso.md` (6.2): o jogador gasta os
 * Dados de Vida um a um, vê a conta e o PV parcial, pode desfazer o último dado, e nada é gravado
 * até o "Concluir" — que aplica tudo (dados, Pacto, recursos de recarga curta) numa operação só,
 * com um passo só no desfazer geral. Cancelar descarta o rascunho. O rascunho mora no playStore
 * (`shortRestDraft`): trocar de aba no meio do descanso não perde os dados já gastos.
 */
export function ShortRestPanel({ view, onClose }: { view: PlayTabProps; onClose: () => void }) {
  const { state, sheet, guide, appDice, run } = view
  const spends = usePlayStore(s => s.shortRestDraft)
  const setSpends = usePlayStore(s => s.setShortRestDraft)
  const [error, setError] = useState<string | null>(null)

  const sim = simulate(state, sheet, spends)
  const preview = previewShortRest(state, sheet)
  // Recuperação Arcana (e afins) com uso: só o lembrete; a escolha é nas bolinhas da aba Magia.
  const slotRecovery = getShortRestSlotRecovery(state, sheet)
  const pool = getHitDiceAvailable(sim.state, sheet)
  const hpBefore = getCurrentHp(state, sheet)
  const hpAfter = getCurrentHp(sim.state, sheet)
  // A 0 PV não se gastam Dados de Vida (decisão de 2026-10-25): o texto vem da própria recusa.
  const blocked = isAtZeroHp(state) && sheet.hitDice[0]
    ? spendHitDie(state, sheet, { die: sheet.hitDice[0].die, value: 1 }).notices.find(n => n.kind === 'refused')?.text ?? null
    : null
  const comesBack = [
    ...(preview.pactSlots > 0 ? [countLabel(preview.pactSlots, 'espaço de Pacto', 'espaços de Pacto')] : []),
    ...preview.resources.map(r => r.name),
  ]

  // A linha de cada tipo de dado ("d12: 0 disponíveis"): o foco vai a ela quando o controle em
  // que estava some. Síncrono (flushSync): a tela já sem ele.
  const dieLines = useRef(new Map<number, HTMLParagraphElement | null>())

  function add(die: number, value: number, record: RollRecord | null): boolean {
    const next = [...spends, { die, value, record }]
    const trial = simulate(state, sheet, next)
    if (trial.refused) {
      setError(trial.refused)
      return false
    }
    flushSync(() => {
      setSpends(next)
      setError(null)
    })
    // O último dado do tipo: o campo e o "Gastar" somem.
    if (getHitDiceAvailable(trial.state, sheet).find(p => p.die === die)?.available === 0) dieLines.current.get(die)?.focus()
    return true
  }

  // O rascunho de um dado só: desfazê-lo tira o bloco do rascunho, com o botão. O foco vai à linha
  // do dado que voltou.
  function undoLastDie() {
    const last = spends.at(-1)
    flushSync(() => {
      setSpends(spends.slice(0, -1))
      setError(null)
    })
    if (last && spends.length === 1) dieLines.current.get(last.die)?.focus()
  }

  function confirm() {
    const result = run((st, sh) => {
      let current = st
      const notices: PlayNotice[] = []
      for (const s of spends) {
        const r = spendHitDie(current, sh, { die: s.die, value: s.value })
        if (isRefused(r.notices)) return { state: st, notices: r.notices }
        current = s.record ? recordRoll(r.state, s.record).state : r.state
        // A conta de cada dado o jogador já viu no rascunho: o aviso leva só o resumo (abaixo) e
        // os alertas, uma vez cada.
        for (const n of r.notices) {
          if (n.kind === 'hitDie' || n.kind === 'healed') continue
          if (!notices.some(m => m.kind === n.kind && m.text === n.text)) notices.push(n)
        }
      }
      if (spends.length > 0) {
        const before = getCurrentHp(st, sh)
        const after = getCurrentHp(current, sh)
        notices.unshift({
          kind: 'healed',
          text: `${countLabel(spends.length, 'Dado de Vida', 'Dados de Vida')}: +${after - before} PV (${before} → ${after}).`,
        })
      }
      const rest = completeShortRest(current, sh, { hitDiceSpent: spends.length })
      if (isRefused(rest.notices)) return { state: st, notices: rest.notices }
      const all = [...notices, ...rest.notices]
      return { state: rest.state, notices: all.length > 0 ? all : [{ kind: 'info', text: 'Descanso curto concluído.' }] }
    })
    if (result && !isRefused(result.notices)) onClose()
  }

  return (
    <div className="rounded-xl border border-parchment-800 bg-surface-raised p-3 space-y-3" aria-label="Descanso curto" role="group">
      <p className="text-xs text-parchment-400 leading-snug">
        Pelo menos 1 hora sem atividade extenuante (pág. 188). Gaste os Dados de Vida que quiser, um de cada vez, e conclua quando o descanso terminar.
      </p>

      <p className="text-sm text-parchment-300">
        Ao concluir, voltam: {comesBack.length > 0 ? comesBack.join(', ') : 'nada além do que os Dados de Vida curarem'}.
      </p>

      {slotRecovery.map(r => (
        <p key={r.id} className="rounded-lg border border-sky-900 bg-sky-950/30 px-3 py-2 text-xs text-sky-200 leading-snug" data-testid="slot-recovery">
          {r.text}
        </p>
      ))}

      {blocked ? (
        <p className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-200">{blocked}</p>
      ) : (
        <ul className="divide-y divide-parchment-900">
          {pool.map(p => (
            <HitDieInput
              key={p.die}
              die={p.die}
              available={p.available}
              entry={guide.hitDice.find(e => e.id === `hit-die:${p.die}`)}
              appDice={appDice}
              onAdd={(value, record) => add(p.die, value, record)}
              lineRef={el => { dieLines.current.set(p.die, el) }}
            />
          ))}
        </ul>
      )}

      {(error || sim.refused) && (
        <p className="text-sm text-red-300" role="alert">{error ?? sim.refused}</p>
      )}

      {/* O rascunho não grava nada (nem aviso): a conta do último dado e o PV parcial são anunciados. */}
      <ChangeAnnouncer
        text={spends.length > 0 ? `${sim.lines.at(-1) ?? ''} PV: ${hpBefore} → ${hpAfter} de ${getEffectiveMaxHp(sim.state, sheet)}.` : ''}
      />
      {spends.length > 0 && (
        <div className="rounded-lg border border-parchment-900 p-2.5" data-testid="short-rest-draft">
          <ul className="space-y-0.5">
            {sim.lines.map((l, i) => <li key={i} className="text-sm text-parchment-200">{l}</li>)}
          </ul>
          {sim.warnings.map((w, i) => <p key={i} className="mt-1 text-[11px] text-amber-300 leading-snug">{w}</p>)}
          <p className="mt-1 text-sm text-parchment-300">
            PV: {hpBefore} → <span className="font-bold text-parchment-100">{hpAfter}</span> de {getEffectiveMaxHp(sim.state, sheet)}
          </p>
          <button
            onClick={undoLastDie}
            className="mt-1 min-h-10 text-xs text-parchment-400 underline hover:text-parchment-200"
          >
            Desfazer o último dado
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={confirm}
          disabled={sim.refused !== null}
          className="min-h-10 rounded-lg bg-gold-500 px-4 font-fantasy font-bold text-sm text-on-accent disabled:opacity-40 hover:bg-gold-400 transition-colors"
        >
          Concluir descanso curto
        </button>
        <button
          onClick={onClose}
          className="min-h-10 rounded-lg border border-parchment-700 px-4 text-sm text-parchment-300 hover:border-parchment-500"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
