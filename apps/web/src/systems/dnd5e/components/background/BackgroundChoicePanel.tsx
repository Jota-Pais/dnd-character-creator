import type { BackgroundChoice } from '@rpg/rules/systems/dnd5e/types/background'
import type { BackgroundChoiceSelections } from '@rpg/rules/systems/dnd5e/types/character'
import {
  getToolsByCategory, TOOL_CHOICE_LABEL, getChosenBackgroundItem,
  type BackgroundItemChoice,
} from '@rpg/rules/systems/dnd5e/utils/backgroundUtils'
import { getItemName } from '@rpg/rules/systems/dnd5e/utils/equipmentUtils'
import { LanguagePicker } from '../common/LanguagePicker'
import { RepeatedProficiencyNotes } from '../common/RepeatedProficiencyNotes'
import { REPEATED_OPTION_STYLE } from '../common/repeatedChipStyle'

type Props = {
  choices: BackgroundChoice[]
  /** "Um item entre opções" do equipamento do antecedente: slot aqui, ao lado de idioma e ferramenta. */
  itemChoices?: BackgroundItemChoice[]
  selections: BackgroundChoiceSelections
  accent: string
  onChange: (updates: Partial<BackgroundChoiceSelections>) => void
  excludedLanguages?: string[]
  excludedTools?: string[]
  /** Ferramenta ou idioma escolhido aqui que outra fonte já dá (id → aviso): fica marcado, para trocar (p. 125). */
  repeated?: Record<string, string>
}

export function BackgroundChoicePanel({
  choices, itemChoices = [], selections, accent, onChange, excludedLanguages, excludedTools, repeated = {},
}: Props) {
  if (choices.length === 0 && itemChoices.length === 0) return null

  return (
    <div className="space-y-5">
      {choices.map((choice, idx) => {
        if (choice.kind === 'tool-choice') {
          return (
            <ToolCategoryField
              key={idx}
              from={choice.from}
              accent={accent}
              selected={selections.tools ?? []}
              excluded={excludedTools}
              repeated={repeated}
              onSelect={tools => onChange({ tools })}
            />
          )
        }
        return (
          <LanguageField
            key={idx}
            count={choice.count}
            accent={accent}
            selected={selections.languages ?? []}
            excluded={excludedLanguages}
            repeated={repeated}
            onSelect={languages => onChange({ languages })}
          />
        )
      })}
      {itemChoices.map(choice => (
        <ItemChoiceField
          key={choice.key}
          choice={choice}
          accent={accent}
          selected={getChosenBackgroundItem(choice, selections)}
          onSelect={id => onChange({ items: { ...selections.items, [choice.key]: id } })}
        />
      ))}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

type ToolCategoryFieldProps = {
  from: 'artisan' | 'musical-instrument' | 'gaming-set'
  accent: string
  selected: string[]
  excluded?: string[]
  repeated: Record<string, string>
  onSelect: (tools: string[]) => void
}

function ToolCategoryField({ from, accent, selected, excluded, repeated, onSelect }: ToolCategoryFieldProps) {
  const tools = getToolsByCategory(from)
  const label = TOOL_CHOICE_LABEL[from]

  function handleClick(toolId: string) {
    if (selected.includes(toolId)) {
      onSelect([])
    } else {
      onSelect([toolId])
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-2 font-fantasy">
        Escolha {label.toLowerCase()}{' '}
        <span className="text-parchment-600 font-normal">({selected.length}/1)</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {tools.map(tool => {
          const isSelected = selected.includes(tool.id)
          // Marcada e repetida por outra fonte (ficha antiga): à vista com o aviso, para trocar.
          const repeatedNote = isSelected ? repeated[tool.id] : undefined
          const isExcluded = !isSelected && (excluded?.includes(tool.id) ?? false)
          return (
            <button
              key={tool.id}
              onClick={() => { if (!isExcluded) handleClick(tool.id) }}
              disabled={isExcluded}
              title={repeatedNote ?? (isExcluded ? 'Você já possui esta ferramenta de outra fonte' : undefined)}
              className="px-3 py-2 rounded-lg border text-sm text-left transition-all"
              style={{
                borderColor: isSelected ? accent : isExcluded ? '#1e150a' : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : isExcluded ? '#3a2614' : '#9a7650',
                cursor: isExcluded ? 'not-allowed' : 'pointer',
                ...(repeatedNote ? REPEATED_OPTION_STYLE : {}),
              }}
            >
              {repeatedNote ? '⚠ ' : isExcluded ? '✓ ' : ''}{tool.name}
            </button>
          )
        })}
      </div>
      <RepeatedProficiencyNotes ids={selected.filter(id => tools.some(t => t.id === id))} notes={repeated} />
    </div>
  )
}

type ItemChoiceFieldProps = {
  choice: BackgroundItemChoice
  accent: string
  selected: string | null
  onSelect: (id: string) => void
}

function ItemChoiceField({ choice, accent, selected, onSelect }: ItemChoiceFieldProps) {
  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-2 font-fantasy">
        Equipamento: {choice.label}{' '}
        <span className="text-parchment-600 font-normal">({selected ? 1 : 0}/1)</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {choice.options.map(id => {
          const isSelected = selected === id
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              aria-pressed={isSelected}
              className="px-3 py-2 rounded-lg border text-sm text-left transition-all"
              style={{
                borderColor: isSelected ? accent : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : '#9a7650',
              }}
            >
              {getItemName(id)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type LanguageFieldProps = {
  count: number
  accent: string
  selected: string[]
  excluded?: string[]
  repeated: Record<string, string>
  onSelect: (languages: string[]) => void
}

function LanguageField({ count, accent, selected, excluded, repeated, onSelect }: LanguageFieldProps) {
  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-2 font-fantasy">
        Escolha {count} idioma{count > 1 ? 's' : ''}{' '}
        <span className="text-parchment-600 font-normal">({selected.length}/{count})</span>
      </p>
      <LanguagePicker count={count} selected={selected} excluded={excluded} repeated={repeated} accent={accent} onChange={onSelect} />
    </div>
  )
}
