import type { RaceChoice, AbilityScore } from '../../types/race'
import type { RaceChoiceSelections } from '../../types/character'
import { ALL_ABILITY_SCORES, ABILITY_LABELS } from '../../utils/abilityScoreUtils'
import { SKILLS, LANGUAGES, TOOL_NAMES } from '../../utils/raceUtils'

type Props = {
  choices: RaceChoice[]
  selections: RaceChoiceSelections
  accent: string
  onChange: (updates: Partial<RaceChoiceSelections>) => void
}

export function ChoicePanel({ choices, selections, accent, onChange }: Props) {
  if (choices.length === 0) return null

  return (
    <div className="space-y-5">
      {choices.map((choice, idx) => {
        switch (choice.kind) {
          case 'ability':
            return (
              <AbilityChoiceField
                key={idx}
                count={choice.count}
                from={choice.from}
                accent={accent}
                selected={selections.abilityBonuses ?? []}
                onSelect={abilities => onChange({ abilityBonuses: abilities })}
              />
            )
          case 'skill':
            return (
              <SkillChoiceField
                key={idx}
                count={choice.count}
                from={choice.from}
                accent={accent}
                selected={selections.skills ?? []}
                onSelect={skills => onChange({ skills })}
              />
            )
          case 'language':
            return (
              <LanguageChoiceField
                key={idx}
                count={choice.count}
                accent={accent}
                selected={selections.languages ?? []}
                onSelect={languages => onChange({ languages })}
              />
            )
          case 'tool':
            return (
              <ToolChoiceField
                key={idx}
                from={choice.from}
                accent={accent}
                selected={selections.tools ?? []}
                onSelect={tools => onChange({ tools })}
              />
            )
          case 'cantrip':
            return (
              <CantripPlaceholder
                key={idx}
                accent={accent}
                value={selections.cantrip ?? ''}
                onChange={cantrip => onChange({ cantrip })}
              />
            )
          case 'feat':
            return (
              <FeatPlaceholder
                key={idx}
                accent={accent}
                value={selections.feat ?? ''}
                onChange={feat => onChange({ feat })}
              />
            )
        }
      })}
    </div>
  )
}

// ─── Sub-componentes de escolha ──────────────────────────────────────────────

type AbilityChoiceFieldProps = {
  count: number
  from: AbilityScore[] | 'any' | 'any-except-charisma'
  accent: string
  selected: AbilityScore[]
  onSelect: (abilities: AbilityScore[]) => void
}

function AbilityChoiceField({ count, from, accent, selected, onSelect }: AbilityChoiceFieldProps) {
  const available =
    from === 'any'
      ? ALL_ABILITY_SCORES
      : from === 'any-except-charisma'
        ? ALL_ABILITY_SCORES.filter(a => a !== 'CHA')
        : from

  function toggle(ability: AbilityScore) {
    if (selected.includes(ability)) {
      onSelect(selected.filter(a => a !== ability))
    } else if (selected.length < count) {
      onSelect([...selected, ability])
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-2 font-fantasy">
        Escolha {count} atributo{count > 1 ? 's' : ''} (+1 cada){' '}
        <span className="text-parchment-600 font-normal">({selected.length}/{count})</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {available.map(ability => {
          const isSelected = selected.includes(ability)
          const isDisabled = !isSelected && selected.length >= count
          return (
            <button
              key={ability}
              onClick={() => toggle(ability)}
              disabled={isDisabled}
              className="px-3 py-2 rounded-lg border-2 font-bold text-sm transition-all font-fantasy"
              style={{
                borderColor: isSelected ? accent : isDisabled ? 'rgba(58, 38, 20, 0.5)' : 'rgba(90, 62, 36, 0.7)',
                backgroundColor: isSelected ? `${accent}20` : 'transparent',
                color: isSelected ? accent : isDisabled ? '#5a3e24' : '#b8946f',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {ABILITY_LABELS[ability].short}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type SkillChoiceFieldProps = {
  count: number
  from: string[] | 'any'
  accent: string
  selected: string[]
  onSelect: (skills: string[]) => void
}

function SkillChoiceField({ count, from, accent, selected, onSelect }: SkillChoiceFieldProps) {
  const available = from === 'any' ? SKILLS : SKILLS.filter(s => (from as string[]).includes(s.id))

  function toggle(skillId: string) {
    if (selected.includes(skillId)) {
      onSelect(selected.filter(s => s !== skillId))
    } else if (selected.length < count) {
      onSelect([...selected, skillId])
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-2 font-fantasy">
        Escolha {count} perícia{count > 1 ? 's' : ''}{' '}
        <span className="text-parchment-600 font-normal">({selected.length}/{count})</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {available.map(skill => {
          const isSelected = selected.includes(skill.id)
          const isDisabled = !isSelected && selected.length >= count
          return (
            <button
              key={skill.id}
              onClick={() => toggle(skill.id)}
              disabled={isDisabled}
              className="px-2 py-1.5 rounded-lg border text-xs text-left transition-all"
              style={{
                borderColor: isSelected ? accent : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : isDisabled ? '#5a3e24' : '#9a7650',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {skill.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type LanguageChoiceFieldProps = {
  count: number
  accent: string
  selected: string[]
  onSelect: (languages: string[]) => void
}

function LanguageChoiceField({ count, accent, selected, onSelect }: LanguageChoiceFieldProps) {
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

type ToolChoiceFieldProps = {
  from: string[]
  accent: string
  selected: string[]
  onSelect: (tools: string[]) => void
}

function ToolChoiceField({ from, accent, selected, onSelect }: ToolChoiceFieldProps) {
  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-2 font-fantasy">
        Escolha uma ferramenta
      </p>
      <div className="flex flex-col gap-1.5">
        {from.map(toolId => {
          const isSelected = selected.includes(toolId)
          return (
            <button
              key={toolId}
              onClick={() => onSelect([toolId])}
              className="px-3 py-2 rounded-lg border text-sm text-left transition-all"
              style={{
                borderColor: isSelected ? accent : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : '#9a7650',
              }}
            >
              {TOOL_NAMES[toolId] ?? toolId}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CantripPlaceholder({
  accent,
  value,
  onChange,
}: {
  accent: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-1 font-fantasy">
        Truque de Mago{' '}
        <span className="text-gold-700 text-xs font-normal">(lista completa em breve)</span>
      </p>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Ex: Ilusão Menor, Luz, Prestidígitação…"
        className="w-full px-3 py-2 rounded-lg border text-parchment-200 placeholder-parchment-700 text-sm bg-parchment-950/50 focus:outline-none transition-colors"
        style={{ borderColor: value ? accent : 'rgba(58, 38, 20, 0.6)' }}
      />
    </div>
  )
}

function FeatPlaceholder({
  accent,
  value,
  onChange,
}: {
  accent: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-1 font-fantasy">
        Talento{' '}
        <span className="text-gold-700 text-xs font-normal">(lista completa em breve)</span>
      </p>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Ex: Sentido Aguçado, Atirador…"
        className="w-full px-3 py-2 rounded-lg border text-parchment-200 placeholder-parchment-700 text-sm bg-parchment-950/50 focus:outline-none transition-colors"
        style={{ borderColor: value ? accent : 'rgba(58, 38, 20, 0.6)' }}
      />
    </div>
  )
}
