import type { OrdemAttributes } from '../../types/character'
import { useOrdemStore } from '../../stores/characterStore'
import { ATTRIBUTES, ATTRIBUTE_POINTS_TOTAL, ATTRIBUTE_MAX, getAttributeSum, isValidAttributes } from '../../utils/attributeUtils'
import { StepNav } from '../common/StepNav'

export function AttributesStep() {
  const attributes = useOrdemStore(state => state.draft.attributes)
  const setAttribute = useOrdemStore(state => state.setAttribute)
  const nextStep = useOrdemStore(state => state.nextStep)
  const prevStep = useOrdemStore(state => state.prevStep)

  const sum = getAttributeSum(attributes)
  const remaining = ATTRIBUTE_POINTS_TOTAL - sum
  const zeroedCount = Object.values(attributes).filter(v => v === 0).length
  const canAdvance = isValidAttributes(attributes)

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1 text-center">
        Quais são suas capacidades?
      </h2>
      <p className="text-parchment-500 text-sm mb-6 text-center leading-relaxed">
        Todos começam em 1. Distribua 4 pontos como quiser — teto inicial 3.
        Pode zerar um único atributo pra ganhar +1 ponto extra.
      </p>

      <div className="flex items-center gap-3 p-3 rounded-xl border border-parchment-900 bg-parchment-950/60 mb-4">
        <span className="text-parchment-500 text-sm font-fantasy">Pontos restantes</span>
        <span
          className="text-2xl font-bold font-fantasy"
          style={{ color: remaining === 0 ? '#dc2626' : '#fb923c' }}
        >
          {remaining}
        </span>
        <span className="text-parchment-700 text-sm">/ {ATTRIBUTE_POINTS_TOTAL}</span>
      </div>

      <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 overflow-hidden divide-y divide-parchment-900">
        {ATTRIBUTES.map(attr => {
          const id = attr.id as keyof OrdemAttributes
          const current = attributes[id]
          const isZero = current === 0
          const canDecrease = current > 1 || (current === 1 && zeroedCount === 0)
          const canIncrease = current < ATTRIBUTE_MAX && sum < ATTRIBUTE_POINTS_TOTAL

          return (
            <div key={attr.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-parchment-200 font-fantasy font-semibold text-sm">{attr.name}</p>
                <p className="text-parchment-600 text-xs truncate">{attr.description}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => canDecrease && setAttribute(id, current - 1)}
                  disabled={!canDecrease}
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-all disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: canDecrease ? '#2a1f0e' : '#120c04',
                    color: canDecrease ? '#c4a66a' : '#3a2614',
                  }}
                >
                  −
                </button>
                <span
                  className="font-bold font-mono text-sm w-6 text-center"
                  style={{ color: isZero ? '#fb923c' : '#e8dcc4' }}
                >
                  {current}
                </span>
                <button
                  onClick={() => canIncrease && setAttribute(id, current + 1)}
                  disabled={!canIncrease}
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-all disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: canIncrease ? '#2a1f0e' : '#120c04',
                    color: canIncrease ? '#c4a66a' : '#3a2614',
                  }}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {zeroedCount > 1 && (
        <p className="text-red-500 text-xs mt-3 text-center font-fantasy">
          Só é possível zerar um atributo.
        </p>
      )}

      <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={canAdvance} disabledReason="Distribua os pontos" />
    </div>
  )
}
