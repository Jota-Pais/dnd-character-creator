import { useState } from 'react'
import { useOrdemStore } from '../../stores/characterStore'
import { getRitualSlotsCount, getMaxRitualCircle, getAvailableRituals, getRitualSlotNex, isRitualStepComplete, ritualNeedsElementChoice, getGrantedRitualElement, ELEMENT_NAMES, ELEMENT_COLORS } from '../../utils/ritualUtils'
import { getGrantedRituals } from '../../utils/characterUtils'
import { getParanormalLearnedRituals } from '../../utils/paranormalPowerUtils'
import { STEP_LABELS } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'
import type { OrdemElement } from '../../types/ritual'
import { StepNav } from '../common/StepNav'

export function RitualsStep() {
  const [openSlot, setOpenSlot] = useState<number | null>(null)
  const draft = useOrdemStore(state => state.draft)
  const nex = useOrdemStore(state => state.draft.nex)
  const charClass = useOrdemStore(state => state.draft.class)
  const ritualChoices = useOrdemStore(state => state.draft.ritualChoices)
  const ritualElementChoices = useOrdemStore(state => state.draft.ritualElementChoices)
  const updateDraft = useOrdemStore(state => state.updateDraft)
  const nextStep = useOrdemStore(state => state.nextStep)
  const prevStep = useOrdemStore(state => state.prevStep)

  if (charClass !== 'occultist') {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-20">
        <h2 className="text-2xl font-fantasy text-gold-400 mb-6 flex items-center gap-2">
          {STEP_LABELS.rituals}
        </h2>
        <div className="bg-parchment-950 border border-parchment-900 rounded-xl p-8 text-center text-parchment-600">
          Apenas <strong className="text-gold-500">Ocultistas</strong> escolhem rituais na criação de personagem.
        </div>
        {/* Qualquer classe pode ter rituais concedidos (trilha ou o poder paranormal Aprender
            Ritual) — sem este bloco, um Combatente com Aprender Ritual veria uma tela que mente. */}
        <GrantedRitualsBlock draft={draft} />
        <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={true} />
      </div>
    )
  }

  const slotCount = getRitualSlotsCount(nex)
  const maxCircle = getMaxRitualCircle(nex)
  const availableRituals = getAvailableRituals(maxCircle)
  // Rituais já aprendidos via poder Aprender Ritual — escolher o mesmo aqui criaria uma
  // duplicata (a instância do poder invalidaria retroativamente na etapa Poderes Paranormais).
  const learnedRituals = getParanormalLearnedRituals(draft)
  const learnedSingleIds = new Set(learnedRituals.filter(l => l.ritual.elements.length === 1).map(l => l.ritual.id))

  const handleSelect = (index: number, ritualId: string) => {
    const newChoices = [...ritualChoices]
    newChoices[index] = ritualId
    updateDraft({ ritualChoices: newChoices })
  }

  const handleElement = (slotIndex: number, element: OrdemElement) => {
    updateDraft({ ritualElementChoices: { ...ritualElementChoices, [slotIndex]: element } })
  }

  // Usa o mesmo validador do store (exige slots preenchidos, sem repetição e com o elemento
  // escolhido para rituais multi-elemento), para o botão "Avançar" não divergir do gate de nextStep.
  const isComplete = isRitualStepComplete(nex, charClass, ritualChoices, ritualElementChoices)

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
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
        Os círculos que você pode escolher são limitados pelo seu NEX.
      </p>

      <div className="space-y-6">
        {Array.from({ length: slotCount }).map((_, i) => {
          const selectedId = ritualChoices[i]
          const isInitial = i < 3
          const slotNex = getRitualSlotNex(i)
          const label = isInitial ? `Ritual Inicial ${i + 1}` : `Ritual NEX ${slotNex}%`

          // Ocultista começa com 3 de 1º círculo. Os demais são limitados pelo círculo conjurável
          // no NEX em que o ritual foi ganho.
          const slotMaxCircle = isInitial ? 1 : getMaxRitualCircle(slotNex)
          // Não é possível conhecer o mesmo ritual duas vezes: exclui os já escolhidos em
          // outros slots (mantendo sempre a escolha do próprio slot). Exceção: rituais multi-
          // elemento (ex.: Amaldiçoar Arma) podem ser escolhidos de novo — uma instância por
          // elemento (FAQ oficial) —, a duplicata real (mesmo elemento 2×) é barrada abaixo.
          const chosenElsewhere = new Set(
            ritualChoices.slice(0, slotCount).filter((id, idx): id is string => Boolean(id) && idx !== i)
          )
          const options = getAvailableRituals(slotMaxCircle as 1|2|3|4)
            .filter(r => r.id === selectedId || ritualNeedsElementChoice(r) || (!chosenElsewhere.has(r.id) && !learnedSingleIds.has(r.id)))

          return (
            <div key={i} className="bg-parchment-950/50 border border-parchment-900 rounded-xl p-5 shadow-sm">
              <label className="block text-sm font-bold text-gold-500 mb-3 flex items-center justify-between">
                <span>{label}</span>
                <span className="text-xs font-normal text-parchment-600">Até {slotMaxCircle}º Círculo</span>
              </label>
              
              <div className="mt-1">
                {openSlot === i ? (
                  <div className="space-y-4">
                    <button onClick={() => setOpenSlot(null)} className="text-xs font-bold font-fantasy text-red-400 hover:text-red-300">
                      ✕ Cancelar seleção
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {options.map(r => (
                        <button
                          key={r.id}
                          onClick={() => { handleSelect(i, r.id); setOpenSlot(null) }}
                          className={`text-left p-4 rounded-xl border transition-colors ${selectedId === r.id ? 'bg-red-950/20 border-red-900' : 'bg-parchment-950/80 border-parchment-800 hover:border-gold-500 hover:bg-parchment-900/50'}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-fantasy text-gold-400 font-bold text-lg leading-none">{r.name}</span>
                            <span className="text-[10px] text-parchment-500 font-bold uppercase tracking-wider">{r.circle}º C.</span>
                          </div>
                          <div className="flex gap-1.5 mb-2">
                            {r.elements.map(e => (
                               <span key={e} className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${ELEMENT_COLORS[e]}`}>{ELEMENT_NAMES[e]}</span>
                            ))}
                          </div>
                          <p className="text-xs text-parchment-400 line-clamp-3 leading-relaxed">{r.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : !selectedId ? (
                  <button
                    onClick={() => setOpenSlot(i)}
                    className="w-full py-6 rounded-xl border-2 border-dashed border-parchment-800 hover:border-gold-500/50 hover:bg-parchment-900/20 text-parchment-500 hover:text-gold-400 font-fantasy text-lg transition-all"
                  >
                    + Escolher Ritual
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-black/40 border border-parchment-900/50 relative group">
                    <button
                      onClick={() => setOpenSlot(i)}
                      className="absolute top-3 right-3 px-3 py-1 bg-parchment-900 text-parchment-200 hover:bg-parchment-800 text-xs font-bold rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Trocar
                    </button>
                    {(() => {
                      const r = availableRituals.find(x => x.id === selectedId)
                      if (!r) return null
                      return (
                        <div className="text-sm">
                          <div className="flex items-center flex-wrap gap-2 mb-2 pr-16">
                            <span className="font-bold text-parchment-200 text-lg">{r.name}</span>
                            {r.elements.map(e => (
                              <span key={e} className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${ELEMENT_COLORS[e]}`}>
                                {ELEMENT_NAMES[e]}
                              </span>
                            ))}
                          </div>
                          <p className="text-parchment-500 text-xs mb-3 leading-relaxed">
                          Execução: {r.execution} · Alcance: {r.range} · Alvo: {r.target} · Duração: {r.duration}
                          {r.resistance && ` · Resistência: ${r.resistance}`}
                        </p>
                        <p className="text-parchment-500 leading-relaxed">{r.description}</p>
                        {ritualNeedsElementChoice(r) && (
                          <div className="mt-3 pt-3 border-t border-parchment-900/50">
                            <label className="block text-xs font-bold text-gold-500 mb-1.5">
                              Escolha o elemento deste ritual
                              <span className="font-normal text-parchment-600"> — ele passa a ser só desse elemento (define o tipo do dano). Pode aprender de novo em outro slot, com outro elemento.</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {r.elements.map(e => {
                                const active = ritualElementChoices[i] === e
                                const usedElsewhere = !active && (
                                  ritualChoices.some((otherId, idx) => idx !== i && otherId === r.id && ritualElementChoices[idx] === e)
                                  || learnedRituals.some(l => l.ritual.id === r.id && l.element === e)
                                )
                                return (
                                  <button
                                    key={e}
                                    disabled={usedElsewhere}
                                    title={usedElsewhere ? 'Já usado em outro slot com este ritual' : undefined}
                                    onClick={() => handleElement(i, e)}
                                    className={`text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded border transition-all ${active ? ELEMENT_COLORS[e] : usedElsewhere ? 'text-parchment-800 border-parchment-900 opacity-40 cursor-not-allowed' : 'text-parchment-600 border-parchment-800 hover:border-parchment-600'}`}
                                  >
                                    {ELEMENT_NAMES[e]}
                                  </button>
                                )
                              })}
                            </div>
                            {!ritualElementChoices[i] && (
                              <p className="text-red-400/80 text-xs mt-1.5">Escolha um elemento para poder avançar.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
              </div>
            </div>
          )
        })}
      </div>

      <GrantedRitualsBlock draft={draft} />

      <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={isComplete} disabledReason="Escolha todos os rituais pendentes" />
    </div>
  )
}

/** Rituais concedidos (features de trilha e Aprender Ritual): read-only, com a fonte de cada um. */
function GrantedRitualsBlock({ draft }: { draft: OrdemCharacterDraft }) {
  const granted = getGrantedRituals(draft)
  if (granted.length === 0) return null
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gold-500">Rituais concedidos</h3>
      <p className="text-parchment-600 text-xs -mt-2">
        Aprendidos automaticamente por trilha ou pelo poder Aprender Ritual — não contam nos limites acima.
      </p>
      {granted.map(g => {
        const element = g.element ?? getGrantedRitualElement(g.ritual, draft.ritualElementChoices)
        return (
          <div key={`${g.ritual.id}-${g.source}-${element ?? 'x'}`} className="p-4 rounded-xl bg-black/40 border border-parchment-900/50">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <span className="font-bold text-parchment-200 font-fantasy">{g.ritual.name}</span>
              <span className="text-[10px] text-parchment-500 font-bold uppercase tracking-wider">{g.ritual.circle}º C.</span>
              {(element ? [element] : g.ritual.elements).map(e => (
                <span key={e} className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${ELEMENT_COLORS[e]}`}>
                  {ELEMENT_NAMES[e]}
                </span>
              ))}
              <span className="text-[10px] text-gold-500/90 font-bold">— {g.source}</span>
            </div>
            <p className="text-xs text-parchment-500 leading-relaxed line-clamp-3">{g.ritual.description}</p>
          </div>
        )
      })}
    </div>
  )
}
