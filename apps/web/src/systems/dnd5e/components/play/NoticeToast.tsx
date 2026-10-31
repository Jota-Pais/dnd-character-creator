import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { flushSync } from 'react-dom'
import { usePlayStore } from '../../stores/playStore'
import type { DamageInput, PlayNotice, PlayNoticeKind } from '@rpg/rules/systems/dnd5e/types/playState'
import { applyDamage, applyDamageDroppingToOneHp, endConcentration, standUp, type DropToOneHpBy } from '@rpg/rules/systems/dnd5e/utils/playState'
import { describeRollGuide, getConcentrationGuide, getZeroHpSaveGuide, type RollGuideEntry } from '@rpg/rules/systems/dnd5e/utils/rollGuide'
import type { PlayView } from './usePlayView'

/**
 * Destaque por tipo: recusa e regra em aberto chamam atenção; o resto é informação. O fundo (`bg`)
 * vai à parte: a barra de escolha do aviso de ação (`ActionBar`) o repete.
 */
type KindStyle = { prefix: string; className: string; bg: string }
const KIND_STYLE: Partial<Record<PlayNoticeKind, KindStyle>> = {
  refused: { prefix: 'Não foi feito: ', className: 'border-red-800 text-red-200', bg: 'bg-red-950/40' },
  unresolvedRule: { prefix: 'Regra em aberto: ', className: 'border-amber-700 text-amber-200', bg: 'bg-amber-950/40' },
  died: { prefix: '', className: 'border-red-800 text-red-200', bg: 'bg-red-950/40' },
  fellUnconscious: { prefix: '', className: 'border-red-900 text-red-200', bg: 'bg-red-950/20' },
  concentrationCheck: { prefix: '', className: 'border-violet-800 text-violet-100', bg: 'bg-violet-950/40' },
  dropToOneHp: { prefix: '', className: 'border-emerald-800 text-emerald-100', bg: 'bg-emerald-950/30' },
  dropToOneHpSave: { prefix: '', className: 'border-emerald-800 text-emerald-100', bg: 'bg-emerald-950/30' },
}
const DEFAULT_STYLE: KindStyle = { prefix: '', className: 'border-parchment-800 text-parchment-200', bg: 'bg-surface-base' }

const NO_NOTICES: PlayNotice[] = []

/**
 * Avisos que pedem uma escolha agora vêm primeiro, e a escolha de cada um (a receita e os botões)
 * fica presa ao pé da lista quando ela rola (`ActionBar`): com dois deles, o segundo passava da
 * altura da lista, e o botão ficava escondido.
 */
const ACTION_KINDS: PlayNoticeKind[] = ['dropToOneHp', 'dropToOneHpSave', 'concentrationCheck']
const sortByAction = (notices: PlayNotice[]) => [
  ...notices.filter(n => ACTION_KINDS.includes(n.kind)),
  ...notices.filter(n => !ACTION_KINDS.includes(n.kind)),
]

/** O que a tela pede ao aviso: o foco no "Desfazer" ou no "OK" dele; false sem aviso aberto. */
export type NoticeToastHandle = { focus: () => boolean }

