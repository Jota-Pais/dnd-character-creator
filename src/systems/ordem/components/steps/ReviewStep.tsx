import { useOrdemStore } from '../../stores/characterStore'
import { getOrigin } from '../../utils/originUtils'
import { getOrdemClass } from '../../utils/classUtils'
import { getSkillName } from '../../utils/skillUtils'
import { deriveStats, getTrainedSkills } from '../../utils/characterUtils'
import { exportCharacter } from '../../utils/storage'
import { StepNav } from '../common/StepNav'

export function ReviewStep() {
  const draft = useOrdemStore(state => state.draft)
  const prevStep = useOrdemStore(state => state.prevStep)
  const goToPrint = useOrdemStore(state => state.goToPrint)
  const reset = useOrdemStore(state => state.reset)

  const origin = draft.origin ? getOrigin(draft.origin) : undefined
  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  if (!cls) return null

  const stats = deriveStats(cls, draft.attributes)
  const trainedSkills = getTrainedSkills(draft)

  function handleExport() {
    exportCharacter(draft)
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-16">
      <div className="text-center mb-2">
        <h2 className="font-fantasy text-2xl font-bold text-gold-400">{draft.name}</h2>
        {draft.concept && <p className="text-parchment-500 text-sm italic mt-1">"{draft.concept}"</p>}
        <p className="text-parchment-600 text-xs mt-1">{origin?.name} · {cls.name} · NEX 5%</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Pontos de Vida" value={String(stats.hp)} />
        <Stat label="Pontos de Esforço" value={String(stats.pe)} />
        <Stat label="Sanidade" value={String(stats.sanity)} />
      </div>

      <Section title="Atributos">
        <div className="grid grid-cols-5 gap-2 text-center">
          <AttrStat label="AGI" value={draft.attributes.agility} />
          <AttrStat label="FOR" value={draft.attributes.strength} />
          <AttrStat label="INT" value={draft.attributes.intellect} />
          <AttrStat label="PRE" value={draft.attributes.presence} />
          <AttrStat label="VIG" value={draft.attributes.vigor} />
        </div>
      </Section>

      {origin && (
        <Section title="Origem">
          <p className="text-parchment-200 font-fantasy font-semibold text-sm">{origin.name}</p>
          <p className="text-parchment-500 text-xs mt-1">
            <span className="font-semibold">{origin.power.name}.</span> {origin.power.description}
          </p>
        </Section>
      )}

      <Section title="Classe">
        <p className="text-parchment-200 font-fantasy font-semibold text-sm">{cls.name}</p>
        <p className="text-parchment-500 text-xs mt-1">{cls.description}</p>
      </Section>

      <Section title={`Perícias Treinadas (${trainedSkills.length})`}>
        <div className="flex flex-wrap gap-1.5">
          {trainedSkills.map(sid => (
            <span key={sid} className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-gold-900/30 text-gold-400">
              {getSkillName(sid)}
            </span>
          ))}
        </div>
      </Section>

      <div className="space-y-2 pt-2">
        <button
          onClick={goToPrint}
          className="w-full py-3 rounded-xl font-fantasy font-bold text-base tracking-wide transition-all hover:brightness-110 active:scale-[0.99] bg-gold-500 text-parchment-950"
        >
          🖨 Imprimir / Salvar como PDF
        </button>
        <button
          onClick={handleExport}
          className="w-full py-2.5 rounded-xl font-fantasy font-semibold text-sm border border-parchment-800 text-parchment-400 hover:text-parchment-200 transition-colors"
        >
          Exportar Ficha como JSON ↓
        </button>
      </div>

      <StepNav onPrev={prevStep} onNext={reset} canAdvance nextLabel="Concluir ✓" />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-3 text-center">
      <p className="text-parchment-700 text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-gold-400 font-fantasy font-bold text-xl">{value}</p>
    </div>
  )
}

function AttrStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-parchment-700 text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-parchment-200 font-fantasy font-bold text-lg">{value}</p>
    </div>
  )
}
