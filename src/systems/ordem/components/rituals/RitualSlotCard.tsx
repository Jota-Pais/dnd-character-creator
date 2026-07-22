import type { OrdemElement, OrdemRitual } from '../../types/ritual'
import { ELEMENT_COLORS, ELEMENT_NAMES, getRitualById, ritualNeedsElementChoice } from '../../utils/ritualUtils'

type Props = {
  /** Rótulo do slot (ex.: "Ritual Inicial 1", "Transcender — poder de NEX 45%"). */
  label: string
  /** Badge à direita do rótulo (ex.: "Até 2º Círculo"). */
  hint: string
  /** Linha explicativa opcional abaixo do rótulo (ex.: a origem do slot). */
  note?: string
  /** Rituais elegíveis para este slot, já filtrados por círculo e duplicidade. */
  options: OrdemRitual[]
  selectedId: string | null | undefined
  selectedElement: OrdemElement | undefined
  open: boolean
  onOpen: () => void
  onClose: () => void
  onSelect: (ritualId: string) => void
  onElement: (element: OrdemElement) => void
  /** Elemento já usado por outra instância deste mesmo ritual — o chip fica desabilitado. */
  isElementUsed: (element: OrdemElement) => boolean
}

/**
 * Card de um slot de ritual: escolher, trocar e (para rituais multi-elemento) definir o elemento.
 * Compartilhado pelos slots do Ocultista e pelos slots concedidos pelo poder Aprender Ritual —
 * as duas fontes se resolvem na mesma etapa e devem ter exatamente a mesma cara.
 */
export function RitualSlotCard({
  label, hint, note, options, selectedId, selectedElement,
  open, onOpen, onClose, onSelect, onElement, isElementUsed,
}: Props) {
  const selected = selectedId ? getRitualById(selectedId) : undefined

  return (
    <div className="bg-parchment-950/50 border border-parchment-900 rounded-xl p-5 shadow-sm">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-gold-500">{label}</span>
          <span className="text-xs font-normal text-parchment-600 shrink-0">{hint}</span>
        </div>
        {note && <p className="text-xs text-parchment-600 mt-1 leading-relaxed">{note}</p>}
      </div>

      <div className="mt-1">
        {open ? (
          <div className="space-y-4">
            <button onClick={onClose} className="text-xs font-bold font-fantasy text-red-400 hover:text-red-300">
              ✕ Cancelar seleção
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {options.map(r => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  className={`text-left p-4 rounded-xl border transition-colors ${selectedId === r.id ? 'bg-red-950/20 border-red-900' : 'bg-parchment-950/80 border-parchment-800 hover:border-gold-500 hover:bg-parchment-900/50'}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-fantasy text-gold-400 font-bold text-lg leading-none">{r.name}</span>
                    <span className="text-[10px] text-parchment-500 font-bold uppercase tracking-wider">{r.circle}º C.</span>
                  </div>
                  <div className="flex gap-1.5 mb-2">
                    {r.elements.map(e => (
                      <span key={e} className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${ELEMENT_COLORS[e]}`}>{ELEMENT_NAMES[e]}</span>
                    ))}
                  </div>
                  <p className="text-xs text-parchment-400 line-clamp-3 leading-relaxed">{r.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : !selected ? (
          <button
            onClick={onOpen}
            className="w-full py-6 rounded-xl border-2 border-dashed border-parchment-800 hover:border-gold-500/50 hover:bg-parchment-900/20 text-parchment-500 hover:text-gold-400 font-fantasy text-lg transition-all"
          >
            + Escolher Ritual
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-black/40 border border-parchment-900/50 relative group">
            <button
              onClick={onOpen}
              className="absolute top-3 right-3 px-3 py-1 bg-parchment-900 text-parchment-200 hover:bg-parchment-800 text-xs font-bold rounded shadow-sm transition-colors"
            >
              Trocar
            </button>
            <div className="text-sm">
              <div className="flex items-center flex-wrap gap-2 mb-2 pr-16">
                <span className="font-bold text-parchment-200 text-lg">{selected.name}</span>
                {selected.elements.map(e => (
                  <span key={e} className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${ELEMENT_COLORS[e]}`}>
                    {ELEMENT_NAMES[e]}
                  </span>
                ))}
              </div>
              <p className="text-parchment-500 text-xs mb-3 leading-relaxed">
                Execução: {selected.execution} · Alcance: {selected.range} · Alvo: {selected.target} · Duração: {selected.duration}
                {selected.resistance && ` · Resistência: ${selected.resistance}`}
              </p>
              <p className="text-parchment-500 leading-relaxed">{selected.description}</p>
              {ritualNeedsElementChoice(selected) && (
                <div className="mt-3 pt-3 border-t border-parchment-900/50">
                  <label className="block text-xs font-bold text-gold-500 mb-1.5">
                    Escolha o elemento deste ritual
                    <span className="font-normal text-parchment-600"> — ele passa a ser só desse elemento (define o tipo do dano). Pode aprender de novo em outro slot, com outro elemento.</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.elements.map(e => {
                      const active = selectedElement === e
                      const usedElsewhere = !active && isElementUsed(e)
                      return (
                        <button
                          key={e}
                          disabled={usedElsewhere}
                          title={usedElsewhere ? 'Esta instância ritual+elemento já é conhecida' : undefined}
                          onClick={() => onElement(e)}
                          className={`text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded border transition-all ${active ? ELEMENT_COLORS[e] : usedElsewhere ? 'text-parchment-800 border-parchment-900 opacity-40 cursor-not-allowed' : 'text-parchment-600 border-parchment-800 hover:border-parchment-600'}`}
                        >
                          {ELEMENT_NAMES[e]}
                        </button>
                      )
                    })}
                  </div>
                  {!selectedElement && (
                    <p className="text-red-400/80 text-xs mt-1.5">Escolha um elemento para poder avançar.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
