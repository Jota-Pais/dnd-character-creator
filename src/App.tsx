import { useAppStore } from './core/stores/appStore'
import { SYSTEMS } from './core/systems/registry'

export default function App() {
  const { activeSystemId, setActiveSystem } = useAppStore()
  
  const System = activeSystemId ? SYSTEMS[activeSystemId] : null

  if (System) {
    const Component = System.Component
    return <Component />
  }

  // Futura tela de seleção de sistemas
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-fantasy text-gold-400 mb-6">Escolha o seu Sistema</h1>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveSystem('dnd5e')}
            className="px-6 py-3 bg-parchment-800 text-parchment-200 rounded hover:bg-parchment-700 transition"
          >
            D&D 5e
          </button>
          <button 
            disabled
            className="px-6 py-3 bg-parchment-900 text-parchment-600 rounded opacity-50 cursor-not-allowed"
          >
            Ordem Paranormal (Em breve)
          </button>
        </div>
      </div>
    </div>
  )
}
