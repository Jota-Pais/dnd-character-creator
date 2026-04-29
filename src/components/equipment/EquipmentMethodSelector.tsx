import type { EquipmentDraft } from '../../types/equipment'

type Props = {
  method: EquipmentDraft['method']
  wealthDice: string
  wealthMultiplier: number
  onChange: (method: 'standard' | 'wealth') => void
}

export function EquipmentMethodSelector({ method, wealthDice, wealthMultiplier, onChange }: Props) {
  const options = [
    {
      id: 'standard' as const,
      emoji: '🎒',
      label: 'Equipamento Padrão',
      description: 'Receba os itens listados para sua classe e antecedente.',
    },
    {
      id: 'wealth' as const,
      emoji: '🎲',
      label: 'Riqueza Inicial',
      description: `Role ${wealthDice}${wealthMultiplier > 1 ? ` × ${wealthMultiplier}` : ''} po e compre seu próprio equipamento.`,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className="text-left p-5 rounded-2xl border-2 transition-all"
          style={{
            borderColor: method === opt.id ? '#c0961a' : '#2a1e0f',
            backgroundColor: method === opt.id ? '#c0961a12' : 'transparent',
          }}
        >
          <div className="text-3xl mb-2">{opt.emoji}</div>
          <div className="font-fantasy font-bold text-parchment-200 mb-1">{opt.label}</div>
          <div className="text-parchment-500 text-sm leading-relaxed">{opt.description}</div>
        </button>
      ))}
    </div>
  )
}
