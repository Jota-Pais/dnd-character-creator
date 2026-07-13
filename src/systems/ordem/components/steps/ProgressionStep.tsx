import { useOrdemStore } from '../../stores/characterStore'
import { getOrdemClass } from '../../utils/classUtils'
import { formatSkillWithAttribute } from '../../utils/skillUtils'
import {
  getAvailableTrilhaOptions,
  getAvailableVersatilityTrilhaOptions,
  getAvailablePowerOptions,
  getEligibleSkillGradeOptions,
  getEffectiveAttributes,
  getRequiredPowerSlots,
  getRequiredAttributeIncreaseSlots,
  getRequiredSkillGradeSlots,
  getSkillGrade,
  POWER_PARAM_SPECS,
} from '../../utils/characterUtils'
import { hasTrilha, hasVersatility } from '../../utils/progressionUtils'
import { SKILLS } from '../../utils/skillUtils'
import { ELEMENT_NAMES } from '../../utils/ritualUtils'
import type { OrdemElement } from '../../types/ritual'
import { ATTRIBUTES, ATTRIBUTE_MAX } from '../../utils/attributeUtils'
import { isStepComplete } from '../../utils/draftValidation'
import { StepNav } from '../common/StepNav'
import type { OrdemAttributes } from '../../types/character'

const ATTRIBUTE_INCREASE_CAP = 5

export function ProgressionStep() {
  const draft = useOrdemStore(state => state.draft)
  const setTrilha = useOrdemStore(state => state.setTrilha)
  const setPowerChoice = useOrdemStore(state => state.setPowerChoice)
  const setAttributeIncreaseChoice = useOrdemStore(state => state.setAttributeIncreaseChoice)
  const setSkillGradeChoice = useOrdemStore(state => state.setSkillGradeChoice)
  const setVersatilityChoice = useOrdemStore(state => state.setVersatilityChoice)
  const nextStep = useOrdemStore(state => state.nextStep)
  const prevStep = useOrdemStore(state => state.prevStep)

  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  const canAdvance = isStepComplete(draft, 'progression')
  if (!cls) return null

  const showTrilha = hasTrilha(draft.nex)
  const requiredPowers = getRequiredPowerSlots(draft.nex)
  const requiredAttrIncreases = getRequiredAttributeIncreaseSlots(draft.nex)
  const requiredGradeSlots = getRequiredSkillGradeSlots(draft.nex)
  const showVersatility = hasVersatility(draft.nex)

  if (draft.nex <= 5) {
    return (
      <div className="max-w-lg mx-auto text-center">
        <div className="text-5xl mb-3">🕯️</div>
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-2">Nada por aqui ainda</h2>
        <p className="text-parchment-500 text-sm mb-8">
          Em NEX 5%, seu agente ainda não escolheu trilha, poderes extras nem aumentos de atributo —
          isso começa a partir de NEX 10%. Volte ao passo Nome se quiser criar um agente mais experiente.
        </p>
        <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={canAdvance} />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-16">
      <div className="text-center mb-2">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200">Progressão até NEX {draft.nex}%</h2>
        <p className="text-parchment-500 text-sm mt-1">
          Trilha, poderes e aumentos que seu agente já desenvolveu.
        </p>
      </div>

      {/* A trilha ocupa a largura toda (uma coluna por trilha, detalhes sempre visíveis). */}
      {showTrilha && (
        <TrilhaSection draft={draft} cls={cls} onSelect={setTrilha} />
      )}

      <div className="max-w-lg mx-auto space-y-4">
        {requiredPowers > 0 && (
          <PowerSection draft={draft} cls={cls} required={requiredPowers} onPick={setPowerChoice} />
        )}

        {requiredAttrIncreases > 0 && (
          <AttributeIncreaseSection draft={draft} required={requiredAttrIncreases} onPick={setAttributeIncreaseChoice} />
        )}

        {requiredGradeSlots > 0 && (
          <SkillGradeSection draft={draft} cls={cls} required={requiredGradeSlots} onPick={setSkillGradeChoice} />
        )}

        {showVersatility && (
          <VersatilitySection draft={draft} cls={cls} onPick={setVersatilityChoice} />
        )}

        <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={canAdvance} />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
      <h4 className="text-xs font-semibold font-fantasy text-parchment-600 uppercase tracking-widest mb-3">{title}</h4>
      {children}
    </div>
  )
}

function Chip({ label, active, disabled, onClick }: { label: string; active: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className="px-2 py-0.5 rounded-md text-xs font-mono font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        backgroundColor: active ? '#dc262630' : '#1a140a',
        color: active ? '#dc2626' : '#8a7a5a',
      }}
    >
      {label}
    </button>
  )
}

