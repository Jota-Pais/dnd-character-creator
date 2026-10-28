import type { ProgressionOption } from '../../utils/progressionOptions'

type Props = {
  option: ProgressionOption
  accent: string
  /** Escolhida neste slot. */
  picked: boolean
  /** Já escolhida num slot de nível anterior do mesmo grupo cumulativo — não dá pra repetir. */
  pickedEarlier: boolean
  /**
   * Slot cheio: dá pra ler, não dá pra marcar. O slot de 1 escolha nunca vem cheio — é rádio, e a
   * opção nova troca a marcada (`isChoiceFull`, decisão de 2026-10-26).
   */
  slotFull: boolean
  /**
   * Pré-requisito de opção que falta ("requer Pacto da Lâmina (Dádiva do Pacto, 3º nível)"): a
   * opção não se marca; já marcada (ficha antiga, pacto trocado), fica com o aviso pra desmarcar.
   */
  unmetRequirement?: string | null
  onToggle: () => void
}

/**
 * Card de uma opção de progressão (manobra, invocação, metamagia, disciplina, totem, terreno).
 * A descrição fica SEMPRE visível — antes vivia só no `title` do chip, e o jogador tinha que
 * passar o mouse opção por opção pra descobrir o que cada uma fazia.
 *
 * O `prerequisite` é o texto que vem do JSON, exibido como selo. Só o pré-requisito de opção
 * (`requiresPick`: o pacto das invocações) é conferido contra a ficha — vem em `unmetRequirement`;
 * o de nível e o de truque continuam só no selo.
 */
export function ProgressionOptionCard({
  option,
  accent,
  picked,
  pickedEarlier,
  slotFull,
  unmetRequirement = null,
  onToggle,
}: Props) {
  const selected = picked || pickedEarlier
  const disabled = pickedEarlier || (!picked && (slotFull || unmetRequirement !== null))

  return (
    <button
      onClick={() => { if (!pickedEarlier) onToggle() }}
      disabled={disabled}
      aria-pressed={selected}
      title={pickedEarlier ? 'Já escolhida num nível anterior' : unmetRequirement && !picked ? `Indisponível: ${unmetRequirement}` : slotFull && !picked ? 'Slot completo' : undefined}
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

      {pickedEarlier && (
        <p className="mt-1.5 text-[11px] text-parchment-600">Escolhida num nível anterior</p>
      )}

      {unmetRequirement && (
        <p className={`mt-1.5 text-[11px] ${selected ? 'text-red-400 font-semibold' : 'text-parchment-600'}`}>
          {selected
            ? `⚠ Sem o pré-requisito: ${unmetRequirement}. Não vale na ficha — desmarque ou escolha o que falta.`
            : `Indisponível: ${unmetRequirement}.`}
        </p>
      )}
    </button>
  )
}
