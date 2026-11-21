import { useEffect } from 'react'
import { useAppStore } from '../../core/stores/appStore'
import { useBackHandler, useStepPath } from '../../core/navigation/back'
import { useCharacterStore } from './stores/characterStore'
import { WizardShell } from '../../core/ui/wizard/WizardShell'
import { PrintScreen } from '../../core/ui/PrintScreen'
import { getMissingSteps } from '@rpg/rules/systems/dnd5e/utils/draftValidation'
import { getClass } from '@rpg/rules/systems/dnd5e/utils/classUtils'
import { dnd5eSystem } from './index'
import { getSteps } from './steps'
import { D20Logo } from './assets/D20Logo'
import { PlayScreen } from './play/PlayScreen'

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
  const exitPlay = useCharacterStore(state => state.exitPlay)

  const PrintableSheet = dnd5eSystem.PrintableSheet
  const steps = getSteps()
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
    // No modo de jogo, direto ao topo: o cabeçalho e os vitais não podem abrir cortados pela
    // rolagem que sobrou da galeria (o suave pode ser interrompido pela troca de tela).
    if (view === 'play') window.scrollTo(0, 0)
    else window.scrollTo({ top: 0, behavior: 'smooth' })
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

  // O voltar do Android (core/navigation/back.ts): o jogo volta à galeria, como o "← Personagens";
  // a impressão, à ficha; o criador refaz o caminho desta visita (useStepPath): a etapa de onde se
  // veio e, da primeira que se abriu, a galeria. A ficha aberta na Revisão volta direto à galeria.
  const stepCameFrom = useStepPath(currentStep)
  useBackHandler(() => {
    if (view === 'play') exitPlay()
    else if (view === 'print') exitPrint()
    else {
      const previous = stepCameFrom()
      if (previous) goToStep(previous)
      else goToGallery()
    }
  })

  // Modo de jogo: tela própria, fora do WizardShell (a ficha não é editada aqui).
  if (view === 'play') return <PlayScreen />

  if (view === 'print') return <PrintScreen Sheet={PrintableSheet} onBack={exitPrint} />

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