function TrilhaSection({ draft, cls, onSelect }: { draft: import('../../types/character').OrdemCharacterDraft; cls: import('../../types/class').OrdemClass; onSelect: (id: string) => void }) {
  const options = getAvailableTrilhaOptions(cls)

  return (
    <Section title="Trilha (NEX 10%)">
      <p className="text-parchment-600 text-xs mb-2">
        A trilha define o foco do seu agente e concede um poder em NEX 10%, 40%, 65% e 99%. Os detalhes de
        todas já estão à mostra — clique numa coluna pra escolher.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 items-stretch">
        {options.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className="text-left px-3 py-2.5 rounded-lg border transition-all flex flex-col"
            style={{
              borderColor: draft.trilha === t.id ? '#dc2626' : '#2a2213',
              backgroundColor: draft.trilha === t.id ? '#dc262615' : '#0a070499',
            }}
          >
            <p className="font-fantasy font-semibold text-base text-parchment-200">{t.name}</p>
            <p className="text-parchment-500 text-xs mt-0.5 leading-snug">{t.description}</p>
            {t.requirement && <p className="text-parchment-600 text-xs mt-0.5">Requisito: {t.requirement}</p>}
            <div className="mt-2 pt-2 border-t border-parchment-900/60 space-y-1.5">
              {t.features.map(f => {
                const reached = f.nex <= draft.nex
                return (
                  <p key={f.name} className={`text-xs leading-snug ${reached ? 'text-parchment-500' : 'text-parchment-700 opacity-70'}`}>
                    <span className={`font-semibold ${reached ? 'text-parchment-300' : 'text-parchment-500'}`}>
                      {reached ? '' : '🔒 '}NEX {f.nex}% – {f.name}.
                    </span>{' '}
                    {f.description}
                  </p>
                )
              })}
            </div>
          </button>
        ))}
      </div>
    </Section>
  )
}

