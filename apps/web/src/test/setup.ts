import '@testing-library/jest-dom/vitest'
import { beforeAll, beforeEach } from 'vitest'
import { preloadLazyScreens } from '../core/utils/lazyScreen'
import { useAuthStore } from '../features/auth/authStore'

// As telas sob demanda (core/utils/lazyScreen.ts) descem antes dos testes, como no app na abertura:
// montam no mesmo render, e o teste lê a tela sem esperar. O caminho antes de o pedaço
// descer tem os testes dele: o do lazyScreen (core/utils/__tests__/lazyScreen.test.tsx) e o dos
// Suspense do App e da tela de impressão (app/__tests__/lazyScreens.test.tsx), que trocam a tela de um
// sistema por uma que ainda não desceu.
beforeAll(() => preloadLazyScreens())

/** A conta com que os testes do site rodam. */
export const TEST_USER = { id: 'user-teste', email: 'teste@ficha.dev' }

// Sem conta ninguém usa o app: o `App` mostra a tela de entrar. Os testes que montam o app querem a
// galeria, o criador e o jogo, então cada um começa com uma conta conectada e a sessão confirmada.
// Vai no store, e não no localStorage, porque quase todo teste limpa o localStorage no começo; o
// portão em si (a tela de entrar, a sessão expirada) tem os testes dele, que trocam este estado.
// A sincronização não liga nos testes: quem a liga é o `main.tsx`, que eles não carregam.
beforeEach(() => {
  useAuthStore.setState({ user: TEST_USER, session: 'valid' })
})
