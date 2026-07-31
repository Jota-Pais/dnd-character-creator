import { useEffect } from 'react'
import { useAppStore } from '../../core/stores/appStore'
import { useCharacterStore } from './stores/characterStore'
import { WizardShell } from '../../components/wizard/WizardShell'
import { getMissingSteps } from './utils/draftValidation'
import { getClass } from './utils/classUtils'
import { dnd5eSystem } from './index'
import { D20Logo } from './assets/D20Logo'

export function Dnd5eApp() {
  const setActiveSystem = useAppStore(state => state.setActiveSystem)
  const view = useCharacterStore(state => state.view)
  const currentStep = useCharacterStore(state => state.currentStep)
  const draft = useCharacterStore(state => state.draft)
  const name = draft.name
  const prevStep = useCharacterStore(state => state.prevStep)
  const goToStep = useCharacterStore(state => state.goToStep)
  const goToGallery = useCharacterStore(state => state.goToGallery)
  const exitPrint = useCharacterStore(state => state.exitPrint)

  const PrintableSheet = dnd5eSystem.PrintableSheet
  const steps = dnd5eSystem.getSteps()
  const CurrentStepComponent = steps.find(s => s.id === currentStep)?.component
  // Navegação livre: toda etapa é alcançável a qualquer momento. O stepper deixa de ser um
  // trilho e passa a ser um mapa — o ✦ marca completude real do draft, não posição no fluxo.
  // A Revisão é o único caso especial: o isComplete dela mede o pré-requisito de multiclasse,
  // não preenchimento, então ela só ganha ✦ quando nenhuma etapa está pendente.
  const missing = getMissingSteps(draft)
  const noneMissing = missing.length === 0
  const shellSteps = steps.map(s => ({
    id: s.id,
    label: s.title,
    complete: s.id === 'review' ? noneMissing && s.isComplete(draft) : s.isComplete(draft),
  }))

  const className = draft.class ? getClass(draft.class)?.name : undefined
  const extraClasses = draft.additionalClasses?.length ?? 0

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep, view])

  // Na tela de impressão, o título do documento vira o nome-padrão do PDF salvo.
  useEffect(() => {
    if (view !== 'print') return
    const previous = document.title
    document.title = `${name.trim() || 'Personagem'} — D&D 5e`
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
      <div className="min-h-screen py-6 px-4">
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

  return (
    <WizardShell
      systemLabel="D&D 5E"
      systemSubtitle="Criador de Personagem"
      logo={<D20Logo className="w-full h-full" />}
      watermark={<D20Logo className="w-full h-full text-gold-500" />}
      characterSummary={name ? (
        <>
          Aventureiro: <span className="font-fantasy font-semibold text-gold-300">{name}</span>
          {className && <> · {className}{extraClasses > 0 && ` +${extraClasses}`}</>}
          {' '}· nível {draft.level ?? 1}
        </>
      ) : undefined}
      steps={shellSteps}
      currentStepId={currentStep}
      pendingCount={missing.length}
      onStepClick={id => goToStep(id as typeof currentStep)}
      onGallery={goToGallery}
      galleryLabel="Meus personagens"
      onSwitchSystem={() => setActiveSystem(null)}
    >
      {CurrentStepComponent && <CurrentStepComponent />}
    </WizardShell>
  )
}