function PowerSection({ draft, cls, required, onPick }: {
  draft: import('../../types/character').OrdemCharacterDraft
  cls: import('../../types/class').OrdemClass
  required: number
  onPick: (slot: number, powerId: string) => void
}) {
  return (
    <Section title={`Poderes de ${cls.name}`}>
      <div className="space-y-3">
        {Array.from({ length: required }).map((_, slot) => {
          const chosen = draft.powerChoices[slot]
          const options = getAvailablePowerOptions(draft, cls, slot)
          return (
            <div key={slot}>
              <p className="text-parchment-600 text-xs mb-1">Poder {slot + 1} de {required}</p>
              <div className="flex flex-wrap gap-1.5">
                {options.map(p => (
                  <Chip key={p.id} label={p.name} active={chosen === p.id} onClick={() => onPick(slot, p.id)} />
                ))}
              </div>
              {chosen && (
                <p className="text-parchment-500 text-xs mt-1">
                  {options.find(p => p.id === chosen)?.description}
                </p>
              )}
              {chosen && POWER_PARAM_SPECS[chosen] && (
                <PowerParamPicker draft={draft} slotKey={`slot-${slot}`} powerId={chosen} />
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

/** Escolhas embutidas de um poder (F27): 2 perícias (Treinamento) ou 1 elemento (Especialista/Mestre). */
function PowerParamPicker({ draft, slotKey, powerId }: {
  draft: import('../../types/character').OrdemCharacterDraft
  slotKey: string
  powerId: string
}) {
  const updateDraft = useOrdemStore(state => state.updateDraft)
  const spec = POWER_PARAM_SPECS[powerId]
  const values = draft.powerParams[slotKey] ?? []

  const setValue = (index: number, value: string) => {
    const next = [...values]
    next[index] = value
    updateDraft({ powerParams: { ...draft.powerParams, [slotKey]: next } })
  }

  if (spec.kind === 'element') {
    const ELEMENTS: OrdemElement[] = ['knowledge', 'energy', 'death', 'blood']
    return (
      <div className="mt-1.5">
        <p className="text-parchment-600 text-xs mb-1">Escolha o elemento:</p>
        <div className="flex flex-wrap gap-1.5">
          {ELEMENTS.map(el => (
            <Chip key={el} label={ELEMENT_NAMES[el]} active={values[0] === el} onClick={() => setValue(0, el)} />
          ))}
        </div>
      </div>
    )
  }

  // Treinamento em Perícia: destreinada → treinada; a partir de NEX 35%/70% pode subir grau de treinada/veterana.
  const eligible = (skillId: string, index: number) => {
    if (values.includes(skillId) && values[index] !== skillId) return false
    const grade = getSkillGrade(draft, skillId)
    if (grade === 'destreinado' || values[index] === skillId) return true
    if (grade === 'treinado') return draft.nex >= 35
    if (grade === 'veterano') return draft.nex >= 70
    return false
  }
  return (
    <div className="mt-1.5 space-y-1">
      {[0, 1].map(i => (
        <select
          key={i}
          value={values[i] ?? ''}
          onChange={e => setValue(i, e.target.value)}
          className="w-full bg-parchment-950 border border-parchment-800 rounded px-2 py-1 text-parchment-300 text-xs"
        >
          <option value="" disabled>Escolha a {i + 1}ª perícia…</option>
          {SKILLS.filter(s => eligible(s.id, i)).map(s => (
            <option key={s.id} value={s.id}>{formatSkillWithAttribute(s.id)}{getSkillGrade(draft, s.id) !== 'destreinado' ? ` (subir grau)` : ''}</option>
          ))}
        </select>
      ))}
    </div>
  )
}

function AttributeIncreaseSection({ draft, required, onPick }: {
  draft: import('../../types/character').OrdemCharacterDraft
  required: number
  onPick: (slot: number, attribute: keyof OrdemAttributes) => void
}) {
  const effective = getEffectiveAttributes(draft)
  return (
    <Section title="Aumento de Atributo">
      <div className="space-y-2">
        {Array.from({ length: required }).map((_, slot) => {
          const chosen = draft.attributeIncreaseChoices[slot]
          return (
            <div key={slot} className="flex items-center gap-1.5 flex-wrap">
              <span className="text-parchment-600 text-xs mr-1">#{slot + 1}</span>
              {ATTRIBUTES.map(attr => {
                const id = attr.id as keyof OrdemAttributes
                const atCap = effective[id] >= ATTRIBUTE_INCREASE_CAP && chosen !== id
                return (
                  <Chip
                    key={attr.id}
                    label={`${attr.name} (${effective[id]})`}
                    active={chosen === id}
                    disabled={atCap}
                    onClick={() => onPick(slot, id)}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      <p className="text-parchment-700 text-xs mt-2">Teto {ATTRIBUTE_MAX + 2} por esta via (aumento de atributo, não de criação).</p>
    </Section>
  )
}

function SkillGradeSection({ draft, cls, required, onPick }: {
  draft: import('../../types/character').OrdemCharacterDraft
  cls: import('../../types/class').OrdemClass
  required: number
  onPick: (slot: number, skillIds: string[]) => void
}) {
  const countPerSlot = cls.skillGradeCount + draft.attributes.intellect
  return (
    <Section title="Grau de Treinamento">
      <div className="space-y-3">
        {Array.from({ length: required }).map((_, slot) => {
          const chosen = draft.skillGradeChoices[slot] ?? []
          const options = getEligibleSkillGradeOptions(draft)
          return (
            <div key={slot}>
              <p className="text-parchment-600 text-xs mb-1">
                Slot {slot + 1} de {required} — escolha {countPerSlot} ({chosen.length}/{countPerSlot})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {options.map(sid => {
                  const active = chosen.includes(sid)
                  const disabled = !active && chosen.length >= countPerSlot
                  return (
                    <Chip
                      key={sid}
                      label={formatSkillWithAttribute(sid)}
                      active={active}
                      disabled={disabled}
                      onClick={() => onPick(slot, active ? chosen.filter(s => s !== sid) : [...chosen, sid])}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function VersatilitySection({ draft, cls, onPick }: {
  draft: import('../../types/character').OrdemCharacterDraft
  cls: import('../../types/class').OrdemClass
  onPick: (choice: import('../../types/character').VersatilityChoice) => void
}) {
  const powerOptions = getAvailablePowerOptions(draft, cls)
  const trilhaOptions = getAvailableVersatilityTrilhaOptions(draft, cls)
  const choice = draft.versatilityChoice

  return (
    <Section title="Versatilidade (NEX 50%)">
      <p className="text-parchment-600 text-xs mb-2">Escolha um poder extra de {cls.name}, ou o 1º poder de outra trilha.</p>
      <div className="mb-2">
        <p className="text-parchment-700 text-xs mb-1">Poder extra</p>
        <div className="flex flex-wrap gap-1.5">
          {powerOptions.map(p => (
            <Chip
              key={p.id}
              label={p.name}
              active={choice?.kind === 'power' && choice.powerId === p.id}
              onClick={() => onPick({ kind: 'power', powerId: p.id })}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-parchment-700 text-xs mb-1">Ou 1º poder de outra trilha</p>
        <div className="flex flex-wrap gap-1.5">
          {trilhaOptions.map(t => (
            <Chip
              key={t.id}
              label={t.name}
              active={choice?.kind === 'trilha' && choice.trilhaId === t.id}
              onClick={() => onPick({ kind: 'trilha', trilhaId: t.id })}
            />
          ))}
        </div>
      </div>
    </Section>
  )
}
