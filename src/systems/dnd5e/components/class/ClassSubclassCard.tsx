import type { ClassSubclass } from '../../types/class'

type Props = {
  subclass: ClassSubclass
  accent: string
  selected: boolean
  onSelect: () => void
}

/**
 * As características ficam SEMPRE à mostra, não só na subclasse já escolhida: o Colégio/Domínio/
 * Caminho é a decisão mais pesada da etapa, e escolher às cegas pra só então ler o que a
 * subclasse faz é o oposto de manter o controle com o jogador.
 */
export function ClassSubclassCard({ subclass, accent, selected, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className="w-full h-full text-left rounded-xl border-2 p-3 transition-all duration-200"
      style={{
        borderColor: selected ? accent : 'rgba(90, 62, 36, 0.5)',
        backgroundColor: selected ? `${accent}12` : 'rgba(15, 10, 4, 0.6)',
        boxShadow: selected ? `0 0 12px ${accent}20` : 'none',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <h5 className="font-fantasy font-bold text-sm" style={{ color: selected ? accent : undefined }}>
          {subclass.name}
        </h5>
        {selected && <span className="text-sm" style={{ color: accent }}>✦</span>}
      </div>
      <p className="text-parchment-500 text-xs leading-relaxed">{subclass.description}</p>
      {subclass.features.length > 0 && (
        <div
          className="mt-2 space-y-1 border-t pt-2"
          style={{ borderColor: selected ? `${accent}30` : 'rgba(90, 62, 36, 0.3)' }}
        >
          {subclass.features.map(f => (
            <div key={f.name}>
              <span
                className="text-xs font-semibold font-fantasy"
                style={{ color: selected ? accent : '#9a7650' }}
              >
                {f.name}.{' '}
              </span>
              <span className="text-xs text-parchment-500">{f.description}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  )
}
