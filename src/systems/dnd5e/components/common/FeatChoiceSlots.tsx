import { useCharacterStore } from '../../stores/characterStore'
import type { FeatChoiceSlot } from '../../utils/sheetEffects'
import { getFeatChoiceSlots, getRepeatedFeatManeuvers, isFeatChoiceComplete } from '../../utils/sheetEffects'
import { getManeuverName, getManeuverOptions } from '../../utils/maneuverUtils'
import { ProgressionOptionCard } from '../class/ProgressionOptionCard'
import {
  FEAT_SPELL_USAGE, formatRepeatedSpell, getFeatSpellcastingAbility, getFeatSpellOptions, getFeatSpellPicks,
  getRepeatedSpells, type FeatSpellChoice,
} from '../../utils/spellUtils'
import { getClass } from '../../utils/classUtils'
import { ABILITY_LABELS } from '../../utils/abilityScoreUtils'
import type { CharacterDraft, FeatSelections } from '../../types/character'
import type { SpellClass } from '../../types/spell'
import {
  getExcludedSkillsForFeat, getExcludedToolsForFeat,
  getExcludedLanguagesForFeat, getExcludedWeaponsForFeat, getRepeatedProficiencyNotes,
} from '../../utils/proficiencyUtils'
import { SKILLS } from '../../utils/raceUtils'
import { LanguagePicker } from './LanguagePicker'
import { RepeatedProficiencyNotes } from './RepeatedProficiencyNotes'
import { REPEATED_CHIP_STYLE } from './repeatedChipStyle'
import { ALL_WEAPONS } from '../../utils/equipmentUtils'
import toolsData from '../../data/tools.json'

type Tool = { id: string; name: string }
const ALL_TOOLS = toolsData as Tool[]

/**
 * As escolhas que um talento abre — Perito (3 perícias ou ferramentas), Poliglota (3 idiomas),
 * Mestre de Armas (4 armas), Adepto Marcial (2 manobras do Mestre de Batalha), Iniciado em Magia
 * (classe, 2 truques e 1 magia de 1º nível da lista dela).
 *
 * Fica ao LADO do catálogo, na etapa dona do talento, e não dentro do card: o card já é uma
 * escolha, e aninhar um segundo catálogo nele esconde a decisão em vez de apresentá-la.
 *
 * O que o personagem já tem por outra fonte aparece marcado e travado — o livro manda escolher
 * outra coisa em vez de repetir a proficiência. A escolha que ficou repetida depois (antecedente
 * trocado, ficha antiga) segue marcada, com o aviso, para trocar (p. 125).
 *
 * `featIds` limita quais talentos este bloco desenha, para cada etapa cuidar dos seus (a Raça
 * mostra só o do Humano Variante; Aprimoramentos, só os dos espaços de ASI).
 */
export function FeatChoiceSlots({ accent, featIds }: { accent: string; featIds?: string[] }) {
  const draft = useCharacterStore(s => s.draft)
  const updateFeatSelections = useCharacterStore(s => s.updateFeatSelections)

  const slots = getFeatChoiceSlots(draft)
    .filter(slot => !featIds || featIds.includes(slot.feat.id))
  if (slots.length === 0) return null

  return (
    <div className="space-y-4">
      {slots.map(slot => (
        <div
          key={slot.feat.id}
          className="rounded-xl border p-3"
          style={{
            borderColor: isFeatChoiceComplete(slot) && !hasRepeated(draft, slot.feat.id) ? `${accent}50` : 'rgba(153, 27, 27, 0.6)',
            backgroundColor: 'rgba(15, 10, 4, 0.5)',
          }}
        >
          <p className="text-xs font-fantasy uppercase tracking-widest mb-2" style={{ color: accent }}>
            {slot.feat.name}
          </p>
          <SlotBody
            slot={slot}
            accent={accent}
            onChange={patch => updateFeatSelections(slot.feat.id, patch)}
          />
        </div>
      ))}
    </div>
  )
}

function hasRepeated(draft: CharacterDraft, featId: string): boolean {
  return Object.keys(getRepeatedProficiencyNotes(draft, { kind: 'feat', featId })).length > 0
}

type Option = { id: string; name: string }
/** SKILLS é `as const`; o picker só lê, então basta afrouxar a leitura. */
type OptionList = readonly Option[]

