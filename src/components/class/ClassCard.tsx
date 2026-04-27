import type { GameClass } from '../../types/class'
import { CLASS_PRESENTATION, isActiveCaster, getHpFormula } from '../../utils/classUtils'
import { ABILITY_LABELS } from '../../utils/abilityScoreUtils'

type Props = {
  cls: GameClass
  selected: boolean
  onSelect: () => void
}

export function ClassCard({ cls, selected, onSelect }: Props) {
  const presentation = CLASS_PRESENTATION[cls.id]
  const accent = presentation?.accent ?? '#d4900a'
  const emoji = presentation?.emoji ?? '⚔️'
  const activeCaster = isActiveCaster(cls, 1)

  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-2xl border-2 transition-all duration-200 overflow-hidden"
      style={{
        borderColor: selected ? accent : 'rgba(90, 62, 36, 0.6)',
        backgroundColor: selected ? 'rgba(30, 22, 12, 0.95)' : 'rgba(20, 14, 6, 0.8)',
        boxShadow: selected ? `0 0 20px ${accent}25, 0 4px 12px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <div className="h-1 w-full opacity-80" style={{ backgroundColor: accent }} />

      <div className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <span className="text-3xl">{emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-fantasy font-bold text-parchment-200 text-base leading-tight">
                {cls.name}
              </h3>
              {selected && (
                <span className="ml-auto text-lg flex-shrink-0" style={{ color: accent }}>✦</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span
                className="px-1.5 py-0.5 rounded text-xs font-mono font-bold"
                style={{ backgroundColor: `${accent}20`, color: accent }}
              >
                {getHpFormula(cls)}
              </span>
              {activeCaster && (
                <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-parchment-900 text-parchment-500">
                  ✦ conjurador
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-parchment-500 text-xs leading-relaxed mb-3 line-clamp-2">
          {cls.description}
        </p>

        <div className="flex items-center gap-2 text-xs text-parchment-700 flex-wrap">
          <span>
            {cls.primaryAbility.map(a => ABILITY_LABELS[a].short).join('/')}
          </span>
          <span>·</span>
          <span>{cls.skillChoices.count} perícias</span>
          {cls.subclassLevel === 1 && (
            <>
              <span>·</span>
              <span style={{ color: accent }}>subclasse nível 1</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}
