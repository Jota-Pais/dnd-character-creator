import { useState } from 'react'
import type { OrdemCharacterDraft, ParanormalPowerChoice, ParanormalSourceKey } from '../../types/character'
import type { ParanormalPower } from '../../types/paranormalPower'
import type { OrdemElement, ParanormalElement } from '../../types/ritual'
import { PARANORMAL_ELEMENTS } from '../../types/ritual'
import { useOrdemStore } from '../../stores/characterStore'
import { ELEMENT_NAMES, ELEMENT_COLORS, getAvailableRituals, getRitualById, ritualNeedsElementChoice } from '../../utils/ritualUtils'
import { ORDEM_CLASSES } from '../../utils/classUtils'
import { getTrilhaGrantedRituals, POWER_PARAM_SPECS } from '../../utils/characterUtils'
import {
  getAvailableExpansionPowers,
  getLearnRitualMaxCircle,
  getSourceAcquisitionNex,
} from '../../utils/paranormalPowerUtils'

type Props = {
  draft: OrdemCharacterDraft
  sourceKey: ParanormalSourceKey
  power: ParanormalPower
  choice: ParanormalPowerChoice
}

/**
 * Sub-escolha de 2º nível do poder paranormal escolhido: o ritual do Aprender Ritual (círculo
 * limitado pelo NEX de aquisição), o elemento do Resistir a Elemento, ou o poder de OUTRA
 * classe da Expansão de Conhecimento (com o parâmetro dele aninhado, ex. Especialista em
 * Elemento). Grava via setParanormalSubChoice (merge na instância).
 */
export function ParanormalSubChoicePicker({ draft, sourceKey, power, choice }: Props) {
  if (!power.choice) return null
  switch (power.choice.kind) {
    case 'element':
      return <ElementPicker sourceKey={sourceKey} choice={choice} />
    case 'ritual':
      return <RitualPicker draft={draft} sourceKey={sourceKey} choice={choice} />
    case 'class-power':
      return <ClassPowerPicker draft={draft} sourceKey={sourceKey} choice={choice} />
  }
}

function ElementPicker({ sourceKey, choice }: { sourceKey: ParanormalSourceKey; choice: ParanormalPowerChoice }) {
  const setParanormalSubChoice = useOrdemStore(state => state.setParanormalSubChoice)
  return (
    <div className="mt-3 pt-3 border-t border-parchment-900/50">
      <p className="text-xs font-bold text-gold-500 mb-1.5">
        Escolha o elemento
        <span className="font-normal text-parchment-600"> — este poder conta como um poder do elemento escolhido.</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PARANORMAL_ELEMENTS.map(element => (
          <ElementChip
            key={element}
            element={element}
            active={choice.element === element}
            onClick={() => setParanormalSubChoice(sourceKey, { element })}
          />
        ))}
      </div>
      {!choice.element && <PendingNote text="Escolha um elemento para completar este poder." />}
    </div>
  )
}

