import { useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { ActionTiming, SheetAction } from '@rpg/rules/systems/dnd5e/types/actions'
import type { PlaySheet, PlayState } from '@rpg/rules/systems/dnd5e/types/playState'
import type { SheetToggle } from '@rpg/rules/systems/dnd5e/types/session'
import { describeToggleEffects } from '@rpg/rules/systems/dnd5e/utils/activeEffects'
import { deactivateToggle, getPlaySpeed, getPlayToggles, getResourceAvailable, performAction } from '@rpg/rules/systems/dnd5e/utils/playState'
import { ChangeAnnouncer } from './ChangeAnnouncer'
import { getShownToggles, togglingActions } from './effectToggles'
import type { PlayTabProps } from './usePlayView'

/** A seção dos efeitos ativos na aba Estado: o chip dos vitais leva até ela. */
export const ACTIVE_EFFECTS_SECTION_ID = 'play-active-effects'

const TIMING_LABEL: Record<ActionTiming, string> = {
  action: 'ação',
  bonusAction: 'ação bônus',
  reaction: 'reação',
  free: 'livre',
  movement: 'movimento',
  special: 'especial',
}

/** O custo e o saldo de quem liga: "gasta 1 Fúria — restam 2"; no 20º nível, "Fúria: usos ilimitados". */
function describeCost(action: SheetAction, state: PlayState, sheet: PlaySheet): string[] {
  return (action.cost ?? []).flatMap(c => {
    const r = sheet.resources.find(x => x.id === c.resource)
    const available = getResourceAvailable(state, sheet, c.resource)
    if (!r || available === null) return []
    if (available === 'unlimited') return [`${r.name}: usos ilimitados`]
    return [`gasta ${c.amount} ${r.name} — ${available === 1 ? 'resta 1' : `restam ${available}`}`]
  })
}

/**
 * Um efeito que a ficha liga (a Fúria): desligado, o botão da ação que o liga, com o momento, o
 * custo e o saldo, e a opção de ligar (o Frenesi); ligado, o que ele está fazendo (ou o que o
 * impede), o lembrete do fim prematuro, o botão da ação que o encerra e o "Já acabou", o fim que
 * não é ação (`deactivateToggle`).
 *
 * Foco (as regras do CLAUDE.md): ligar troca o botão pelo "Encerrar", que recebe o foco; encerrar
 * ou o "Já acabou" levam o foco ao título da seção; recusado (sem usos, já em fúria, sem ações), o
 * aviso diz por quê e o foco fica onde estava.
 */
function ToggleCard({ toggle, view, titleRef }: {
  toggle: SheetToggle
  view: PlayTabProps
  titleRef: RefObject<HTMLHeadingElement | null>
}) {
  const { draft, state, sheet, run } = view
  const [option, setOption] = useState<string | null>(null)
  const endRef = useRef<HTMLButtonElement>(null)
  const { on, off } = togglingActions(sheet, toggle.id)
  const resolved = getPlayToggles(state, sheet).find(t => t.id === toggle.id)

  // Síncrono (flushSync): o controle que entra no lugar já existe para receber o foco.
  function turnOn() {
    if (!on) return
    const result = flushSync(() => run((st, sh) => performAction(st, sh, on.id, { now: Date.now(), ...(option ? { option } : {}) })))
    if (result?.state.activeEffects.some(a => a.id === toggle.id)) {
      setOption(null)
      endRef.current?.focus()
    }
  }

  function turnOff() {
    if (!off) return
    const result = flushSync(() => run((st, sh) => performAction(st, sh, off.id, { now: Date.now() })))
    if (result && !result.state.activeEffects.some(a => a.id === toggle.id)) titleRef.current?.focus()
  }

  // O fim que não é ação: a duração passou, ou o fim prematuro (a Fúria: o turno acabou sem ataque
  // nem dano, pág. 48). Sem custo e sem pedir que o personagem possa agir — Atordoado, a fúria acaba
  // do mesmo jeito, e a ação bônus do "Encerrar" seria recusada. O que a opção custa ao acabar (o
  // Frenesi) vale igual.
  function markEnded() {
    const result = flushSync(() => run((st, sh) => deactivateToggle(st, sh, toggle.id)))
    if (result && !result.state.activeEffects.some(a => a.id === toggle.id)) titleRef.current?.focus()
  }

  if (resolved) {
    const lines = describeToggleEffects(draft, resolved, getPlaySpeed(state, sheet))
    return (
      <div className="rounded-xl border border-amber-700 bg-amber-950/30 p-3 space-y-2" data-testid={`toggle-${toggle.id}`}>
        <p className="font-fantasy text-amber-200">
          {resolved.label}
          {resolved.option && <span className="text-sm text-amber-300"> · {resolved.option.label}</span>}
        </p>
        {resolved.blockedBy && (
          <p className="text-xs text-red-200 leading-snug">
            Sem os benefícios: você está de {resolved.blockedBy} (pág. {toggle.page}).
          </p>
        )}
        {lines.length > 0 && (
          <ul className="space-y-0.5">
            {lines.map(line => <li key={line} className="text-sm text-parchment-200 leading-snug">{line}</li>)}
          </ul>
        )}
        {toggle.earlyEndReminder && <p className="text-xs text-amber-200 leading-snug">{toggle.earlyEndReminder}</p>}
        {resolved.option?.onEnd?.exhaustion && (
          <p className="text-xs text-amber-200 leading-snug">
            {resolved.option.label}: ao terminar, você sofre um nível de exaustão.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {off && (
            <span className="flex items-center gap-2">
              <button
                ref={endRef}
                onClick={turnOff}
                className="min-h-10 rounded-lg border border-amber-700 px-3 text-sm text-amber-200 hover:border-amber-500"
              >
                {off.name}
              </button>
              <span className="text-[11px] text-parchment-500">{TIMING_LABEL[off.timing]}</span>
            </span>
          )}
          <span className="flex items-center gap-2">
            <button
              onClick={markEnded}
              className="min-h-10 rounded-lg border border-parchment-700 px-3 text-sm text-parchment-300 hover:border-parchment-500"
            >
              Já acabou
            </button>
            <span className="text-[11px] text-parchment-500">sem gastar ação</span>
          </span>
        </div>
      </div>
    )
  }

  const cost = on ? describeCost(on, state, sheet) : []
  return (
    <div className="rounded-xl border border-parchment-900 bg-surface-raised p-3 space-y-2" data-testid={`toggle-${toggle.id}`}>
      <p className="font-fantasy text-parchment-100">{toggle.source}</p>
      {toggle.options.map(o => (
        <label key={o.id} className="flex items-center gap-2 min-h-10 text-sm text-parchment-300 cursor-pointer">
          <input
            type="checkbox"
            checked={option === o.id}
            onChange={e => setOption(e.target.checked ? o.id : null)}
            className="w-5 h-5 shrink-0 accent-gold-500"
          />
          {o.label}{o.onEnd?.exhaustion ? ' (ao terminar, +1 nível de exaustão)' : ''}
        </label>
      ))}
      {on && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            onClick={turnOn}
            className="min-h-10 rounded-lg border border-amber-800 px-3 text-sm text-amber-200 hover:border-amber-500"
          >
            {on.name}
          </button>
          <span className="text-[11px] text-parchment-500">{[TIMING_LABEL[on.timing], ...cost].join(' · ')}</span>
        </div>
      )}
    </div>
  )
}

/** O que muda só no número (ligado, o saldo de usos) para o leitor de tela, sem falar ao montar. */
function describeForAnnouncement(state: PlayState, sheet: PlaySheet): string {
  const on = getPlayToggles(state, sheet)
  const status = on.length > 0
    ? `Ligado: ${on.map(t => (t.option ? `${t.label} (${t.option.label})` : t.label)).join(', ')}.`
    : 'Nenhum efeito ligado.'
  const costs = sheet.toggles.flatMap(t => {
    const action = togglingActions(sheet, t.id).on
    return action ? describeCost(action, state, sheet).map(c => c.replace(/^gasta \d+ /, '')) : []
  })
  return [status, ...costs].join(' ')
}

/**
 * Efeitos ativos (Fase 2): os efeitos que a ficha liga em jogo (`sheet.toggles`: a Fúria), cada um
 * com o botão que roda a ação que o liga ou o encerra (`performAction`), na aba Estado. Ligado, o
 * efeito muda os números das outras abas (o dano das armas, a vantagem em Força, as defesas do
 * painel de PV); o chip nos vitais traz até aqui.
 */
export function ActiveEffectsSection({ titleRef, ...view }: PlayTabProps & { titleRef: RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="space-y-2">
      {/* Primeiro filho: no fim, o space-y daria margem a ele. */}
      <ChangeAnnouncer text={describeForAnnouncement(view.state, view.sheet)} />
      {getShownToggles(view.state, view.sheet).map(t => <ToggleCard key={t.id} toggle={t} view={view} titleRef={titleRef} />)}
    </div>
  )
}
