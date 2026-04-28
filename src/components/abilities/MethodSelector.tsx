import type { AbilityMethod } from '../../types/character'

type Props = {
  selected: AbilityMethod | null
  onSelect: (method: AbilityMethod) => void
}

const METHODS: {
  id: AbilityMethod
  name: string
  emoji: string
  description: string
  tag: string
}[] = [
  {
    id: 'standard-array',
    name: 'Array Padrão',
    emoji: '📋',
    description: 'Distribua os valores fixos [15, 14, 13, 12, 10, 8] entre os atributos.',
    tag: 'Simples e equilibrado',
  },
  {
    id: 'point-buy',
    name: 'Compra de Pontos',
    emoji: '💰',
    description: 'Comece com 8 em tudo e gaste 27 pontos para personalizar seus atributos.',
    tag: 'Máximo controle',
  },
  {
    id: 'roll',
    name: 'Rolagem',
    emoji: '🎲',
    description: 'Role 4d6 (descartando o menor) seis vezes e distribua os resultados.',
    tag: 'Emocionante e imprevisível',
  },
]

export function MethodSelector({ selected, onSelect }: Props) {
  return (
    <div>
      <p className="text-xs font-fantasy text-parchment-600 uppercase tracking-widest mb-3">
        Método de geração
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {METHODS.map(method => {
          const isSelected = selected === method.id
          return (
            <button
              key={method.id}
              onClick={() => onSelect(method.id)}
              className="text-left p-4 rounded-xl border-2 transition-all"
              style={{
                borderColor: isSelected ? '#d4900a80' : '#2a1f0e',
                backgroundColor: isSelected ? '#d4900a10' : '#0f0a04',
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">{method.emoji}</span>
                <span
                  className="font-fantasy font-bold text-sm"
                  style={{ color: isSelected ? '#d4900a' : '#c4a66a' }}
                >
                  {method.name}
                </span>
                {isSelected && <span className="ml-auto text-xs" style={{ color: '#d4900a' }}>✦</span>}
              </div>
              <p className="text-parchment-500 text-xs leading-relaxed">{method.description}</p>
              <p
                className="text-xs mt-2 font-fantasy"
                style={{ color: isSelected ? '#d4900a80' : '#3a2614' }}
              >
                {method.tag}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