function SlotBody({
  slot, accent, onChange,
}: {
  slot: FeatChoiceSlot
  accent: string
  onChange: (patch: FeatSelections) => void
}) {
  const draft = useCharacterStore(s => s.draft)
  const { feat, choices, selections } = slot

  if (choices.skillOrToolChoice) {
    // "Qualquer combinação de três perícias OU ferramentas": um limite só para os dois bolos.
    const picked = (selections.skills?.length ?? 0) + (selections.tools?.length ?? 0)
    const full = picked >= choices.skillOrToolChoice.count
    const excludedSkills = new Set(getExcludedSkillsForFeat(draft, feat.id))
    const excludedTools = new Set(getExcludedToolsForFeat(draft, feat.id))
    const repeated = getRepeatedProficiencyNotes(draft, { kind: 'feat', featId: feat.id })
    return (
      <>
        <Header
          label={`Perícias ou ferramentas (${picked}/${choices.skillOrToolChoice.count})`}
        />
        <Group
          title="Perícias"
          options={SKILLS}
          selected={selections.skills ?? []}
          excluded={excludedSkills}
          repeated={repeated}
          full={full}
          accent={accent}
          onToggle={id => onChange({ skills: toggle(selections.skills ?? [], id) })}
        />
        <Group
          title="Ferramentas"
          options={ALL_TOOLS}
          selected={selections.tools ?? []}
          excluded={excludedTools}
          repeated={repeated}
          full={full}
          accent={accent}
          onToggle={id => onChange({ tools: toggle(selections.tools ?? [], id) })}
        />
        <RepeatedProficiencyNotes ids={[...(selections.skills ?? []), ...(selections.tools ?? [])]} notes={repeated} />
      </>
    )
  }

  if (choices.languageChoice) {
    const selected = selections.languages ?? []
    return (
      <>
        <Header label={`Idiomas (${selected.length}/${choices.languageChoice.count})`} />
        <LanguagePicker
          count={choices.languageChoice.count}
          selected={selected}
          excluded={getExcludedLanguagesForFeat(draft, feat.id)}
          accent={accent}
          onChange={languages => onChange({ languages })}
        />
      </>
    )
  }

  if (choices.weaponChoice) {
    const selected = selections.weapons ?? []
    return (
      <>
        <Header label={`Armas (${selected.length}/${choices.weaponChoice.count})`} />
        <Group
          options={ALL_WEAPONS.map(w => ({ id: w.id, name: w.name }))}
          selected={selected}
          excluded={new Set(getExcludedWeaponsForFeat(draft, feat.id))}
          full={selected.length >= choices.weaponChoice.count}
          accent={accent}
          onToggle={id => onChange({ weapons: toggle(selected, id) })}
        />
      </>
    )
  }

  if (choices.maneuverChoice) {
    // As manobras que o Mestre de Batalha já ensinou não aparecem: aprender a mesma de novo não
    // daria nada. A que já estava marcada (ficha antiga, subclasse trocada) fica à vista, com o
    // aviso, para ser desmarcada.
    const selected = selections.maneuvers ?? []
    const max = choices.maneuverChoice.count
    const repeated = getRepeatedFeatManeuvers(slot)
    const options = getManeuverOptions()
      .filter(m => !slot.takenManeuvers.includes(m.id) || selected.includes(m.id))
    return (
      <>
        <Header label={`Manobras (${selected.length}/${max})`} />
        <p className="text-[11px] text-parchment-600 mb-2">
          Da lista do Mestre de Batalha.
          {slot.takenManeuvers.length > 0 && ' As que você já conhece pelo arquétipo não aparecem.'}
        </p>
        {repeated.map(id => (
          <p key={id} className="text-xs mb-2 text-red-400 font-semibold">
            ⚠ {getManeuverName(id)} você já conhece pelo Mestre de Batalha — desmarque e escolha outra.
          </p>
        ))}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-stretch">
          {options.map(opt => (
            <ProgressionOptionCard
              key={opt.id}
              option={opt}
              accent={accent}
              picked={selected.includes(opt.id)}
              pickedEarlier={false}
              slotFull={selected.length >= max}
              onToggle={() => {
                if (!selected.includes(opt.id) && selected.length >= max) return
                onChange({ maneuvers: toggle(selected, opt.id) })
              }}
            />
          ))}
        </div>
      </>
    )
  }

  if (choices.spellChoice) {
    return <SpellChoiceBody slot={slot} choice={choices.spellChoice} accent={accent} onChange={onChange} />
  }

  return null
}

/**
 * Iniciado em Magia (p. 170), em três passos no mesmo slot: a classe (com o atributo de
 * conjuração que ela dá), os truques e a magia de 1º nível da lista dela. Trocar a classe limpa
 * os truques e a magia — os da lista antiga não valem na nova.
 */
