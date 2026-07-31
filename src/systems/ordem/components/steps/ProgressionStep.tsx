import { useOrdemStore } from '../../stores/characterStore'
import { getOrdemClass } from '../../utils/classUtils'
import { formatSkillWithAttribute } from '../../utils/skillUtils'
import {
  getTrilhaOptions,
  getVersatilityTrilhaOptions,
  getClassPowerOptions,
  getClassPowerCatalog,
  getEligibleSkillGradeOptions,
  getEffectiveAttributes,
  getRequiredPowerSlots,
  getRequiredAttributeIncreaseSlots,
  getRequiredSkillGradeSlots,
  getSkillGrade,
  POWER_PARAM_SPECS,
} from '../../utils/characterUtils'
import { hasTrilha, hasVersatility, POWER_SLOT_NEX } from '../../utils/progressionUtils'
import { getParanormalPower } from '../../utils/paranormalPowerUtils'
import type { ParanormalSourceKey } from '../../types/character'
import { SKILLS } from '../../utils/skillUtils'
import { ELEMENT_NAMES, ELEMENT_COLORS } from '../../utils/ritualUtils'
import type { OrdemElement } from '../../types/ritual'
import { ATTRIBUTES, ATTRIBUTE_MAX } from '../../utils/attributeUtils'
import { isStepComplete } from '../../utils/draftValidation'
import { StepNav } from '../common/StepNav'
import { StepPrerequisite } from '../common/StepPrerequisite'
import { ClassPowerCard } from '../progression/ClassPowerCard'
import type { OrdemAttributes } from '../../types/character'

const ATTRIBUTE_INCREASE_CAP = 5

