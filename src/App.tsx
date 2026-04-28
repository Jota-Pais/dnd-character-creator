import { useCharacterStore } from './stores/characterStore'
import { StepIndicator } from './components/wizard/StepIndicator'
import { NameStep } from './components/steps/NameStep'
import { RaceStep } from './components/steps/RaceStep'
import { ClassStep } from './components/steps/ClassStep'
import { AbilitiesStep } from './components/steps/AbilitiesStep'
import { BackgroundStep } from './components/steps/BackgroundStep'

export default function App() {
  const currentStep = useCharacterStore(state => state.currentStep)
  const name = useCharacterStore(state => state.draft.name)

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 pb-28 lg:pb-10">

        {/* Header */}
        <header className="pt-8 pb-6 text-center">
          <div className="text-5xl mb-3">🎲</div>
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
          {name && currentStep !== 'name' && (
            <p className="mt-2 text-parchment-400 text-sm">
              <span className="text-parchment-600">Aventureiro:</span>{' '}
              <span className="text-gold-400 font-semibold font-fantasy">{name}</span>
            </p>
          )}
        </header>

        {/* Step indicator */}
        <div className="mb-8 flex justify-center">
          <StepIndicator currentStep={currentStep} />
        </div>

        {/* Divider ornamental */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-parchment-800" />
          <span className="text-parchment-700 text-sm">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-parchment-800" />
        </div>

        <main key={currentStep} className="animate-fade-in">
          {currentStep === 'name' && <NameStep />}
          {currentStep === 'race' && <RaceStep />}
          {currentStep === 'class' && <ClassStep />}
          {currentStep === 'abilities' && <AbilitiesStep />}
          {currentStep === 'background' && <BackgroundStep />}
          {currentStep !== 'name' && currentStep !== 'race' && currentStep !== 'class' && currentStep !== 'abilities' && currentStep !== 'background' && (
            <div className="flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-parchment-800">
              <div className="text-4xl mb-3">🏗️</div>
              <p className="text-parchment-600 font-fantasy">Etapa em construção — em breve!</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
