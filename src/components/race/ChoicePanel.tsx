import type { RaceChoice, AbilityScore } from '../../types/race'
import type { RaceChoiceSelections } from '../../types/character'
import { ALL_ABILITY_SCORES, ABILITY_LABELS } from '../../utils/abilityScoreUtils'
import { SKILLS, LANGUAGES, TOOL_NAMES } from '../../utils/raceUtils'

type Props = {
  choices: RaceChoice[]
  selections: RaceChoiceSelections
  onChange: (updates: Partial<RaceChoiceSelections>) => void
}

export function ChoicePanel({ choices, selections, onChange }: Props) {
  if (choices.length === 0) return null

  return (
    <div className="space-y-6">
      {choices.map((choice, idx) => {
        switch (choice.kind) {
          case 'ability':
            return (
              <AbilityChoiceField
                key={idx}
                count={choice.count}
                from={choice.from}
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
                selected={selections.skills ?? []}
                onSelect={skills => onChange({ skills })}
              />
            )
          case 'language':
            return (
              <LanguageChoiceField
                key={idx}
                count={choice.count}
                selected={selections.languages ?? []}
                onSelect={languages => onChange({ languages })}
              />
            )
          case 'tool':
            return (
              <ToolChoiceField
                key={idx}
                count={choice.count}
                from={choice.from}
                selected={selections.tools ?? []}
                onSelect={tools => onChange({ tools })}
              />
            )
          case 'cantrip':
            return (
              <CantripPlaceholder
                key={idx}
                value={selections.cantrip ?? ''}
                onChange={cantrip => onChange({ cantrip })}
              />
            )
          case 'feat':
            return (
              <FeatPlaceholder
                key={idx}
                value={selections.feat ?? ''}
                onChange={feat => onChange({ feat })}
              />
            )
        }
      })}
    </div>
  )
}

type AbilityChoiceFieldProps = {
  count: number
  from: AbilityScore[] | 'any' | 'any-except-charisma'
  selected: AbilityScore[]
  onSelect: (abilities: AbilityScore[]) => void
}

function AbilityChoiceField({ count, from, selected, onSelect }: AbilityChoiceFieldProps) {
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
      <p className="text-sm font-medium text-stone-300 mb-2">
        Escolha {count} atributo{count > 1 ? 's' : ''} para receber +1{' '}
        <span className="text-stone-500">({selected.length}/{count})</span>
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
              className={[
                'px-3 py-2 rounded-lg border-2 font-bold text-sm transition-all',
                isSelected
                  ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                  : isDisabled
                    ? 'border-stone-700 bg-stone-900 text-stone-600 cursor-not-allowed'
                    : 'border-stone-600 bg-stone-800 text-stone-300 hover:border-stone-400',
              ].join(' ')}
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
  selected: string[]
  onSelect: (skills: string[]) => void
}

function SkillChoiceField({ count, from, selected, onSelect }: SkillChoiceFieldProps) {
  const available =
    from === 'any' ? SKILLS : SKILLS.filter(s => (from as string[]).includes(s.id))

  function toggle(skillId: string) {
    if (selected.includes(skillId)) {
      onSelect(selected.filter(s => s !== skillId))
    } else if (selected.length < count) {
      onSelect([...selected, skillId])
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-stone-300 mb-2">
        Escolha {count} perícia{count > 1 ? 's' : ''}{' '}
        <span className="text-stone-500">({selected.length}/{count})</span>
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
              className={[
                'px-2 py-1.5 rounded border text-xs text-left transition-all',
                isSelected
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : isDisabled
                    ? 'border-stone-700 text-stone-600 cursor-not-allowed'
                    : 'border-stone-700 text-stone-300 hover:border-stone-500 hover:bg-stone-800',
              ].join(' ')}
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
  selected: string[]
  onSelect: (languages: string[]) => void
}

function LanguageChoiceField({ count, selected, onSelect }: LanguageChoiceFieldProps) {
  function toggle(langId: string) {
    if (selected.includes(langId)) {
      onSelect(selected.filter(l => l !== langId))
    } else if (selected.length < count) {
      onSelect([...selected, langId])
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-stone-300 mb-2">
        Escolha {count} idioma{count > 1 ? 's' : ''}{' '}
        <span className="text-stone-500">({selected.length}/{count})</span>
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
              className={[
                'px-2 py-1.5 rounded border text-xs text-left transition-all',
                isSelected
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : isDisabled
                    ? 'border-stone-700 text-stone-600 cursor-not-allowed'
                    : 'border-stone-700 text-stone-300 hover:border-stone-500 hover:bg-stone-800',
              ].join(' ')}
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
  count: number
  from: string[]
  selected: string[]
  onSelect: (tools: string[]) => void
}

function ToolChoiceField({ from, selected, onSelect }: ToolChoiceFieldProps) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-300 mb-2">Escolha uma ferramenta</p>
      <div className="flex flex-col gap-1.5">
        {from.map(toolId => {
          const isSelected = selected.includes(toolId)
          return (
            <button
              key={toolId}
              onClick={() => onSelect([toolId])}
              className={[
                'px-3 py-2 rounded border text-sm text-left transition-all',
                isSelected
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-stone-700 text-stone-300 hover:border-stone-500 hover:bg-stone-800',
              ].join(' ')}
            >
              {TOOL_NAMES[toolId] ?? toolId}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CantripPlaceholder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-300 mb-1">
        Escolha um truque de mago{' '}
        <span className="text-amber-600 text-xs">(lista completa em breve)</span>
      </p>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Digite o nome do truque"
        className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
      />
    </div>
  )
}

function FeatPlaceholder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-300 mb-1">
        Escolha um talento{' '}
        <span className="text-amber-600 text-xs">(lista completa em breve)</span>
      </p>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Digite o nome do talento"
        className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
      />
    </div>
  )
}
