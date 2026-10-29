import { SKILLS } from '../../utils/raceUtils'
import { TOOLS, getSkillName, getToolName } from '../../utils/backgroundUtils'
import { isChoiceFull, toggleChoice } from '../../utils/choiceToggle'
import type { BackgroundOverlap } from '../../utils/proficiencyUtils'
import { RepeatedProficiencyNotes } from '../common/RepeatedProficiencyNotes'
import { REPEATED_CHIP_STYLE } from '../common/repeatedChipStyle'

type Props = {
  kind: 'skill' | 'tool'
  /** As fixas do antecedente que outra fonte também dá fixa: cada uma abre uma substituta. */
  overlaps: BackgroundOverlap[]
  selected: string[]
  /** O que o personagem já tem por qualquer fonte (menos as substitutas marcadas aqui). */
  excluded: string[]
  /** Substituta marcada que outra fonte passou a dar (id → aviso): fica marcada, para trocar. */
  repeated: Record<string, string>
  accent: string
  onChange: (ids: string[]) => void
}

/**
 * Fixo × fixo (p. 125): "se um personagem fosse obter a mesma proficiência de duas fontes
 * diferentes, ele pode escolher uma proficiência diferente do mesmo tipo". O Meio-Orc e o Soldado
 * dão Intimidação; aqui o jogador escolhe outra perícia no lugar. É opcional: a etapa não pendura.
 */
export function SubstituteProficiencyPicker({ kind, overlaps, selected, excluded, repeated, accent, onChange }: Props) {
  const count = overlaps.length
  const options = kind === 'skill' ? SKILLS : TOOLS
  const excludedSet = new Set(excluded)
  const nameOf = kind === 'skill' ? getSkillName : getToolName
  const noun = kind === 'skill' ? 'perícia' : 'ferramenta'

  return (
    <div>
      {overlaps.map(o => (
        <p key={o.id} className="text-sm text-parchment-400 leading-relaxed">
          <span className="font-semibold text-parchment-200">{nameOf(o.id)}</span> vem também {o.source}.
        </p>
      ))}
      <p className="text-xs text-parchment-500 mt-1 mb-2">
        Pelo livro, você pode escolher {count > 1 ? `outras ${count} ${noun}s` : `outra ${noun}`} no lugar
        (opcional) <span className="text-parchment-600">({Math.min(selected.length, count)}/{count})</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isSelected = selected.includes(opt.id)
          const isRepeated = isSelected ? repeated[opt.id] : undefined
          const isExcluded = !isSelected && excludedSet.has(opt.id)
          const disabled = isExcluded || (!isSelected && isChoiceFull(selected.length, count))
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              title={isRepeated ?? (isExcluded ? `Você já possui esta ${noun} de outra fonte` : undefined)}
              onClick={() => {
                const next = toggleChoice(selected, opt.id, count)
                if (next) onChange(next)
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: isSelected ? accent : disabled ? 'rgba(30,20,8,0.4)' : 'rgba(40,28,12,0.8)',
                color: isSelected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                border: isSelected ? 'none' : `1px solid ${disabled ? 'rgba(60,40,20,0.3)' : 'rgba(90,62,36,0.5)'}`,
                cursor: disabled ? 'not-allowed' : 'pointer',
                ...(isRepeated ? REPEATED_CHIP_STYLE : {}),
              }}
            >
              {isRepeated ? '⚠ ' : isExcluded ? '✓ ' : ''}{opt.name}
            </button>
          )
        })}
      </div>
      <RepeatedProficiencyNotes ids={selected} notes={repeated} />
    </div>
  )
}
