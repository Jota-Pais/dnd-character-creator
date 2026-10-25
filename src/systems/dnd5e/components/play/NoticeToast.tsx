import { usePlayStore } from '../../stores/playStore'
import type { PlayNotice, PlayNoticeKind } from '../../types/playState'
import { endConcentration } from '../../utils/playState'
import { describeRollGuide, getConcentrationGuide, type RollGuideEntry } from '../../utils/rollGuide'
import type { PlayView } from './usePlayView'

/** Destaque por tipo: recusa e regra em aberto chamam atenção; o resto é informação. */
const KIND_STYLE: Partial<Record<PlayNoticeKind, { prefix: string; className: string }>> = {
  refused: { prefix: 'Não foi feito: ', className: 'border-red-800 bg-red-950/40 text-red-200' },
  unresolvedRule: { prefix: 'Regra em aberto: ', className: 'border-amber-700 bg-amber-950/40 text-amber-200' },
  died: { prefix: '', className: 'border-red-800 bg-red-950/40 text-red-200' },
  fellUnconscious: { prefix: '', className: 'border-red-900 bg-red-950/20 text-red-200' },
  concentrationCheck: { prefix: '', className: 'border-violet-800 bg-violet-950/40 text-violet-100' },
}
const DEFAULT_STYLE = { prefix: '', className: 'border-parchment-800 bg-surface-base text-parchment-200' }

/**
 * Os avisos da última ação do modo de jogo (ou da abertura, se a ficha mudou), presos ao pé da
 * tela, com o "Desfazer" quando a ação mudou algo. O aviso de concentração traz a CD e a receita
 * do TR de Constituição (`getConcentrationGuide`), com atalho para a folha e para encerrar.
 */
export function NoticeToast({ view, onOpenRecipe }: {
  view: PlayView
  onOpenRecipe: (entry: RollGuideEntry) => void
}) {
  const notices = usePlayStore(s => s.notices)
  const canUndo = usePlayStore(s => s.lastActionChanged && s.undoStack.length > 0)
  const undo = usePlayStore(s => s.undo)
  const dismiss = usePlayStore(s => s.dismissNotices)

  if (notices.length === 0) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none">
      <div className="max-w-2xl mx-auto px-4 pb-4">
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto rounded-xl border border-parchment-800 bg-surface-raised p-3 shadow-xl shadow-black/50"
        >
          <ul className="space-y-1.5">
            {notices.map((n, i) => (
              <NoticeLine key={i} notice={n} view={view} onOpenRecipe={onOpenRecipe} />
            ))}
          </ul>
          <div className="mt-2 flex justify-end gap-2">
            {canUndo && (
              <button
                onClick={undo}
                className="min-h-10 rounded-lg border border-parchment-700 px-3 text-sm text-parchment-200 hover:border-gold-600"
              >
                ↶ Desfazer
              </button>
            )}
            <button
              onClick={dismiss}
              className="min-h-10 rounded-lg px-3 text-sm text-parchment-500 hover:text-parchment-200"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NoticeLine({ notice, view, onOpenRecipe }: {
  notice: PlayNotice
  view: PlayView
  onOpenRecipe: (entry: RollGuideEntry) => void
}) {
  const style = KIND_STYLE[notice.kind] ?? DEFAULT_STYLE
  // A CD vem do aviso (o dano já com resistência, contando o absorvido); o guia dá o resto da receita.
  const concentration = notice.kind === 'concentrationCheck' && notice.dc !== undefined && view.state.concentration
    ? { ...getConcentrationGuide(view.draft, view.state, 0), dc: notice.dc }
    : null

  return (
    <li className={`rounded-lg border px-3 py-2 text-sm leading-snug ${style.className}`}>
      {style.prefix && <span className="font-bold">{style.prefix}</span>}
      {notice.text}
      {concentration && (
        <>
          <p className="mt-1 text-xs">
            Role {describeRollGuide(concentration)}: precisa de {concentration.dc} ou mais.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              onClick={() => onOpenRecipe(concentration)}
              className="min-h-10 rounded-lg border border-violet-700 px-3 text-xs hover:border-violet-400"
            >
              Ver o que rolar
            </button>
            <button
              onClick={() => view.run(st => endConcentration(st))}
              className="min-h-10 rounded-lg border border-violet-700 px-3 text-xs hover:border-violet-400"
            >
              Falhei: encerrar
            </button>
          </div>
        </>
      )}
    </li>
  )
}
