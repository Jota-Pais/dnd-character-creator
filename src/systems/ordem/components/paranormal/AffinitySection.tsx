import type { OrdemCharacterDraft } from '../../types/character'
import type { ParanormalElement } from '../../types/ritual'
import { PARANORMAL_ELEMENTS } from '../../types/ritual'
import { ELEMENT_NAMES, ELEMENT_COLORS } from '../../utils/ritualUtils'
import { getAffinityState, OPPRESSOR_OF } from '../../utils/paranormalPowerUtils'

type Props = {
  draft: OrdemCharacterDraft
  onPick: (element: ParanormalElement) => void
}

/**
 * Afinidade Elemental (p. 116): ao atingir NEX 50% o agente escolhe um elemento (imutável em
 * jogo; editável aqui como qualquer escolha do builder). A afinidade só ATIVA na primeira vez
 * que ele transcende a partir de NEX 50%.
 */
export function AffinitySection({ draft, onPick }: Props) {
  const affinity = getAffinityState(draft)

  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
      <div className="flex items-center flex-wrap gap-2 mb-2">
        <h4 className="text-xs font-semibold font-fantasy text-parchment-600 uppercase tracking-widest">
          Afinidade Elemental (NEX 50%)
        </h4>
        {affinity.active && affinity.element ? (
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${ELEMENT_COLORS[affinity.element]}`}>
            ● Afinidade ativa: {ELEMENT_NAMES[affinity.element]}
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border text-parchment-600 border-parchment-800">
            Inativa — ativa na primeira vez que você transcender a partir de NEX 50%
          </span>
        )}
      </div>
      <p className="text-parchment-600 text-xs mb-2 leading-relaxed">
        Ao atingir NEX 50%, você se conecta com um elemento (escolha que não pode ser alterada em jogo).
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PARANORMAL_ELEMENTS.map(element => {
          const active = draft.affinityElement === element
          return (
            <button
              key={element}
              onClick={() => onPick(element)}
              className={`text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded border transition-all ${
                active ? ELEMENT_COLORS[element] : 'text-parchment-600 border-parchment-800 hover:border-parchment-600'
              }`}
            >
              {ELEMENT_NAMES[element]}
            </button>
          )
        })}
      </div>
      {affinity.active && affinity.element && (
        <ul className="text-parchment-500 text-xs mt-3 space-y-1 leading-relaxed list-disc list-inside">
          <li>Conjura rituais de {ELEMENT_NAMES[affinity.element]} sem componentes ritualísticos, e pode aprender rituais que exijam afinidade com o elemento.</li>
          <li>+ØØ em testes contra efeitos de {ELEMENT_NAMES[affinity.element]}; −ØØ contra efeitos de {ELEMENT_NAMES[OPPRESSOR_OF[affinity.element]]} (elemento opressor).</li>
          <li>Pode escolher poderes paranormais de {ELEMENT_NAMES[affinity.element]} uma 2ª vez para receber a linha "Afinidade".</li>
        </ul>
      )}
    </div>
  )
}
