import type { TurnSlot } from '@rpg/rules/systems/dnd5e/types/playState'
import { formatMeters } from '@rpg/rules/systems/dnd5e/utils/abilityScoreUtils'
import { getTurnExtraActions, getTurnMovement, markTurn, newTurn } from '@rpg/rules/systems/dnd5e/utils/playState'
import type { PlayTabProps } from './usePlayView'

/** O título do checklist: dá nome ao grupo das quatro casas. */
const TITLE_ID = 'turn-checklist-title'

/** As casas na ordem do turno, com o rótulo curto (cabe em 360 px) e o nome inteiro, o do leitor de tela. */
const SLOTS: { slot: TurnSlot; label: string; name: string }[] = [
  { slot: 'action', label: 'Ação', name: 'Ação' },
  { slot: 'bonusAction', label: 'Bônus', name: 'Ação bônus' },
  { slot: 'movement', label: 'Movimento', name: 'Movimento' },
  { slot: 'reaction', label: 'Reação', name: 'Reação' },
]

/**
 * O checklist leve do turno (decisão 10.2.10), numa linha no topo da aba Ações: a ação, a ação
 * bônus, o movimento (com o que resta do deslocamento do turno — a Disparada somada, o levantar-se
 * descontado: `getTurnMovement`) e a reação, mais o Novo turno. O "Usar" das ações marca a casa sozinho, e o toque na casa corrige
 * (`markTurn`); nada aqui impede de jogar. O Novo turno (`newTurn`) zera as casas e encerra o que
 * dura até o início do seu turno — o aviso do pé da tela diz o que mudou, com o "Desfazer".
 *
 * Nenhum controle some com o próprio toque: o foco fica nele.
 */
export function TurnChecklist({ state, sheet, run }: PlayTabProps) {
  const { turn } = state
  const movement = formatMeters(getTurnMovement(state, sheet))
  const extraActions = getTurnExtraActions(state, sheet)
  // A segunda linha da casa: o que resta do deslocamento do turno no movimento; nas outras, livre ou
  // usada, e a ação a mais (o Surto de Ação, a de cada turno da Velocidade) na da ação. O nome
  // acessível diz o mesmo por extenso.
  const shown = (slot: TurnSlot): string => {
    if (slot === 'movement') return movement
    const extra = slot === 'action' ? extraActions : 0
    return `${turn[slot] ? 'usada' : 'livre'}${extra > 0 ? ` +${extra}` : ''}`
  }
  const spoken = (slot: TurnSlot): string => {
    if (slot === 'movement') return turn.dashes > 0 ? `${movement}, com Disparada` : movement
    const extra = slot === 'action' ? extraActions : 0
    const more = extra > 0 ? `, mais ${extra} ${extra === 1 ? 'ação' : 'ações'} neste turno` : ''
    return `${turn[slot] ? 'usada' : 'livre'}${more}`
  }

  return (
    <section aria-labelledby={TITLE_ID} className="rounded-xl border border-parchment-900 bg-surface-raised p-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id={TITLE_ID} className="pl-1 text-[11px] uppercase tracking-wider text-parchment-600 font-fantasy">
          Neste turno
        </h2>
        <button
          onClick={() => run((st, sh) => newTurn(st, sh))}
          className="min-h-10 rounded-lg border border-gold-800 px-3 text-sm text-gold-300 hover:border-gold-600"
        >
          Novo turno
        </button>
      </div>
      {/* A casa do movimento é mais larga: "Movimento", na letra dos títulos, não cabe num quarto de 360 px. */}
      <div role="group" aria-labelledby={TITLE_ID} className="mt-1.5 grid grid-cols-[1fr_1fr_1.35fr_1fr] gap-1.5">
        {SLOTS.map(({ slot, label, name }) => {
          const used = turn[slot]
          return (
            <button
              key={slot}
              aria-pressed={used}
              aria-label={`${name}: ${spoken(slot)}`}
              onClick={() => run(st => markTurn(st, slot, !st.turn[slot]))}
              data-testid={`turn-${slot}`}
              className={[
                'min-h-10 min-w-0 rounded-lg border px-1 py-1 flex flex-col items-center justify-center leading-tight transition-colors',
                used
                  ? 'border-gold-700 bg-gold-900/30 text-gold-300'
                  : 'border-parchment-800 text-parchment-200 hover:border-parchment-600',
              ].join(' ')}
            >
              <span className="text-[0.66rem] sm:text-xs font-fantasy whitespace-nowrap">{label}</span>
              {/* O "✓" na linha de baixo: no rótulo, ele quebrava a linha nas casas estreitas. */}
              <span className={`text-[11px] whitespace-nowrap ${used ? 'text-gold-300' : 'text-parchment-400'}`}>
                {used ? `✓ ${shown(slot)}` : shown(slot)}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
