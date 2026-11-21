import { Suspense } from 'react'
import { useAppStore } from '../core/stores/appStore'
import { SYSTEMS } from '../systems/registry'
import { GlobalGallery } from '../features/gallery/GlobalGallery'
import { AuthScreen } from '../features/auth/AuthScreen'
import { useAuthStore } from '../features/auth/authStore'
import { Loading } from '../core/ui/Loading'

export default function App() {
  const activeSystemId = useAppStore(state => state.activeSystemId)
  // O portão: sem conta ninguém usa o app (decisão do dono de 2026-11-21). Decide na hora, pelo
  // que o aparelho lembra (features/auth/accountStorage.ts), sem esperar a rede: quem já entrou
  // neste aparelho abre o app sem internet, direto na galeria ou no jogo que estava aberto. A
  // conferência com o servidor roda em segundo plano (features/auth/account.ts).
  const user = useAuthStore(state => state.user)

  if (!user) return <AuthScreen />

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
