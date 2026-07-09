import type { Background } from '../../types/background'
import { BACKGROUND_PRESENTATION, getSkillName, TOOL_CHOICE_LABEL } from '../../utils/backgroundUtils'

type Props = {
  background: Background
  selected: boolean
  onSelect: () => void
}

export function BackgroundCard({ background, selected, onSelect }: Props) {
  const presentation = BACKGROUND_PRESENTATION[background.id]
  const accent = presentation?.accent ?? '#d4900a'

  const toolChoice = background.choices.find(c => c.kind === 'tool-choice')
  const langChoice = background.choices.find(c => c.kind === 'language-choice')

  const tags: string[] = []
  if (toolChoice && toolChoice.kind === 'tool-choice') tags.push(TOOL_CHOICE_LABEL[toolChoice.from])
  if (langChoice && langChoice.kind === 'language-choice') {
    tags.push(`${langChoice.count} idioma${langChoice.count > 1 ? 's' : ''}`)
  }

  return (
    <button
      onClick={onSelect}
      className="text-left p-4 rounded-xl border-2 transition-all w-full"
      style={{
        borderColor: selected ? `${accent}80` : '#2a1f0e',
        backgroundColor: selected ? `${accent}10` : '#0f0a04',
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-2xl">{presentation?.emoji ?? '📜'}</span>
        <span
          className="font-fantasy font-bold text-sm leading-tight"
          style={{ color: selected ? accent : '#c4a66a' }}
        >
          {background.name}
        </span>
        {selected && <span className="ml-auto text-xs flex-shrink-0" style={{ color: accent }}>✦</span>}
      </div>

      <div className="flex flex-wrap gap-1 mb-1.5">
        {background.skillProficiencies.map(skill => (
          <span
            key={skill}
            className="text-xs px-1.5 py-0.5 rounded font-fantasy"
            style={{
              backgroundColor: selected ? `${accent}18` : '#1a1007',
              color: selected ? accent : '#7a5a30',
            }}
          >
            {getSkillName(skill)}
          </span>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <span key={tag} className="text-xs text-parchment-700 font-fantasy">
              + {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
