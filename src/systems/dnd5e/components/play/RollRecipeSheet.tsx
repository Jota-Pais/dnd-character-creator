import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { usePlayStore } from '../../stores/playStore'
import type { RollMode } from '../../types/condition'
import { formatModifier } from '../../utils/abilityScoreUtils'
import { endConcentration, setInspiration } from '../../utils/playState'
import { withInspirationSpent, withTableMode, type RollGuideEntry } from '../../utils/rollGuide'
import { canRollEntry, describeRolledFormula, formatRollCopyText, rollGuideEntry, type GuideRoll } from './playDice'
import { PlayDialog } from './PlayDialog'
import { RollOutcome } from './RollOutcome'

const reasonLabels = (reasons: { label: string }[]) => reasons.map(r => r.label).join(', ')

const TABLE_MODES: { mode: RollMode; label: string; pressed: string }[] = [
  { mode: 'normal', label: 'Normal', pressed: 'border-parchment-500 bg-parchment-800 text-parchment-100' },
  { mode: 'advantage', label: 'Vantagem', pressed: 'border-emerald-600 bg-emerald-950 text-emerald-200' },
  { mode: 'disadvantage', label: 'Desvantagem', pressed: 'border-red-700 bg-red-950 text-red-200' },
]

/**
 * Normal / Vantagem / Desvantagem da mesa: a circunstância que a ficha não conhece (o Mestre, o
 * Ataque Descuidado, a ação Ajudar). Entra como mais uma fonte do modo (`withTableMode`), pela regra
 * da pág. 175; não é o modo final — as linhas logo abaixo dizem o que resultou.
 */
