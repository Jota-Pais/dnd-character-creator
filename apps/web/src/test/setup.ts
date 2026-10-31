import '@testing-library/jest-dom/vitest'
import { beforeAll } from 'vitest'
import { preloadLazyScreens } from '../core/utils/lazyScreen'

// As telas sob demanda (core/utils/lazyScreen.ts) descem antes dos testes, como no app depois do
// `load`: montam no mesmo render, e o teste lê a tela sem esperar. O caminho antes de o pedaço
// descer (o Suspense) tem o teste dele (core/utils/__tests__/lazyScreen.test.tsx).
beforeAll(() => preloadLazyScreens())
