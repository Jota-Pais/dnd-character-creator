import { useState } from 'react'
import type { GameClass, ClassChoiceSelections } from '../../types/class'
import {
  getSkillOptions,
  getExpertiseOptions,
  FIGHTING_STYLES,
  SUBCLASS_LABEL,
} from '../../utils/classUtils'
import { ClassSubclassCard } from './ClassSubclassCard'
import { InfoTooltip } from '../common/InfoTooltip'
import type { TermId } from '../../utils/glossary'
import { SKILLS, LANGUAGES } from '../../utils/raceUtils'
import toolsData from '../../data/tools.json'
import { getProgressionSlotsUpToLevel, type ProgressionSlot } from '../../utils/progressionChoiceUtils'
import { getProgressionOptions } from '../../utils/progressionOptions'

type Tool = { id: string; name: string; category: 'artisan' | 'musical-instrument' | 'gaming-set' | 'other' | 'vehicle' }
const ALL_TOOLS: Tool[] = toolsData as Tool[]

type Props = {
  cls: GameClass
  choices: ClassChoiceSelections
  accent: string
  level: number
  onChange: (patch: Partial<ClassChoiceSelections>) => void
  excludedSkills?: string[]
  excludedTools?: string[]
  /** Classe adicional (multiclasse): concede só o subconjunto de perícias e nenhuma escolha de ferramenta. */
  multiclass?: boolean
}

