import { useState } from 'react'
import { useOrdemStore } from '../../stores/characterStore'
import { getRitualSlotsCount, getMaxRitualCircle, getAvailableRituals, getRitualSlotNex, getSlotRitualElement, ritualNeedsElementChoice, getGrantedRitualElement, getRitualById, ELEMENT_NAMES, ELEMENT_COLORS } from '../../utils/ritualUtils'
import { getTrilhaGrantedRituals } from '../../utils/characterUtils'
import { getLearnRitualSlots, type LearnRitualSlot } from '../../utils/paranormalPowerUtils'
import { isStepComplete } from '../../utils/draftValidation'
import { STEP_LABELS } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'
import type { OrdemElement, OrdemRitualCircle } from '../../types/ritual'
import { StepNav } from '../common/StepNav'
import { RitualSlotCard } from '../rituals/RitualSlotCard'

/** Dono de uma instância ritual+elemento já conhecida — usado para não oferecer duplicatas. */
type Occupancy = { owner: string; ritualId: string; element: OrdemElement | undefined }

export function RitualsStep() {
  // Chave do slot aberto: 'slot:<i>' (Ocultista) ou 'learn:<sourceKey>' (Aprender Ritual).
  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const draft = useOrdemStore(state => state.draft)
  const nex = useOrdemStore(state => state.draft.nex)
  const charClass = useOrdemStore(state => state.draft.class)
  const ritualChoices = useOrdemStore(state => state.draft.ritualChoices)
  const ritualElementChoices = useOrdemStore(state => state.draft.ritualElementChoices)
  const updateDraft = useOrdemStore(state => state.updateDraft)
  const setParanormalSubChoice = useOrdemStore(state => state.setParanormalSubChoice)
  const nextStep = useOrdemStore(state => state.nextStep)
  const prevStep = useOrdemStore(state => state.prevStep)

  const isOccultist = charClass === 'occultist'
  const slotCount = isOccultist ? getRitualSlotsCount(nex) : 0
  const maxCircle = getMaxRitualCircle(nex)
  const learnSlots = getLearnRitualSlots(draft)

  // Instâncias ritual+elemento já conhecidas, com a fonte de cada uma: slots do Ocultista
  // (só os ABERTOS pelo NEX — padrão slice), slots do Aprender Ritual e rituais de trilha.
  // Um slot nunca conta contra si mesmo, por isso a lista guarda o dono.
  const occupancies: Occupancy[] = []
  ritualChoices.slice(0, slotCount).forEach((id, i) => {
    const ritual = id ? getRitualById(id) : undefined
    if (!id || !ritual) return
    occupancies.push({ owner: `slot:${i}`, ritualId: id, element: getSlotRitualElement(ritual, i, ritualElementChoices) })
  })
  for (const slot of learnSlots) {
    if (!slot.ritual) continue
    occupancies.push({ owner: `learn:${slot.key}`, ritualId: slot.ritual.id, element: slot.element ?? undefined })
  }
  for (const granted of getTrilhaGrantedRituals(draft)) {
    occupancies.push({
      owner: `granted:${granted.ritual.id}`,
      ritualId: granted.ritual.id,
      element: getGrantedRitualElement(granted.ritual, ritualElementChoices),
    })
  }

  /** Rituais de elemento único já conhecidos por OUTRA fonte — somem da lista de opções. */
  const singleOccupiedBy = (owner: string): Set<string> => {
    const set = new Set<string>()
    for (const o of occupancies) {
      if (o.owner === owner) continue
      const ritual = getRitualById(o.ritualId)
      if (ritual && !ritualNeedsElementChoice(ritual)) set.add(o.ritualId)
    }
    return set
  }

  /** Instâncias ritual+elemento de OUTRA fonte — o chip daquele elemento fica travado. */
  const instanceOccupiedBy = (owner: string): Set<string> => {
    const set = new Set<string>()
    for (const o of occupancies) {
      if (o.owner === owner || !o.element) continue
      set.add(`${o.ritualId}::${o.element}`)
    }
    return set
  }

  const optionsFor = (owner: string, circle: OrdemRitualCircle, selectedId: string | null | undefined) => {
    const occupied = singleOccupiedBy(owner)
    return getAvailableRituals(circle).filter(r => r.id === selectedId || ritualNeedsElementChoice(r) || !occupied.has(r.id))
  }

  const handleSelect = (index: number, ritualId: string) => {
    const newChoices = [...ritualChoices]
    newChoices[index] = ritualId
    updateDraft({ ritualChoices: newChoices })
  }

  const handleElement = (slotIndex: number, element: OrdemElement) => {
    updateDraft({ ritualElementChoices: { ...ritualElementChoices, [slotIndex]: element } })
  }

  const canAdvance = isStepComplete(draft, 'rituals')
  const disabledReason = learnSlots.some(s => !s.complete)
    ? 'Escolha o ritual concedido pelo poder Aprender Ritual'
    : 'Escolha todos os rituais pendentes'

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-fantasy text-gold-400 flex items-center gap-2">
          {STEP_LABELS.rituals}
        </h2>
        {isOccultist && (
          <span className="text-sm font-fantasy text-parchment-500 bg-parchment-900 px-3 py-1 rounded-full border border-parchment-800 shadow-inner">
            Círculo Máx: {maxCircle}º
          </span>
        )}
      </div>

      {isOccultist ? (
        <p className="text-parchment-400 text-sm mb-6 leading-relaxed bg-parchment-950/30 p-4 rounded-xl border border-parchment-900">
          Como <strong className="text-gold-500 font-fantasy">Ocultista (Escolhido pelo Outro Lado)</strong>,
          você aprende 3 rituais iniciais, e ganha +1 ritual a cada NEX alcançado.
          Os círculos que você pode escolher são limitados pelo seu NEX.
        </p>
      ) : (
        // Qualquer classe pode ter rituais (trilha ou o poder paranormal Aprender Ritual) — sem
        // este aviso, um Combatente com Aprender Ritual veria uma tela que mente.
        <div className="bg-parchment-950 border border-parchment-900 rounded-xl p-8 text-center text-parchment-600">
          Apenas <strong className="text-gold-500">Ocultistas</strong> escolhem rituais na criação de personagem.
        </div>
      )}

      {isOccultist && (
        <div className="space-y-6">
          {Array.from({ length: slotCount }).map((_, i) => {
            const selectedId = ritualChoices[i]
            const isInitial = i < 3
            const slotNex = getRitualSlotNex(i)
            const owner = `slot:${i}`
            // Ocultista começa com 3 de 1º círculo. Os demais são limitados pelo círculo
            // conjurável no NEX em que o ritual foi ganho.
            const slotMaxCircle = (isInitial ? 1 : getMaxRitualCircle(slotNex)) as OrdemRitualCircle
            const usedInstances = instanceOccupiedBy(owner)

            return (
              <RitualSlotCard
                key={i}
                label={isInitial ? `Ritual Inicial ${i + 1}` : `Ritual NEX ${slotNex}%`}
                hint={`Até ${slotMaxCircle}º Círculo`}
                options={optionsFor(owner, slotMaxCircle, selectedId)}
                selectedId={selectedId}
                selectedElement={ritualElementChoices[i]}
                open={openSlot === owner}
                onOpen={() => setOpenSlot(owner)}
                onClose={() => setOpenSlot(null)}
                onSelect={id => { handleSelect(i, id); setOpenSlot(null) }}
                onElement={element => handleElement(i, element)}
                isElementUsed={element => usedInstances.has(`${selectedId}::${element}`)}
              />
            )
          })}
        </div>
      )}

      <LearnRitualSlots
        slots={learnSlots}
        openSlot={openSlot}
        setOpenSlot={setOpenSlot}
        optionsFor={optionsFor}
        instanceOccupiedBy={instanceOccupiedBy}
        onSelect={(key, ritualId) => setParanormalSubChoice(key, { ritualId, ritualElement: undefined })}
        onElement={(key, element) => setParanormalSubChoice(key, { ritualElement: element })}
      />

      <GrantedRitualsBlock draft={draft} />

      <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={canAdvance} disabledReason={disabledReason} />
    </div>
  )
}

