import { useCharacterStore } from '../../stores/characterStore'
import { STEP_LABELS } from '../../types/character'
import type { WizardStep } from '../../types/character'
import { formatMissingCount } from '../../../../components/wizard/pendingSteps'

/**
 * Única trava do fluxo: a Revisão lista o que ficou pendente e leva direto a cada etapa.
 * O jogador preenche na ordem que quiser — a cobrança acontece aqui, no fim.
 */
export function PendingStepsPanel({ missing }: { missing: WizardStep[] }) {
  const goToStep = useCharacterStore(state => state.goToStep)
  if (missing.length === 0) return null

  return (
    <div className="rounded-xl border border-gold-800 bg-gold-950/20 p-4">
      <p className="font-fantasy font-bold text-[15px] text-gold-400">
        ⚠ {formatMissingCount(missing.length)} para fechar a ficha
      </p>
      <p className="text-parchment-500 text-xs mt-1 leading-relaxed">
        Você preenche na ordem que quiser — só não dá pra concluir com pendência. Vai e volta quantas
        vezes precisar: seu personagem fica salvo do jeito que está.
      </p>
      <ul className="mt-3">
        {missing.map(step => (
          <li key={step} className="flex items-center justify-between gap-3 py-2 border-t border-gold-900/50">
            <span className="font-fantasy text-sm text-parchment-200">{STEP_LABELS[step]}</span>
            <button
              onClick={() => goToStep(step)}
              className="px-3 py-1.5 rounded-lg font-fantasy font-bold text-xs bg-gold-800 text-parchment-100 hover:bg-gold-600 hover:text-parchment-950 transition-colors shrink-0"
            >
              Preencher →
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
