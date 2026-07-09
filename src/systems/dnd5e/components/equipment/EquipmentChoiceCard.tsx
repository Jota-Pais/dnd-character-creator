import type {
  EquipmentChoice, EquipmentChoiceItem, ChoiceResolution,
  Weapon, GeneralItem, Tool,
} from '../../types/equipment'
import {
  describeEquipmentOption, isChoiceResolved,
  getWeaponsForFilter, getToolsForCategory, getFocusGroupItems,
} from '../../utils/equipmentUtils'

type FilterItem = Extract<EquipmentChoiceItem, { kind: 'weapon-filter' | 'tool-filter' | 'focus-group' }>

type Props = {
  choiceIndex: number
  choice: EquipmentChoice
  resolution: ChoiceResolution | undefined
  onResolve: (resolution: ChoiceResolution) => void
}

export function EquipmentChoiceCard({ choiceIndex, choice, resolution, onResolve }: Props) {
  const label = String.fromCharCode(65 + choiceIndex)
  const resolved = isChoiceResolved(choice, resolution)
  const hasMultipleOptions = choice.options.length > 1

  // For single-option choices, treat optionIndex as 0 even before the store is updated
  const effectiveResolution: ChoiceResolution = resolution ?? { optionIndex: -1, pickedIds: [] }
  const effectiveOptionIndex = !hasMultipleOptions ? 0 : effectiveResolution.optionIndex
  const selectedOption = effectiveOptionIndex >= 0
    ? choice.options[effectiveOptionIndex]
    : null

  const filterItem = selectedOption?.find(
    (item): item is FilterItem =>
      item.kind === 'weapon-filter' || item.kind === 'tool-filter' || item.kind === 'focus-group',
  ) ?? null

  function selectOption(optIdx: number) {
    onResolve({ optionIndex: optIdx, pickedIds: [] })
  }

  function togglePick(id: string, max: number) {
    const current = effectiveResolution.pickedIds
    let next: string[]
    if (current.includes(id)) {
      next = current.filter(x => x !== id)
    } else if (max === 1) {
      next = [id]
    } else if (current.length < max) {
      next = [...current, id]
    } else {
      return
    }
    onResolve({ optionIndex: effectiveOptionIndex, pickedIds: next })
  }

  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold font-fantasy text-gold-600 uppercase tracking-widest">
          Escolha {label}
        </span>
        {resolved && (
          <span className="text-xs text-green-600 font-bold">✓</span>
        )}
      </div>

      {hasMultipleOptions && (
        <div className="flex flex-col gap-2 mb-3">
          {choice.options.map((option, optIdx) => {
            const isSelected = effectiveResolution.optionIndex === optIdx
            return (
              <button
                key={optIdx}
                onClick={() => selectOption(optIdx)}
                className="text-left px-3 py-2 rounded-lg border text-sm transition-all"
                style={{
                  borderColor: isSelected ? '#c0961a' : '#2a1e0f',
                  backgroundColor: isSelected ? '#c0961a15' : 'transparent',
                  color: isSelected ? '#d4b06a' : '#6a5540',
                }}
              >
                <span
                  className="font-bold font-fantasy mr-2"
                  style={{ color: isSelected ? '#c0961a' : '#4a3520' }}
                >
                  {optIdx + 1}.
                </span>
                {describeEquipmentOption(option)}
              </button>
            )
          })}
        </div>
      )}

      {selectedOption && filterItem && (
        <div className={hasMultipleOptions ? 'pt-3 border-t border-parchment-900' : ''}>
          <SubPicker
            item={filterItem}
            pickedIds={effectiveResolution.pickedIds}
            onToggle={togglePick}
          />
        </div>
      )}
    </div>
  )
}

function SubPicker({
  item,
  pickedIds,
  onToggle,
}: {
  item: FilterItem
  pickedIds: string[]
  onToggle: (id: string, max: number) => void
}) {
  if (item.kind === 'weapon-filter') {
    const weapons = getWeaponsForFilter(item.filter)
    return <ItemGrid items={weapons} pickedIds={pickedIds} max={item.picks} onToggle={onToggle} />
  }
  if (item.kind === 'tool-filter') {
    const tools = getToolsForCategory(item.category)
    return <ItemGrid items={tools} pickedIds={pickedIds} max={item.picks} onToggle={onToggle} />
  }
  if (item.kind === 'focus-group') {
    const focusItems = getFocusGroupItems(item.group)
    const GROUP_LABEL: Record<string, string> = {
      arcane: 'foco arcano',
      druidic: 'foco druídico',
      holy: 'símbolo sagrado',
    }
    return (
      <div>
        <p className="text-xs text-parchment-600 mb-2">
          Escolha um {GROUP_LABEL[item.group] ?? item.group}:
        </p>
        <ItemGrid items={focusItems} pickedIds={pickedIds} max={item.picks} onToggle={onToggle} />
      </div>
    )
  }
}

function ItemGrid({
  items,
  pickedIds,
  max,
  onToggle,
}: {
  items: (Weapon | Tool | GeneralItem)[]
  pickedIds: string[]
  max: number
  onToggle: (id: string, max: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const picked = pickedIds.includes(item.id)
        const disabled = !picked && pickedIds.length >= max && max > 1
        return (
          <button
            key={item.id}
            onClick={() => onToggle(item.id, max)}
            disabled={disabled}
            className="text-xs px-2 py-1 rounded-lg border transition-all"
            style={{
              borderColor: picked ? '#c0961a' : '#2a1e0f',
              backgroundColor: picked ? '#c0961a18' : 'transparent',
              color: picked ? '#d4b06a' : disabled ? '#3a2e20' : '#7a6550',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {item.name}
          </button>
        )
      })}
    </div>
  )
}