function TableModePicker({ value, onChange }: { value: RollMode; onChange: (mode: RollMode) => void }) {
  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Vantagem ou desvantagem da mesa">
        {TABLE_MODES.map(m => (
          <button
            key={m.mode}
            onClick={() => onChange(m.mode)}
            aria-pressed={value === m.mode}
            className={[
              'min-h-10 min-w-0 rounded-lg border px-1.5 text-xs sm:text-sm transition-colors',
              value === m.mode ? m.pressed : 'border-parchment-800 text-parchment-400 hover:border-parchment-600',
            ].join(' ')}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-parchment-600 leading-snug">
        O Mestre ou a cena dá vantagem ou impõe desvantagem? Marque aqui; a ficha junta com o que ela já sabe.
      </p>
    </div>
  )
}

/** Uma rolagem dos dados do app feita na folha, com a fórmula (e o modo) que valia nela. */
type SheetRoll = GuideRoll & { crit: boolean; formula: string }

/** Uma jogada ligada a esta, aberta de dentro da folha: o dano de um ataque. */
export type RecipeLink = { label: string; entry: RollGuideEntry }

/**
 * A "receita" de uma jogada: o que rolar e quanto somar, em letra grande, com o modo e os motivos,
 * a falha automática, as linhas condicionais e de onde vem cada parcela. O jogador rola os próprios
 * dados; com os dados do app ligados, um "Rolar" discreto rola pelo motor e grava no histórico.
 * Nas jogadas de d20, o Normal / Vantagem / Desvantagem da mesa vale só enquanto a folha está
 * aberta, e o "Rolar" usa o modo que resultou.
 *
 * O 20 e o 1 naturais só ganham destaque: num teste comum eles não decidem nada (pág. 174). No
 * ataque, a folha leva ao dano (`links`); com os dados do app, um natural a partir de
 * `critThreshold` abre o dano já como crítico. A folha de dano aberta com `crit` mostra e rola os
 * dados dobrados (pág. 198), com o "não foi crítico" para voltar ao normal.
 */
export function RollRecipeSheet({
  entry: baseEntry, appDice, onClose, onFocusAway, crit = false, links = [], critThreshold = 20, onOpenLink,
}: {
  entry: RollGuideEntry
  appDice: boolean
  onClose: () => void
  /** Quem abriu a folha sumiu com a ação dela (ver `PlayDialog`). */
  onFocusAway?: () => void
  /** Abrir já no modo crítico (só jogada de dano, que tem `entry.crit`). */
  crit?: boolean
  links?: RecipeLink[]
  /** A partir de que d20 natural o ataque é crítico. */
  critThreshold?: number
  onOpenLink?: (entry: RollGuideEntry, options: { crit: boolean }) => void
}) {
  const logRoll = usePlayStore(s => s.logRoll)
  const run = usePlayStore(s => s.run)
  const undo = usePlayStore(s => s.undo)
  const undoTop = usePlayStore(s => s.undoStack.at(-1))
  const concentrating = usePlayStore(s => s.state?.concentration != null)
  const inspired = usePlayStore(s => s.state?.inspiration === true)
  const [result, setResult] = useState<SheetRoll | null>(null)
  const [critMode, setCritMode] = useState(crit && baseEntry.crit !== undefined)
  // Inspiração gasta nesta folha (11.5): guarda o topo do desfazer logo depois do gasto, para o
  // "devolver" desfazer só ele. Se ela voltou por outro caminho (o desfazer geral), a folha volta
  // ao modo normal.
  const [inspirationSpent, setInspirationSpent] = useState<{ undoTop: unknown } | null>(null)
  const usingInspiration = inspirationSpent !== null && !inspired
  // A circunstância da mesa: só desta folha aberta, nunca gravada.
  const [tableMode, setTableMode] = useState<RollMode>('normal')
  const atTable = withTableMode(baseEntry, tableMode)
  const entry = usingInspiration ? withInspirationSpent(atTable) : atTable

  // O resultado sai abaixo do "Rolar", e num ataque o dano vem depois dele: no celular, os dois
  // podiam ficar abaixo da borda da folha, e o toque parecia não dar em nada. A cada rolagem, a
  // folha rola até o fim dela (o mínimo, se já está à vista).
  const sheetEndRef = useRef<HTMLDivElement>(null)
  const rolledId = result?.record.id
  useEffect(() => {
    if (rolledId === undefined) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    sheetEndRef.current?.scrollIntoView?.({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [rolledId])

  function rollIt(asCrit: boolean) {
    const rolled = rollGuideEntry(entry, { crit: asCrit })
    // Só o histórico: rolar não é um passo do desfazer nem apaga o aviso da última ação.
    logRoll(rolled.record)
    setResult({ ...rolled, crit: asCrit, formula: describeRolledFormula(entry, asCrit) })
  }

  // A folha fecha, e quem a abriu (o "Ver o que rolar" do aviso) some junto: o foco vai aonde a
  // tela disser (`onFocusAway`).
  function endFailedConcentration() {
    run(st => endConcentration(st))
    onClose()
  }

  // Os botões abaixo somem com a própria ação. Síncrono (flushSync), o foco vai ao que entra no
  // lugar (o "Usar" e o "Devolver" da inspiração trocam de lugar) ou à fórmula, o título da folha.
  const formulaRef = useRef<HTMLParagraphElement>(null)
  const inspireRef = useRef<HTMLButtonElement>(null)
  const returnRef = useRef<HTMLButtonElement>(null)

  function leaveCrit() {
    flushSync(() => {
      setCritMode(false)
      setResult(null)
    })
    formulaRef.current?.focus()
  }

  /** Gasta a Inspiração nesta jogada: um passo do desfazer, e o modo mostrado e rolado muda. */
  function spendInspiration() {
    flushSync(() => {
      const r = run(st => setInspiration(st, false))
      if (!r || r.state.inspiration) return
      setInspirationSpent({ undoTop: usePlayStore.getState().undoStack.at(-1) })
      setResult(null)
    })
    // Recusado, o "Usar" fica, e o foco também.
    returnRef.current?.focus()
  }

  /** Devolve a Inspiração gasta aqui, desfazendo o gasto (só se ele ainda é o último passo). */
  function returnInspiration() {
    flushSync(() => {
      if (inspirationSpent && undoTop === inspirationSpent.undoTop) undo()
      setInspirationSpent(null)
      setResult(null)
    })
    ;(inspireRef.current ?? formulaRef.current)?.focus()
  }

  /** Outra circunstância da mesa: o resultado anterior saiu com o modo de antes e some. */
  function chooseTableMode(mode: RollMode) {
    setTableMode(mode)
    if (mode !== tableMode) setResult(null)
  }

  const titleId = `recipe-${entry.id}`
  const isD20 = entry.kind === 'd20'
  const canceled = entry.mode === 'normal' && entry.advantage.length > 0 && entry.disadvantage.length > 0
  const shown = critMode && entry.crit ? entry.crit : { formula: entry.formula, dice: entry.dice }
  // O ataque rolado pelo app deu crítico: o dano abre com os dados dobrados.
  const critHit = isD20 && result !== null && result.natural !== null && result.natural >= critThreshold
  // 1 natural num ataque: erra, qualquer que seja o total (pág. 196). Sem oferta de dano.
  const autoMiss = isD20 && entry.attackRoll === true && result !== null && result.natural === 1
  // O TR de concentração rolado pelo app não passou: o "encerrar" fica na própria folha.
  const failedConcentration = entry.id === 'concentration' && concentrating && result !== null
    && entry.dc !== undefined && (entry.autoFail.length > 0 || result.record.total < entry.dc)

  return (
    <PlayDialog title={entry.label} titleId={titleId} onClose={onClose} onFocusAway={onFocusAway}>
      <p ref={formulaRef} tabIndex={-1} className="mt-2 font-fantasy font-bold text-3xl text-gold-300" data-testid="recipe-formula">
        {shown.formula}
      </p>

      {critMode && (
        <div className="mt-2 rounded-lg border border-gold-800 bg-gold-900/30 px-3 py-2 text-sm text-gold-300">
          <p>Acerto crítico: os dados de dano dobram, o modificador não (pág. 198).</p>
          {entry.crit?.notes?.map((n, i) => (
            <p key={i} className="mt-1 text-xs text-parchment-100" data-testid="crit-note">• {n}</p>
          ))}
          <button onClick={leaveCrit} className="mt-1 min-h-10 text-xs text-parchment-400 underline hover:text-parchment-200">
            Não foi crítico
          </button>
        </div>
      )}

      {isD20 && <TableModePicker value={tableMode} onChange={chooseTableMode} />}

      {entry.mode === 'advantage' && (
        <p className="mt-2 text-sm text-emerald-300">
          Com vantagem: role dois d20 e fique com o maior. <span className="text-parchment-500">({reasonLabels(entry.advantage)})</span>
        </p>
      )}
      {entry.mode === 'disadvantage' && (
        <p className="mt-2 text-sm text-red-300">
          Com desvantagem: role dois d20 e fique com o menor. <span className="text-parchment-500">({reasonLabels(entry.disadvantage)})</span>
        </p>
      )}
      {canceled && (
        <p className="mt-2 text-sm text-parchment-400">
          Vantagem ({reasonLabels(entry.advantage)}) e desvantagem ({reasonLabels(entry.disadvantage)}) se anulam: role um d20 só.
        </p>
      )}
      {isD20 && inspired && !usingInspiration && (
        <button
          ref={inspireRef}
          onClick={spendInspiration}
          className="mt-2 min-h-10 rounded-lg border border-gold-700 px-3 text-sm text-gold-300 hover:border-gold-500"
        >
          ★ Usar inspiração
        </button>
      )}
      {usingInspiration && inspirationSpent && undoTop === inspirationSpent.undoTop && (
        <button
          ref={returnRef}
          onClick={returnInspiration}
          className="mt-1 min-h-10 text-xs text-parchment-400 underline hover:text-parchment-200"
        >
          Devolver a inspiração
        </button>
      )}
      {entry.autoFail.length > 0 && (
        <p className="mt-2 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          Falha automática ({reasonLabels(entry.autoFail)}).
        </p>
      )}
      {entry.dc !== undefined && (
        <p className="mt-2 text-sm text-parchment-300">CD {entry.dc}: o total precisa ser {entry.dc} ou mais.</p>
      )}
      {entry.crit && !critMode && (
        <p className="mt-2 text-sm text-parchment-400">
          Acerto crítico: <span className="text-parchment-200">{entry.crit.formula}</span> (só os dados dobram).
        </p>
      )}

      {entry.notes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {entry.notes.map((n, i) => (
            <li key={i} className="text-xs text-parchment-400 leading-snug">• {n}</li>
          ))}
        </ul>
      )}

      {entry.breakdown.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wider text-parchment-600">De onde vem</p>
          <ul className="mt-1 divide-y divide-parchment-900">
            {shown.dice && (
              <li className="flex justify-between py-1 text-sm">
                <span className="text-parchment-400">Dado</span>
                <span className="text-parchment-200">{shown.dice}</span>
              </li>
            )}
            {entry.breakdown.map((b, i) => (
              <li key={i} className="flex justify-between py-1 text-sm">
                <span className="text-parchment-400">{b.label}</span>
                <span className="text-parchment-200">{formatModifier(b.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {appDice && canRollEntry(entry) && (
        <div className="mt-5 border-t border-parchment-900 pt-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => rollIt(critMode)}
              className="min-h-10 px-4 rounded-lg border border-parchment-800 text-sm text-parchment-300 hover:text-parchment-100 hover:border-parchment-600 transition-colors"
            >
              Rolar
            </button>
            {entry.crit && !critMode && (
              <button
                onClick={() => rollIt(true)}
                className="min-h-10 px-4 rounded-lg border border-parchment-800 text-sm text-parchment-300 hover:text-parchment-100 hover:border-parchment-600 transition-colors"
              >
                Rolar crítico
              </button>
            )}
          </div>
          {/* A região viva existe antes da primeira rolagem: o leitor de tela anuncia cada resultado. */}
          <div aria-live="polite">
            {result && <RollResult key={result.record.id} result={result} entry={entry} isD20={isD20} autoMiss={autoMiss} />}
          </div>
          {failedConcentration && (
            <button
              onClick={endFailedConcentration}
              className="mt-2 min-h-10 rounded-lg border border-violet-700 px-3 text-sm text-violet-200 hover:border-violet-400"
            >
              Falhei: encerrar
            </button>
          )}
        </div>
      )}

      {links.length > 0 && onOpenLink && !autoMiss && (
        <div className="mt-5 border-t border-parchment-900 pt-4">
          <p className="text-[11px] uppercase tracking-wider text-parchment-600">Acertou? Role o dano</p>
          <ul className="mt-2 space-y-2">
            {links.map(link => {
              const canCrit = link.entry.crit !== undefined && link.entry.dice !== ''
              return (
                <li key={link.entry.id} className="flex flex-wrap items-center gap-2">
                  {critHit && canCrit ? (
                    <button
                      onClick={() => onOpenLink(link.entry, { crit: true })}
                      className="min-h-10 px-3 rounded-lg border border-gold-600 bg-gold-900/40 text-sm text-gold-300 hover:border-gold-400"
                    >
                      {link.label} do crítico: {link.entry.crit?.formula}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onOpenLink(link.entry, { crit: false })}
                        className="min-h-10 px-3 rounded-lg border border-parchment-800 text-sm text-parchment-200 hover:border-gold-700"
                      >
                        {link.label}: {link.entry.formula}
                      </button>
                      {canCrit && (
                        <button
                          onClick={() => onOpenLink(link.entry, { crit: true })}
                          aria-label={`${link.label} do crítico`}
                          className="min-h-10 px-3 rounded-lg border border-parchment-800 text-xs text-parchment-400 hover:text-parchment-200"
                        >
                          crítico
                        </button>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {/* A margem é o recuo de baixo da folha: rola até o fim de verdade, e o que crescer depois
          (a fonte do total que termina de carregar) ainda cabe. */}
      <div ref={sheetEndRef} className="scroll-mb-6" />
    </PlayDialog>
  )
}

function RollResult({ result, entry, isD20, autoMiss }: {
  result: SheetRoll
  entry: RollGuideEntry
  isD20: boolean
  /** Ataque com 1 natural: erra automaticamente. */
  autoMiss: boolean
}) {
  const { record, natural } = result
  return (
    <RollOutcome
      record={record}
      natural={isD20 ? natural : null}
      copyText={formatRollCopyText({ label: record.label ?? entry.label, formula: result.formula, record })}
      prefix={result.crit ? 'Crítico: ' : ''}
      naturalOneText={autoMiss ? '1 natural: erra automaticamente (pág. 196).' : '1 natural.'}
    >
      {entry.dc !== undefined && entry.autoFail.length === 0 && (
        <p className={`mt-1 text-sm ${record.total >= entry.dc ? 'text-emerald-300' : 'text-red-300'}`}>
          {record.total >= entry.dc ? `Passou (CD ${entry.dc}).` : `Não passou (CD ${entry.dc}).`}
        </p>
      )}
    </RollOutcome>
  )
}
