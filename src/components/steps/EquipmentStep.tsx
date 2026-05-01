import { useEffect, useState } from 'react'
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

          <WealthRoller
            wealthDice={classEquipment.wealthDice}
            wealthMultiplier={classEquipment.wealthMultiplier}
            wealthUnit={classEquipment.wealthUnit}
            storedGold={equipment.rolledGold}
            accent={accent}
            onChange={setRolledGold}
          />
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

function parseDice(wealthDice: string): { count: number; sides: number } {
  const m = wealthDice.match(/^(\d+)d(\d+)$/)
  return m ? { count: parseInt(m[1]), sides: parseInt(m[2]) } : { count: 1, sides: 6 }
}

function WealthRoller({
  wealthDice,
  wealthMultiplier,
  wealthUnit,
  storedGold,
  accent,
  onChange,
}: {
  wealthDice: string
  wealthMultiplier: number
  wealthUnit: string
  storedGold: number | null
  accent: string
  onChange: (gold: number | null) => void
}) {
  const { count, sides } = parseDice(wealthDice)
  const [values, setValues] = useState<(number | null)[]>(() => Array(count).fill(null))

  const allFilled = values.every(v => v !== null)
  const diceSum = values.reduce<number>((acc, v) => acc + (v ?? 0), 0)
  const total = allFilled ? diceSum * wealthMultiplier : null

  function rollAll() {
    const rolled = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
    setValues(rolled)
    onChange(rolled.reduce((a, b) => a + b, 0) * wealthMultiplier)
  }

  function rollOne(idx: number) {
    const newVal = Math.floor(Math.random() * sides) + 1
    const next = [...values]
    next[idx] = newVal
    setValues(next)
    if (next.every(v => v !== null)) {
      onChange(next.reduce<number>((a, b) => a + (b ?? 0), 0) * wealthMultiplier)
    }
  }

  function setOne(idx: number, raw: string) {
    const next = [...values]
    if (!raw.trim()) {
      next[idx] = null
      setValues(next)
      onChange(null)
      return
    }
    const parsed = parseInt(raw, 10)
    if (isNaN(parsed)) return
    next[idx] = Math.max(1, Math.min(sides, parsed))
    setValues(next)
    if (next.every(v => v !== null)) {
      onChange(next.reduce<number>((a, b) => a + (b ?? 0), 0) * wealthMultiplier)
    } else {
      onChange(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-parchment-400 text-sm mb-4">
          Role{' '}
          <span className="font-fantasy font-bold" style={{ color: accent }}>
            {wealthDice}{wealthMultiplier > 1 ? ` × ${wealthMultiplier}` : ''}
          </span>{' '}
          {wealthUnit} — insira cada dado individualmente ou clique em 🎲 para rolar.
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          {values.map((val, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1.5">
              <span className="text-xs text-parchment-700 font-fantasy">d{sides}</span>
              <input
                type="number"
                min={1}
                max={sides}
                value={val ?? ''}
                onChange={e => setOne(idx, e.target.value)}
                className="w-12 h-12 rounded-lg text-center text-base font-bold font-fantasy transition-all"
                style={{
                  backgroundColor: '#0a0704',
                  border: `2px solid ${val !== null ? accent : '#2a1e0f'}`,
                  color: val !== null ? accent : '#5a3e24',
                  outline: 'none',
                }}
                placeholder="—"
              />
              <button
                onClick={() => rollOne(idx)}
                title="Rolar este dado"
                className="text-sm text-parchment-700 hover:text-parchment-400 transition-colors leading-none"
              >
                🎲
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={rollAll}
          className="px-4 py-2 rounded-lg text-sm font-fantasy font-bold transition-all"
          style={{
            backgroundColor: `${accent}18`,
            color: accent,
            border: `1px solid ${accent}40`,
          }}
        >
          🎲 Rolar Todos
        </button>
      </div>

      {allFilled && total !== null && (
        <div
          className="rounded-xl p-4 text-center space-y-1"
          style={{ backgroundColor: `${accent}0d`, border: `1px solid ${accent}25` }}
        >
          <p className="text-xs text-parchment-600 font-fantasy uppercase tracking-widest">
            Resultado
          </p>
          <p className="text-parchment-500 text-sm font-fantasy">
            {values.join(' + ')}
            {wealthMultiplier > 1 && (
              <> = {diceSum} × {wealthMultiplier}</>
            )}
          </p>
          <p className="font-fantasy font-bold text-2xl" style={{ color: accent }}>
            {total} {wealthUnit}
          </p>
          <p className="text-parchment-700 text-xs">
            Use esse valor para comprar equipamento na lista do PHB.
          </p>
        </div>
      )}

      {!allFilled && storedGold !== null && (
        <p className="text-parchment-700 text-xs font-fantasy">
          Resultado anterior registrado:{' '}
          <span className="text-parchment-500">{storedGold} {wealthUnit}</span>
          {' '}— role novamente para atualizar.
        </p>
      )}
    </div>
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
