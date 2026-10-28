import { useState, useEffect } from 'react'
import type { GameClass, ClassChoiceSelections, ToolChoiceSource } from '../../types/class'
import {
  getSkillOptions,
  getExpertiseCount,
  getExpertiseOptions,
  resolveSkillOptions,
  getClassFightingStyleOptions,
  SUBCLASS_LABEL,
  getSubclassFeaturesUpToLevel,
  getClassToolChoices,
} from '../../utils/classUtils'
import { ClassSubclassCard } from './ClassSubclassCard'
import { ProgressionOptionCard } from './ProgressionOptionCard'
import { InfoTooltip } from '../common/InfoTooltip'
import type { TermId } from '../../utils/glossary'
import { SKILLS, getLanguageName } from '../../utils/raceUtils'
import { LanguagePicker } from '../common/LanguagePicker'
import toolsData from '../../data/tools.json'
import {
  getActivePicks, getProgressionSlotsUpToLevel, isSingleChoiceSlot, SPELL_OPTIONS_LIST_ID, type ProgressionSlot,
} from '../../utils/progressionChoiceUtils'
import { isChoiceFull, toggleChoice } from '../../utils/choiceToggle'
import {
  describeRequiredPick, getProgressionOptions, getSecretSpellOptions, getUnmetRequirement, type ProgressionOption,
} from '../../utils/progressionOptions'
import { getMaxSpellLevel, getSecretCantripRoom, getSpell } from '../../utils/spellUtils'
import type { ClassSlotProficiencies } from '../../utils/proficiencyUtils'
import type { TakenFightingStyles } from '../../utils/sheetEffects'
import { MANEUVER_LIST_ID } from '../../utils/maneuverUtils'
import { RepeatedProficiencyNotes } from '../common/RepeatedProficiencyNotes'
import { REPEATED_CHIP_STYLE } from '../common/repeatedChipStyle'

type Tool = { id: string; name: string; category: 'artisan' | 'musical-instrument' | 'gaming-set' | 'other' | 'vehicle' }
const ALL_TOOLS: Tool[] = toolsData as Tool[]

const TOOL_CHOICE_LABELS: Record<ToolChoiceSource, string> = {
  'musical-instrument': 'Instrumento Musical',
  artisan: 'Ferramenta de Artesão',
  'any-tool': 'Ferramenta',
}

/** Recorte do catálogo de ferramentas para uma escolha ('any-tool' abre tudo). */
function filterToolsBySource(from: ToolChoiceSource): Tool[] {
  if (from === 'any-tool') return ALL_TOOLS
  return ALL_TOOLS.filter(t => t.category === from)
}

type Props = {
  cls: GameClass
  choices: ClassChoiceSelections
  accent: string
  level: number
  onChange: (patch: Partial<ClassChoiceSelections>) => void
  /**
   * O que já está tomado em cada slot desta classe e o que o personagem tem no total. Vem pronto
   * de `getClassSlotProficiencies` porque só quem enxerga o draft inteiro sabe o que a raça, o
   * antecedente e as OUTRAS classes da multiclasse já concederam.
   */
  proficiencies: ClassSlotProficiencies
  /**
   * Estilos de Luta que outra fonte já tomou (outra classe da multiclasse, o Adicional do campeão),
   * de `getTakenFightingStyles`: o mesmo estilo não se escolhe duas vezes (p. 85).
   */
  takenFightingStyles: TakenFightingStyles
  /**
   * Manobras que o personagem já aprendeu por talento (Adepto Marcial, `getFeatManeuvers`): o slot
   * de manobras do Mestre de Batalha não as oferece — aprender a mesma de novo não daria nada.
   */
  takenManeuvers?: string[]
  /** Classe adicional (multiclasse): concede só o subconjunto de perícias e de instrumentos (p. 164). */
  multiclass?: boolean
}

