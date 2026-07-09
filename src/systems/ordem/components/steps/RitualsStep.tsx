import { useOrdemStore } from '../../stores/characterStore'
import { getRitualSlotsCount, getMaxRitualCircle, getAvailableRituals } from '../../utils/ritualUtils'
import { STEP_LABELS } from '../../types/character'

const ELEMENT_COLORS: Record<string, string> = {
  blood: 'text-red-500 bg-red-950/30 border-red-900',
  death: 'text-zinc-400 bg-zinc-950/30 border-zinc-800',
  energy: 'text-purple-400 bg-purple-950/30 border-purple-900',
  knowledge: 'text-amber-500 bg-amber-950/30 border-amber-900',
  fear: 'text-white bg-slate-900/50 border-slate-700',
}

const ELEMENT_NAMES: Record<string, string> = {
  blood: 'Sangue',
  death: 'Morte',
  energy: 'Energia',
  knowledge: 'Conhecimento',
  fear: 'Medo',
}

export function RitualsStep() {
  const nex = useOrdemStore(state => state.draft.nex)
  const charClass = useOrdemStore(state => state.draft.class)
  const ritualChoices = useOrdemStore(state => state.draft.ritualChoices)
  const updateDraft = useOrdemStore(state => state.updateDraft)
  const nextStep = useOrdemStore(state => state.nextStep)
  const prevStep = useOrdemStore(state => state.prevStep)

  if (charClass !== 'occultist') {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
        <h2 className="text-2xl font-fantasy text-gold-400 mb-6 flex items-center gap-2">
          {STEP_LABELS.rituals}
        </h2>
        <div className="bg-parchment-950 border border-parchment-900 rounded-xl p-8 text-center text-parchment-600">
          Apenas <strong className="text-gold-500">Ocultistas</strong> recebem rituais na criação de personagem.
        </div>
        <div className="flex justify-between pt-6 border-t border-parchment-900">
          <button onClick={prevStep} className="px-6 py-2 rounded-xl font-fantasy font-bold text-parchment-500 hover:bg-parchment-950 transition-colors">← Voltar</button>
          <button onClick={nextStep} className="px-6 py-2 rounded-xl font-fantasy font-bold bg-gold-500 text-parchment-950 hover:bg-gold-400 transition-colors">Avançar →</button>
        </div>
      </div>
    )
  }

  const slotCount = getRitualSlotsCount(nex)
  const maxCircle = getMaxRitualCircle(nex)
  const availableRituals = getAvailableRituals(maxCircle)

  const handleSelect = (index: number, ritualId: string) => {
    const newChoices = [...ritualChoices]
    newChoices[index] = ritualId
    updateDraft({ ritualChoices: newChoices })
  }

  const isComplete = ritualChoices.slice(0, slotCount).every(Boolean)

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-fantasy text-gold-400 flex items-center gap-2">
          {STEP_LABELS.rituals}
        </h2>
        <span className="text-sm font-fantasy text-parchment-500 bg-parchment-900 px-3 py-1 rounded-full border border-parchment-800 shadow-inner">
          Círculo Máx: {maxCircle}º
        </span>
      </div>
      
      <p className="text-parchment-400 text-sm mb-6 leading-relaxed bg-parchment-950/30 p-4 rounded-xl border border-parchment-900">
        Como <strong className="text-gold-500 font-fantasy">Ocultista (Escolhido pelo Outro Lado)</strong>, 
        você aprende 3 rituais iniciais, e ganha +1 ritual a cada NEX alcançado. 
        Os círculos que você pode escolher são limitados pelo seu nível.
      </p>

      <div className="space-y-6">
        {Array.from({ length: slotCount }).map((_, i) => {
          const selectedId = ritualChoices[i]
          const isInitial = i < 3
          const label = isInitial ? `Ritual Inicial ${i + 1}` : `Ritual NEX ${5 + (i - 2) * 5}%`
          
          // Ocultista começa com 3 de 1º círculo. Outros são limitados pelo círculo do nível onde foi ganho.
          const slotMaxCircle = isInitial ? 1 : getMaxRitualCircle(5 + (i - 2) * 5)
          const options = getAvailableRituals(slotMaxCircle as 1|2|3|4)

          return (
            <div key={i} className="bg-parchment-950/50 border border-parchment-900 rounded-xl p-5 shadow-sm">
              <label className="block text-sm font-bold text-gold-500 mb-3 flex items-center justify-between">
                <span>{label}</span>
                <span className="text-xs font-normal text-parchment-600">Até {slotMaxCircle}º Círculo</span>
              </label>
              
              <div className="relative">
                <select
                  value={selectedId ?? ''}
                  onChange={e => handleSelect(i, e.target.value)}
                  className="w-full bg-parchment-950 border border-parchment-800 rounded-lg p-3 text-parchment-200 outline-none focus:border-gold-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="" disabled className="text-parchment-700">Escolha um ritual...</option>
                  {/* Agrupar opções por Círculo */}
                  {[1, 2, 3, 4].filter(c => c <= slotMaxCircle).map(circle => {
                    const rits = options.filter(r => r.circle === circle)
                    if (rits.length === 0) return null
                    return (
                      <optgroup key={circle} label={`${circle}º Círculo`} className="text-gold-600 bg-parchment-950 font-fantasy">
                        {rits.map(r => (
                          <option key={r.id} value={r.id} className="text-parchment-300 font-sans">
                            {r.name} ({ELEMENT_NAMES[r.element]})
                          </option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-parchment-600">
                  ▼
                </div>
              </div>

              {selectedId && (
                <div className="mt-4 p-4 rounded-lg bg-black/40 border border-parchment-900/50">
                  {(() => {
                    const r = availableRituals.find(x => x.id === selectedId)
                    if (!r) return null
                    return (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-parchment-200">{r.name}</span>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${ELEMENT_COLORS[r.element]}`}>
                            {ELEMENT_NAMES[r.element]}
                          </span>
                        </div>
                        <p className="text-parchment-500 leading-relaxed">{r.description}</p>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-between pt-6 border-t border-parchment-900">
        <button
          onClick={prevStep}
          className="px-6 py-2 rounded-xl font-fantasy font-bold text-parchment-500 hover:bg-parchment-950 transition-colors"
        >
          ← Voltar
        </button>
        <button
          onClick={nextStep}
          disabled={!isComplete}
          className="px-6 py-2 rounded-xl font-fantasy font-bold bg-gold-500 text-parchment-950 hover:bg-gold-400 disabled:opacity-50 disabled:hover:bg-gold-500 transition-colors"
        >
          Avançar →
        </button>
      </div>
    </div>
  )
}
