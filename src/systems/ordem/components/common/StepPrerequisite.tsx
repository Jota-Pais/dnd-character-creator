import { useOrdemStore } from '../../stores/characterStore'
import { STEP_LABELS } from '../../types/character'
import type { WizardStep } from '../../types/character'
import { StepNav } from './StepNav'

type Props = {
  /** Etapa dona da escolha que falta (o botão leva direto pra ela). */
  dependsOn: WizardStep
  /** O que esta etapa precisa, em uma frase. Ex.: "saber a classe do seu agente". */
  needs: string
  emoji?: string
}

/**
 * Tela de uma etapa que depende de uma escolha feita em outra. Com navegação livre o jogador
 * pode cair aqui antes da hora — em vez de mostrar nada (beco sem saída), a etapa explica a
 * dependência, oferece o atalho pra etapa dona dela e mantém o rodapé funcionando.
 */
export function StepPrerequisite({ dependsOn, needs, emoji = '🔒' }: Props) {
  const goToStep = useOrdemStore(state => state.goToStep)
  const nextStep = useOrdemStore(state => state.nextStep)
  const prevStep = useOrdemStore(state => state.prevStep)
  const label = STEP_LABELS[dependsOn]

  // Sem `animate-fade-in` no container: o transform que ela deixa aplicado criaria um containing
  // block e prenderia o rodapé fixo aqui dentro. O <main> do wizard já anima a troca de etapa.
  return (
    <div className="max-w-lg mx-auto text-center pb-20">
      <div className="text-5xl mb-3">{emoji}</div>
      <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-2">Falta um passo antes</h2>
      <p className="text-parchment-500 text-sm mb-6 leading-relaxed">
        Esta etapa precisa {needs} — o que se escolhe em{' '}
        <strong className="text-gold-500">{label}</strong>. Pode ir lá agora e voltar, ou seguir
        preenchendo outra etapa: nada do que você já fez se perde.
      </p>
      <button
        onClick={() => goToStep(dependsOn)}
        className="px-6 py-3 rounded-[10px] font-fantasy font-bold text-[14px] transition-all"
        style={{ backgroundColor: '#dc2626', color: '#ffffff', letterSpacing: '.06em' }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#ef4444' }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#dc2626' }}
      >
        Ir para {label} →
      </button>

      <StepNav onPrev={prevStep} onNext={nextStep} pendingReason={`Depende da etapa ${label}`} />
    </div>
  )
}
