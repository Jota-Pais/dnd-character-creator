import { useAppStore } from './core/stores/appStore'
import { SYSTEMS } from './core/systems/registry'
import { usePlayStore } from './core/play/playStore'
import { GlobalGallery } from './GlobalGallery'
import { PlayScreen } from './components/play/PlayScreen'

export default function App() {
  const activeSystemId = useAppStore(state => state.activeSystemId)
  const playSession = usePlayStore(state => state.session)

  // A mesa é um destino irmão do wizard, não uma tela dentro dele. A própria existência da
  // sessão é a rota — por isso não há estado de navegação duplicado.
  if (playSession) return <PlayScreen />

  const System = activeSystemId ? SYSTEMS[activeSystemId] : null

  if (System) {
    const Component = System.Component
    return <Component />
  }

  return <GlobalGallery />
}
