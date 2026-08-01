import { useState } from 'react'
import { rollDamage, rollPool } from '../../core/dice/dice'
import type { LogEntry, PlayAction, PlayActionGroup } from '../../core/play/types'

type Props = {
  groups: PlayActionGroup[]
  onLog: (entry: Omit<LogEntry, 'id' | 'at'>) => void
  /** Cobra o custo da ação. Delta negativo consome. */
  onSpend: (resourceId: string, amount: number) => void
  /** Marca um uso limitado por frequência (1×/cena, 1×/rodada). */
  onUse: (key: string, at: number) => void
}

/** O resultado do último ataque, pra oferecer o dano logo em seguida. */
type PendingAttack = { actionId: string; kept: number; total: number; isThreat: boolean }

/**
 * As ações da ficha, cada uma um botão que rola sozinho.
 *
 * A rolagem em si mora em `core/dice` — este componente só dispara e apresenta. É de propósito:
 * a animação de dados da versão final entra aqui, na apresentação, sem tocar no cálculo.
 */
export function ActionPanel({ groups, onLog, onSpend, onUse }: Props) {
  const [pending, setPending] = useState<PendingAttack | null>(null)
  const [openGroup, setOpenGroup] = useState<string>(groups[0]?.id ?? '')

  function performAction(action: PlayAction) {
    if (action.blocked) return

    // O custo sai primeiro: se a ação consome recurso, o gasto acontece mesmo que ela não role.
    if (action.cost) onSpend(action.cost.resourceId, action.cost.amount)
    if (action.usage) onUse(action.usage.key, action.usage.at)

    if (!action.roll) {
      onLog({
        kind: 'roll',
        title: action.name,
        detail: [action.cost ? `−${action.cost.label}` : null, action.rollLabel]
          .filter(Boolean).join(' · '),
      })
      setPending(null)
      return
    }

    const result = rollPool(action.roll)
    const isThreat = action.damage !== undefined && result.kept >= action.damage.threatMargin

    onLog({
      kind: 'roll',
      title: action.name,
      detail: [
        action.roll.label,
        action.cost ? `−${action.cost.label}` : null,
        isThreat ? `⚡ margem de ameaça (${action.damage!.threatMargin}+)` : null,
      ].filter(Boolean).join(' · '),
      total: result.total,
      dice: result.dice,
    })

    setPending(action.damage
      ? { actionId: action.id, kept: result.kept, total: result.total, isThreat }
      : null)
  }

  function rollTheDamage(action: PlayAction, critical: boolean) {
    if (!action.damage) return
    const multiplier = critical ? action.damage.critMultiplier : 1
    const result = rollDamage(action.damage.spec, { critMultiplier: multiplier })
    onLog({
      kind: 'damage',
      title: `Dano — ${action.name}${critical ? ` (crítico ×${multiplier})` : ''}`,
      detail: action.damage.label,
      total: result.total,
      dice: [...result.dice, ...result.extra],
    })
    setPending(null)
  }

  if (groups.length === 0) return null

  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60">
      <div className="flex flex-wrap gap-1 p-2 border-b border-parchment-900">
        {groups.map(group => (
          <button
            key={group.id}
            onClick={() => setOpenGroup(group.id)}
            className="px-3 py-1 rounded-lg text-xs font-fantasy font-bold transition-colors"
            style={openGroup === group.id
              ? { backgroundColor: 'color-mix(in srgb, var(--color-gold-500) 20%, transparent)', color: 'var(--color-gold-400)' }
              : { color: '#8a7368' }}
          >
            {group.label}
            <span className="ml-1.5 opacity-60">{group.actions.length}</span>
          </button>
        ))}
      </div>

      {groups.filter(g => g.id === openGroup).map(group => (
        <div key={group.id}>
          {group.hint && (
            <p className="px-3 pt-2 text-[11px] text-parchment-700 leading-snug">{group.hint}</p>
          )}
          <ul className="p-2 space-y-1 max-h-[420px] overflow-y-auto">
            {group.actions.map(action => (
              <ActionRow
                key={action.id}
                action={action}
                pending={pending?.actionId === action.id ? pending : null}
                onUse={() => performAction(action)}
                onDamage={critical => rollTheDamage(action, critical)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function ActionRow({ action, pending, onUse, onDamage }: {
  action: PlayAction
  pending: PendingAttack | null
  onUse: () => void
  onDamage: (critical: boolean) => void
}) {
  const blocked = Boolean(action.blocked)

  return (
    <li
      className="rounded-lg border transition-colors"
      style={{
        borderColor: pending ? 'var(--color-gold-700)' : 'rgba(90,62,36,0.35)',
        backgroundColor: pending ? 'color-mix(in srgb, var(--color-gold-900) 40%, transparent)' : 'transparent',
        opacity: blocked ? 0.55 : 1,
      }}
    >
      <button
        onClick={onUse}
        disabled={blocked}
        title={action.blocked}
        className="w-full text-left px-3 py-2 flex items-baseline gap-2"
        style={{ cursor: blocked ? 'not-allowed' : 'pointer' }}
      >
        <span className="font-fantasy text-[13.5px] font-semibold text-parchment-200 flex-1 min-w-0 truncate">
          {action.name}
        </span>
        {action.cost && (
          <span
            className="text-[11px] shrink-0 px-1.5 py-0.5 rounded font-bold"
            style={{ color: '#93c5fd', backgroundColor: '#2563eb22' }}
          >
            {action.cost.label}
          </span>
        )}
        <span className="font-mono text-[12px] shrink-0 text-gold-400">
          {action.roll?.label ?? action.rollLabel}
        </span>
      </button>

      <div className="px-3 pb-2 -mt-1 space-y-1">
        {action.damage && (
          <p className="text-[11px] text-parchment-600">
            {action.damage.label}
            {action.detail ? ` · ${action.detail}` : ''}
          </p>
        )}
        {!action.damage && action.detail && (
          <p className="text-[11px] text-parchment-600">{action.detail}</p>
        )}

        {action.blocked && (
          <p className="text-[11px]" style={{ color: '#c9a05a' }}>⛔ {action.blocked}</p>
        )}

        {action.notes?.map(note => (
          <p key={note} className="text-[11px] text-parchment-700 leading-snug">· {note}</p>
        ))}

        {pending && action.damage && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {pending.isThreat && (
              <span className="text-[11px] font-bold" style={{ color: 'var(--color-gold-400)' }}>
                ⚡ Caiu na margem de ameaça
              </span>
            )}
            <button
              onClick={() => onDamage(false)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-fantasy font-bold border border-parchment-700 text-parchment-300 hover:border-parchment-500 transition-colors"
            >
              Rolar dano
            </button>
            {pending.isThreat && (
              <button
                onClick={() => onDamage(true)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-fantasy font-bold transition-all hover:brightness-110"
                style={{ backgroundColor: 'var(--color-gold-500)', color: 'var(--color-on-accent)' }}
                title="Só é crítico se o ataque tiver acertado — quem confirma é o mestre"
              >
                Dano crítico ×{action.damage.critMultiplier}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
