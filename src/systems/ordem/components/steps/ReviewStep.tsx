import { useOrdemStore } from '../../stores/characterStore'
import { getOrigin } from '../../utils/originUtils'
import { getOrdemClass } from '../../utils/classUtils'
import { getSkillName } from '../../utils/skillUtils'
import { getTrilha } from '../../utils/trilhaUtils'
import { getPower } from '../../utils/powerUtils'
import { deriveStats, getTrainedSkills, getEffectiveAttributes, getSkillGrade } from '../../utils/characterUtils'
import { getRitualById, formatElements, getRitualSlotsCount } from '../../utils/ritualUtils'
import { getEquipmentById, getMaxCapacity, getCurrentSpaces, getEquippedDefenseBonus } from '../../utils/equipmentUtils'
import { getReachedTrilhaSlots, getPeLimit } from '../../utils/progressionUtils'
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

  const attributes = getEffectiveAttributes(draft)
  const stats = deriveStats(cls, attributes, draft.nex, getEquippedDefenseBonus(draft.equipmentChoices))
  const trainedSkills = getTrainedSkills(draft)
  const trilha = draft.trilha ? getTrilha(draft.trilha) : undefined
  const reachedTrilhaFeatures = trilha
    ? getReachedTrilhaSlots(draft.nex).map(nex => trilha.features.find(f => f.nex === nex)).filter(Boolean)
    : []
  const powers = draft.powerChoices.filter((p): p is string => Boolean(p)).map(getPower).filter(Boolean)
  // Só o Ocultista conhece rituais; limita aos slots realmente abertos pelo NEX (baixar o NEX
  // depois de escolher não deve deixar rituais obsoletos de círculos inacessíveis na ficha).
  const ritualSlots = draft.class === 'occultist' ? getRitualSlotsCount(draft.nex) : 0
  const rituals = draft.ritualChoices.slice(0, ritualSlots).filter((r): r is string => Boolean(r)).map(getRitualById).filter(Boolean)
  const equipment = draft.equipmentChoices.map(getEquipmentById).filter(Boolean)
  const upgradedSkills = trainedSkills.filter(sid => getSkillGrade(draft, sid) !== 'treinado')

  function handleExport() {
    exportCharacter(draft)
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-16">
      <div className="text-center mb-2">
        <h2 className="font-fantasy text-2xl font-bold text-gold-400">{draft.name}</h2>
        {draft.concept && <p className="text-parchment-500 text-sm italic mt-1">"{draft.concept}"</p>}
        <p className="text-parchment-600 text-xs mt-1">
          {origin?.name} · {cls.name}{trilha ? ` (${trilha.name})` : ''} · NEX {draft.nex}%
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Pontos de Vida" value={String(stats.hp)} />
        <Stat label="Pontos de Esforço" value={String(stats.pe)} />
        <Stat label="Sanidade" value={String(stats.sanity)} />
        <Stat label="Defesa" value={String(stats.defense)} />
      </div>
      <p className="text-center text-parchment-600 text-xs">
        Limite de PE por turno: <span className="text-parchment-400 font-semibold">{getPeLimit(draft.nex)}</span>
        {' · '}Deslocamento: <span className="text-parchment-400 font-semibold">9m</span>
      </p>

      <Section title="Atributos">
        <div className="grid grid-cols-5 gap-2 text-center">
          <AttrStat label="AGI" value={attributes.agility} />
          <AttrStat label="FOR" value={attributes.strength} />
          <AttrStat label="INT" value={attributes.intellect} />
          <AttrStat label="PRE" value={attributes.presence} />
          <AttrStat label="VIG" value={attributes.vigor} />
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
        <p className="text-parchment-500 text-xs mt-2">
          <span className="font-semibold text-parchment-300">{cls.classAbility.name}.</span> {cls.classAbility.description}
        </p>
      </Section>

      {trilha && reachedTrilhaFeatures.length > 0 && (
        <Section title={`Trilha — ${trilha.name}`}>
          <div className="space-y-2">
            {reachedTrilhaFeatures.map(f => f && (
              <p key={f.name} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">NEX {f.nex}% – {f.name}.</span> {f.description}
              </p>
            ))}
          </div>
        </Section>
      )}

      {powers.length > 0 && (
        <Section title={`Poderes de ${cls.name}`}>
          <div className="space-y-2">
            {powers.map(p => p && (
              <p key={p.id} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">{p.name}.</span> {p.description}
              </p>
            ))}
          </div>
        </Section>
      )}

      {rituals.length > 0 && (
        <Section title={`Rituais Conhecidos (${rituals.length})`}>
          <div className="space-y-2">
            {rituals.map((r, i) => r && (
              <p key={`${r.id}-${i}`} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">{r.name}</span>{' '}
                <span className="text-parchment-700">({formatElements(r.elements)}, {r.circle}º Círculo)</span>
              </p>
            ))}
          </div>
        </Section>
      )}

      {equipment.length > 0 && (
        <Section title={`Equipamento (${getCurrentSpaces(draft.equipmentChoices)}/${getMaxCapacity(attributes.strength)} espaços)`}>
          <div className="space-y-2">
            {equipment.map(item => item && (
              <p key={item.id} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">{item.name}</span> <span className="text-parchment-700">(Cat {item.category === 0 ? '0' : 'I'}, {item.spaces} esp.)</span>
                {item.type === 'weapon' && ` — ${item.damage} ${item.damageType} (Crítico: ${item.critical})`}
                {item.type === 'protection' && ` — Defesa +${item.defenseBonus}`}
              </p>
            ))}
          </div>
        </Section>
      )}

      <Section title={`Perícias Treinadas (${trainedSkills.length})`}>
        <div className="flex flex-wrap gap-1.5">
          {trainedSkills.map(sid => {
            const grade = getSkillGrade(draft, sid)
            return (
              <span key={sid} className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-gold-900/30 text-gold-400">
                {getSkillName(sid)}{grade !== 'treinado' && ` (${grade})`}
              </span>
            )
          })}
        </div>
        {upgradedSkills.length === 0 && trainedSkills.length > 0 && (
          <p className="text-parchment-700 text-[11px] mt-2">Todas treinadas — nenhuma subiu de grau ainda.</p>
        )}
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
