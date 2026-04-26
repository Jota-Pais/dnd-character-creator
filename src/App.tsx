import { useCharacterStore } from './stores/characterStore'
import { StepIndicator } from './components/wizard/StepIndicator'
import { NameStep } from './components/steps/NameStep'
import { RaceStep } from './components/steps/RaceStep'

export default function App() {
  const currentStep = useCharacterStore(state => state.currentStep)
  const name = useCharacterStore(state => state.draft.name)

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="max-w-6xl mx-auto px-4 pb-24 lg:pb-8">
        <header className="py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-amber-500">Criador de Personagem</h1>
            <p className="text-stone-500 text-xs">D&D 5e — PHB 2014</p>
          </div>
          {name && currentStep !== 'name' && (
            <span className="text-stone-300 text-sm">
              <span className="text-stone-500">Personagem:</span> {name}
            </span>
          )}
        </header>

        <div className="mb-8">
          <StepIndicator currentStep={currentStep} />
        </div>

        <main>
          {currentStep === 'name' && <NameStep />}
          {currentStep === 'race' && <RaceStep />}
          {currentStep !== 'name' && currentStep !== 'race' && (
            <div className="flex items-center justify-center h-64 rounded-xl border-2 border-dashed border-stone-700">
              <p className="text-stone-500">Etapa em construção — em breve!</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
