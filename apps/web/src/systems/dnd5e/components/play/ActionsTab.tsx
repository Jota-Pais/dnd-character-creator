import { useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { ActionGroup, SheetAction } from '@rpg/rules/systems/dnd5e/types/actions'
import type { PlaySheet, PlayState, TurnSlot } from '@rpg/rules/systems/dnd5e/types/playState'
import { formatModifier } from '@rpg/rules/systems/dnd5e/utils/abilityScoreUtils'
import { ACTION_GROUPS, getActionGroup, groupActionsByTiming, hasUse } from '@rpg/rules/systems/dnd5e/utils/actionUtils'
import { getTurnActions, performAction } from '@rpg/rules/systems/dnd5e/utils/playState'
import { findRollGuideEntry } from '@rpg/rules/systems/dnd5e/utils/rollGuide'
import { describeActionCost, TIMING_LABEL } from './actionView'
import { AttackList } from './AttacksTab'
import { ChangeAnnouncer } from './ChangeAnnouncer'
import { rollButtonLabel } from './playFormat'
import { RollMarks } from './RollMarks'
import { TurnChecklist } from './TurnChecklist'
import type { PlayTabProps } from './usePlayView'

const GROUP_TITLE: Record<ActionGroup, string> = {
  action: 'Ação',
  bonusAction: 'Ação bônus',
  reaction: 'Reação',
  other: 'Outras',
}

/** A casa do checklist de cada grupo: o título diz se ela já foi usada neste turno. */
const GROUP_SLOT: Partial<Record<ActionGroup, TurnSlot>> = { action: 'action', bonusAction: 'bonusAction', reaction: 'reaction' }

/**
 * O que muda só no número para o leitor de tela, sem falar ao montar: as casas do turno e o saldo
 * de cada recurso que uma ação gasta.
 */
function describeForAnnouncement(state: PlayState, sheet: PlaySheet): string {
  const { turn } = state
  const slot = (used: boolean) => (used ? 'usada' : 'livre')
  const turnText = `Neste turno: ação ${slot(turn.action)}, ação bônus ${slot(turn.bonusAction)}, movimento ${turn.movement ? 'usado' : 'livre'}, reação ${slot(turn.reaction)}.`
  const costs = [...new Set(sheet.actions.flatMap(a => describeActionCost(a, state, sheet).map(c => c.replace(/^gasta \d+ /, ''))))]
  return [turnText, ...costs].join(' ')
}

/** Os botões das jogadas para onde a ação leva (Esconder → Furtividade) e o da aba Magia. */
function ActionLinks({ action, view }: { action: SheetAction; view: PlayTabProps }) {
  const buttons = (action.links ?? []).flatMap(link => {
    if (link === 'spellbook') {
      return [(
        <button
          key={link}
          onClick={() => view.openTab('magic')}
          className="min-h-10 rounded-lg border border-parchment-800 px-3 text-sm text-parchment-200 hover:border-gold-700"
        >
          Abrir a aba Magia
        </button>
      )]
    }
    const entry = findRollGuideEntry(view.guide, link)
    if (!entry) return []
    return [(
      <button
        key={link}
        onClick={() => view.openRecipe(entry)}
        aria-label={rollButtonLabel(entry)}
        className="min-h-10 flex items-center gap-1.5 rounded-lg border border-parchment-800 px-3 hover:border-gold-700"
      >
        <span className="text-sm text-parchment-200">{entry.label}</span>
        <span className="font-fantasy font-bold text-parchment-100" aria-hidden="true">
          {formatModifier(entry.modifier)} <RollMarks entry={entry} />
        </span>
      </button>
    )]
  })
  if (buttons.length === 0) return null
  return <div className="mt-2 flex flex-wrap gap-1.5">{buttons}</div>
}

/**
 * Uma ação: o nome, quem a dá, o gatilho da reação, o custo com o saldo, o "?" que abre o texto
 * (o resumo da ação ou o da característica, com a página), o "Usar" e para onde ela leva.
 *
 * O "Usar" roda a ação (`performAction`): gasta, aplica e marca o turno num passo só do desfazer.
 * Recusado (sem usos, sem poder agir), o aviso do pé diz por quê e o foco fica nele. A ação que some
 * da lista depois de usada (entrar em fúria, Esquivar, Levantar-se) leva o foco ao título do grupo.
 */
function ActionItem({ action, view, onGone, nested = false, children }: {
  action: SheetAction
  view: PlayTabProps
  onGone: () => void
  /** Dentro de outra ação (o agarrão em Atacar): um nível de título abaixo. */
  nested?: boolean
  children?: ReactNode
}) {
  const Title = nested ? 'h4' : 'h3'
  const { state, sheet, run } = view
  const [open, setOpen] = useState(false)
  const [option, setOption] = useState<string | null>(null)
  const textId = `action-text-${action.id}`
  // As escolhas de quem liga um efeito com opção (o Frenesi, ao entrar em fúria).
  const turnsOn = (action.outcomes ?? []).flatMap(o => (o.kind === 'toggleOn' ? [o.toggle] : []))
  const options = sheet.toggles.filter(t => turnsOn.includes(t.id)).flatMap(t => t.options)
  const meta = [
    ...(getActionGroup(action.timing) === 'other' ? [TIMING_LABEL[action.timing]] : []),
    ...describeActionCost(action, state, sheet),
  ]
  const usesAttacks = action.links?.includes('attacks') && getActionGroup(action.timing) !== 'action'

  function use() {
    const result = flushSync(() => run((st, sh) => performAction(st, sh, action.id, { now: Date.now(), ...(option ? { option } : {}) })))
    if (!result || result.notices.some(n => n.kind === 'refused' || n.kind === 'unresolvedRule')) return
    setOption(null)
    if (!getTurnActions(result.state, sheet).some(a => a.id === action.id)) onGone()
  }

  return (
    <li className="rounded-xl border border-parchment-900 bg-surface-raised p-3" data-testid={`action-${action.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Title className="font-fantasy font-bold text-parchment-100 leading-tight">{action.name}</Title>
          {!action.standard && action.source !== action.name && (
            <p className="text-[11px] text-parchment-500 leading-snug">{action.source}</p>
          )}
          {action.trigger && <p className="text-xs text-parchment-300 leading-snug">Quando {action.trigger}.</p>}
          {meta.length > 0 && <p className="text-[11px] text-parchment-400 leading-snug">{meta.join(' · ')}</p>}
          {usesAttacks && <p className="text-[11px] text-parchment-400 leading-snug">Os números do ataque estão em Atacar.</p>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-controls={textId}
            aria-label={`O que é: ${action.name}`}
            className="w-10 h-10 rounded-lg border border-parchment-800 text-parchment-300 hover:border-parchment-600"
          >
            ?
          </button>
          {hasUse(action) && (
            <button
              onClick={use}
              aria-label={`Usar: ${action.name}`}
              className="min-h-10 rounded-lg border border-gold-800 px-3 text-sm text-gold-300 hover:border-gold-600"
            >
              Usar
            </button>
          )}
        </div>
      </div>
      <p id={textId} hidden={!open} className="mt-2 text-sm text-parchment-300 leading-snug whitespace-pre-line">
        {action.description} (pág. {action.page})
      </p>
      {options.map(o => (
        <label key={o.id} className="mt-1 flex items-center gap-2 min-h-10 text-sm text-parchment-300 cursor-pointer">
          <input
            type="checkbox"
            checked={option === o.id}
            onChange={e => setOption(e.target.checked ? o.id : null)}
            className="w-5 h-5 shrink-0 accent-gold-500"
          />
          {o.label}{o.onEnd?.exhaustion ? ' (ao terminar, +1 nível de exaustão)' : ''}
        </label>
      ))}
      <ActionLinks action={action} view={view} />
      {children}
    </li>
  )
}

/**
 * Aba Ações (Fase 2, onda `turno`): o que o personagem pode fazer em cada momento do turno, com o
 * custo. No topo, o checklist do turno (`TurnChecklist`); depois os grupos Ação, Ação Bônus, Reação
 * e Outras, com as ações que valem agora (`getTurnActions`: as em combate e as das características,
 * montadas em `getSheetActions`). A ação de Atacar traz as linhas de ataque de sempre (`AttackList`)
 * e, dentro dela, o agarrão e o encontrão. Sem ação bônus listada, o grupo diz quando se tem uma
 * (pág. 191).
 */
export function ActionsTab(view: PlayTabProps) {
  const { state, sheet } = view
  const titles = useRef<Partial<Record<ActionGroup, HTMLHeadingElement | null>>>({})
  const actions = getTurnActions(state, sheet)
  const parts = actions.filter(a => a.partOf === 'attack')
  const groups = groupActionsByTiming(actions.filter(a => !a.partOf))

  return (
    <div className="space-y-4">
      {/* Primeiro filho: no fim, o space-y daria margem a ele. */}
      <ChangeAnnouncer text={describeForAnnouncement(state, sheet)} />
      <TurnChecklist {...view} />
      {ACTION_GROUPS.map(group => {
        const slot = GROUP_SLOT[group]
        const list = groups[group]
        return (
          <section key={group} aria-labelledby={`actions-${group}`}>
            <h2
              id={`actions-${group}`}
              ref={el => { titles.current[group] = el }}
              tabIndex={-1}
              className="text-[11px] uppercase tracking-wider text-parchment-600 font-fantasy mb-1.5"
            >
              {GROUP_TITLE[group]}
              {/* O espaço fora do span: o nome acessível apara o começo de cada elemento. */}
              {slot && <>{' '}<span className="normal-case tracking-normal">· {state.turn[slot] ? 'usada neste turno' : 'livre'}</span></>}
            </h2>
            {/* Sem afirmar que não há: as ações de várias características (Retomar o Fôlego, Ação
                Ardilosa) e as magias de ação bônus ainda não estão nos dados, e o texto delas está
                na aba Regras. */}
            {list.length === 0 ? (group === 'bonusAction' && (
              <p className="text-sm text-parchment-400 leading-snug">
                Nenhuma ação bônus listada para a sua ficha. Você só tem ação bônus quando uma característica, magia ou
                outra habilidade diz que algo pode ser feito como ação bônus (pág. 191): se a sua ficha tiver alguma, o
                texto está na aba Regras.
              </p>
            )) : (
              <ul className="space-y-2">
                {list.map(action => (
                  <ActionItem key={action.id} action={action} view={view} onGone={() => titles.current[group]?.focus()}>
                    {group === 'action' && action.links?.includes('attacks') && (
                      <div className="mt-3 space-y-2">
                        <AttackList guide={view.guide} openRecipe={view.openRecipe} />
                        {parts.length > 0 && (
                          <ul className="space-y-2">
                            {parts.map(part => (
                              <ActionItem key={part.id} action={part} view={view} nested onGone={() => titles.current[group]?.focus()} />
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </ActionItem>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