export function ProgressionStep() {
  const draft = useOrdemStore(state => state.draft)
  const setTrilha = useOrdemStore(state => state.setTrilha)
  const setPowerChoice = useOrdemStore(state => state.setPowerChoice)
  const clearPowerChoice = useOrdemStore(state => state.clearPowerChoice)
  const setAttributeIncreaseChoice = useOrdemStore(state => state.setAttributeIncreaseChoice)
  const setSkillGradeChoice = useOrdemStore(state => state.setSkillGradeChoice)
  const setVersatilityChoice = useOrdemStore(state => state.setVersatilityChoice)
  const nextStep = useOrdemStore(state => state.nextStep)
  const prevStep = useOrdemStore(state => state.prevStep)

  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  const canAdvance = isStepComplete(draft, 'progression')
  // Trilha, poderes e graus de perícia são todos da classe: sem ela, não há o que oferecer aqui.
  if (!cls) return <StepPrerequisite dependsOn="class" needs="saber a classe do seu agente" emoji="🎖️" />

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
        <StepNav onPrev={prevStep} onNext={nextStep} pendingReason={canAdvance ? undefined : 'Progressão pendente'} />
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

      {/* Catálogos (poderes, versatilidade) usam a largura toda, como a trilha: são cards com
          descrição inteira, e ler três lado a lado é bem melhor do que rolar uma coluna estreita. */}
      {requiredPowers > 0 && (
        <PowerSection
          draft={draft}
          cls={cls}
          required={requiredPowers}
          onPick={setPowerChoice}
          onRelease={clearPowerChoice}
        />
      )}

      {/* Aumentos e graus são listas curtas de chips — ficam melhor numa coluna central. */}
      <div className="max-w-lg mx-auto space-y-4">
        {requiredAttrIncreases > 0 && (
          <AttributeIncreaseSection draft={draft} required={requiredAttrIncreases} onPick={setAttributeIncreaseChoice} />
        )}

        {requiredGradeSlots > 0 && (
          <SkillGradeSection draft={draft} cls={cls} required={requiredGradeSlots} onPick={setSkillGradeChoice} />
        )}
      </div>

      {showVersatility && (
        <VersatilitySection draft={draft} cls={cls} onPick={setVersatilityChoice} />
      )}

      <StepNav onPrev={prevStep} onNext={nextStep} pendingReason={canAdvance ? undefined : 'Escolhas pendentes'} />
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
  // Trilha sem o treino exigido aparece desabilitada com o motivo, não escondida.
  const options = getTrilhaOptions(draft, cls)

  return (
    <Section title="Trilha (NEX 10%)">
      <p className="text-parchment-600 text-xs mb-2">
        A trilha define o foco do seu agente e concede um poder em NEX 10%, 40%, 65% e 99%. Os detalhes de
        todas já estão à mostra — clique numa coluna pra escolher.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 items-stretch">
        {options.map(({ trilha: t, available, reasons }) => (
          <button
            key={t.id}
            onClick={() => { if (available) onSelect(t.id) }}
            disabled={!available}
            className="text-left px-3 py-2.5 rounded-lg border transition-all flex flex-col disabled:cursor-not-allowed"
            style={{
              borderColor: draft.trilha === t.id ? '#dc2626' : available ? '#2a2213' : '#241a1c',
              backgroundColor: draft.trilha === t.id ? '#dc262615' : '#0a070499',
              opacity: available ? 1 : 0.65,
            }}
          >
            <p className="font-fantasy font-semibold text-base text-parchment-200">{t.name}</p>
            <p className="text-parchment-500 text-xs mt-0.5 leading-snug">{t.description}</p>
            {t.requirement && <p className="text-parchment-600 text-xs mt-0.5">Requisito: {t.requirement}</p>}
            {!available && reasons.length > 0 && (
              <p className="text-[11px] mt-1" style={{ color: '#c9a05a' }}>⛔ {reasons.join(' · ')}</p>
            )}
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

function PowerSection({ draft, cls, required, onPick, onRelease }: {
  draft: import('../../types/character').OrdemCharacterDraft
  cls: import('../../types/class').OrdemClass
  required: number
  onPick: (slot: number, powerId: string) => void
  onRelease: (slot: number) => void
}) {
  const catalog = getClassPowerCatalog(draft, cls, required)
  const chosenCount = draft.powerChoices.slice(0, required).filter(Boolean).length
  const missing = required - chosenCount

  return (
    <Section title={`Poderes de ${cls.name}`}>
      <p className="text-parchment-600 text-xs mb-1">
        Escolha {required} {required === 1 ? 'poder' : 'poderes'} entre os {catalog.length} da classe. Todos estão
        listados com o que fazem; o que você ainda não pode pegar aparece com o motivo.
      </p>
      <p className="text-xs mb-3" style={{ color: missing > 0 ? '#c9a05a' : '#86efac' }}>
        {chosenCount} de {required} escolhidos{missing > 0 ? ` — falta${missing > 1 ? 'm' : ''} ${missing}` : ' ✓'}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
        {catalog.map(entry => (
          <ClassPowerCard
            key={entry.power.id}
            power={entry.power}
            reasons={entry.reasons}
            onPick={entry.targetSlot !== null ? () => onPick(entry.targetSlot!, entry.power.id) : undefined}
            chosen={entry.chosenSlots.map(slot => ({
              key: `slot-${slot}`,
              label: `adquirido em NEX ${POWER_SLOT_NEX[slot]}%`,
              onRelease: () => onRelease(slot),
            }))}
          >
            {entry.chosenSlots.map(slot => (
              <div key={slot}>
                {POWER_PARAM_SPECS[entry.power.id] && (
                  <PowerParamPicker draft={draft} slotKey={`slot-${slot}`} powerId={entry.power.id} />
                )}
                {entry.power.id === 'transcend' && <TranscendHint draft={draft} sourceKey={`slot-${slot}`} />}
              </div>
            ))}
          </ClassPowerCard>
        ))}
      </div>
    </Section>
  )
}

/** Status do Transcender: o poder paranormal em si é escolhido na etapa Poderes Paranormais. */
function TranscendHint({ draft, sourceKey }: {
  draft: import('../../types/character').OrdemCharacterDraft
  sourceKey: ParanormalSourceKey
}) {
  const chosen = draft.paranormalPowerChoices[sourceKey]
  const power = chosen ? getParanormalPower(chosen.powerId) : undefined
  return power ? (
    <p className="text-gold-400 text-xs mt-1">✦ Poder paranormal: {power.name} (etapa Poderes Paranormais)</p>
  ) : (
    <p className="text-amber-500/90 text-xs mt-1">→ Escolha o poder paranormal na etapa Poderes Paranormais.</p>
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
          {ELEMENTS.map(el => {
            const active = values[0] === el
            return (
              <button
                key={el}
                onClick={() => setValue(0, el)}
                className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border transition-colors ${
                  active ? ELEMENT_COLORS[el] : 'text-parchment-600 border-parchment-800 hover:border-parchment-600'
                }`}
              >
                {ELEMENT_NAMES[el]}
              </button>
            )
          })}
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
  /** null desfaz a escolha (o ✕ do card). */
  onPick: (choice: import('../../types/character').OrdemCharacterDraft['versatilityChoice']) => void
}) {
  // Poder extra: a escolha vale no NEX 50% (slotIndex undefined), não no NEX de um slot.
  const powerOptions = getClassPowerOptions(draft, cls)
  const trilhaOptions = getVersatilityTrilhaOptions(draft, cls)
  const choice = draft.versatilityChoice

  return (
    <Section title="Versatilidade (NEX 50%)">
      <p className="text-parchment-600 text-xs mb-3">
        Escolha <strong>um</strong> poder extra de {cls.name} <strong>ou</strong> o 1º poder de outra trilha.
      </p>

      <p className="text-parchment-700 text-xs mb-1.5">Poder extra</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
        {powerOptions.map(option => {
          const active = choice?.kind === 'power' && choice.powerId === option.power.id
          return (
            <ClassPowerCard
              key={option.power.id}
              power={option.power}
              reasons={option.reasons}
              onPick={option.available && !active ? () => onPick({ kind: 'power', powerId: option.power.id }) : undefined}
              chosen={active
                ? [{ key: 'versatility', label: 'Versatilidade (NEX 50%)', onRelease: () => onPick(null) }]
                : []}
            >
              {active && POWER_PARAM_SPECS[option.power.id] && (
                <PowerParamPicker draft={draft} slotKey="versatility" powerId={option.power.id} />
              )}
              {active && option.power.id === 'transcend' && <TranscendHint draft={draft} sourceKey="versatility" />}
            </ClassPowerCard>
          )
        })}
      </div>

      <p className="text-parchment-700 text-xs mt-4 mb-1.5">Ou 1º poder de outra trilha</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
        {trilhaOptions.map(({ trilha, available, reasons }) => {
          const active = choice?.kind === 'trilha' && choice.trilhaId === trilha.id
          const first = trilha.features[0]
          return (
            <div
              key={trilha.id}
              className="rounded-xl border p-3"
              style={{
                borderColor: active ? '#dc2626' : available ? '#2a2213' : '#241a1c',
                backgroundColor: active ? '#dc262612' : '#0a070499',
                opacity: available ? 1 : 0.65,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-fantasy font-bold leading-tight" style={{ color: active ? '#fca5a5' : '#f3e9dc' }}>
                  {trilha.name}
                </p>
                {available && !active && (
                  <button
                    onClick={() => onPick({ kind: 'trilha', trilhaId: trilha.id })}
                    className="shrink-0 px-3 py-1.5 rounded-lg font-fantasy font-bold text-[12px]"
                    style={{ backgroundColor: '#2a0d0f', border: '1px solid #7f1d1d', color: '#fca5a5' }}
                  >
                    Escolher
                  </button>
                )}
                {active && (
                  <button
                    onClick={() => onPick(null)}
                    className="shrink-0 px-3 py-1.5 rounded-lg font-fantasy text-[12px]"
                    style={{ border: '1px solid #7f1d1d', color: '#c9a5a5' }}
                  >
                    ✓ Escolhida ✕
                  </button>
                )}
              </div>
              {first && (
                <p className="text-xs mt-1 leading-relaxed" style={{ color: available ? '#b3a094' : '#8a7368' }}>
                  <span className="font-semibold">NEX {first.nex}% – {first.name}.</span> {first.description}
                </p>
              )}
              {!available && reasons.length > 0 && (
                <p className="text-[11px] mt-2" style={{ color: '#c9a05a' }}>⛔ {reasons.join(' · ')}</p>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}
