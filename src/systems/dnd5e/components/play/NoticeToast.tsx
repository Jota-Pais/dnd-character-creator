import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { flushSync } from 'react-dom'
import { usePlayStore } from '../../stores/playStore'
import type { DamageInput, PlayNotice, PlayNoticeKind } from '../../types/playState'
import { applyDamageDroppingToOneHp, endConcentration, standUp } from '../../utils/playState'
import { describeRollGuide, getConcentrationGuide, type RollGuideEntry } from '../../utils/rollGuide'
import type { PlayView } from './usePlayView'

/** Destaque por tipo: recusa e regra em aberto chamam atenção; o resto é informação. */
const KIND_STYLE: Partial<Record<PlayNoticeKind, { prefix: string; className: string }>> = {
  refused: { prefix: 'Não foi feito: ', className: 'border-red-800 bg-red-950/40 text-red-200' },
  unresolvedRule: { prefix: 'Regra em aberto: ', className: 'border-amber-700 bg-amber-950/40 text-amber-200' },
  died: { prefix: '', className: 'border-red-800 bg-red-950/40 text-red-200' },
  fellUnconscious: { prefix: '', className: 'border-red-900 bg-red-950/20 text-red-200' },
  concentrationCheck: { prefix: '', className: 'border-violet-800 bg-violet-950/40 text-violet-100' },
  dropToOneHp: { prefix: '', className: 'border-emerald-800 bg-emerald-950/30 text-emerald-100' },
}
const DEFAULT_STYLE = { prefix: '', className: 'border-parchment-800 bg-surface-base text-parchment-200' }

const NO_NOTICES: PlayNotice[] = []

/** Avisos que pedem uma escolha agora vêm primeiro: com a lista rolando, o botão nunca fica escondido. */
const ACTION_KINDS: PlayNoticeKind[] = ['dropToOneHp', 'concentrationCheck']
const sortByAction = (notices: PlayNotice[]) => [
  ...notices.filter(n => ACTION_KINDS.includes(n.kind)),
  ...notices.filter(n => !ACTION_KINDS.includes(n.kind)),
]

/** O que a tela pede ao aviso: o foco no "Desfazer" ou no "OK" dele; false sem aviso aberto. */
export type NoticeToastHandle = { focus: () => boolean }

/**
 * Os avisos da última ação do modo de jogo (ou da abertura, se a ficha mudou), presos ao pé da
 * tela, com o "Desfazer" quando a ação mudou algo. O aviso de concentração traz a CD e a receita
 * do TR de Constituição (`getConcentrationGuide`), com atalho para a folha e para encerrar.
 */
