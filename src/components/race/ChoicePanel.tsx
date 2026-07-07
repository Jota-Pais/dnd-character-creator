import type { RaceChoice, AbilityScore } from '../../types/race'
import type { RaceChoiceSelections } from '../../types/character'
import { ALL_ABILITY_SCORES, ABILITY_LABELS } from '../../utils/abilityScoreUtils'
import { SKILLS, LANGUAGES, TOOL_NAMES } from '../../utils/raceUtils'
import { getCantrips, SPELLS } from '../../utils/spellUtils'

type Props = {
  choices: RaceChoice[]
  selections: RaceChoiceSelections
  accent: string
  onChange: (updates: Partial<RaceChoiceSelections>) => void
  excludedLanguages?: string[]
  excludedSkills?: string[]
  excludedTools?: string[]
}

export function ChoicePanel({ choices, selections, accent, onChange, excludedLanguages, excludedSkills, excludedTools }: Props) {
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
                excluded={excludedSkills}
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
                excluded={excludedLanguages}
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
                excluded={excludedTools}
                onSelect={tools => onChange({ tools })}
              />
            )
          case 'cantrip':
            return (
              <CantripChoiceField
                key={idx}
                from={choice.from}
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
  excluded?: string[]
  onSelect: (skills: string[]) => void
}

function SkillChoiceField({ count, from, accent, selected, excluded, onSelect }: SkillChoiceFieldProps) {
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
          const isExcluded = excluded?.includes(skill.id) ?? false
          const isSelected = selected.includes(skill.id)
          const isDisabled = isExcluded || (!isSelected && selected.length >= count)
          return (
            <button
              key={skill.id}
              onClick={() => toggle(skill.id)}
              disabled={isDisabled}
              title={isExcluded ? 'Você já possui esta perícia de outra fonte' : undefined}
              className="px-2 py-1.5 rounded-lg border text-xs text-left transition-all"
              style={{
                borderColor: isSelected ? accent : isExcluded ? '#1e150a' : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : isExcluded ? '#3a2614' : isDisabled ? '#5a3e24' : '#9a7650',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {isExcluded ? '✓ ' : ''}{skill.name}
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
  excluded?: string[]
  onSelect: (languages: string[]) => void
}

function LanguageChoiceField({ count, accent, selected, excluded, onSelect }: LanguageChoiceFieldProps) {
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
          const isExcluded = excluded?.includes(lang.id) ?? false
          const isSelected = selected.includes(lang.id)
          const isDisabled = isExcluded || (!isSelected && selected.length >= count)
          return (
            <button
              key={lang.id}
              onClick={() => toggle(lang.id)}
              disabled={isDisabled}
              className="px-2 py-1.5 rounded-lg border text-xs text-left transition-all"
              style={{
                borderColor: isSelected ? accent : isExcluded ? '#1e150a' : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : isExcluded ? '#3a2614' : isDisabled ? '#5a3e24' : '#9a7650',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {isExcluded ? '✓ ' : ''}{lang.name}
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
  excluded?: string[]
  onSelect: (tools: string[]) => void
}

function ToolChoiceField({ from, accent, selected, excluded, onSelect }: ToolChoiceFieldProps) {
  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-2 font-fantasy">
        Escolha uma ferramenta
      </p>
      <div className="flex flex-col gap-1.5">
        {from.map(toolId => {
          const isExcluded = excluded?.includes(toolId) ?? false
          const isSelected = selected.includes(toolId)
          return (
            <button
              key={toolId}
              onClick={() => { if (!isExcluded) onSelect([toolId]) }}
              disabled={isExcluded}
              title={isExcluded ? 'Você já possui esta ferramenta de outra fonte' : undefined}
              className="px-3 py-2 rounded-lg border text-sm text-left transition-all"
              style={{
                borderColor: isSelected ? accent : isExcluded ? '#1e150a' : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : isExcluded ? '#3a2614' : '#9a7650',
                cursor: isExcluded ? 'not-allowed' : 'pointer',
              }}
            >
              {isExcluded ? '✓ ' : ''}{TOOL_NAMES[toolId] ?? toolId}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type CantripChoiceFieldProps = {
  from: 'wizard-list' | string[]
  accent: string
  value: string
  onChange: (v: string) => void
}

function CantripChoiceField({ from, accent, value, onChange }: CantripChoiceFieldProps) {
  const options =
    from === 'wizard-list'
      ? getCantrips('wizard')
      : SPELLS.filter(s => s.level === 0 && from.includes(s.id))

  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-2 font-fantasy">
        Escolha 1 truque de mago{' '}
        <span className="text-parchment-600 font-normal">({value ? '1' : '0'}/1)</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {options.map(spell => {
          const isSelected = value === spell.id
          return (
            <button
              key={spell.id}
              onClick={() => onChange(isSelected ? '' : spell.id)}
              className="px-2 py-1.5 rounded-lg border text-xs text-left transition-all"
              style={{
                borderColor: isSelected ? accent : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : '#9a7650',
              }}
            >
              {spell.name}
            </button>
          )
        })}
      </div>
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
