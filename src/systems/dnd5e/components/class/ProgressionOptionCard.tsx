import type { ProgressionOption } from '../../utils/progressionOptions'

type Props = {
  option: ProgressionOption
  accent: string
  /** Escolhida neste slot. */
  picked: boolean
  /** Já escolhida num slot de nível anterior do mesmo grupo cumulativo — não dá pra repetir. */
  pickedEarlier: boolean
  /** Slot cheio: dá pra ler, não dá pra marcar. */
  slotFull: boolean
  onToggle: () => void
}

/**
 * Card de uma opção de progressão (manobra, invocação, metamagia, disciplina, totem, terreno).
 * A descrição fica SEMPRE visível — antes vivia só no `title` do chip, e o jogador tinha que
 * passar o mouse opção por opção pra descobrir o que cada uma fazia.
 *
 * O `prerequisite` é o texto que vem do JSON, exibido como selo. Não é avaliado contra a ficha:
 * o D&D não tem camada de pré-requisito calculado e isso seria regra nova.
 */
export function ProgressionOptionCard({
  option,
  accent,
  picked,
  pickedEarlier,
  slotFull,
  onToggle,
}: Props) {
  const selected = picked || pickedEarlier
  const disabled = pickedEarlier || (!picked && slotFull)
  const tiers = [option.tier3, option.tier6, option.tier14].filter(Boolean)

  return (
    <button
      onClick={() => { if (!pickedEarlier) onToggle() }}
      disabled={disabled}
      title={pickedEarlier ? 'Já escolhida num nível anterior' : slotFull && !picked ? 'Slot completo' : undefined}
      className="text-left p-3 rounded-xl border-2 transition-all duration-200 h-full"
      style={{
        borderColor: selected ? accent : 'rgba(90, 62, 36, 0.5)',
        backgroundColor: selected ? `${accent}12` : 'rgba(15, 10, 4, 0.6)',
        opacity: disabled && !selected ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span
          className="font-fantasy font-bold text-sm leading-tight"
          style={{ color: selected ? accent : '#c4a97a' }}
        >
          {option.name}
        </span>
        {selected && (
          <span className="shrink-0 text-sm" style={{ color: accent }}>
            {pickedEarlier ? '✓' : '✦'}
          </span>
        )}
      </div>

      {option.prerequisite && (
        <span className="inline-block mb-1.5 text-[10px] uppercase px-1.5 py-0.5 rounded font-bold text-gold-400 bg-gold-950/40 border border-gold-800">
          Requer {option.prerequisite}
        </span>
      )}

      {option.description && (
        <p className="text-parchment-500 text-xs leading-relaxed whitespace-pre-line">
          {option.description}
        </p>
      )}

      {tiers.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {tiers.map(tier => (
            <li key={tier} className="text-[11px] text-parchment-600 leading-snug">
              · {tier}
            </li>
          ))}
        </ul>
      )}

      {pickedEarlier && (
        <p className="mt-1.5 text-[11px] text-parchment-600">Escolhida num nível anterior</p>
      )}
    </button>
  )
}