/**
 * Os avisos da última ação do modo de jogo (ou da abertura, se a ficha mudou), presos ao pé da
 * tela, com o "Desfazer" quando a ação mudou algo; a correção da ficha fica entre eles até o OK.
 * O aviso de concentração traz a CD e a receita do TR de Constituição (`getConcentrationGuide`),
 * com atalho para a folha e para encerrar; o da Fúria Implacável, a CD e a receita do teste
 * (`getZeroHpSaveGuide`), com o "Passei", que reaplica o dano terminando em 1 PV, e o "Falhei", que o
 * reaplica contando o uso.
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
  const storeCorrection = usePlayStore(s => s.sheetCorrection?.notice ?? null)
  const canUndo = usePlayStore(s => s.lastActionChanged && s.undoStack.length > 0)
  const undo = usePlayStore(s => s.undo)
  const dismiss = usePlayStore(s => s.dismissNotices)
  const boxRef = useRef<HTMLDivElement>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)
  // Os avisos da abertura (a correção da ficha, a reconciliação) já estão na fila quando a tela
  // monta: eles esperam o quadro seguinte, para a região viva existir vazia antes do texto. O que
  // chega depois (qualquer ação) aparece na hora.
  const [heldAtMount] = useState(() => {
    const s = usePlayStore.getState()
    return { notices: s.notices, correction: s.sheetCorrection?.notice ?? null }
  })
  const [released, setReleased] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReleased(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const held = !released && storeNotices === heldAtMount.notices && storeCorrection === heldAtMount.correction
  const actionNotices = held ? NO_NOTICES : storeNotices
  // A correção da ficha fica até o OK, junto dos avisos de cada ação; o "Desfazer" é só da ação.
  const correction = held ? null : storeCorrection
  const notices = correction ? [correction, ...actionNotices] : actionNotices
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
    // Acima da barra de gestos e fora do entalhe (área segura); a altura medida já a inclui.
    <div ref={boxRef} className="fixed inset-x-0 bottom-0 z-30 pointer-events-none">
      <div role="status" aria-live="polite" className="max-w-2xl mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        {open && (
          <div className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
                {canUndo && actionNotices.length > 0 && (
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
  function dropToOneHp(damage: DamageInput, by: DropToOneHpBy = 'trait') {
    undo()
    view.run((st, sh) => applyDamageDroppingToOneHp(st, sh, damage, by))
  }
  // A falha no teste também é uso (decisão de 2026-10-30): desfaz e reaplica o mesmo dano com a
  // falha, que soma o uso sem mudar o PV, num passo só do desfazer, como o "Passei".
  function failZeroHpSave(damage: DamageInput) {
    undo()
    view.run((st, sh) => applyDamage(st, sh, { ...damage, zeroHpSaveFailed: true }))
  }
  // Fúria Implacável: a receita do TR com a CD do aviso; quem passou, desfaz e reaplica em 1 PV,
  // ainda em fúria; quem falhou, conta o uso. A ficha diz o atributo e quem dá o teste. A receita sai
  // do estado de antes do dano (o topo do desfazer, de onde o "Passei" reaplica), e não do
  // `view.guide`: a queda já encerrou a fúria e, com o Frenesi, subiu a exaustão, e o teste é feito
  // antes dela.
  const before = usePlayStore(s => s.undoStack.at(-1))
  const zeroHpSave = view.sheet.toggles.find(t => t.zeroHpSave)?.zeroHpSave
  const saveOffer = notice.kind === 'dropToOneHpSave' && canUndo && before && notice.damage && notice.dc !== undefined && zeroHpSave
    ? { damage: notice.damage, entry: getZeroHpSaveGuide(view.draft, before, zeroHpSave, notice.dc) }
    : null
  // A CD vem do aviso (o dano já com resistência, contando o absorvido); o guia dá o resto da receita.
  const concentration = notice.kind === 'concentrationCheck' && notice.dc !== undefined && view.state.concentration
    ? { ...getConcentrationGuide(view.draft, view.state, 0), dc: notice.dc }
    : null
  // Acordou e continua Caído: o "Levantar" fica no próprio aviso (o da aba Estado está longe).
  const canStandUp = notice.kind === 'regainedConsciousness' && view.state.lifeState === 'conscious'
    && view.state.conditions.includes('prone')

  return (
    <li className={`rounded-lg border px-3 py-2 text-sm leading-snug ${style.className} ${style.bg}`}>
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
        <ActionBar bg={style.bg}>
          <button
            onClick={() => act(() => dropToOneHp(dropDamage))}
            className="min-h-10 rounded-lg border border-emerald-700 px-3 text-xs text-emerald-200 hover:border-emerald-400"
          >
            Usar {view.sheet.dropToOneHp?.source ?? 'Resistência Implacável'} (fica com 1 PV)
          </button>
        </ActionBar>
      )}
      {saveOffer && (
        <ActionBar bg={style.bg}>
          <p className="text-xs">
            Role {describeRollGuide(saveOffer.entry)}: precisa de {saveOffer.entry.dc} ou mais.
          </p>
          <div className="mt-1.5">
            <button
              onClick={() => onOpenRecipe(saveOffer.entry)}
              className="min-h-10 rounded-lg border border-emerald-700 px-3 text-xs text-emerald-200 hover:border-emerald-400"
            >
              Ver o que rolar
            </button>
          </div>
          {/* Os dois resultados numa linha só, embaixo da receita: com o "Ver o que rolar" ao lado, a
              360 px o "Passei" não cabia nem com o texto quebrado dentro dele. */}
          <div className="mt-1.5 flex gap-2">
            <button
              onClick={() => act(() => dropToOneHp(saveOffer.damage, 'save'))}
              className="min-h-10 min-w-0 rounded-lg border border-emerald-700 px-3 text-xs text-emerald-200 hover:border-emerald-400"
            >
              Passei: fico com <span className="whitespace-nowrap">1 PV</span>
            </button>
            <button
              onClick={() => act(() => failZeroHpSave(saveOffer.damage))}
              className="min-h-10 shrink-0 rounded-lg border border-emerald-700 px-3 text-xs text-emerald-200 hover:border-emerald-400"
            >
              Falhei
            </button>
          </div>
        </ActionBar>
      )}
      {concentration && (
        <ActionBar bg={style.bg}>
          <p className="text-xs">
            Role {describeRollGuide(concentration)}: precisa de {concentration.dc} ou mais.
          </p>
          <div className="mt-1.5 flex gap-2">
            <button
              onClick={() => onOpenRecipe(concentration)}
              className="min-h-10 shrink-0 rounded-lg border border-violet-700 px-3 text-xs hover:border-violet-400"
            >
              Ver o que rolar
            </button>
            <button
              onClick={() => act(() => view.run((st, sh) => endConcentration(st, sh)))}
              className="min-h-10 min-w-0 rounded-lg border border-violet-700 px-3 text-xs hover:border-violet-400"
            >
              Falhei: encerrar
            </button>
          </div>
        </ActionBar>
      )}
    </li>
  )
}

/**
 * A escolha de um aviso de ação (a receita e os botões), presa ao pé da lista quando ela rola: o
 * meio-orc bárbaro 11 que cai em fúria recebe as duas ofertas (Resistência Implacável e Fúria
 * Implacável), e a 360 px o "Passei" ficava abaixo da parte visível. Presa, ela cobre o fim do
 * texto do próprio aviso, que se lê rolando. O fundo é opaco — o do cartão com o tom do aviso por
 * cima, a mesma cor da linha —, para o texto não aparecer por trás.
 */
function ActionBar({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-3 bg-surface-raised">
      <div className={`px-3 pt-1.5 ${bg}`}>{children}</div>
    </div>
  )
}
