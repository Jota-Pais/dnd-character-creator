import { useState } from 'react'
import type { GameClass, ClassChoiceSelections } from '../../types/class'
import {
  getSkillOptions,
  getExpertiseOptions,
  FIGHTING_STYLES,
} from '../../utils/classUtils'
import { ClassSubclassCard } from './ClassSubclassCard'
import { SKILLS, LANGUAGES } from '../../utils/raceUtils'
import toolsData from '../../data/tools.json'

type Tool = { id: string; name: string; category: 'musical' | 'artisan' }
const ALL_TOOLS: Tool[] = toolsData as Tool[]

type Props = {
  cls: GameClass
  choices: ClassChoiceSelections
  accent: string
  onChange: (patch: Partial<ClassChoiceSelections>) => void
}

export function ClassChoicePanel({ cls, choices, accent, onChange }: Props) {
  const skillOptions = getSkillOptions(cls)

  function handleSkillToggle(skillId: string) {
    if (choices.skills.includes(skillId)) {
      onChange({
        skills: choices.skills.filter(s => s !== skillId),
        expertiseItems: choices.expertiseItems.filter(e => e !== skillId),
      })
    } else {
      if (choices.skills.length >= cls.skillChoices.count) return
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
  const skillsFullyChosen = choices.skills.length === cls.skillChoices.count

  return (
    <div className="space-y-5">

      {/* ── Seleção de perícias ── */}
      <ChoiceSection
        title={`Perícias (${choices.skills.length}/${cls.skillChoices.count})`}
        accent={accent}
      >
        <div className="flex flex-wrap gap-1.5">
          {skillOptions.map(skill => {
            const selected = choices.skills.includes(skill.id)
            const disabled = !selected && choices.skills.length >= cls.skillChoices.count
            return (
              <button
                key={skill.id}
                onClick={() => handleSkillToggle(skill.id)}
                disabled={disabled}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{
                  backgroundColor: selected ? accent : disabled ? 'rgba(30, 20, 8, 0.4)' : 'rgba(40, 28, 12, 0.8)',
                  color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                  border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60, 40, 20, 0.3)' : 'rgba(90, 62, 36, 0.5)'}`,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {skill.name}
              </button>
            )
          })}
        </div>
      </ChoiceSection>

      {/* ── Ferramentas (Bardo/Monge) ── */}
      {cls.toolProficiencies.choices.map((toolChoice, i) => {
        const filtered =
          toolChoice.from === 'musical' ? ALL_TOOLS.filter(t => t.category === 'musical')
          : toolChoice.from === 'artisan' ? ALL_TOOLS.filter(t => t.category === 'artisan')
          : ALL_TOOLS
        const label =
          toolChoice.from === 'musical' ? 'Instrumento Musical'
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
                const disabled = !selected && choices.tools.length >= toolChoice.count
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolToggle(tool.id, toolChoice.count)}
                    disabled={disabled}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: selected ? accent : disabled ? 'rgba(30, 20, 8, 0.4)' : 'rgba(40, 28, 12, 0.8)',
                      color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                      border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60, 40, 20, 0.3)' : 'rgba(90, 62, 36, 0.5)'}`,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {tool.name}
                  </button>
                )
              })}
            </div>
          </ChoiceSection>
        )
      })}

      {/* ── Estilo de Luta (Guerreiro) ── */}
      {cls.hasFightingStyle && (
        <ChoiceSection title="Estilo de Luta" accent={accent}>
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

      {/* ── Subclasse nível 1 ── */}
      {cls.subclassLevel === 1 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <SectionTitle accent={accent}>
              {cls.id === 'cleric' ? 'Domínio Divino' : 'Patrono / Origem'}
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
  children,
}: {
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
      <SectionTitle accent={accent}>{title}</SectionTitle>
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
