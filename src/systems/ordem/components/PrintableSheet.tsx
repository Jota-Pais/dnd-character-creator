import { useOrdemStore } from '../stores/characterStore'
import { getOrigin } from '../utils/originUtils'
import { getOrdemClass } from '../utils/classUtils'
import { getSkillName } from '../utils/skillUtils'
import { deriveStats, getTrainedSkills } from '../utils/characterUtils'

/**
 * Versão enxuta — cobre o essencial (identidade, atributos, origem, classe, perícias, PV/PE/SAN em NEX 5%).
 * Detalhamento completo (equipamento, poderes, trilhas, rituais) chega junto dessas mecânicas em fases futuras.
 */
export function PrintableSheet() {
  const draft = useOrdemStore(state => state.draft)
  const origin = draft.origin ? getOrigin(draft.origin) : undefined
  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  if (!cls) return null

  const stats = deriveStats(cls, draft.attributes)
  const trainedSkills = getTrainedSkills(draft)

  return (
    <div className="print-sheet mx-auto max-w-[820px] bg-white text-gray-900 p-8 rounded-lg shadow-lg" style={{ fontFamily: 'Georgia, serif' }}>
      <header className="text-center border-b-2 border-gray-800 pb-3 mb-4">
        <h1 className="text-3xl font-bold">{draft.name}</h1>
        {draft.concept && <p className="italic text-gray-600 mt-1">"{draft.concept}"</p>}
        <p className="text-sm text-gray-600 mt-1">{origin?.name} · {cls.name} · NEX 5% · Patente: Recruta</p>
      </header>

      <section className="grid grid-cols-3 gap-3 mb-4 text-center">
        <StatBox label="Pontos de Vida" value={stats.hp} />
        <StatBox label="Pontos de Esforço" value={stats.pe} />
        <StatBox label="Sanidade" value={stats.sanity} />
      </section>

      <section className="mb-4">
        <h2 className="font-bold uppercase text-sm tracking-wide border-b border-gray-400 mb-2">Atributos</h2>
        <div className="grid grid-cols-5 gap-2 text-center">
          <AttrBox label="Agilidade" value={draft.attributes.agility} />
          <AttrBox label="Força" value={draft.attributes.strength} />
          <AttrBox label="Intelecto" value={draft.attributes.intellect} />
          <AttrBox label="Presença" value={draft.attributes.presence} />
          <AttrBox label="Vigor" value={draft.attributes.vigor} />
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
        <p className="text-sm text-gray-700">{cls.description}</p>
      </section>

      <section className="mb-4">
        <h2 className="font-bold uppercase text-sm tracking-wide border-b border-gray-400 mb-2">
          Perícias Treinadas ({trainedSkills.length})
        </h2>
        <p className="text-sm">{trainedSkills.map(getSkillName).join(', ')}</p>
      </section>
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
