import { useState } from 'react'
import { useOrdemStore } from '../../stores/characterStore'
import { STEP_LABELS } from '../../types/character'
import type { ParanormalSourceKey } from '../../types/character'
import { ELEMENT_NAMES, ELEMENT_COLORS } from '../../utils/ritualUtils'
import { isStepComplete } from '../../utils/draftValidation'
import {
  getActiveParanormalSources,
  getAffinityState,
  getParanormalInstances,
  getSourceLabel,
  type ParanormalInstance,
} from '../../utils/paranormalPowerUtils'
import { isParanormalElement } from '../../utils/paranormalPowerUtils'
import { StepNav } from '../common/StepNav'
import { AffinitySection } from '../paranormal/AffinitySection'
import { ParanormalPowerCatalog } from '../paranormal/ParanormalPowerCatalog'
import { ParanormalSubChoicePicker } from '../paranormal/ParanormalSubChoicePicker'

export function ParanormalPowersStep() {
  const draft = useOrdemStore(state => state.draft)
  const setParanormalPowerChoice = useOrdemStore(state => state.setParanormalPowerChoice)
  const setAffinityElement = useOrdemStore(state => state.setAffinityElement)
  const nextStep = useOrdemStore(state => state.nextStep)
  const prevStep = useOrdemStore(state => state.prevStep)
  const [openSource, setOpenSource] = useState<ParanormalSourceKey | null>(null)

  const sources = getActiveParanormalSources(draft)
  const instances = getParanormalInstances(draft)
  const showAffinity = draft.nex >= 50
  const canAdvance = isStepComplete(draft, 'paranormal')

  if (sources.length === 0 && !showAffinity) {
    return (
      <div className="max-w-lg mx-auto text-center animate-fade-in pb-20">
        <div className="text-5xl mb-3">🌘</div>
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-2">Nenhum poder paranormal ainda</h2>
        <p className="text-parchment-500 text-sm mb-8 leading-relaxed">
          Para tocar o Outro Lado, escolha o poder <strong className="text-gold-500">Transcender</strong> na
          etapa Progressão, ou a origem <strong className="text-gold-500">Cultista Arrependido</strong>.
          Cada Transcender concede um poder paranormal — mas cobra a Sanidade daquele aumento de NEX.
        </p>
        <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={canAdvance} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fade-in pb-20">
      <div className="text-center mb-2">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200">{STEP_LABELS.paranormal}</h2>
        <p className="text-parchment-500 text-sm mt-1 leading-relaxed">
          Cada Transcender concede um poder paranormal (e custa a Sanidade daquele aumento de NEX).
          Pré-requisitos como <em>Morte 2</em> exigem já possuir poderes daquele elemento nas escolhas anteriores.
        </p>
      </div>

      {showAffinity && <AffinitySection draft={draft} onPick={setAffinityElement} />}

      {sources.map(key => {
        const instance = instances.find(i => i.key === key)
        if (!instance) return null
        return (
          <SourceCard
            key={key}
            instance={instance}
            open={openSource === key}
            onOpen={() => setOpenSource(key)}
            onClose={() => setOpenSource(null)}
            onPick={powerId => {
              setParanormalPowerChoice(key, powerId)
              setOpenSource(null)
            }}
          />
        )
      })}

      <StepNav
        onPrev={prevStep}
        onNext={nextStep}
        canAdvance={canAdvance}
        disabledReason={getDisabledReason(instances, showAffinity && !draft.affinityElement)}
      />
    </div>
  )
}

/** Mensagem do CTA bloqueado, na ordem da pendência mais fundamental. */
function getDisabledReason(instances: ParanormalInstance[], affinityPending: boolean): string {
  if (affinityPending) return 'Escolha o elemento de afinidade'
  if (instances.some(i => !i.choice)) return 'Escolha o poder paranormal pendente'
  if (instances.some(i => !i.complete)) return 'Complete as escolhas do poder'
  if (instances.some(i => i.problems.length > 0)) return 'Corrija o poder com pré-requisito não atendido'
  return 'Faça as escolhas pendentes'
}

function SourceCard({ instance, open, onOpen, onClose, onPick }: {
  instance: ParanormalInstance
  open: boolean
  onOpen: () => void
  onClose: () => void
  onPick: (powerId: string) => void
}) {
  const draft = useOrdemStore(state => state.draft)
  const affinity = getAffinityState(draft)
  const { power, choice } = instance

  return (
    <div className="bg-parchment-950/50 border border-parchment-900 rounded-xl p-5 shadow-sm">
      <p className="text-sm font-bold text-gold-500 mb-3">{getSourceLabel(instance.key)}</p>

      {open ? (
        <div className="space-y-3">
          <button onClick={onClose} className="text-xs font-bold font-fantasy text-red-400 hover:text-red-300">
            ✕ Cancelar seleção
          </button>
          <ParanormalPowerCatalog draft={draft} sourceKey={instance.key} onPick={onPick} />
        </div>
      ) : !choice || !power ? (
        <>
          <button
            onClick={onOpen}
            className="w-full py-6 rounded-xl border-2 border-dashed border-parchment-800 hover:border-gold-500/50 hover:bg-parchment-900/20 text-parchment-500 hover:text-gold-400 font-fantasy text-lg transition-all"
          >
            + Escolher Poder Paranormal
          </button>
          {choice && !power && (
            <p className="text-amber-500/90 text-xs mt-2">⚠️ {instance.problems.join(' · ')}</p>
          )}
        </>
      ) : (
        <div className="p-4 rounded-xl bg-black/40 border border-parchment-900/50 relative group">
          <button
            onClick={onOpen}
            className="absolute top-3 right-3 px-3 py-1 bg-parchment-900 text-parchment-200 hover:bg-parchment-800 text-xs font-bold rounded shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            Trocar
          </button>
          <div className="flex items-center flex-wrap gap-2 mb-2 pr-16">
            <span className="font-bold text-parchment-200 text-lg font-fantasy">{power.name}</span>
            {isParanormalElement(instance.element) ? (
              <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${ELEMENT_COLORS[instance.element]}`}>
                {ELEMENT_NAMES[instance.element]}
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border text-parchment-400 border-parchment-700">
                Geral
              </span>
            )}
            {instance.isAffinityCopy && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border text-gold-400 bg-gold-950/40 border-gold-800">
                2ª vez — Afinidade
              </span>
            )}
          </div>
          {power.prerequisite && (
            <p className="text-parchment-600 text-xs mb-1">Pré-requisito: {power.prerequisite}</p>
          )}
          <p className="text-parchment-500 text-sm leading-relaxed">{power.description}</p>
          {power.affinityDescription && (
            <p
              className={`text-sm leading-relaxed mt-2 ${
                instance.isAffinityCopy ? 'text-gold-400' : 'text-parchment-700'
              }`}
              title={instance.isAffinityCopy
                ? undefined
                : affinity.active && isParanormalElement(instance.element) && instance.element === affinity.element
                  ? 'Escolha este poder uma 2ª vez (em outro Transcender) para receber este benefício'
                  : `Ativa ao escolher este poder uma 2ª vez, com afinidade em ${isParanormalElement(instance.element) ? ELEMENT_NAMES[instance.element] : 'seu elemento'}`}
            >
              {instance.isAffinityCopy ? '✦' : '🔒'} <strong>Afinidade:</strong> {power.affinityDescription}
            </p>
          )}
          {instance.problems.length > 0 && (
            <div className="mt-3 px-3 py-2 rounded-lg border border-amber-900 bg-amber-950/30">
              {instance.problems.map(problem => (
                <p key={problem} className="text-amber-500/90 text-xs leading-snug">⛔ {problem}</p>
              ))}
              <p className="text-amber-600/80 text-[11px] mt-1">Pré-requisito não atendido — troque este poder ou ajuste as escolhas anteriores.</p>
            </div>
          )}
          <ParanormalSubChoicePicker draft={draft} sourceKey={instance.key} power={power} choice={choice} />
        </div>
      )}
    </div>
  )
}
