import { useEffect } from 'react'
import { useAppStore } from '../../core/stores/appStore'
import { useCharacterStore } from './stores/characterStore'
import { StepIndicator } from '../../components/wizard/StepIndicator'
import { dnd5eSystem } from './index'

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
  // Navegação livre: uma etapa é clicável se todas as anteriores estão completas
  // (o mesmo alcance de avançar com "próximo" — nunca pula validação).
  const firstIncompleteIdx = steps.findIndex(s => !s.isComplete(draft))
  const maxReachableIdx = firstIncompleteIdx === -1 ? steps.length - 1 : firstIncompleteIdx
  const stepIndicatorProps = steps.map((s, i) => ({ id: s.id, label: s.title, clickable: i <= maxReachableIdx }))

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
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 pb-24">

        {/* Header */}
        <header className="pt-8 pb-6 text-center">
          <div className="text-5xl mb-3">🐉</div>
          <h1 className="font-fantasy text-3xl font-bold text-gold-400 tracking-wide">
            Criador de Personagem
          </h1>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="h-px w-20 bg-gold-800" />
            <span className="text-parchment-500 text-xs uppercase tracking-widest font-fantasy">
              D&D 5e · PHB 2014
            </span>
            <div className="h-px w-20 bg-gold-800" />
          </div>
          {view === 'wizard' && name && currentStep !== 'name' && (
            <p className="mt-2 text-parchment-400 text-sm">
              <span className="text-parchment-600">Aventureiro:</span>{' '}
              <span className="text-gold-400 font-semibold font-fantasy">{name}</span>
            </p>
          )}
          {view === 'wizard' && (
            <button
              onClick={goToGallery}
              className="mt-3 text-parchment-600 hover:text-parchment-300 text-xs font-fantasy transition-colors"
            >
              ← Meus personagens
            </button>
          )}
        </header>

        {/* Step indicator */}
        <div className="mb-8 flex justify-center">
          <StepIndicator steps={stepIndicatorProps} currentStepId={currentStep} onStepClick={id => goToStep(id as typeof currentStep)} />
        </div>

        {/* Divider ornamental */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-parchment-800" />
          <span className="text-parchment-700 text-sm">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-parchment-800" />
        </div>

        <main key={currentStep} className="animate-fade-in relative pb-24 lg:pb-32">
          {CurrentStepComponent && <CurrentStepComponent />}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-parchment-900 mt-12 py-6 text-center">
        <p className="text-parchment-700 text-xs font-fantasy tracking-wider">
          Forjado por Jota{' '}
          <span className="text-parchment-800 mx-1">·</span>{' '}
          <a
            href="https://github.com/Jota-Pais/dnd-character-creator"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-700 hover:text-gold-500 transition-colors"
          >
            GitHub ↗
          </a>
          <span className="text-parchment-800 mx-1">·</span>{' '}
          <button
            onClick={() => setActiveSystem(null)}
            className="text-gold-700 hover:text-gold-500 transition-colors"
          >
            Trocar de sistema
          </button>
        </p>
      </footer>
    </div>
  )
}