/**
 * Rituais concedidos pelo poder paranormal Aprender Ritual: um slot por escolha do poder, com o
 * teto de círculo do NEX em que ele foi adquirido. Escreve direto na instância do poder
 * (`paranormalPowerChoices`), então a etapa Poderes Paranormais reflete a escolha na hora.
 */
function LearnRitualSlots({ slots, openSlot, setOpenSlot, optionsFor, instanceOccupiedBy, onSelect, onElement }: {
  slots: LearnRitualSlot[]
  openSlot: string | null
  setOpenSlot: (key: string | null) => void
  optionsFor: (owner: string, circle: OrdemRitualCircle, selectedId: string | null | undefined) => ReturnType<typeof getAvailableRituals>
  instanceOccupiedBy: (owner: string) => Set<string>
  onSelect: (key: LearnRitualSlot['key'], ritualId: string) => void
  onElement: (key: LearnRitualSlot['key'], element: OrdemElement) => void
}) {
  if (slots.length === 0) return null
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gold-500">Rituais do poder Aprender Ritual</h3>
        <p className="text-parchment-600 text-xs mt-1 leading-relaxed">
          Cada escolha do poder paranormal <strong className="text-parchment-400">Aprender Ritual</strong> concede
          um ritual aqui — ele não conta nos limites do Ocultista, e o círculo máximo é o do NEX em que o poder foi adquirido.
        </p>
      </div>
      {slots.map(slot => {
        const owner = `learn:${slot.key}`
        const selectedId = slot.ritual?.id ?? null
        const usedInstances = instanceOccupiedBy(owner)
        return (
          <RitualSlotCard
            key={slot.key}
            label={slot.sourceLabel}
            hint={`Até ${slot.maxCircle}º Círculo`}
            note="Concedido pelo poder paranormal Aprender Ritual."
            options={optionsFor(owner, slot.maxCircle, selectedId)}
            selectedId={selectedId}
            selectedElement={slot.element ?? undefined}
            open={openSlot === owner}
            onOpen={() => setOpenSlot(owner)}
            onClose={() => setOpenSlot(null)}
            onSelect={id => { onSelect(slot.key, id); setOpenSlot(null) }}
            onElement={element => onElement(slot.key, element)}
            isElementUsed={element => usedInstances.has(`${selectedId}::${element}`)}
          />
        )
      })}
    </div>
  )
}

/** Rituais concedidos por features de trilha: read-only, com a fonte de cada um. */
function GrantedRitualsBlock({ draft }: { draft: OrdemCharacterDraft }) {
  // Só trilha: os do Aprender Ritual são slots editáveis acima, e apareceriam duas vezes aqui.
  const granted = getTrilhaGrantedRituals(draft)
  if (granted.length === 0) return null
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gold-500">Rituais concedidos</h3>
      <p className="text-parchment-600 text-xs -mt-2">
        Aprendidos automaticamente pela sua trilha — não contam nos limites acima.
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
