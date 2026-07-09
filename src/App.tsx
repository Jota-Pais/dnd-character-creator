import { useAppStore } from './core/stores/appStore'
import { SYSTEMS } from './core/systems/registry'
import { GlobalGallery } from './GlobalGallery'

export default function App() {
  const activeSystemId = useAppStore(state => state.activeSystemId)

  const System = activeSystemId ? SYSTEMS[activeSystemId] : null

  if (System) {
    const Component = System.Component
    return <Component />
  }

  return <GlobalGallery />
}
