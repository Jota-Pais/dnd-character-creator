import { useCharacterStore } from '../../stores/characterStore'
import type { FeatChoiceSlot } from '../../utils/sheetEffects'
import { getFeatChoiceSlots, getRepeatedFeatManeuvers, isFeatChoiceComplete } from '../../utils/sheetEffects'
import { getManeuverName, getManeuverOptions } from '../../utils/maneuverUtils'
import { ProgressionOptionCard } from '../class/ProgressionOptionCard'
import {
  getExcludedSkillsForFeat, getExcludedToolsForFeat,
  getExcludedLanguagesForFeat, getExcludedWeaponsForFeat,
} from '../../utils/proficiencyUtils'
import { SKILLS } from '../../utils/raceUtils'
import { LanguagePicker } from './LanguagePicker'
import { ALL_WEAPONS } from '../../utils/equipmentUtils'
import toolsData from '../../data/tools.json'

type Tool = { id: string; name: string }
const ALL_TOOLS = toolsData as Tool[]

/**
 * As escolhas que um talento abre — Perito (3 perícias ou ferramentas), Poliglota (3 idiomas),
 * Mestre de Armas (4 armas), Adepto Marcial (2 manobras do Mestre de Batalha).
 *
 * Fica ao LADO do catálogo, na etapa dona do talento, e não dentro do card: o card já é uma
 * escolha, e aninhar um segundo catálogo nele esconde a decisão em vez de apresentá-la.
 *
 * O que o personagem já tem por outra fonte aparece marcado e travado — o livro manda escolher
 * outra coisa em vez de repetir a proficiência.
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
            borderColor: isFeatChoiceComplete(slot) ? `${accent}50` : 'rgba(153, 27, 27, 0.6)',
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

type Option = { id: string; name: string }
/** SKILLS é `as const`; o picker só lê, então basta afrouxar a leitura. */
type OptionList = readonly Option[]

function SlotBody({
  slot, accent, onChange,
}: {
  slot: FeatChoiceSlot
  accent: string
  onChange: (patch: { skills?: string[]; tools?: string[]; languages?: string[]; weapons?: string[]; maneuvers?: string[] }) => void
}) {
  const draft = useCharacterStore(s => s.draft)
  const { feat, choices, selections } = slot

  if (choices.skillOrToolChoice) {
    // "Qualquer combinação de três perícias OU ferramentas": um limite só para os dois bolos.
    const picked = (selections.skills?.length ?? 0) + (selections.tools?.length ?? 0)
    const full = picked >= choices.skillOrToolChoice.count
    const excludedSkills = new Set(getExcludedSkillsForFeat(draft, feat.id))
    const excludedTools = new Set(getExcludedToolsForFeat(draft, feat.id))
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
          full={full}
          accent={accent}
          onToggle={id => onChange({ skills: toggle(selections.skills ?? [], id) })}
        />
        <Group
          title="Ferramentas"
          options={ALL_TOOLS}
          selected={selections.tools ?? []}
          excluded={excludedTools}
          full={full}
          accent={accent}
          onToggle={id => onChange({ tools: toggle(selections.tools ?? [], id) })}
        />
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

  return null
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id]
}

function Header({ label }: { label: string }) {
  return <p className="text-xs font-semibold text-parchment-300 mb-1.5">{label}</p>
}

function Group({
  title, options, selected, excluded, full, accent, onToggle,
}: {
  title?: string
  options: OptionList
  selected: string[]
  excluded: Set<string>
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
          const isExcluded = excluded.has(option.id)
          const disabled = isExcluded || (!isSelected && full)
          return (
            <button
              key={option.id}
              disabled={disabled}
              title={isExcluded ? 'Você já possui esta proficiência de outra fonte' : undefined}
              onClick={() => { if (!disabled) onToggle(option.id) }}
              className="px-2 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: isSelected ? accent : disabled ? 'rgba(30,20,8,0.4)' : 'rgba(40,28,12,0.8)',
                color: isSelected ? '#0a0704' : disabled ? '#4a3520' : '#c4a97a',
                border: isSelected ? 'none' : `1px solid ${disabled ? 'rgba(60,40,20,0.3)' : 'rgba(90,62,36,0.5)'}`,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {isExcluded ? '✓ ' : ''}{option.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