export function NoticeToast({ view, onOpenRecipe, onHeightChange, onFocusAway, ref }: {
  view: PlayView
  onOpenRecipe: (entry: RollGuideEntry) => void
  /**
   * A altura ocupada no pé da tela (0 sem aviso): a tela usa como folga de fundo, para o aviso
   * nunca cobrir o último controle, e o teste contra a morte rola o d20 para cima dele.
   */
  onHeightChange?: (height: number) => void
  /** O aviso fechou pelo botão que tinha o foco: a tela diz para onde ele vai (a aba aberta). */
  onFocusAway?: () => void
  /** A folha da receita que fecha sem quem a abriu passa o foco ao aviso (`NoticeToastHandle`). */
  ref?: Ref<NoticeToastHandle>
}) {
  const storeNotices = usePlayStore(s => s.notices)
  const canUndo = usePlayStore(s => s.lastActionChanged && s.undoStack.length > 0)
  const undo = usePlayStore(s => s.undo)
  const dismiss = usePlayStore(s => s.dismissNotices)
  const boxRef = useRef<HTMLDivElement>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)
  // Os avisos da abertura (a correção da ficha, a reconciliação) já estão na fila quando a tela
  // monta: eles esperam o quadro seguinte, para a região viva existir vazia antes do texto. O que
  // chega depois (qualquer ação) aparece na hora.
  const [heldAtMount] = useState(() => usePlayStore.getState().notices)
  const [released, setReleased] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReleased(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const notices = !released && storeNotices === heldAtMount ? NO_NOTICES : storeNotices
  const open = notices.length > 0

  function focusNotice(): boolean {
    const target = undoRef.current ?? okRef.current
    target?.focus()
    return target !== null
  }
  useImperativeHandle(ref, () => ({ focus: focusNotice }))

  // Todo botão do aviso some com a própria ação ("Falhei: encerrar", "Levantar", e o "Desfazer" e o
  // "OK", que fecham o aviso): síncrono (flushSync), o foco vai ao "Desfazer" ou ao "OK" do aviso
  // que ficou e, com o aviso fechado, a `onFocusAway` — nunca cai no body.
  function act(action: () => void) {
    flushSync(action)
    if (!focusNotice()) onFocusAway?.()
  }

  // A caixa existe sempre (sem aviso, com altura 0): o ResizeObserver acompanha abrir e fechar.
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el || !onHeightChange) return
    const report = () => onHeightChange(el.getBoundingClientRect().height)
    report()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(report)
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      onHeightChange(0)
    }
  }, [open, onHeightChange])
  // E a cada desenho, antes do quadro seguinte: o aviso que troca de texto sem fechar (o teste de
  // concentração aberto quando vem a queda) só chega ao ResizeObserver depois do
  // requestAnimationFrame em que o teste contra a morte rola a tela, com a altura velha.
  useLayoutEffect(() => {
    const el = boxRef.current
    if (el && onHeightChange) onHeightChange(el.getBoundingClientRect().height)
  })

  // A região viva fica montada mesmo sem aviso, vazia: inserida já com o texto, o leitor de tela
  // pode não anunciar.
  return (
    <div ref={boxRef} className="fixed inset-x-0 bottom-0 z-30 pointer-events-none">
      <div role="status" aria-live="polite" className="max-w-2xl mx-auto px-4">
        {open && (
          <div className="pb-4">
            <div className="pointer-events-auto rounded-xl border border-parchment-800 bg-surface-raised p-3 shadow-xl shadow-black/50">
              {/* Muitos avisos (um descanso com vários recursos) rolam dentro do cartão: ele nunca passa
                  da metade da tela e, em celular baixo, deixa espaço para os vitais fixos e o d20 do
                  teste contra a morte entre os dois. */}
              <ul className="space-y-1.5 max-h-[min(50vh,calc(100vh_-_24rem))] overflow-y-auto">
                {sortByAction(notices).map((n, i) => (
                  <NoticeLine key={i} notice={n} view={view} onOpenRecipe={onOpenRecipe} canUndo={canUndo} act={act} />
                ))}
              </ul>
              <div className="mt-2 flex justify-end gap-2">
                {canUndo && (
                  <button
                    ref={undoRef}
                    onClick={() => act(undo)}
                    className="min-h-10 rounded-lg border border-parchment-700 px-3 text-sm text-parchment-200 hover:border-gold-600"
                  >
                    ↶ Desfazer
                  </button>
                )}
                <button
                  ref={okRef}
                  onClick={() => act(dismiss)}
                  className="min-h-10 rounded-lg px-3 text-sm text-parchment-500 hover:text-parchment-200"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NoticeLine({ notice, view, onOpenRecipe, canUndo, act }: {
  notice: PlayNotice
  view: PlayView
  onOpenRecipe: (entry: RollGuideEntry) => void
  /** A última ação (o dano que derrubou) ainda pode ser desfeita. */
  canUndo: boolean
  /** Roda a ação do botão da linha, que some com ela, e passa o foco adiante (ver `NoticeToast`). */
  act: (action: () => void) => void
}) {
  const undo = usePlayStore(s => s.undo)
  const style = KIND_STYLE[notice.kind] ?? DEFAULT_STYLE
  // Resistência Implacável: desfaz o dano que derrubou e o reaplica terminando em 1 PV.
  const dropDamage = notice.kind === 'dropToOneHp' && canUndo ? notice.damage : undefined
  function dropToOneHp(damage: DamageInput) {
    undo()
    view.run((st, sh) => applyDamageDroppingToOneHp(st, sh, damage))
  }
  // A CD vem do aviso (o dano já com resistência, contando o absorvido); o guia dá o resto da receita.
  const concentration = notice.kind === 'concentrationCheck' && notice.dc !== undefined && view.state.concentration
    ? { ...getConcentrationGuide(view.draft, view.state, 0), dc: notice.dc }
    : null
  // Acordou e continua Caído: o "Levantar" fica no próprio aviso (o da aba Estado está longe).
  const canStandUp = notice.kind === 'regainedConsciousness' && view.state.lifeState === 'conscious'
    && view.state.conditions.includes('prone')

  return (
    <li className={`rounded-lg border px-3 py-2 text-sm leading-snug ${style.className}`}>
      {style.prefix && <span className="font-bold">{style.prefix}</span>}
      {notice.text}
      {canStandUp && (
        <div className="mt-1.5">
          <button
            onClick={() => act(() => view.run((st, sh) => standUp(st, sh)))}
            className="min-h-10 rounded-lg border border-parchment-700 px-3 text-xs text-parchment-200 hover:border-gold-600"
          >
            Levantar
          </button>
        </div>
      )}
      {dropDamage && (
        <div className="mt-1.5">
          <button
            onClick={() => act(() => dropToOneHp(dropDamage))}
            className="min-h-10 rounded-lg border border-emerald-700 px-3 text-xs text-emerald-200 hover:border-emerald-400"
          >
            Usar {view.sheet.dropToOneHp?.source ?? 'Resistência Implacável'} (fica com 1 PV)
          </button>
        </div>
      )}
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
              onClick={() => act(() => view.run(st => endConcentration(st)))}
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
