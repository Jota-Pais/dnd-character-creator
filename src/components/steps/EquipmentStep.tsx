import { useEffect } from 'react'
import { useCharacterStore } from '../../stores/characterStore'
import { getClass, CLASS_PRESENTATION } from '../../utils/classUtils'
import { getBackground } from '../../utils/backgroundUtils'
import { getItemName, isEquipmentStepComplete } from '../../utils/equipmentUtils'
import type { BackgroundEquipment, BackgroundEquipmentItem, FixedItem } from '../../types/equipment'
import { EquipmentMethodSelector } from '../equipment/EquipmentMethodSelector'
import { EquipmentChoiceCard } from '../equipment/EquipmentChoiceCard'

export function EquipmentStep() {
  const draft = useCharacterStore(state => state.draft)
  const setEquipmentMethod = useCharacterStore(state => state.setEquipmentMethod)
  const resolveEquipmentChoice = useCharacterStore(state => state.resolveEquipmentChoice)
  const setRolledGold = useCharacterStore(state => state.setRolledGold)
  const nextStep = useCharacterStore(state => state.nextStep)
  const prevStep = useCharacterStore(state => state.prevStep)

  const cls = draft.class ? getClass(draft.class) : undefined
  const bg = draft.background ? getBackground(draft.background) : undefined
  const classEquipment = cls?.startingEquipment
  const equipment = draft.equipment

  const accent = cls ? (CLASS_PRESENTATION[cls.id]?.accent ?? '#c0961a') : '#c0961a'
  const canAdvance = isEquipmentStepComplete(equipment, classEquipment)

  // Auto-resolve single-option choices (player has no selection to make)
  useEffect(() => {
    if (equipment.method !== 'standard' || !classEquipment) return
    classEquipment.choices.forEach((choice, idx) => {
      if (choice.options.length === 1) {
        const res = equipment.classResolutions[idx]
        if (!res || res.optionIndex !== 0) {
          resolveEquipmentChoice(idx, { optionIndex: 0, pickedIds: res?.pickedIds ?? [] })
        }
      }
    })
  }, [equipment.method]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1">
          Equipamento Inicial
        </h2>
        <p className="text-parchment-500 text-sm">
          Escolha como deseja equipar seu personagem para a aventura.
        </p>
      </div>

      {/* Method selector */}
      {classEquipment && (
        <EquipmentMethodSelector
          method={equipment.method}
          wealthDice={classEquipment.wealthDice}
          wealthMultiplier={classEquipment.wealthMultiplier}
          onChange={setEquipmentMethod}
        />
      )}

      {/* Standard equipment */}
      {equipment.method === 'standard' && classEquipment && (
        <div className="space-y-4">

          {/* Background items */}
          {bg && (
            <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
              <SectionTitle>Do seu Antecedente</SectionTitle>
              <BackgroundItemList
                bgEquipment={bg.equipment}
                chosenToolId={draft.backgroundChoices.tools?.[0]}
              />
            </div>
          )}

          {/* Fixed class items */}
          {classEquipment.fixed.length > 0 && (
            <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
              <SectionTitle>Itens Fixos da Classe</SectionTitle>
              <FixedItemList fixed={classEquipment.fixed} />
            </div>
          )}

          {/* Interactive choices */}
          {classEquipment.choices.length > 0 && (
            <div className="space-y-3">
              <SectionTitle>Escolhas de Equipamento</SectionTitle>
              {classEquipment.choices.map((choice, idx) => (
                <EquipmentChoiceCard
                  key={idx}
                  choiceIndex={idx}
                  choice={choice}
                  resolution={equipment.classResolutions[idx]}
                  onResolve={res => resolveEquipmentChoice(idx, res)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Wealth method */}
      {equipment.method === 'wealth' && classEquipment && (
        <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-5 space-y-4">
          <SectionTitle>Riqueza Inicial</SectionTitle>

          {bg && (
            <div className="pb-4 border-b border-parchment-900">
              <p className="text-xs text-parchment-600 mb-2 uppercase tracking-widest font-fantasy">
                Equipamento do Antecedente (sempre recebido)
              </p>
              <BackgroundItemList
                bgEquipment={bg.equipment}
                chosenToolId={draft.backgroundChoices.tools?.[0]}
              />
            </div>
          )}

          <div>
            <p className="text-parchment-400 text-sm mb-1">
              Role{' '}
              <span className="font-fantasy font-bold text-gold-500">
                {classEquipment.wealthDice}
                {classEquipment.wealthMultiplier > 1 && ` × ${classEquipment.wealthMultiplier}`}
              </span>{' '}
              {classEquipment.wealthUnit} para determinar sua riqueza inicial.
            </p>
            <p className="text-parchment-600 text-xs mb-4">
              Use esse valor para comprar equipamento na lista de itens do PHB.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-parchment-400 text-sm font-fantasy whitespace-nowrap">
                Total rolado:
              </label>
              <input
                type="number"
                min="0"
                value={equipment.rolledGold ?? ''}
                onChange={e => {
                  const val = parseInt(e.target.value, 10)
                  if (!isNaN(val) && val >= 0) setRolledGold(val)
                }}
                className="w-24 px-3 py-1.5 rounded-lg border text-sm text-center font-fantasy"
                style={{
                  backgroundColor: '#0a0704',
                  borderColor: equipment.rolledGold !== null ? '#c0961a' : '#2a1e0f',
                  color: '#d4b06a',
                  outline: 'none',
                }}
                placeholder="0"
              />
              <span className="text-parchment-500 text-sm">{classEquipment.wealthUnit}</span>
            </div>
          </div>
        </div>
      )}

      {/* Mobile nav */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-parchment-900 px-4 py-3 flex justify-between items-center lg:hidden"
        style={{ backgroundColor: '#0a0704ee', backdropFilter: 'blur(8px)' }}
      >
        <button
          onClick={prevStep}
          className="px-4 py-2 text-parchment-500 hover:text-parchment-300 transition-colors text-sm font-fantasy"
        >
          ← Voltar
        </button>
        <button
          onClick={nextStep}
          disabled={!canAdvance}
          className="px-6 py-2 rounded-xl font-fantasy font-bold text-sm tracking-wide transition-all"
          style={{
            backgroundColor: canAdvance ? accent : '#3a2614',
            color: canAdvance ? '#0a0704' : '#5a3e24',
            cursor: canAdvance ? 'pointer' : 'not-allowed',
          }}
        >
          Continuar ✦
        </button>
      </div>

      {/* Desktop nav */}
      <div className="hidden lg:flex justify-end gap-3 pt-4">
        <button
          onClick={prevStep}
          className="px-4 py-2 text-parchment-500 hover:text-parchment-300 transition-colors font-fantasy text-sm"
        >
          ← Voltar
        </button>
        <button
          onClick={nextStep}
          disabled={!canAdvance}
          className="px-6 py-2 rounded-xl font-fantasy font-bold text-sm tracking-wide transition-all"
          style={{
            backgroundColor: canAdvance ? accent : '#3a2614',
            color: canAdvance ? '#0a0704' : '#5a3e24',
            cursor: canAdvance ? 'pointer' : 'not-allowed',
          }}
        >
          Continuar ✦
        </button>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold font-fantasy text-parchment-600 uppercase tracking-widest mb-3">
      {children}
    </h4>
  )
}

function BackgroundItemList({
  bgEquipment,
  chosenToolId,
}: {
  bgEquipment: BackgroundEquipment
  chosenToolId?: string
}) {
  const FOCUS_LABEL: Record<string, string> = {
    arcane: 'Foco Arcano',
    druidic: 'Foco Druídico',
    holy: 'Símbolo Sagrado',
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {bgEquipment.items.map((item, idx) => (
        <BgItemChip key={idx} item={item} chosenToolId={chosenToolId} focusLabel={FOCUS_LABEL} />
      ))}
      <span className="text-xs px-2 py-1 rounded-md border border-gold-900/60 text-gold-600 font-fantasy">
        💰 {bgEquipment.goldPo} po
      </span>
    </div>
  )
}

function BgItemChip({
  item,
  chosenToolId,
  focusLabel,
}: {
  item: BackgroundEquipmentItem
  chosenToolId?: string
  focusLabel: Record<string, string>
}) {
  let label: string
  let italic = false

  if (item.kind === 'specific') {
    const name = getItemName(item.id)
    label = item.quantity > 1 ? `${item.quantity}× ${name}` : name
  } else if (item.kind === 'chosen-tool') {
    label = chosenToolId ? getItemName(chosenToolId) : 'Ferramenta do Antecedente'
    italic = !chosenToolId
  } else {
    label = `${focusLabel[item.group] ?? item.group} (à escolher)`
    italic = true
  }

  return (
    <span
      className={`text-xs px-2 py-1 rounded-md border border-parchment-800 text-parchment-400${italic ? ' italic' : ''}`}
    >
      {label}
    </span>
  )
}

function FixedItemList({ fixed }: { fixed: FixedItem[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {fixed.map((item, idx) => (
        <span
          key={idx}
          className="text-xs px-2 py-1 rounded-md border border-parchment-800 text-parchment-400"
        >
          {item.quantity > 1 ? `${item.quantity}× ` : ''}{getItemName(item.id)}
        </span>
      ))}
    </div>
  )
}
