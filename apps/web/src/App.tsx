import { Suspense } from 'react'
import { useAppStore } from './core/stores/appStore'
import { SYSTEMS } from './core/systems/registry'
import { GlobalGallery } from './GlobalGallery'
import { Loading } from './components/common/Loading'

export default function App() {
  const activeSystemId = useAppStore(state => state.activeSystemId)

  const System = activeSystemId ? SYSTEMS[activeSystemId] : null

  if (System) {
    const Component = System.Component
    // A tela do Ordem desce sob demanda (core/utils/lazyScreen.ts): no toque logo na primeira
    // abertura, antes de o pedaço descer, o "Carregando…" segura a vez.
    return (
      <Suspense fallback={<Loading className="min-h-screen" />}>
        <Component />
      </Suspense>
    )
  }

  return <GlobalGallery />
}
