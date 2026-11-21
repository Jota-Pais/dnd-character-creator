import type { RaceChoice, AbilityScore } from '@rpg/rules/systems/dnd5e/types/race'
import type { RaceChoiceSelections } from '@rpg/rules/systems/dnd5e/types/character'
import { ALL_ABILITY_SCORES, ABILITY_LABELS } from '@rpg/rules/systems/dnd5e/utils/abilityScoreUtils'
import { SKILLS, TOOL_NAMES } from '@rpg/rules/systems/dnd5e/utils/raceUtils'
import { getCantrips, SPELLS } from '@rpg/rules/systems/dnd5e/utils/spellUtils'
import { getFeat } from '@rpg/rules/systems/dnd5e/utils/featUtils'
import { FeatCatalog } from '../common/FeatCatalog'
import { FeatChoiceSlots } from '../common/FeatChoiceSlots'
import { LanguagePicker } from '../common/LanguagePicker'
import { RepeatedProficiencyNotes } from '../common/RepeatedProficiencyNotes'
import { REPEATED_OPTION_STYLE } from '../common/repeatedChipStyle'
import { isChoiceFull, toggleChoice } from '@rpg/rules/systems/dnd5e/utils/choiceToggle'

type Props = {
  choices: RaceChoice[]
  selections: RaceChoiceSelections
  accent: string
  onChange: (updates: Partial<RaceChoiceSelections>) => void
  excludedLanguages?: string[]
  excludedSkills?: string[]
  excludedTools?: string[]
  /**
   * Perícias e ferramentas escolhidas aqui que outra fonte já dá (id → aviso, de
   * `getRepeatedProficiencyNotes`): ficam marcadas, com o aviso, para trocar (p. 125).
   */
  repeated?: Record<string, string>
}

export function ChoicePanel({ choices, selections, accent, onChange, excludedLanguages, excludedSkills, excludedTools, repeated = {} }: Props) {
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
                repeated={repeated}
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
                repeated={repeated}
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
                repeated={repeated}
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
              <FeatChoiceField
                key={idx}
                accent={accent}
                featId={selections.feat ?? ''}
                featAbility={selections.featAbility}
                onChange={patch => onChange(patch)}
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
    const next = toggleChoice(selected, ability, count)
    if (next) onSelect(next)
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
          const isDisabled = !isSelected && isChoiceFull(selected.length, count)
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
  repeated: Record<string, string>
  onSelect: (skills: string[]) => void
}

function SkillChoiceField({ count, from, accent, selected, excluded, repeated, onSelect }: SkillChoiceFieldProps) {
  const available = from === 'any' ? SKILLS : SKILLS.filter(s => (from as string[]).includes(s.id))

  // Escolha de 1 (Humano Variante) é rádio: outra perícia troca a marcada (decisão de 2026-10-26).
  function toggle(skillId: string) {
    const next = toggleChoice(selected, skillId, count)
    if (next) onSelect(next)
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
          // Marcada e repetida por outra fonte (antecedente trocado depois, ficha antiga): fica à
          // vista com o aviso, para desmarcar e trocar — nunca travada nem apagada.
          const repeatedNote = isSelected ? repeated[skill.id] : undefined
          const isExcluded = !isSelected && (excluded?.includes(skill.id) ?? false)
          const isDisabled = isExcluded || (!isSelected && isChoiceFull(selected.length, count))
          return (
            <button
              key={skill.id}
              onClick={() => toggle(skill.id)}
              disabled={isDisabled}
              title={repeatedNote ?? (isExcluded ? 'Você já possui esta perícia de outra fonte' : undefined)}
              className="px-2 py-1.5 rounded-lg border text-xs text-left transition-all"
              style={{
                borderColor: isSelected ? accent : isExcluded ? '#1e150a' : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : isExcluded ? '#3a2614' : isDisabled ? '#5a3e24' : '#9a7650',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                ...(repeatedNote ? REPEATED_OPTION_STYLE : {}),
              }}
            >
              {repeatedNote ? '⚠ ' : isExcluded ? '✓ ' : ''}{skill.name}
            </button>
          )
        })}
      </div>
      <RepeatedProficiencyNotes ids={selected} notes={repeated} />
    </div>
  )
}

type LanguageChoiceFieldProps = {
  count: number
  accent: string
  selected: string[]
  excluded?: string[]
  repeated: Record<string, string>
  onSelect: (languages: string[]) => void
}

function LanguageChoiceField({ count, accent, selected, excluded, repeated, onSelect }: LanguageChoiceFieldProps) {
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

type ToolChoiceFieldProps = {
  from: string[]
  accent: string
  selected: string[]
  excluded?: string[]
  repeated: Record<string, string>
  onSelect: (tools: string[]) => void
}

function ToolChoiceField({ from, accent, selected, excluded, repeated, onSelect }: ToolChoiceFieldProps) {
  return (
    <div>
      <p className="text-sm font-semibold text-parchment-300 mb-2 font-fantasy">
        Escolha uma ferramenta
      </p>
      <div className="flex flex-col gap-1.5">
        {from.map(toolId => {
          const isSelected = selected.includes(toolId)
          const repeatedNote = isSelected ? repeated[toolId] : undefined
          const isExcluded = !isSelected && (excluded?.includes(toolId) ?? false)
          return (
            <button
              key={toolId}
              onClick={() => { if (!isExcluded) onSelect([toolId]) }}
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
              {repeatedNote ? '⚠ ' : isExcluded ? '✓ ' : ''}{TOOL_NAMES[toolId] ?? toolId}
            </button>
          )
        })}
      </div>
      <RepeatedProficiencyNotes ids={selected} notes={repeated} />
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

function FeatChoiceField({
  accent,
  featId,
  featAbility,
  onChange,
}: {
  accent: string
  featId: string
  featAbility?: AbilityScore
  onChange: (patch: Partial<RaceChoiceSelections>) => void
}) {
  const feat = featId ? getFeat(featId) : undefined
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-parchment-300 font-fantasy">Talento</p>
        <span className="text-xs" style={{ color: feat ? accent : '#7d5c3c' }}>
          {feat ? feat.name : 'nenhum escolhido'}
        </span>
      </div>
      {/*
        O mesmo catálogo do passo Aprimoramentos, e não um <select>: com 42 talentos, uma lista
        só de nomes obriga a escolher um por um pra descobrir o que cada um faz. O painel da raça
        é estreito, então a grade vai a uma coluna só e rola dentro de si.
        Sem `scoreWithout`: aqui os atributos ainda nem foram definidos (Raça vem antes).
      */}
      <FeatCatalog
        selectedFeatId={featId}
        // Trocar de talento zera o +1: o atributo elegível é do talento antigo.
        onSelect={id => onChange({ feat: id, featAbility: undefined })}
        accent={accent}
        abilityChoice={featAbility}
        onAbilityChoice={ab => onChange({ featAbility: ab })}
        gridClassName="grid-cols-1"
        gridMaxHeightClassName="max-h-[26rem]"
      />
      {featId && <div className="mt-3"><FeatChoiceSlots accent={accent} featIds={[featId]} /></div>}
    </div>
  )
}
