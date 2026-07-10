import { useOrdemStore } from '../../stores/characterStore'
import { getOrdemClass } from '../../utils/classUtils'
import { getSkillName } from '../../utils/skillUtils'
import { getTrilha } from '../../utils/trilhaUtils'
import {
  getAvailableTrilhaOptions,
  getAvailableVersatilityTrilhaOptions,
  getAvailablePowerOptions,
  getEligibleSkillGradeOptions,
  getEffectiveAttributes,
  getRequiredPowerSlots,
  getRequiredAttributeIncreaseSlots,
  getRequiredSkillGradeSlots,
} from '../../utils/characterUtils'
import { hasTrilha, hasVersatility } from '../../utils/progressionUtils'
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

  if (draft.nex === 5) {
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
    <div className="max-w-lg mx-auto space-y-4 pb-16">
      <div className="text-center mb-2">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200">Progressão até NEX {draft.nex}%</h2>
        <p className="text-parchment-500 text-sm mt-1">
          Trilha, poderes e aumentos que seu agente já desenvolveu.
        </p>
      </div>

      {showTrilha && (
        <TrilhaSection draft={draft} cls={cls} onSelect={setTrilha} />
      )}

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
        backgroundColor: active ? '#d4900a30' : '#1a140a',
        color: active ? '#d4900a' : '#8a7a5a',
      }}
    >
      {label}
    </button>
  )
}

function TrilhaSection({ draft, cls, onSelect }: { draft: import('../../types/character').OrdemCharacterDraft; cls: import('../../types/class').OrdemClass; onSelect: (id: string) => void }) {
  const options = getAvailableTrilhaOptions(cls)
  const selected = draft.trilha ? getTrilha(draft.trilha) : undefined

  return (
    <Section title="Trilha (NEX 10%)">
      <p className="text-parchment-600 text-[11px] mb-2">
        A trilha define o foco do seu agente e concede um poder em NEX 10%, 40%, 65% e 99%. Você já vê aqui
        tudo que cada trilha entrega ao longo da progressão, mesmo o que só ganha mais pra frente.
      </p>
      <div className="grid grid-cols-1 gap-1.5 mb-3">
        {options.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className="text-left px-3 py-2 rounded-lg border transition-all"
            style={{
              borderColor: draft.trilha === t.id ? '#d4900a' : '#2a2213',
              backgroundColor: draft.trilha === t.id ? '#d4900a15' : '#0a070499',
            }}
          >
            <p className="font-fantasy font-semibold text-sm text-parchment-200">{t.name}</p>
            <p className="text-parchment-500 text-[11px] mt-0.5 leading-snug">{t.description}</p>
            {t.requirement && <p className="text-parchment-600 text-[11px] mt-0.5">Requisito: {t.requirement}</p>}
          </button>
        ))}
      </div>
      {selected && (
        <div className="space-y-1.5 pt-2 border-t border-parchment-900">
          <p className="text-[11px] font-fantasy text-parchment-600 uppercase tracking-widest mb-1">
            Poderes de {selected.name}
          </p>
          {selected.features.map(f => {
            const reached = f.nex <= draft.nex
            return (
              <p key={f.name} className={`text-xs ${reached ? 'text-parchment-500' : 'text-parchment-700 opacity-70'}`}>
                <span className={`font-semibold ${reached ? 'text-parchment-300' : 'text-parchment-500'}`}>
                  {reached ? '' : '🔒 '}NEX {f.nex}% – {f.name}.
                </span>{' '}
                {f.description}
                {!reached && <span className="text-parchment-700 italic"> (ainda não alcançado)</span>}
              </p>
            )
          })}
        </div>
      )}
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
              <p className="text-parchment-600 text-[11px] mb-1">Poder {slot + 1} de {required}</p>
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
            </div>
          )
        })}
      </div>
    </Section>
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
              <span className="text-parchment-600 text-[11px] mr-1">#{slot + 1}</span>
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
      <p className="text-parchment-700 text-[11px] mt-2">Teto {ATTRIBUTE_MAX + 2} por esta via (aumento de atributo, não de criação).</p>
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
              <p className="text-parchment-600 text-[11px] mb-1">
                Slot {slot + 1} de {required} — escolha {countPerSlot} ({chosen.length}/{countPerSlot})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {options.map(sid => {
                  const active = chosen.includes(sid)
                  const disabled = !active && chosen.length >= countPerSlot
                  return (
                    <Chip
                      key={sid}
                      label={getSkillName(sid)}
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
      <p className="text-parchment-600 text-[11px] mb-2">Escolha um poder extra de {cls.name}, ou o 1º poder de outra trilha.</p>
      <div className="mb-2">
        <p className="text-parchment-700 text-[11px] mb-1">Poder extra</p>
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
        <p className="text-parchment-700 text-[11px] mb-1">Ou 1º poder de outra trilha</p>
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
