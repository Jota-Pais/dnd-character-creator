import type { OrdemCharacterDraft, ParanormalSourceKey } from '../../types/character'
import type { ParanormalElement } from '../../types/ritual'
import { PARANORMAL_ELEMENTS } from '../../types/ritual'
import { ELEMENT_NAMES, ELEMENT_COLORS } from '../../utils/ritualUtils'
import {
  getAvailableParanormalPowers,
  getParanormalInstances,
  isParanormalElement,
  type ParanormalPowerOption,
} from '../../utils/paranormalPowerUtils'

type Props = {
  draft: OrdemCharacterDraft
  sourceKey: ParanormalSourceKey
  onPick: (powerId: string) => void
}

/**
 * Catálogo dos 22 poderes paranormais, agrupado Gerais → Conhecimento → Energia → Morte → Sangue
 * (ordem do livro). Opções bloqueadas NUNCA são escondidas: ficam desabilitadas com o motivo
 * visível (pré-requisito "Elemento N", 2ª escolha sem afinidade, limite do Aprender Ritual).
 */
export function ParanormalPowerCatalog({ draft, sourceKey, onPick }: Props) {
  const options = getAvailableParanormalPowers(draft, sourceKey)
  const generals = options.filter(o => o.power.element === null)

  // Contagem informativa por elemento (instâncias válidas atuais) — dá leitura ao "Elemento N".
  const counts: Partial<Record<ParanormalElement, number>> = {}
  for (const instance of getParanormalInstances(draft)) {
    if (instance.valid && isParanormalElement(instance.element)) {
      counts[instance.element] = (counts[instance.element] ?? 0) + 1
    }
  }

  return (
    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
      <CatalogSection label="Gerais" options={generals} onPick={onPick} />
      {PARANORMAL_ELEMENTS.map(element => (
        <CatalogSection
          key={element}
          label={ELEMENT_NAMES[element]}
          element={element}
          count={counts[element] ?? 0}
          options={options.filter(o => o.power.element === element)}
          onPick={onPick}
        />
      ))}
    </div>
  )
}

function CatalogSection({ label, element, count, options, onPick }: {
  label: string
  element?: ParanormalElement
  count?: number
  options: ParanormalPowerOption[]
  onPick: (powerId: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        {element ? (
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${ELEMENT_COLORS[element]}`}>
            {label}
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border text-parchment-400 border-parchment-700">
            {label}
          </span>
        )}
        {element && (
          <span className="text-[10px] text-parchment-600">
            você tem {count} poder{count === 1 ? '' : 'es'} deste elemento
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {options.map(option => (
          <PowerOptionCard key={option.power.id} option={option} onPick={onPick} />
        ))}
      </div>
    </div>
  )
}

function PowerOptionCard({ option, onPick }: { option: ParanormalPowerOption; onPick: (powerId: string) => void }) {
  const { power, available, reasons, isSecondPick } = option
  return (
    <button
      onClick={() => onPick(power.id)}
      disabled={!available}
      title={!available ? reasons.join(' · ') : undefined}
      className={`text-left p-3 rounded-xl border transition-colors ${
        available
          ? 'bg-parchment-950/80 border-parchment-800 hover:border-gold-500 hover:bg-parchment-900/50'
          : 'bg-parchment-950/40 border-parchment-900 opacity-50 cursor-not-allowed'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-fantasy text-gold-400 font-bold leading-tight">{power.name}</span>
        <span className="flex gap-1 shrink-0">
          {isSecondPick && available && (
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold text-gold-400 bg-gold-950/40 border border-gold-800">
              2ª vez — Afinidade
            </span>
          )}
          {power.prerequisite && (
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold text-amber-500/90 bg-amber-950/30 border border-amber-900">
              Requer {power.prerequisite}
            </span>
          )}
        </span>
      </div>
      <p className="text-xs text-parchment-400 line-clamp-3 leading-relaxed">{power.description}</p>
      {power.affinityDescription && (
        <p className="text-[11px] text-parchment-600 italic mt-1 line-clamp-2">
          Afinidade: {power.affinityDescription}
        </p>
      )}
      {!available && (
        <p className="text-[11px] text-amber-500/90 mt-1.5 leading-snug">⛔ {reasons.join(' · ')}</p>
      )}
    </button>
  )
}
