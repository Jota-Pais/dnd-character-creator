import { Suspense } from 'react'
import { useAppStore } from '../core/stores/appStore'
import { SYSTEMS } from '../systems/registry'
import { GlobalGallery } from '../features/gallery/GlobalGallery'
import { Loading } from '../core/ui/Loading'

export default function App() {
  const activeSystemId = useAppStore(state => state.activeSystemId)

  const System = activeSystemId ? SYSTEMS[activeSystemId] : null

  if (System) {
    const Component = System.Component
    // A tela do Ordem desce sob demanda (core/utils/lazyScreen.ts): no toque logo na primeira
    // visita, antes de o pedaço descer, o "Carregando…" segura a vez.
    return (
      <Suspense fallback={<Loading className="min-h-screen" />}>
        <Component />
      </Suspense>
    )
  }

  return <GlobalGallery />
}