function RitualPicker({ draft, sourceKey, choice }: {
  draft: OrdemCharacterDraft
  sourceKey: ParanormalSourceKey
  choice: ParanormalPowerChoice
}) {
  const setParanormalSubChoice = useOrdemStore(state => state.setParanormalSubChoice)
  const [browsing, setBrowsing] = useState(!choice.ritualId)
  const maxCircle = getLearnRitualMaxCircle(getSourceAcquisitionNex(sourceKey))
  const chosen = choice.ritualId ? getRitualById(choice.ritualId) : undefined

  // Instâncias já ocupadas: rituais escolhidos pelo Ocultista, concedidos por trilha e de outras
  // fontes de Aprender Ritual. Rituais de elemento único somem da lista; multi-elemento seguem
  // (pode-se conhecer uma instância por elemento) e a duplicata real é barrada nos chips.
  const occupiedSingle = new Set<string>()
  const occupiedInstances = new Set<string>()
  const track = (ritualId: string, element: OrdemElement | undefined, multi: boolean) => {
    if (multi) { if (element) occupiedInstances.add(`${ritualId}::${element}`) }
    else occupiedSingle.add(ritualId)
  }
  draft.ritualChoices.forEach((id, slotIndex) => {
    if (!id) return
    const ritual = getRitualById(id)
    if (!ritual) return
    track(id, draft.ritualElementChoices[slotIndex], ritual.elements.length > 1)
  })
  for (const granted of getTrilhaGrantedRituals(draft)) {
    track(granted.ritual.id, granted.ritual.elements[0], granted.ritual.elements.length > 1)
  }
  for (const [key, other] of Object.entries(draft.paranormalPowerChoices)) {
    if (key === sourceKey || other?.powerId !== 'learn-ritual' || !other.ritualId) continue
    const ritual = getRitualById(other.ritualId)
    if (!ritual) continue
    track(other.ritualId, other.ritualElement, ritual.elements.length > 1)
  }

  if (browsing || !chosen) {
    const options = getAvailableRituals(maxCircle)
      .filter(r => r.id === choice.ritualId || ritualNeedsElementChoice(r) || !occupiedSingle.has(r.id))
    return (
      <div className="mt-3 pt-3 border-t border-parchment-900/50 space-y-2">
        <p className="text-xs font-bold text-gold-500">
          Escolha o ritual aprendido
          <span className="font-normal text-parchment-600"> — até o {maxCircle}º círculo nesta escolha (NEX {getSourceAcquisitionNex(sourceKey)}%).</span>
        </p>
        {chosen && (
          <button onClick={() => setBrowsing(false)} className="text-xs font-bold font-fantasy text-red-400 hover:text-red-300">
            ✕ Cancelar troca
          </button>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {options.map(r => (
            <button
              key={r.id}
              onClick={() => {
                setParanormalSubChoice(sourceKey, { ritualId: r.id, ritualElement: undefined })
                setBrowsing(false)
              }}
              className={`text-left p-3 rounded-xl border transition-colors ${
                choice.ritualId === r.id
                  ? 'bg-red-950/20 border-red-900'
                  : 'bg-parchment-950/80 border-parchment-800 hover:border-gold-500 hover:bg-parchment-900/50'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-fantasy text-gold-400 font-bold leading-none">{r.name}</span>
                <span className="text-[10px] text-parchment-500 font-bold uppercase tracking-wider">{r.circle}º C.</span>
              </div>
              <div className="flex gap-1.5 mb-1">
                {r.elements.map(e => (
                  <span key={e} className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${ELEMENT_COLORS[e]}`}>{ELEMENT_NAMES[e]}</span>
                ))}
              </div>
              <p className="text-xs text-parchment-400 line-clamp-2 leading-relaxed">{r.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-parchment-900/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-parchment-400">
          <span className="text-gold-500 font-bold">Ritual aprendido:</span>{' '}
          <span className="font-fantasy text-parchment-200">{chosen.name}</span>{' '}
          <span className="text-parchment-600">({chosen.circle}º círculo)</span>
        </p>
        <button
          onClick={() => setBrowsing(true)}
          className="px-2.5 py-1 bg-parchment-900 text-parchment-200 hover:bg-parchment-800 text-xs font-bold rounded shadow-sm"
        >
          Trocar
        </button>
      </div>
      {ritualNeedsElementChoice(chosen) && (
        <div className="mt-2">
          <p className="text-xs font-bold text-gold-500 mb-1.5">
            Escolha o elemento deste ritual
            <span className="font-normal text-parchment-600"> — o poder conta como um poder desse elemento.</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {chosen.elements.map(element => {
              const used = choice.ritualElement !== element && occupiedInstances.has(`${chosen.id}::${element}`)
              return (
                <ElementChip
                  key={element}
                  element={element}
                  active={choice.ritualElement === element}
                  disabled={used}
                  title={used ? 'Esta instância ritual+elemento já é conhecida' : undefined}
                  onClick={() => setParanormalSubChoice(sourceKey, { ritualElement: element })}
                />
              )
            })}
          </div>
          {!choice.ritualElement && <PendingNote text="Escolha o elemento para completar este poder." />}
        </div>
      )}
    </div>
  )
}

function ClassPowerPicker({ draft, sourceKey, choice }: {
  draft: OrdemCharacterDraft
  sourceKey: ParanormalSourceKey
  choice: ParanormalPowerChoice
}) {
  const setParanormalSubChoice = useOrdemStore(state => state.setParanormalSubChoice)
  const [browsing, setBrowsing] = useState(!choice.classPowerId)
  const options = getAvailableExpansionPowers(draft, sourceKey)
  const chosen = choice.classPowerId ? options.find(o => o.power.id === choice.classPowerId)?.power : undefined
  const spec = choice.classPowerId ? POWER_PARAM_SPECS[choice.classPowerId] : undefined

  if (browsing || !chosen) {
    return (
      <div className="mt-3 pt-3 border-t border-parchment-900/50 space-y-2">
        <p className="text-xs font-bold text-gold-500">
          Escolha um poder de OUTRA classe
          <span className="font-normal text-parchment-600"> — os pré-requisitos dele precisam ser atendidos.</span>
        </p>
        {chosen && (
          <button onClick={() => setBrowsing(false)} className="text-xs font-bold font-fantasy text-red-400 hover:text-red-300">
            ✕ Cancelar troca
          </button>
        )}
        <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
          {ORDEM_CLASSES.filter(c => c.id !== draft.class).map(cls => (
            <div key={cls.id}>
              <p className="text-[10px] uppercase tracking-wider font-bold text-parchment-500 mb-1">Poderes de {cls.name}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {options.filter(o => o.power.classIds.includes(cls.id)).map(({ power, available, reasons }) => (
                  <button
                    key={power.id}
                    onClick={() => {
                      setParanormalSubChoice(sourceKey, { classPowerId: power.id, classPowerParams: undefined })
                      setBrowsing(false)
                    }}
                    disabled={!available}
                    title={!available ? reasons.join(' · ') : undefined}
                    className={`text-left p-3 rounded-xl border transition-colors ${
                      choice.classPowerId === power.id
                        ? 'bg-red-950/20 border-red-900'
                        : available
                          ? 'bg-parchment-950/80 border-parchment-800 hover:border-gold-500 hover:bg-parchment-900/50'
                          : 'bg-parchment-950/40 border-parchment-900 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-fantasy text-gold-400 font-bold leading-tight">{power.name}</span>
                      {power.prerequisite && (
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold text-amber-500/90 bg-amber-950/30 border border-amber-900 shrink-0">
                          Requer {power.prerequisite}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-parchment-400 line-clamp-2 leading-relaxed">{power.description}</p>
                    {!available && <p className="text-[11px] text-amber-500/90 mt-1 leading-snug">⛔ {reasons.join(' · ')}</p>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-parchment-900/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-parchment-400">
          <span className="text-gold-500 font-bold">Poder de outra classe:</span>{' '}
          <span className="font-fantasy text-parchment-200">{chosen.name}</span>
        </p>
        <button
          onClick={() => setBrowsing(true)}
          className="px-2.5 py-1 bg-parchment-900 text-parchment-200 hover:bg-parchment-800 text-xs font-bold rounded shadow-sm"
        >
          Trocar
        </button>
      </div>
      <p className="text-parchment-500 text-xs mt-1 leading-relaxed">{chosen.description}</p>
      {spec?.kind === 'element' && (
        <div className="mt-2">
          <p className="text-xs font-bold text-gold-500 mb-1.5">Escolha o elemento de {chosen.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {PARANORMAL_ELEMENTS.map(element => (
              <ElementChip
                key={element}
                element={element}
                active={choice.classPowerParams?.[0] === element}
                onClick={() => setParanormalSubChoice(sourceKey, { classPowerParams: [element] })}
              />
            ))}
          </div>
          {!choice.classPowerParams?.[0] && <PendingNote text="Escolha o elemento para completar este poder." />}
        </div>
      )}
    </div>
  )
}

function ElementChip({ element, active, disabled, title, onClick }: {
  element: ParanormalElement | OrdemElement
  active: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded border transition-all ${
        active
          ? ELEMENT_COLORS[element]
          : disabled
            ? 'text-parchment-800 border-parchment-900 opacity-40 cursor-not-allowed'
            : 'text-parchment-600 border-parchment-800 hover:border-parchment-600'
      }`}
    >
      {ELEMENT_NAMES[element]}
    </button>
  )
}

function PendingNote({ text }: { text: string }) {
  return <p className="text-red-400/80 text-xs mt-1.5">{text}</p>
}
