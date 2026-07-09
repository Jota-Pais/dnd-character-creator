import { useOrdemStore } from '../stores/characterStore'
import { getOrigin } from '../utils/originUtils'
import { getOrdemClass } from '../utils/classUtils'
import { getSkillName } from '../utils/skillUtils'
import { getTrilha } from '../utils/trilhaUtils'
import { getPower } from '../utils/powerUtils'
import { deriveStats, getTrainedSkills, getEffectiveAttributes, getSkillGrade } from '../utils/characterUtils'
import { getReachedTrilhaSlots } from '../utils/progressionUtils'
import { getRitualById, formatElements, getRitualSlotsCount } from '../utils/ritualUtils'
import { getEquipmentById, getMaxCapacity, getCurrentSpaces } from '../utils/equipmentUtils'

/**
 * Versão imprimível com layout compacto de ficha cobrindo atributos,
 * origem, classe, trilha, poderes, perícias, rituais, equipamento.
 */
export function PrintableSheet() {
  const draft = useOrdemStore(state => state.draft)
  const origin = draft.origin ? getOrigin(draft.origin) : undefined
  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  if (!cls) return null

  const attributes = getEffectiveAttributes(draft)
  const stats = deriveStats(cls, attributes, draft.nex)
  const trainedSkills = getTrainedSkills(draft)
  const trilha = draft.trilha ? getTrilha(draft.trilha) : undefined
  const reachedTrilhaFeatures = trilha ? getReachedTrilhaSlots(draft.nex).map(nex => trilha.features.find(f => f.nex === nex)).filter(Boolean) : []
  const powers = draft.powerChoices.filter((p): p is string => Boolean(p)).map(getPower).filter(Boolean)
  // Só o Ocultista conhece rituais; limita aos slots abertos pelo NEX (ver ReviewStep).
  const ritualSlots = draft.class === 'occultist' ? getRitualSlotsCount(draft.nex) : 0
  const rituals = draft.ritualChoices.slice(0, ritualSlots).filter((r): r is string => Boolean(r)).map(getRitualById).filter(Boolean)
  const equipment = draft.equipmentChoices.map(getEquipmentById).filter(Boolean)

  return (
    <div className="print-sheet mx-auto max-w-[820px] bg-white text-gray-900 p-8 rounded-lg shadow-lg" style={{ fontFamily: 'Georgia, serif' }}>
      <header className="text-center border-b-2 border-gray-800 pb-3 mb-4">
        <h1 className="text-3xl font-bold">{draft.name}</h1>
        {draft.concept && <p className="italic text-gray-600 mt-1">"{draft.concept}"</p>}
        <p className="text-sm text-gray-600 mt-1">{origin?.name} · {cls.name}{trilha ? ` (${trilha.name})` : ''} · NEX {draft.nex}% · Patente: Recruta</p>
      </header>

      <section className="grid grid-cols-3 gap-3 mb-4 text-center">
        <StatBox label="Pontos de Vida" value={stats.hp} />
        <StatBox label="Pontos de Esforço" value={stats.pe} />
        <StatBox label="Sanidade" value={stats.sanity} />
      </section>

      <section className="mb-4">
        <h2 className="font-bold uppercase text-sm tracking-wide border-b border-gray-400 mb-2">Atributos</h2>
        <div className="grid grid-cols-5 gap-2 text-center">
          <AttrBox label="Agilidade" value={attributes.agility} />
          <AttrBox label="Força" value={attributes.strength} />
          <AttrBox label="Intelecto" value={attributes.intellect} />
          <AttrBox label="Presença" value={attributes.presence} />
          <AttrBox label="Vigor" value={attributes.vigor} />
        </div>
      </section>

      {origin && (
        <section className="mb-4">
          <h2 className="font-bold uppercase text-sm tracking-wide border-b border-gray-400 mb-2">Origem — {origin.name}</h2>
          <p className="text-sm"><span className="font-semibold">{origin.power.name}.</span> {origin.power.description}</p>
        </section>
      )}

      <section className="mb-4">
        <h2 className="font-bold uppercase text-sm tracking-wide border-b border-gray-400 mb-2">Classe — {cls.name}</h2>
        <p className="text-sm text-gray-700 mb-1">{cls.description}</p>
        <p className="text-sm"><span className="font-semibold">{cls.classAbility.name}.</span> {cls.classAbility.description}</p>
      </section>

      {trilha && reachedTrilhaFeatures.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold uppercase text-sm tracking-wide border-b border-gray-400 mb-2">Trilha — {trilha.name}</h2>
          <div className="space-y-1">
            {reachedTrilhaFeatures.map(f => f && (
              <p key={f.name} className="text-sm">
                <span className="font-semibold">NEX {f.nex}% – {f.name}.</span> {f.description}
              </p>
            ))}
          </div>
        </section>
      )}

      {powers.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold uppercase text-sm tracking-wide border-b border-gray-400 mb-2">Poderes de {cls.name}</h2>
          <div className="space-y-1">
            {powers.map(p => p && (
              <p key={p.id} className="text-sm">
                <span className="font-semibold">{p.name}.</span> {p.description}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="mb-4">
        <h2 className="font-bold uppercase text-sm tracking-wide border-b border-gray-400 mb-2">
          Perícias Treinadas ({trainedSkills.length})
        </h2>
        <p className="text-sm">
          {trainedSkills.map(sid => {
            const grade = getSkillGrade(draft, sid)
            const name = getSkillName(sid)
            return grade !== 'treinado' ? `${name} (${grade})` : name
          }).join(', ')}
        </p>
      </section>

      {rituals.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold uppercase text-sm tracking-wide border-b border-gray-400 mb-2">Rituais Conhecidos</h2>
          <div className="space-y-1">
            {rituals.map((r, i) => r && (
              <div key={`${r.id}-${i}`} className="text-sm">
                <span className="font-semibold">{r.name}</span>
                <span className="text-gray-600"> ({formatElements(r.elements)}, {r.circle}º Círculo)</span>
                <span className="text-gray-500 text-xs"> — {r.execution}, {r.range}, {r.target}, {r.duration}{r.resistance ? `, ${r.resistance}` : ''}</span>
                <p className="text-gray-700">{r.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {equipment.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold uppercase text-sm tracking-wide border-b border-gray-400 mb-2">
            Equipamento ({getCurrentSpaces(draft.equipmentChoices)}/{getMaxCapacity(attributes.strength)} espaços)
          </h2>
          <div className="space-y-1">
            {equipment.map(item => item && (
              <p key={item.id} className="text-sm">
                <span className="font-semibold">{item.name}</span> (Cat {item.category === 0 ? '0' : 'I'}, {item.spaces} esp.)
                {item.type === 'weapon' && ` — ${item.damage} ${item.damageType} (Crítico: ${item.critical})`}
                {item.type === 'protection' && ` — Defesa +${item.defenseBonus}`}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-gray-400 rounded p-2">
      <p className="text-[10px] uppercase text-gray-600">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function AttrBox({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-gray-600">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