export function ClassChoicePanel({ cls, choices, accent, level, onChange, excludedSkills, excludedTools, multiclass = false }: Props) {
  const skillOptions = getSkillOptions(cls)
  const excludedSkillSet = new Set(excludedSkills ?? [])
  const excludedToolSet = new Set(excludedTools ?? [])
  // Ao multiclassar, a classe dá só o subconjunto de perícias da Tabela de Proficiências (0 ou 1).
  const skillLimit = multiclass ? (cls.multiclassProficiencies.skills?.count ?? 0) : cls.skillChoices.count

  function handleSkillToggle(skillId: string) {
    if (choices.skills.includes(skillId)) {
      onChange({
        skills: choices.skills.filter(s => s !== skillId),
        expertiseItems: choices.expertiseItems.filter(e => e !== skillId),
      })
    } else {
      if (choices.skills.length >= skillLimit) return
      onChange({ skills: [...choices.skills, skillId] })
    }
  }

  function handleSubclassSelect(subclassId: string) {
    onChange({ subclass: subclassId, subclassExtras: {} })
  }

  function handleExpertiseToggle(itemId: string) {
    if (choices.expertiseItems.includes(itemId)) {
      onChange({ expertiseItems: choices.expertiseItems.filter(e => e !== itemId) })
    } else {
      if (choices.expertiseItems.length >= 2) return
      onChange({ expertiseItems: [...choices.expertiseItems, itemId] })
    }
  }

  function handleToolToggle(toolId: string, maxCount: number) {
    if (choices.tools.includes(toolId)) {
      onChange({ tools: choices.tools.filter(t => t !== toolId) })
    } else {
      if (choices.tools.length >= maxCount) return
      onChange({ tools: [...choices.tools, toolId] })
    }
  }

  const selectedSubclass = cls.subclasses.find(s => s.id === choices.subclass)
  const subclassExtras = selectedSubclass?.extras ?? null
  const skillsFullyChosen = choices.skills.length === skillLimit

  return (
    <div className="space-y-5">

      {/* ── Seleção de perícias ── */}
      {skillLimit > 0 && (
      <ChoiceSection
        title={`Perícias (${choices.skills.length}/${skillLimit})`}
        accent={accent}
      >
        <div className="flex flex-wrap gap-1.5">
          {skillOptions.map(skill => {
            const selected = choices.skills.includes(skill.id)
            const excluded = excludedSkillSet.has(skill.id)
            const disabled = excluded || (!selected && choices.skills.length >= skillLimit)
            return (
              <button
                key={skill.id}
                onClick={() => { if (!excluded) handleSkillToggle(skill.id) }}
                disabled={disabled}
                title={excluded ? 'Você já possui esta perícia de outra fonte' : undefined}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{
                  backgroundColor: selected ? accent : disabled ? 'rgba(30, 20, 8, 0.4)' : 'rgba(40, 28, 12, 0.8)',
                  color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                  border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60, 40, 20, 0.3)' : 'rgba(90, 62, 36, 0.5)'}`,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {excluded ? '✓ ' : ''}{skill.name}
              </button>
            )
          })}
        </div>
      </ChoiceSection>
      )}

      {/* ── Ferramentas (Bardo/Monge) — só na classe inicial ── */}
      {!multiclass && cls.toolProficiencies.choices.map((toolChoice, i) => {
        const filtered =
          toolChoice.from === 'musical-instrument' ? ALL_TOOLS.filter(t => t.category === 'musical-instrument')
          : toolChoice.from === 'artisan' ? ALL_TOOLS.filter(t => t.category === 'artisan')
          : ALL_TOOLS
        const label =
          toolChoice.from === 'musical-instrument' ? 'Instrumento Musical'
          : toolChoice.from === 'artisan' ? 'Ferramenta de Artesão'
          : 'Ferramenta'
        return (
          <ChoiceSection
            key={i}
            title={`${label} (${Math.min(choices.tools.length, toolChoice.count)}/${toolChoice.count})`}
            accent={accent}
          >
            <div className="flex flex-wrap gap-1.5">
              {filtered.map(tool => {
                const selected = choices.tools.includes(tool.id)
                const excluded = excludedToolSet.has(tool.id)
                const disabled = excluded || (!selected && choices.tools.length >= toolChoice.count)
                return (
                  <button
                    key={tool.id}
                    onClick={() => { if (!excluded) handleToolToggle(tool.id, toolChoice.count) }}
                    disabled={disabled}
                    title={excluded ? 'Você já possui esta ferramenta de outra fonte' : undefined}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: selected ? accent : disabled ? 'rgba(30, 20, 8, 0.4)' : 'rgba(40, 28, 12, 0.8)',
                      color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                      border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60, 40, 20, 0.3)' : 'rgba(90, 62, 36, 0.5)'}`,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {excluded ? '✓ ' : ''}{tool.name}
                  </button>
                )
              })}
            </div>
          </ChoiceSection>
        )
      })}

      {/* ── Estilo de Luta (Guerreiro) ── */}
      {cls.hasFightingStyle && (
        <ChoiceSection title="Estilo de Luta" accent={accent} term="estilo-de-luta">
          <div className="space-y-2">
            {FIGHTING_STYLES.map(style => {
              const selected = choices.fightingStyle === style.id
              return (
                <button
                  key={style.id}
                  onClick={() => onChange({ fightingStyle: style.id })}
                  className="w-full text-left rounded-xl border-2 p-3 transition-all duration-200"
                  style={{
                    borderColor: selected ? accent : 'rgba(90, 62, 36, 0.5)',
                    backgroundColor: selected ? `${accent}12` : 'rgba(15, 10, 4, 0.6)',
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-fantasy font-bold text-sm" style={{ color: selected ? accent : '#c4a97a' }}>
                      {style.name}
                    </span>
                    {selected && <span style={{ color: accent }}>✦</span>}
                  </div>
                  <p className="text-parchment-500 text-xs leading-relaxed">{style.description}</p>
                </button>
              )
            })}
          </div>
        </ChoiceSection>
      )}

      {/* ── Subclasse (quando o personagem já atingiu o nível de escolha) ── */}
      {cls.subclassLevel <= level && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <SectionTitle accent={accent}>
              {SUBCLASS_LABEL[cls.id] ?? 'Subclasse'}
            </SectionTitle>
            {!choices.subclass && (
              <span className="text-red-500 text-xs">obrigatório</span>
            )}
          </div>
          <div className="space-y-2">
            {cls.subclasses.map(sub => (
              <ClassSubclassCard
                key={sub.id}
                subclass={sub}
                accent={accent}
                selected={choices.subclass === sub.id}
                onSelect={() => handleSubclassSelect(sub.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Extras da subclasse ── */}
      {subclassExtras && (
        <SubclassExtrasPanel
          extras={subclassExtras}
          subclassExtras={choices.subclassExtras}
          accent={accent}
          onChangeExtras={(patch) =>
            onChange({ subclassExtras: { ...choices.subclassExtras, ...patch } })
          }
        />
      )}

      {/* ── Especialização (Ladino) — aparece após perícias escolhidas ── */}
      {cls.hasExpertise && skillsFullyChosen && (
        <ChoiceSection
          title={`Especialização (${choices.expertiseItems.length}/2)`}
          accent={accent}
          term="especializacao"
        >
          <p className="text-parchment-600 text-xs mb-2">
            Escolha 2 itens para dobrar o bônus de proficiência.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {getExpertiseOptions(choices).map(opt => {
              const selected = choices.expertiseItems.includes(opt.id)
              const disabled = !selected && choices.expertiseItems.length >= 2
              return (
                <button
                  key={opt.id}
                  onClick={() => handleExpertiseToggle(opt.id)}
                  disabled={disabled}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: selected ? accent : disabled ? 'rgba(30, 20, 8, 0.4)' : 'rgba(40, 28, 12, 0.8)',
                    color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                    border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60, 40, 20, 0.3)' : 'rgba(90, 62, 36, 0.5)'}`,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {opt.name}
                </button>
              )
            })}
          </div>
        </ChoiceSection>
      )}

      {/* ── Escolhas de Progressão ── */}
      <ProgressionChoicesPanel
        classId={cls.id}
        subclassId={choices.subclass}
        level={level}
        choices={choices}
        accent={accent}
        onChange={(patch) => onChange({ progressionChoices: { ...choices.progressionChoices, ...patch } })}
      />
    </div>
  )
}

type SubclassExtrasPanelProps = {
  extras: NonNullable<import('../../types/class').ClassSubclass['extras']>
  subclassExtras: import('../../types/class').SubclassChoiceSelections
  accent: string
  onChangeExtras: (patch: Partial<import('../../types/class').SubclassChoiceSelections>) => void
}

function SubclassExtrasPanel({ extras, subclassExtras, accent, onChangeExtras }: SubclassExtrasPanelProps) {
  const [cantripInput, setCantripInput] = useState(subclassExtras.cantrip ?? '')

  const hasChoices =
    extras.expertiseSkills || extras.skillChoice || extras.languages || extras.cantripChoice

  const grantedInfo = [
    ...extras.grantedArmorProficiencies.map(a =>
      a === 'heavy' ? 'Armadura Pesada' : a === 'medium' ? 'Armadura Média' : a
    ),
    ...extras.grantedWeaponProficiencies.map(w =>
      w === 'martial' ? 'Armas Marciais' : w
    ),
    ...extras.grantedLanguages.map(l => {
      const lang = LANGUAGES.find(x => x.id === l)
      return lang?.name ?? l
    }),
  ]

  if (!hasChoices && grantedInfo.length === 0) return null

  return (
    <div className="space-y-4">
      {grantedInfo.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {grantedInfo.map(info => (
            <span
              key={info}
              className="px-2 py-0.5 rounded-md text-xs font-semibold"
              style={{ backgroundColor: `${accent}20`, color: accent }}
            >
              ✦ {info}
            </span>
          ))}
        </div>
      )}

      {/* Expertise de perícias (Domínio do Conhecimento) */}
      {extras.expertiseSkills && (
        <ChoiceSection
          title={`Expertise em Perícia (${(subclassExtras.skills ?? []).length}/${extras.expertiseSkills.count})`}
          accent={accent}
        >
          <p className="text-parchment-600 text-xs mb-2">Bônus de proficiência dobrado nessas perícias.</p>
          <div className="flex flex-wrap gap-1.5">
            {extras.expertiseSkills.from.map(skillId => {
              const skill = SKILLS.find(s => s.id === skillId)
              if (!skill) return null
              const selected = (subclassExtras.skills ?? []).includes(skillId)
              const disabled = !selected && (subclassExtras.skills ?? []).length >= extras.expertiseSkills!.count
              return (
                <button
                  key={skillId}
                  disabled={disabled}
                  onClick={() => {
                    const current = subclassExtras.skills ?? []
                    onChangeExtras({
                      skills: selected ? current.filter(s => s !== skillId) : [...current, skillId],
                    })
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: selected ? accent : disabled ? 'rgba(30,20,8,0.4)' : 'rgba(40,28,12,0.8)',
                    color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                    border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60,40,20,0.3)' : 'rgba(90,62,36,0.5)'}`,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {skill.name}
                </button>
              )
            })}
          </div>
        </ChoiceSection>
      )}

      {/* Idiomas (Domínio do Conhecimento) */}
      {extras.languages && (
        <ChoiceSection
          title={`Idiomas (${(subclassExtras.languages ?? []).length}/${extras.languages.count})`}
          accent={accent}
        >
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map(lang => {
              const selected = (subclassExtras.languages ?? []).includes(lang.id)
              const disabled = !selected && (subclassExtras.languages ?? []).length >= extras.languages!.count
              return (
                <button
                  key={lang.id}
                  disabled={disabled}
                  onClick={() => {
                    const current = subclassExtras.languages ?? []
                    onChangeExtras({
                      languages: selected ? current.filter(l => l !== lang.id) : [...current, lang.id],
                    })
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: selected ? accent : disabled ? 'rgba(30,20,8,0.4)' : 'rgba(40,28,12,0.8)',
                    color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                    border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60,40,20,0.3)' : 'rgba(90,62,36,0.5)'}`,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {lang.name}
                </button>
              )
            })}
          </div>
        </ChoiceSection>
      )}

      {/* Perícia extra (Domínio da Natureza) */}
      {extras.skillChoice && (
        <ChoiceSection
          title={`Perícia Adicional (${(subclassExtras.skills ?? []).length}/${extras.skillChoice.count})`}
          accent={accent}
        >
          <div className="flex flex-wrap gap-1.5">
            {extras.skillChoice.from.map(skillId => {
              const skill = SKILLS.find(s => s.id === skillId)
              if (!skill) return null
              const selected = (subclassExtras.skills ?? []).includes(skillId)
              const disabled = !selected && (subclassExtras.skills ?? []).length >= extras.skillChoice!.count
              return (
                <button
                  key={skillId}
                  disabled={disabled}
                  onClick={() => {
                    const current = subclassExtras.skills ?? []
                    onChangeExtras({
                      skills: selected ? current.filter(s => s !== skillId) : [...current, skillId],
                    })
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: selected ? accent : disabled ? 'rgba(30,20,8,0.4)' : 'rgba(40,28,12,0.8)',
                    color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                    border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60,40,20,0.3)' : 'rgba(90,62,36,0.5)'}`,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {skill.name}
                </button>
              )
            })}
          </div>
        </ChoiceSection>
      )}

      {/* Truque (Domínio da Natureza — placeholder) */}
      {extras.cantripChoice && (
        <ChoiceSection title="Truque de Druida" accent={accent}>
          <p className="text-parchment-600 text-xs mb-2">
            Escolha um truque da lista do druida (lista de magias em breve).
          </p>
          <input
            type="text"
            value={cantripInput}
            placeholder="Nome do truque..."
            onChange={e => {
              setCantripInput(e.target.value)
              onChangeExtras({ cantrip: e.target.value.trim() || undefined })
            }}
            className="w-full px-3 py-2 rounded-lg text-sm bg-parchment-950/80 border text-parchment-200 placeholder-parchment-700 outline-none focus:ring-1"
            style={{
              borderColor: `${accent}40`,
            }}
          />
        </ChoiceSection>
      )}
    </div>
  )
}

function ChoiceSection({
  title,
  accent,
  term,
  children,
}: {
  title: string
  accent: string
  term?: TermId
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
      <SectionTitle accent={accent}>
        {title}
        {term && <> <InfoTooltip term={term} /></>}
      </SectionTitle>
      {children}
    </div>
  )
}

function SectionTitle({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <h4
      className="text-xs font-semibold font-fantasy uppercase tracking-widest mb-3"
      style={{ color: `${accent}cc` }}
    >
      {children}
    </h4>
  )
}

function ProgressionChoicesPanel({
  classId,
  subclassId,
  level,
  choices,
  accent,
  onChange,
}: {
  classId: string
  subclassId: string | null
  level: number
  choices: ClassChoiceSelections
  accent: string
  onChange: (patch: Record<string, string[]>) => void
}) {
  const slots = getProgressionSlotsUpToLevel(classId, subclassId, level)
  if (slots.length === 0) return null

  // Agrupa os slots por optionsListId para somar a contagem quando cumulative=true
  const groups = new Map<string, { slots: ProgressionSlot[]; totalCount: number }>()

  for (const slot of slots) {
    if (slot.cumulative) {
      if (!groups.has(slot.optionsListId)) {
        groups.set(slot.optionsListId, { slots: [], totalCount: 0 })
      }
      const group = groups.get(slot.optionsListId)!
      group.slots.push(slot)
      group.totalCount += slot.count
    } else {
      // Se não for cumulativo, criamos um grupo único para ele baseado no ID do slot
      groups.set(slot.id, { slots: [slot], totalCount: slot.count })
    }
  }

  function handleOptionToggle(slotId: string, optionId: string, maxCount: number) {
    const current = choices.progressionChoices[slotId] ?? []
    if (current.includes(optionId)) {
      onChange({ [slotId]: current.filter(id => id !== optionId) })
    } else {
      if (current.length >= maxCount) return
      onChange({ [slotId]: [...current, optionId] })
    }
  }

  return (
    <div className="space-y-4">
      {Array.from(groups.values()).map(group => {
        const optionsListId = group.slots[0].optionsListId
        // Estilo de Luta Adicional (Campeão nv10): não pode repetir o estilo já escolhido no passo Classe.
        const options = getProgressionOptions(optionsListId).filter(
          opt => !(optionsListId === 'FIGHTING_STYLES' && opt.id === choices.fightingStyle),
        )

        // Cada slot é renderizado separadamente; num grupo cumulativo, as opções já
        // escolhidas nos slots de níveis anteriores aparecem marcadas e desabilitadas.
        return group.slots.map((slot, index) => {
          const currentPicked = choices.progressionChoices[slot.id] ?? []
          
          // Calcula opções já escolhidas em slots cumulativos anteriores para desabilitar
          const previousPicks = new Set<string>()
          if (slot.cumulative) {
            for (let i = 0; i < index; i++) {
              const prevSlot = group.slots[i]
              const prevPicked = choices.progressionChoices[prevSlot.id] ?? []
              prevPicked.forEach(p => previousPicks.add(p))
            }
          }

          return (
            <ChoiceSection
              key={slot.id}
              title={`${slot.label} (${currentPicked.length}/${slot.count}) ${slot.cumulative && index > 0 ? `(Nível ${slot.level})` : ''}`}
              accent={accent}
            >
              <div className="flex flex-wrap gap-1.5">
                {options.map(opt => {
                  const isPreviouslyPicked = previousPicks.has(opt.id)
                  const isCurrentlyPicked = currentPicked.includes(opt.id)
                  const selected = isCurrentlyPicked || isPreviouslyPicked
                  const disabled = isPreviouslyPicked || (!isCurrentlyPicked && currentPicked.length >= slot.count)

                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        if (!isPreviouslyPicked) {
                          handleOptionToggle(slot.id, opt.id, slot.count)
                        }
                      }}
                      disabled={disabled}
                      title={opt.description ?? opt.prerequisite}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all group relative"
                      style={{
                        backgroundColor: selected ? accent : disabled ? 'rgba(30, 20, 8, 0.4)' : 'rgba(40, 28, 12, 0.8)',
                        color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                        border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60, 40, 20, 0.3)' : 'rgba(90, 62, 36, 0.5)'}`,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isPreviouslyPicked ? '✓ ' : ''}{opt.name}
                      {opt.prerequisite && <span className="ml-1 opacity-60">({opt.prerequisite})</span>}
                    </button>
                  )
                })}
              </div>
            </ChoiceSection>
          )
        })
      })}
    </div>
  )
}
