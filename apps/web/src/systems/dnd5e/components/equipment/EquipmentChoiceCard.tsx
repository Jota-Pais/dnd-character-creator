import type {
  EquipmentChoice, EquipmentChoiceItem, ChoiceResolution,
  Weapon, GeneralItem, Tool,
} from '@rpg/rules/systems/dnd5e/types/equipment'
import {
  describeEquipmentOption, isChoiceResolved,
  getWeaponsForFilter, getToolsForCategory, getFocusGroupItems,
  getWeaponById, getArmorById, getPackById, formatPackContents, getToolById,
} from '@rpg/rules/systems/dnd5e/utils/equipmentUtils'
import { describeToolWithoutProficiency } from '@rpg/rules/systems/dnd5e/utils/proficiencyUtils'
import { formatWeaponSummary, formatArmorSummary } from '@rpg/rules/systems/dnd5e/utils/weaponFormat'

/** O que o personagem já domina, pra guiar a escolha de ferramenta/instrumento sem decidir por ele. */
type ToolGuidance = {
  proficientToolIds: string[]
  /** Conjura com instrumento musical como foco (bardo, p. 53). */
  instrumentFocus: boolean
}

/**
 * Detalhes dos itens específicos de uma opção, pra decidir sem abrir o livro:
 * armas (dano/propriedades), armaduras/escudos (CA/propriedades), pacotes (conteúdo) e
 * ferramentas sem proficiência (o que isso custa, p. 156).
 * Itens triviais (corda, tocha...) não geram linha — o nome já basta.
 */
function optionItemDetails(option: EquipmentChoiceItem[], guidance: ToolGuidance): { name: string; detail: string }[] {
  const out: { name: string; detail: string }[] = []
  for (const it of option) {
    if (it.kind !== 'specific') continue
    const w = getWeaponById(it.id)
    if (w) { out.push({ name: w.name, detail: formatWeaponSummary(w) }); continue }
    const a = getArmorById(it.id)
    if (a) { out.push({ name: a.name, detail: formatArmorSummary(a) }); continue }
    const p = getPackById(it.id)
    if (p) { out.push({ name: p.name, detail: formatPackContents(p) }); continue }
    const t = getToolById(it.id)
    if (t && !guidance.proficientToolIds.includes(t.id)) {
      const focus = guidance.instrumentFocus && t.category === 'musical-instrument'
      out.push({ name: t.name, detail: `sem proficiência — ${describeToolWithoutProficiency(focus)}` })
    }
  }
  return out
}

type FilterItem = Extract<EquipmentChoiceItem, { kind: 'weapon-filter' | 'tool-filter' | 'focus-group' }>

type Props = {
  choiceIndex: number
  choice: EquipmentChoice
  resolution: ChoiceResolution | undefined
  onResolve: (resolution: ChoiceResolution) => void
  /** Ferramentas/instrumentos que o personagem já domina (getAllGrantedTools). */
  proficientToolIds?: string[]
  instrumentFocus?: boolean
}

export function EquipmentChoiceCard({
  choiceIndex, choice, resolution, onResolve, proficientToolIds = [], instrumentFocus = false,
}: Props) {
  const guidance: ToolGuidance = { proficientToolIds, instrumentFocus }
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
            const details = optionItemDetails(option, guidance)
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
                {details.map(d => (
                  <span key={d.name} className="block text-[11px] opacity-75 mt-0.5 ml-5">
                    {d.name}: {d.detail}
                  </span>
                ))}
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
            proficientToolIds={proficientToolIds}
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
  proficientToolIds,
}: {
  item: FilterItem
  pickedIds: string[]
  onToggle: (id: string, max: number) => void
  proficientToolIds: string[]
}) {
  if (item.kind === 'weapon-filter') {
    const weapons = getWeaponsForFilter(item.filter)
    return <ItemGrid items={weapons} pickedIds={pickedIds} max={item.picks} onToggle={onToggle} />
  }
  if (item.kind === 'tool-filter') {
    // Os que o personagem domina vêm primeiro, com selo — guia sem pré-selecionar nada.
    const proficient = new Set(proficientToolIds)
    const tools = getToolsForCategory(item.category)
      .map((tool, i) => ({ tool, i }))
      .sort((a, b) => Number(proficient.has(b.tool.id)) - Number(proficient.has(a.tool.id)) || a.i - b.i)
      .map(({ tool }) => tool)
    return (
      <ItemGrid items={tools} pickedIds={pickedIds} max={item.picks} onToggle={onToggle} proficientIds={proficient} />
    )
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
  proficientIds,
}: {
  items: (Weapon | Tool | GeneralItem)[]
  pickedIds: string[]
  max: number
  onToggle: (id: string, max: number) => void
  /** Itens marcados com "✓ você é proficiente" (ferramentas/instrumentos). */
  proficientIds?: Set<string>
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const picked = pickedIds.includes(item.id)
        const disabled = !picked && pickedIds.length >= max && max > 1
        // Armas mostram dano + propriedades pra decidir sem abrir o livro (F1); ferramentas/focos só o nome.
        const isWeapon = 'weaponType' in item
        return (
          <button
            key={item.id}
            onClick={() => onToggle(item.id, max)}
            disabled={disabled}
            className={`text-xs rounded-lg border transition-all text-left ${isWeapon ? 'px-2.5 py-1.5' : 'px-2 py-1'}`}
            style={{
              borderColor: picked ? '#c0961a' : '#2a1e0f',
              backgroundColor: picked ? '#c0961a18' : 'transparent',
              color: picked ? '#d4b06a' : disabled ? '#3a2e20' : '#7a6550',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <span className={isWeapon ? 'font-semibold' : ''}>{item.name}</span>
            {isWeapon && (
              <span className="block text-[11px] opacity-80 mt-0.5">{formatWeaponSummary(item as Weapon)}</span>
            )}
            {proficientIds?.has(item.id) && (
              <span className="block text-[10px] text-green-600 mt-0.5">✓ você é proficiente</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
