import '@testing-library/jest-dom/vitest'
import { beforeAll } from 'vitest'
import { preloadLazyScreens } from '../core/utils/lazyScreen'

// As telas sob demanda (core/utils/lazyScreen.ts) descem antes dos testes, como no app na abertura:
// montam no mesmo render, e o teste lê a tela sem esperar. O caminho antes de o pedaço
// descer tem os testes dele: o do lazyScreen (core/utils/__tests__/lazyScreen.test.tsx) e o dos
// Suspense do App e da tela de impressão (__tests__/lazyScreens.test.tsx), que trocam a tela de um
// sistema por uma que ainda não desceu.
beforeAll(() => preloadLazyScreens())
