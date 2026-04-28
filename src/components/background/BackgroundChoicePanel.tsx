import type { BackgroundChoice } from '../../types/background'
import type { BackgroundChoiceSelections } from '../../types/character'
import { LANGUAGES, getToolsByCategory, TOOL_CHOICE_LABEL } from '../../utils/backgroundUtils'

type Props = {
  choices: BackgroundChoice[]
  selections: BackgroundChoiceSelections
  accent: string
  onChange: (updates: Partial<BackgroundChoiceSelections>) => void
}

export function BackgroundChoicePanel({ choices, selections, accent, onChange }: Props) {
  if (choices.length === 0) return null

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
            onSelect={languages => onChange({ languages })}
          />
        )
      })}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

type ToolCategoryFieldProps = {
  from: 'artisan' | 'musical' | 'gaming'
  accent: string
  selected: string[]
  onSelect: (tools: string[]) => void
}

function ToolCategoryField({ from, accent, selected, onSelect }: ToolCategoryFieldProps) {
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
          return (
            <button
              key={tool.id}
              onClick={() => handleClick(tool.id)}
              className="px-3 py-2 rounded-lg border text-sm text-left transition-all"
              style={{
                borderColor: isSelected ? accent : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : '#9a7650',
              }}
            >
              {tool.name}
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
  onSelect: (languages: string[]) => void
}

function LanguageField({ count, accent, selected, onSelect }: LanguageFieldProps) {
  function toggle(langId: string) {
    if (selected.includes(langId)) {
      onSelect(selected.filter(l => l !== langId))
    } else if (selected.length < count) {
      onSelect([...selected, langId])
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-2 font-fantasy">
        Escolha {count} idioma{count > 1 ? 's' : ''}{' '}
        <span className="text-parchment-600 font-normal">({selected.length}/{count})</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {LANGUAGES.map(lang => {
          const isSelected = selected.includes(lang.id)
          const isDisabled = !isSelected && selected.length >= count
          return (
            <button
              key={lang.id}
              onClick={() => toggle(lang.id)}
              disabled={isDisabled}
              className="px-2 py-1.5 rounded-lg border text-xs text-left transition-all"
              style={{
                borderColor: isSelected ? accent : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : isDisabled ? '#5a3e24' : '#9a7650',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {lang.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