export function ClassChoicePanel({ cls, choices, accent, level, onChange, proficiencies, takenFightingStyles, takenManeuvers = [], multiclass = false }: Props) {
  const skillOptions = getSkillOptions(cls)
  const excludedSkillSet = new Set(proficiencies.excludedBaseSkills)
  const excludedToolSet = new Set(proficiencies.excludedBaseTools)
  const { repeatedBase } = proficiencies
  // Ao multiclassar, a classe dá só o subconjunto de perícias da Tabela de Proficiências (0 ou 1).
  const skillLimit = multiclass ? (cls.multiclassProficiencies.skills?.count ?? 0) : cls.skillChoices.count
  // Especialização chega em levas (ladino no 1º e 6º, bardo no 3º e 10º), pelo nível NESTA classe.
  const expertiseCount = getExpertiseCount(cls, level)
  // Estilo de Luta também pelo nível NESTA classe: o paladino 1 ainda não tem.
  const fightingStyleOptions = getClassFightingStyleOptions(cls, level)

  // Especialização vale sobre proficiências que o personagem TEM: se a perícia sai, a escolha sai
  // junto; se outra fonte passou a dobrá-la, também (o bônus só dobra uma vez); se o nível baixa,
  // ficam só as das levas mais antigas. Vale igual para as classes da multiclasse, por isso mora
  // aqui e não na etapa.
  const { grantedSkills, grantedTools, excludedExpertise } = proficiencies
  useEffect(() => {
    const items = choices.expertiseItems
    const kept = items
      .filter(id => grantedSkills.includes(id) || grantedTools.includes(id))
      .filter(id => !excludedExpertise.includes(id))
      .slice(0, expertiseCount)
    if (kept.length !== items.length) onChange({ expertiseItems: kept })
  }, [grantedSkills.join(','), grantedTools.join(','), excludedExpertise.join(','), expertiseCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Desmarcar não mexe na Especialização: ela vale para a perícia que o personagem tem de qualquer
  // fonte, e quem a tira quando a perícia some de todas é o efeito acima. Assim, trocar a perícia
  // repetida pelo antecedente (p. 125) não apaga a Especialização que continua valendo.
  // Escolha de 1 (a perícia da multiclasse, a ferramenta do monge) é rádio; a de N para no limite
  // (toggleChoice, decisão de 2026-10-26).
  function handleSkillToggle(skillId: string) {
    const next = toggleChoice(choices.skills, skillId, skillLimit)
    if (next) onChange({ skills: next })
  }

  function handleSubclassSelect(subclassId: string) {
    onChange({ subclass: subclassId, subclassExtras: {} })
  }

  function handleExpertiseToggle(itemId: string) {
    const next = toggleChoice(choices.expertiseItems, itemId, expertiseCount)
    if (next) onChange({ expertiseItems: next })
  }

  function handleToolToggle(toolId: string, maxCount: number) {
    const next = toggleChoice(choices.tools, toolId, maxCount)
    if (next) onChange({ tools: next })
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
            // O que outra fonte já dá não se escolhe. Marcada assim mesmo (o antecedente ou a raça
            // trocados depois, ficha antiga), fica à vista com o aviso, para desmarcar e trocar.
            const repeated = selected ? repeatedBase[skill.id] : undefined
            const excluded = !selected && excludedSkillSet.has(skill.id)
            const disabled = excluded || (!selected && isChoiceFull(choices.skills.length, skillLimit))
            return (
              <button
                key={skill.id}
                onClick={() => { if (!disabled) handleSkillToggle(skill.id) }}
                disabled={disabled}
                title={repeated ?? (excluded ? 'Você já possui esta perícia de outra fonte' : undefined)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{
                  backgroundColor: selected ? accent : disabled ? 'rgba(30, 20, 8, 0.4)' : 'rgba(40, 28, 12, 0.8)',
                  color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                  border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60, 40, 20, 0.3)' : 'rgba(90, 62, 36, 0.5)'}`,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  ...(repeated ? REPEATED_CHIP_STYLE : {}),
                }}
              >
                {repeated ? '⚠ ' : excluded ? '✓ ' : ''}{skill.name}
              </button>
            )
          })}
        </div>
        <RepeatedProficiencyNotes ids={choices.skills} notes={repeatedBase} />
      </ChoiceSection>
      )}

      {/* ── Ferramentas (Bardo/Monge; na multiclasse, o instrumento do bardo) ── */}
      {getClassToolChoices(cls, multiclass).map((toolChoice, i) => {
        const filtered = filterToolsBySource(toolChoice.from)
        const label = TOOL_CHOICE_LABELS[toolChoice.from]
        return (
          <ChoiceSection
            key={i}
            title={`${label} (${Math.min(choices.tools.length, toolChoice.count)}/${toolChoice.count})`}
            accent={accent}
          >
            <div className="flex flex-wrap gap-1.5">
              {filtered.map(tool => {
                const selected = choices.tools.includes(tool.id)
                const repeated = selected ? repeatedBase[tool.id] : undefined
                const excluded = !selected && excludedToolSet.has(tool.id)
                const disabled = excluded || (!selected && isChoiceFull(choices.tools.length, toolChoice.count))
                return (
                  <button
                    key={tool.id}
                    onClick={() => { if (!disabled) handleToolToggle(tool.id, toolChoice.count) }}
                    disabled={disabled}
                    title={repeated ?? (excluded ? 'Você já possui esta ferramenta de outra fonte' : undefined)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: selected ? accent : disabled ? 'rgba(30, 20, 8, 0.4)' : 'rgba(40, 28, 12, 0.8)',
                      color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                      border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60, 40, 20, 0.3)' : 'rgba(90, 62, 36, 0.5)'}`,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      ...(repeated ? REPEATED_CHIP_STYLE : {}),
                    }}
                  >
                    {repeated ? '⚠ ' : excluded ? '✓ ' : ''}{tool.name}
                  </button>
                )
              })}
            </div>
            <RepeatedProficiencyNotes
              ids={choices.tools.filter(id => filtered.some(t => t.id === id))}
              notes={repeatedBase}
            />
          </ChoiceSection>
        )
      })}

      {/* ── Estilo de Luta (guerreiro no 1º nível; paladino e patrulheiro no 2º, da lista deles) ── */}
      {fightingStyleOptions.length > 0 && (
        <ChoiceSection title="Estilo de Luta" accent={accent} term="estilo-de-luta">
          <div className="space-y-2">
            {fightingStyleOptions.map(style => {
              const selected = choices.fightingStyle === style.id
              // Já tomado por outra fonte: não se escolhe de novo (p. 85). Se ficou selecionado
              // assim mesmo (o nível da outra classe subiu depois), continua à vista para trocar.
              const taken = takenFightingStyles.class.includes(style.id)
              const disabled = taken && !selected
              return (
                <button
                  key={style.id}
                  disabled={disabled}
                  onClick={() => onChange({ fightingStyle: style.id })}
                  className="w-full text-left rounded-xl border-2 p-3 transition-all duration-200"
                  style={{
                    borderColor: selected ? (taken ? '#c0392b' : accent) : 'rgba(90, 62, 36, 0.5)',
                    backgroundColor: selected ? `${accent}12` : 'rgba(15, 10, 4, 0.6)',
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-fantasy font-bold text-sm" style={{ color: selected ? accent : '#c4a97a' }}>
                      {style.name}
                    </span>
                    {taken
                      ? <span className="text-xs" style={{ color: selected ? '#e74c3c' : '#8a7356' }}>já escolhido em outra fonte</span>
                      : selected && <span style={{ color: accent }}>✦</span>}
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
          {/* Grid em vez de coluna: com as características à mostra, comparar lado a lado é o
              ponto todo — uma coluna estreita viraria um rolo interminável. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-stretch">
            {cls.subclasses.map(sub => (
              <ClassSubclassCard
                key={sub.id}
                subclass={sub}
                features={getSubclassFeaturesUpToLevel(sub.id, cls.subclassLevel)}
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
          excludedSkills={proficiencies.excludedSubclassSkills}
          excludedTools={proficiencies.excludedSubclassTools}
          excludedLanguages={proficiencies.excludedSubclassLanguages}
          repeated={proficiencies.repeatedSubclass}
          onChangeExtras={(patch) =>
            onChange({ subclassExtras: { ...choices.subclassExtras, ...patch } })
          }
        />
      )}

      {/* ── Especialização (Ladino, Bardo) — aparece após perícias escolhidas ── */}
      {cls.expertise && expertiseCount > 0 && skillsFullyChosen && (
        <ChoiceSection
          title={`Especialização (${choices.expertiseItems.length}/${expertiseCount})`}
          accent={accent}
          term="especializacao"
        >
          <p className="text-parchment-600 text-xs mb-2">
            {cls.expertise.includesThievesTools
              ? `Escolha ${expertiseCount} entre suas perícias e as ferramentas de ladrão para dobrar o bônus de proficiência.`
              : `Escolha ${expertiseCount} perícias em que você é proficiente para dobrar o bônus de proficiência.`}
            {describeExpertiseGrants(cls.expertise.grants, level)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {getExpertiseOptions(
              grantedSkills,
              grantedTools,
              cls.expertise.includesThievesTools,
              excludedExpertise,
            ).map(opt => {
              const selected = choices.expertiseItems.includes(opt.id)
              const disabled = !selected && isChoiceFull(choices.expertiseItems.length, expertiseCount)
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
        takenFightingStyles={takenFightingStyles.slot}
        takenManeuvers={takenManeuvers}
        onChange={(patch) => onChange({ progressionChoices: { ...choices.progressionChoices, ...patch } })}
      />
    </div>
  )
}

/** " (2 no 1º nível + 2 no 6º nível)" — de onde vem o total, quando já chegou mais de uma leva. */
function describeExpertiseGrants(grants: { level: number; count: number }[], level: number): string {
  const reached = grants.filter(grant => grant.level <= level)
  if (reached.length < 2) return ''
  return ` (${reached.map(grant => `${grant.count} no ${grant.level}º nível`).join(' + ')})`
}

type SubclassExtrasPanelProps = {
  extras: NonNullable<import('../../types/class').ClassSubclass['extras']>
  subclassExtras: import('../../types/class').SubclassChoiceSelections
  accent: string
  /** Perícias já vindas de outra fonte — o livro manda escolher outra em vez de repetir. */
  excludedSkills: string[]
  excludedTools: string[]
  /** Idiomas que o personagem já fala por outra fonte (raça, antecedente, talento, outra classe). */
  excludedLanguages: string[]
  /** Perícias e ferramentas escolhidas aqui que outra fonte já dá (id → aviso): marcadas, para trocar. */
  repeated: Record<string, string>
  onChangeExtras: (patch: Partial<import('../../types/class').SubclassChoiceSelections>) => void
}

const ARMOR_LABELS: Record<string, string> = {
  light: 'Armadura Leve',
  medium: 'Armadura Média',
  heavy: 'Armadura Pesada',
  shields: 'Escudos',
}

function SubclassExtrasPanel({
  extras, subclassExtras, accent, excludedSkills, excludedTools, excludedLanguages, repeated, onChangeExtras,
}: SubclassExtrasPanelProps) {
  const [cantripInput, setCantripInput] = useState(subclassExtras.cantrip ?? '')
  const excludedSkillSet = new Set(excludedSkills)
  const excludedToolSet = new Set(excludedTools)

  const hasChoices =
    extras.expertiseSkills || extras.skillChoice || extras.languages ||
    extras.toolChoice || extras.cantripChoice

  const grantedInfo = [
    ...extras.grantedArmorProficiencies.map(a => ARMOR_LABELS[a] ?? a),
    ...extras.grantedWeaponProficiencies.map(w =>
      w === 'martial' ? 'Armas Marciais' : w === 'simple' ? 'Armas Simples' : w
    ),
    ...extras.grantedTools.map(t => ALL_TOOLS.find(x => x.id === t)?.name ?? t),
    ...extras.grantedLanguages.map(getLanguageName),
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
              const disabled = !selected && isChoiceFull((subclassExtras.skills ?? []).length, extras.expertiseSkills!.count)
              return (
                <button
                  key={skillId}
                  disabled={disabled}
                  onClick={() => {
                    const next = toggleChoice(subclassExtras.skills ?? [], skillId, extras.expertiseSkills!.count)
                    if (next) onChangeExtras({ skills: next })
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
          <LanguagePicker
            count={extras.languages.count}
            selected={subclassExtras.languages ?? []}
            excluded={excludedLanguages}
            repeated={repeated}
            accent={accent}
            onChange={languages => onChangeExtras({ languages })}
          />
        </ChoiceSection>
      )}

      {/* Perícias ganhas (Domínio da Natureza: 1; Colégio do Conhecimento: 3 quaisquer) */}
      {extras.skillChoice && (
        <ChoiceSection
          title={`${extras.skillChoice.count === 1 ? 'Perícia Adicional' : 'Perícias Adicionais'} (${(subclassExtras.skills ?? []).length}/${extras.skillChoice.count})`}
          accent={accent}
        >
          <div className="flex flex-wrap gap-1.5">
            {resolveSkillOptions(extras.skillChoice.from).map(skill => {
              const selected = (subclassExtras.skills ?? []).includes(skill.id)
              const isRepeated = selected ? repeated[skill.id] : undefined
              const excluded = !selected && excludedSkillSet.has(skill.id)
              const disabled = excluded
                || (!selected && isChoiceFull((subclassExtras.skills ?? []).length, extras.skillChoice!.count))
              return (
                <button
                  key={skill.id}
                  disabled={disabled}
                  title={isRepeated ?? (excluded ? 'Você já possui esta perícia de outra fonte' : undefined)}
                  onClick={() => {
                    if (disabled) return
                    const next = toggleChoice(subclassExtras.skills ?? [], skill.id, extras.skillChoice!.count)
                    if (next) onChangeExtras({ skills: next })
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: selected ? accent : disabled ? 'rgba(30,20,8,0.4)' : 'rgba(40,28,12,0.8)',
                    color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                    border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60,40,20,0.3)' : 'rgba(90,62,36,0.5)'}`,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    ...(isRepeated ? REPEATED_CHIP_STYLE : {}),
                  }}
                >
                  {isRepeated ? '⚠ ' : excluded ? '✓ ' : ''}{skill.name}
                </button>
              )
            })}
          </div>
          <RepeatedProficiencyNotes ids={subclassExtras.skills ?? []} notes={repeated} />
        </ChoiceSection>
      )}

      {/* Ferramenta à escolha (Mestre de Batalha, "Estudioso da Guerra") */}
      {extras.toolChoice && (
        <ChoiceSection
          title={`${TOOL_CHOICE_LABELS[extras.toolChoice.from]} (${(subclassExtras.tools ?? []).length}/${extras.toolChoice.count})`}
          accent={accent}
        >
          <div className="flex flex-wrap gap-1.5">
            {filterToolsBySource(extras.toolChoice.from).map(tool => {
              const selected = (subclassExtras.tools ?? []).includes(tool.id)
              const isRepeated = selected ? repeated[tool.id] : undefined
              const excluded = !selected && excludedToolSet.has(tool.id)
              const disabled = excluded
                || (!selected && isChoiceFull((subclassExtras.tools ?? []).length, extras.toolChoice!.count))
              return (
                <button
                  key={tool.id}
                  disabled={disabled}
                  title={isRepeated ?? (excluded ? 'Você já possui esta ferramenta de outra fonte' : undefined)}
                  onClick={() => {
                    if (disabled) return
                    const next = toggleChoice(subclassExtras.tools ?? [], tool.id, extras.toolChoice!.count)
                    if (next) onChangeExtras({ tools: next })
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: selected ? accent : disabled ? 'rgba(30,20,8,0.4)' : 'rgba(40,28,12,0.8)',
                    color: selected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                    border: selected ? 'none' : `1px solid ${disabled ? 'rgba(60,40,20,0.3)' : 'rgba(90,62,36,0.5)'}`,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    ...(isRepeated ? REPEATED_CHIP_STYLE : {}),
                  }}
                >
                  {isRepeated ? '⚠ ' : excluded ? '✓ ' : ''}{tool.name}
                </button>
              )
            })}
          </div>
          <RepeatedProficiencyNotes ids={subclassExtras.tools ?? []} notes={repeated} />
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
  takenFightingStyles,
  takenManeuvers,
  onChange,
}: {
  classId: string
  subclassId: string | null
  level: number
  choices: ClassChoiceSelections
  accent: string
  /** Estilos que outra fonte já tomou (o da própria classe incluído) — fora do slot do campeão. */
  takenFightingStyles: string[]
  /** Manobras do talento Adepto Marcial — fora dos slots de manobra do Mestre de Batalha. */
  takenManeuvers: string[]
  onChange: (patch: Record<string, string[]>) => void
}) {
  const slots = getProgressionSlotsUpToLevel(classId, subclassId, level, choices.progressionChoices)
  if (slots.length === 0) return null
  // Pré-requisito de opção (Lâmina Sedenta exige o Pacto da Lâmina, p. 61): conferido contra o que
  // a classe tem escolhido nos slots liberados.
  const activePicks = getActivePicks(classId, subclassId, level, choices.progressionChoices)

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

  // Slot de 1 escolha (Dádiva do Pacto, Ancestral Dracônico, totens, a invocação do 5º nível) é
  // rádio: outra opção troca a marcada. O de N mantém o limite (decisão de 2026-10-26).
  function handleOptionToggle(slot: ProgressionSlot, optionId: string) {
    const next = toggleChoice(choices.progressionChoices[slot.id] ?? [], optionId, slot.count, isSingleChoiceSlot(slot))
    if (next) onChange({ [slot.id]: next })
  }

  return (
    <div className="space-y-4">
      {Array.from(groups.values()).map(group => {
        const optionsListId = group.slots[0].optionsListId
        // Estilo de Luta Adicional (Campeão nv10): não repete o estilo desta classe nem o de outra
        // classe da multiclasse (p. 85). O que já está no slot fica à vista para desmarcar.
        const pickedInGroup = group.slots.flatMap(s => choices.progressionChoices[s.id] ?? [])
        // Segredos Mágicos: só magia de nível que o bardo conjura pela tabela dele, ou truque (pp. 54-55).
        // Slot com teto próprio (truques do Livro das Sombras, p. 59) fica no teto dele.
        const classMaxLevel = optionsListId === SPELL_OPTIONS_LIST_ID ? getMaxSpellLevel(classId, level, subclassId) : 0
        const maxSecretLevel = Math.min(classMaxLevel, group.slots[0].maxSpellLevel ?? classMaxLevel)
        const options = (optionsListId === SPELL_OPTIONS_LIST_ID
          ? getSecretSpellOptions(maxSecretLevel, pickedInGroup)
          : getProgressionOptions(optionsListId)
        ).filter(
          opt => !(optionsListId === 'FIGHTING_STYLES' && takenFightingStyles.includes(opt.id) && !pickedInGroup.includes(opt.id)),
        ).filter(
          // Manobra já aprendida pelo Adepto Marcial: a marcada antes fica à vista para desmarcar
          // (o conflito trava a etapa do talento, getRepeatedFeatManeuvers).
          opt => !(optionsListId === MANEUVER_LIST_ID && takenManeuvers.includes(opt.id) && !pickedInGroup.includes(opt.id)),
        )

        // Cada slot é renderizado separadamente; num grupo cumulativo, as opções já
        // escolhidas nos slots de níveis anteriores aparecem marcadas e desabilitadas.
        return group.slots.map((slot, index) => {
          const currentPicked = choices.progressionChoices[slot.id] ?? []
          const slotFull = isChoiceFull(currentPicked.length, slot.count, isSingleChoiceSlot(slot))

          // Calcula opções já escolhidas em slots cumulativos anteriores para desabilitar
          const previousPicks = new Set<string>()
          if (slot.cumulative) {
            for (let i = 0; i < index; i++) {
              const prevSlot = group.slots[i]
              const prevPicked = choices.progressionChoices[prevSlot.id] ?? []
              prevPicked.forEach(p => previousPicks.add(p))
            }
          }

          const title = `${slot.label} (${currentPicked.length}/${slot.count}) ${slot.cumulative && index > 0 ? `(Nível ${slot.level})` : ''}`

          // Segredos Mágicos escolhe entre TODAS as magias do jogo — card catalog não serve
          // pra 361 opções. Esse caso fica na lista compacta com busca.
          if (optionsListId === SPELL_OPTIONS_LIST_ID) {
            // Segredo truque ocupa vaga de Truques Conhecidos: com a coluna cheia de Segredos, o
            // próximo tem de ser magia de 1º nível ou mais.
            const cantripRoom = slot.countsAsKnownSpell
              ? getSecretCantripRoom(classId, subclassId, level, choices.progressionChoices)
              : null
            const cantripsFull = cantripRoom !== null && cantripRoom.used.length >= cantripRoom.max
            const isLocked = (optId: string) => cantripsFull && getSpell(optId)?.level === 0
            return (
              <ChoiceSection key={slot.id} title={title} accent={accent}>
                <p className="text-xs text-parchment-500 mb-2">
                  {slot.hint ?? (
                    <>
                      Magia de qualquer classe, de até {maxSecretLevel}º nível (o que você conjura pela tabela do Bardo), ou um truque.{' '}
                      {slot.countsAsKnownSpell
                        ? 'Já faz parte das suas magias conhecidas (p. 54): ocupa uma vaga de Magias Conhecidas — ou de Truques Conhecidos, se for truque — e a etapa Magias pede uma a menos.'
                        : 'Não conta no número de magias conhecidas (p. 55): vem por cima das escolhidas na etapa Magias.'}
                    </>
                  )}
                </p>
                {cantripsFull && cantripRoom && currentPicked.length < slot.count && (
                  <p className="text-xs mb-2 rounded-lg border border-parchment-800 px-3 py-2 text-parchment-300">
                    Seus {cantripRoom.max} Truques Conhecidos já são todos Segredos Mágicos: os próximos Segredos têm de ser magia de 1º nível ou mais.
                  </p>
                )}
                <SpellPickerList
                  options={options}
                  picked={currentPicked}
                  previousPicks={previousPicks}
                  full={slotFull}
                  isLocked={isLocked}
                  accent={accent}
                  onToggle={optId => {
                    if (isLocked(optId) && !currentPicked.includes(optId)) return
                    handleOptionToggle(slot, optId)
                  }}
                />
              </ChoiceSection>
            )
          }

          return (
            <ChoiceSection key={slot.id} title={title} accent={accent}>
              {slot.hint && <p className="text-xs text-parchment-500 mb-2">{slot.hint}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 items-stretch">
                {options.map(opt => {
                  const unmet = getUnmetRequirement(classId, subclassId, activePicks, opt)
                  return (
                    <ProgressionOptionCard
                      key={opt.id}
                      option={opt}
                      accent={accent}
                      picked={currentPicked.includes(opt.id)}
                      pickedEarlier={previousPicks.has(opt.id)}
                      slotFull={slotFull}
                      unmetRequirement={unmet ? describeRequiredPick(unmet) : null}
                      onToggle={() => handleOptionToggle(slot, opt.id)}
                    />
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

/**
 * Seletor dos Segredos Mágicos (Bardo): a lista de opções são as 361 magias do jogo, então em
 * vez do catálogo de cards vale busca + lista compacta. As já escolhidas ficam no topo, pra não
 * sumirem no meio do rolo depois de filtrar.
 */
function SpellPickerList({
  options,
  picked,
  previousPicks,
  full,
  isLocked,
  accent,
  onToggle,
}: {
  options: ProgressionOption[]
  picked: string[]
  previousPicks: Set<string>
  /** Slot cheio para magia nova (`isChoiceFull`: o de 1 escolha troca, nunca enche). */
  full: boolean
  /** Opção que não pode entrar agora (truque com Truques Conhecidos cheios de Segredos). */
  isLocked?: (optionId: string) => boolean
  accent: string
  onToggle: (optionId: string) => void
}) {
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()

  const chosen = options.filter(o => picked.includes(o.id) || previousPicks.has(o.id))
  const rest = options.filter(
    o => !picked.includes(o.id) && !previousPicks.has(o.id) &&
      (term === '' || o.name.toLowerCase().includes(term) || (o.description ?? '').toLowerCase().includes(term)),
  )
  const LIMIT = 40
  const shown = rest.slice(0, LIMIT)

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar magia por nome, nível ou classe…"
        className="w-full px-3 py-2 mb-2 rounded-lg border text-parchment-200 text-sm bg-parchment-950 placeholder:text-parchment-700"
        style={{ borderColor: 'rgba(90,62,36,0.6)' }}
      />

      <div className="max-h-[320px] overflow-y-auto pr-1 space-y-1">
        {[...chosen, ...shown].map(opt => {
          const pickedEarlier = previousPicks.has(opt.id)
          const isPicked = picked.includes(opt.id)
          const selected = isPicked || pickedEarlier
          const disabled = pickedEarlier || (!isPicked && (full || (isLocked?.(opt.id) ?? false)))

          return (
            <button
              key={opt.id}
              onClick={() => { if (!pickedEarlier) onToggle(opt.id) }}
              disabled={disabled}
              className="w-full text-left px-3 py-1.5 rounded-lg border transition-all"
              style={{
                borderColor: selected ? accent : 'rgba(90,62,36,0.4)',
                backgroundColor: selected ? `${accent}12` : 'transparent',
                opacity: disabled && !selected ? 0.45 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="font-fantasy text-sm font-semibold"
                  style={{ color: selected ? accent : '#c4a97a' }}
                >
                  {pickedEarlier ? '✓ ' : ''}{opt.name}
                </span>
                <span className="text-[11px] text-parchment-600 shrink-0">{opt.description}</span>
              </div>
            </button>
          )
        })}

        {rest.length > LIMIT && (
          <p className="text-[11px] text-parchment-600 text-center py-2">
            +{rest.length - LIMIT} magias — refine a busca pra ver as demais.
          </p>
        )}
        {rest.length === 0 && chosen.length === 0 && (
          <p className="text-xs text-parchment-600 text-center py-3">Nenhuma magia encontrada.</p>
        )}
      </div>
    </div>
  )
}
