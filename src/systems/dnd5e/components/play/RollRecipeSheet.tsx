import { useEffect, useState } from 'react'
import { usePlayStore } from '../../stores/playStore'
import { formatModifier } from '../../utils/abilityScoreUtils'
import { recordRoll } from '../../utils/playState'
import type { RollGuideEntry } from '../../utils/rollGuide'
import { canRollEntry, rollGuideEntry, type GuideRoll } from './playDice'

const reasonLabels = (reasons: { label: string }[]) => reasons.map(r => r.label).join(', ')

/** Uma jogada ligada a esta, aberta de dentro da folha: o dano de um ataque. */
export type RecipeLink = { label: string; entry: RollGuideEntry }

/**
 * A "receita" de uma jogada: o que rolar e quanto somar, em letra grande, com o modo e os motivos,
 * a falha automática, as linhas condicionais e de onde vem cada parcela. O jogador rola os próprios
 * dados; com os dados do app ligados, um "Rolar" discreto rola pelo motor e grava no histórico.
 *
 * O 20 e o 1 naturais só ganham destaque: num teste comum eles não decidem nada (pág. 174). No
 * ataque, a folha leva ao dano (`links`); com os dados do app, um natural a partir de
 * `critThreshold` abre o dano já como crítico. A folha de dano aberta com `crit` mostra e rola os
 * dados dobrados (pág. 196), com o "não foi crítico" para voltar ao normal.
 */
export function RollRecipeSheet({ entry, appDice, onClose, crit = false, links = [], critThreshold = 20, onOpenLink }: {
  entry: RollGuideEntry
  appDice: boolean
  onClose: () => void
  /** Abrir já no modo crítico (só jogada de dano, que tem `entry.crit`). */
  crit?: boolean
  links?: RecipeLink[]
  /** A partir de que d20 natural o ataque é crítico. */
  critThreshold?: number
  onOpenLink?: (entry: RollGuideEntry, options: { crit: boolean }) => void
}) {
  const run = usePlayStore(s => s.run)
  const [result, setResult] = useState<(GuideRoll & { crit: boolean }) | null>(null)
  const [critMode, setCritMode] = useState(crit && entry.crit !== undefined)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function rollIt(asCrit: boolean) {
    const rolled = rollGuideEntry(entry, { crit: asCrit })
    run(st => recordRoll(st, rolled.record))
    setResult({ ...rolled, crit: asCrit })
  }

  function leaveCrit() {
    setCritMode(false)
    setResult(null)
  }

  const titleId = `recipe-${entry.id}`
  const isD20 = entry.kind === 'd20'
  const canceled = entry.mode === 'normal' && entry.advantage.length > 0 && entry.disadvantage.length > 0
  const shown = critMode && entry.crit ? entry.crit : { formula: entry.formula, dice: entry.dice }
  // O ataque rolado pelo app deu crítico: o dano abre com os dados dobrados.
  const critHit = isD20 && result !== null && result.natural !== null && result.natural >= critThreshold

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-parchment-800 bg-surface-raised px-5 pt-4 pb-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-fantasy font-bold text-base text-parchment-200 leading-snug pt-2">{entry.label}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-parchment-500 hover:text-parchment-200"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 font-fantasy font-bold text-3xl text-gold-300" data-testid="recipe-formula">{shown.formula}</p>

        {critMode && (
          <div className="mt-2 rounded-lg border border-gold-800 bg-gold-900/30 px-3 py-2 text-sm text-gold-200">
            <p>Acerto crítico: os dados de dano dobram, o modificador não (pág. 196).</p>
            <button onClick={leaveCrit} className="mt-1 min-h-10 text-xs text-parchment-400 underline hover:text-parchment-200">
              Não foi crítico
            </button>
          </div>
        )}

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
            {result && <RollResult result={result} entry={entry} isD20={isD20} />}
          </div>
        )}

        {links.length > 0 && onOpenLink && (
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
                        className="min-h-10 px-3 rounded-lg border border-gold-600 bg-gold-900/40 text-sm text-gold-200 hover:border-gold-400"
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
      </div>
    </div>
  )
}

function RollResult({ result, entry, isD20 }: {
  result: GuideRoll & { crit: boolean }
  entry: RollGuideEntry
  isD20: boolean
}) {
  const { record, natural } = result
  const faces = record.terms.flatMap(t => t.dice)
  return (
    <div className="mt-3" aria-live="polite">
      <p className="text-sm text-parchment-400">
        {result.crit ? 'Crítico: ' : ''}Total{' '}
        <span className="font-fantasy font-bold text-2xl text-parchment-100" data-testid="roll-total">{record.total}</span>
      </p>
      <p className="text-xs text-parchment-600">
        Dados:{' '}
        {faces.map((d, i) => (
          <span key={i} className={d.kept ? 'text-parchment-300' : 'line-through'}>{i > 0 ? ', ' : ''}{d.value}</span>
        ))}
        {record.modifierTotal !== 0 && <> ({formatModifier(record.modifierTotal)})</>}
      </p>
      {isD20 && natural === 20 && <p className="mt-1 text-sm font-bold text-gold-300">20 natural!</p>}
      {isD20 && natural === 1 && <p className="mt-1 text-sm font-bold text-red-400">1 natural.</p>}
      {entry.dc !== undefined && entry.autoFail.length === 0 && (
        <p className={`mt-1 text-sm ${record.total >= entry.dc ? 'text-emerald-300' : 'text-red-300'}`}>
          {record.total >= entry.dc ? `Passou (CD ${entry.dc}).` : `Não passou (CD ${entry.dc}).`}
        </p>
      )}
    </div>
  )
}
