import { useEffect } from 'react'
import { useAppStore } from '../../core/stores/appStore'
import { useOrdemStore } from './stores/characterStore'
import { WizardShell } from '../../components/wizard/WizardShell'
import { ordemSystem } from './index'
import simboloMaior from './assets/simbolo-maior.webp'

/** O Símbolo Maior como máscara: pinta a área com a cor de fundo e recorta no desenho. */
const SIGIL_MASK = {
  maskImage: `url(${simboloMaior})`, WebkitMaskImage: `url(${simboloMaior})`,
  maskSize: 'contain', WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
  maskPosition: 'center', WebkitMaskPosition: 'center',
} as const

export function OrdemApp() {
  const setActiveSystem = useAppStore(state => state.setActiveSystem)
  const view = useOrdemStore(state => state.view)
  const currentStep = useOrdemStore(state => state.currentStep)
  const draft = useOrdemStore(state => state.draft)
  const name = draft.name
  const prevStep = useOrdemStore(state => state.prevStep)
  const goToStep = useOrdemStore(state => state.goToStep)
  const goToGallery = useOrdemStore(state => state.goToGallery)
  const exitPrint = useOrdemStore(state => state.exitPrint)

  const PrintableSheet = ordemSystem.PrintableSheet
  const steps = ordemSystem.getSteps()
  const CurrentStepComponent = steps.find(s => s.id === currentStep)?.component
  // Navegação livre: toda etapa é alcançável a qualquer momento. O stepper deixa de ser um
  // trilho e passa a ser um mapa — o ✦ marca completude real do draft, não posição no fluxo.
  const completion = steps.map(s => s.isComplete(draft))
  const shellSteps = steps.map((s, i) => ({ id: s.id, label: s.title, complete: completion[i] }))
  // A Revisão fica fora da conta: ela só espelha as outras (ver getMissingSteps).
  const pendingCount = steps.filter((s, i) => s.id !== 'review' && !completion[i]).length

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep, view])

  // Na tela de impressão, o título do documento vira o nome-padrão do PDF salvo.
  useEffect(() => {
    if (view !== 'print') return
    const previous = document.title
    document.title = `${name.trim() || 'Agente'} — Ordem Paranormal`
    return () => { document.title = previous }
  }, [view, name])

  useEffect(() => {
    if (view !== 'wizard') return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      prevStep()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [prevStep, view])

  if (view === 'print') {
    return (
      <div className="theme-ordem min-h-screen py-6 px-4">
        <div className="no-print max-w-[820px] mx-auto mb-4 flex justify-between items-center">
          <button
            onClick={exitPrint}
            className="px-4 py-2 text-parchment-400 hover:text-parchment-200 text-sm font-fantasy transition-colors"
          >
            ← Voltar
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 rounded-xl font-fantasy font-bold text-sm bg-gold-500 text-parchment-950 hover:bg-gold-400 transition-colors"
          >
            🖨 Imprimir / Salvar PDF
          </button>
        </div>
        <div className="overflow-x-auto print:overflow-visible">
          <PrintableSheet />
        </div>
        <p className="no-print max-w-[820px] mx-auto mt-4 text-center text-parchment-700 text-xs">
          Dica: na janela de impressão, escolha "Salvar como PDF" como destino.
        </p>
      </div>
    )
  }

  // O `.theme-ordem` reescreve os tokens de cor no escopo — a casca compartilhada é a mesma
  // do D&D e não sabe de que sistema se trata (handoff "Redesign Ordem").
  return (
    <div className="theme-ordem">
      <WizardShell
        systemLabel="ORDEM"
        systemSubtitle="Criador de Agente"
        logo={<div className="w-full h-full bg-current" style={SIGIL_MASK} />}
        watermark={<div className="w-full h-full bg-gold-500" style={SIGIL_MASK} />}
        characterSummary={name ? (
          <>
            Agente: <span className="font-fantasy font-semibold text-gold-300">{name}</span> · NEX {draft.nex}%
          </>
        ) : undefined}
        steps={shellSteps}
        currentStepId={currentStep}
        pendingCount={pendingCount}
        onStepClick={id => goToStep(id as typeof currentStep)}
        onGallery={goToGallery}
        galleryLabel="Meus agentes"
        onSwitchSystem={() => setActiveSystem(null)}
      >
        {CurrentStepComponent && <CurrentStepComponent />}
      </WizardShell>
    </div>
  )
}
