import { useOrdemStore } from '../../stores/characterStore'
import { STEP_LABELS } from '../../types/character'
import type { WizardStep } from '../../types/character'
import { formatMissingCount } from '../../../../components/wizard/pendingSteps'

/**
 * Única trava do fluxo: a Revisão lista o que ficou pendente e leva direto a cada etapa.
 * O jogador preenche na ordem que quiser — a cobrança acontece aqui, no fim.
 */
export function PendingStepsPanel({ missing }: { missing: WizardStep[] }) {
  const goToStep = useOrdemStore(state => state.goToStep)
  if (missing.length === 0) return null

  return (
    <div className="rounded-xl p-4" style={{ border: '1px solid #7f1d1d', backgroundColor: 'rgba(42,13,15,.55)' }}>
      <p className="font-fantasy font-bold text-[15px]" style={{ color: '#fca5a5' }}>
        ⚠ {formatMissingCount(missing.length)} para fechar a ficha
      </p>
      <p className="text-xs mt-1 leading-relaxed" style={{ color: '#b3a094' }}>
        Você preenche na ordem que quiser — só não dá pra concluir com pendência. Vai e volta quantas
        vezes precisar: seu agente fica salvo do jeito que está.
      </p>
      <ul className="mt-3">
        {missing.map(step => (
          <li
            key={step}
            className="flex items-center justify-between gap-3 py-2"
            style={{ borderTop: '1px solid rgba(127,29,29,.45)' }}
          >
            <span className="font-fantasy text-[13.5px]" style={{ color: '#ede2d6' }}>
              {STEP_LABELS[step]}
            </span>
            <button
              onClick={() => goToStep(step)}
              className="px-3 py-1.5 rounded-lg font-fantasy font-bold text-[12px] transition-colors shrink-0"
              style={{ backgroundColor: '#7f1d1d', color: '#fecaca' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dc2626' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#7f1d1d' }}
            >
              Preencher →
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