function SpellChoiceBody({
  slot, choice, accent, onChange,
}: {
  slot: FeatChoiceSlot
  choice: FeatSpellChoice
  accent: string
  onChange: (patch: FeatSelections) => void
}) {
  const draft = useCharacterStore(s => s.draft)
  const picks = getFeatSpellPicks(choice, slot.selections)
  const spellClass = picks.spellClass
  const featSource = `feat:${slot.feat.id}`
  const repeated = getRepeatedSpells(draft).filter(r => r.sources.some(s => s.key === featSource))
  const classOptions = choice.classes.map(id => {
    const ability = getFeatSpellcastingAbility(id as SpellClass)
    return { id, name: `${getClass(id)?.name ?? id}${ability ? ` · ${ABILITY_LABELS[ability].short}` : ''}` }
  })
  return (
    <>
      <Header label="Classe" />
      <p className="text-[11px] text-parchment-600 mb-2">
        As magias vêm da lista dela, e o atributo de conjuração também.
      </p>
      <Group
        options={classOptions}
        selected={spellClass ? [spellClass] : []}
        excluded={new Set()}
        full={false}
        accent={accent}
        onToggle={id => onChange(id === spellClass
          ? { spellClass: undefined, cantrips: [], spells: [] }
          : { spellClass: id, cantrips: [], spells: [] })}
      />
      {spellClass && (
        <>
          <Header label={`Truques (${picks.cantrips.length}/${choice.cantrips})`} />
          <Group
            options={getFeatSpellOptions(spellClass, 0)}
            selected={picks.cantrips}
            excluded={new Set()}
            full={picks.cantrips.length >= choice.cantrips}
            accent={accent}
            onToggle={id => onChange({ cantrips: toggle(picks.cantrips, id) })}
          />
          <Header label={`Magia de ${choice.spellLevel}º nível (${picks.spells.length}/${choice.spells})`} />
          <p className="text-[11px] text-parchment-600 mb-2">{FEAT_SPELL_USAGE}.</p>
          <Group
            options={getFeatSpellOptions(spellClass, choice.spellLevel)}
            selected={picks.spells}
            excluded={new Set()}
            full={picks.spells.length >= choice.spells}
            accent={accent}
            onToggle={id => onChange({ spells: toggle(picks.spells, id) })}
          />
          {/* Mesmo aviso da etapa Magias e da Revisão: a regra deixa repetir, a ficha só avisa. */}
          {repeated.map(r => (
            <p key={r.spellId} className="text-xs mt-2 text-red-400 font-semibold">⚠ {formatRepeatedSpell(r)}</p>
          ))}
        </>
      )}
    </>
  )
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id]
}

function Header({ label }: { label: string }) {
  return <p className="text-xs font-semibold text-parchment-300 mb-1.5">{label}</p>
}

function Group({
  title, options, selected, excluded, repeated = {}, full, accent, onToggle,
}: {
  title?: string
  options: OptionList
  selected: string[]
  excluded: Set<string>
  /** Marcadas que outra fonte já dá (id → aviso): em vermelho, para desmarcar e trocar. */
  repeated?: Record<string, string>
  full: boolean
  accent: string
  onToggle: (id: string) => void
}) {
  return (
    <div className="mb-2 last:mb-0">
      {title && <p className="text-[11px] text-parchment-700 mb-1">{title}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options.map(option => {
          const isSelected = selected.includes(option.id)
          const repeatedNote = isSelected ? repeated[option.id] : undefined
          const isExcluded = !isSelected && excluded.has(option.id)
          const disabled = isExcluded || (!isSelected && full)
          return (
            <button
              key={option.id}
              disabled={disabled}
              title={repeatedNote ?? (isExcluded ? 'Você já possui esta proficiência de outra fonte' : undefined)}
              onClick={() => { if (!disabled) onToggle(option.id) }}
              className="px-2 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: isSelected ? accent : disabled ? 'rgba(30,20,8,0.4)' : 'rgba(40,28,12,0.8)',
                color: isSelected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                border: isSelected ? 'none' : `1px solid ${disabled ? 'rgba(60,40,20,0.3)' : 'rgba(90,62,36,0.5)'}`,
                cursor: disabled ? 'not-allowed' : 'pointer',
                ...(repeatedNote ? REPEATED_CHIP_STYLE : {}),
              }}
            >
              {repeatedNote ? '⚠ ' : isExcluded ? '✓ ' : ''}{option.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
