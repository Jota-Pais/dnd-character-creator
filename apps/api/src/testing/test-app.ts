import type { Express } from 'express'
import { createApp, type AppOptions } from '../app'
import { createMemoryAuthRepository, type MemoryAuthRepository } from '../modules/auth/auth.repository.memory'

/** O relógio dos testes: parado, e só anda quando o teste manda. */
export type TestClock = {
  now: () => Date
  advance(ms: number): void
}

export function createTestClock(start = new Date('2026-11-21T12:00:00.000Z')): TestClock {
  let current = start.getTime()
  return {
    now: () => new Date(current),
    advance(ms) {
      current += ms
    },
  }
}

/** O único item de uma coleção; falha se ela tiver outro tamanho. */
export function only<T>(items: Iterable<T>): T {
  const all = [...items]
  if (all.length !== 1) throw new Error(`Esperava 1 item, havia ${all.length}.`)
  return all[0] as T
}

export type TestApp = {
  app: Express
  clock: TestClock
  repositories: { auth: MemoryAuthRepository }
}

/**
 * A API inteira em memória, para os testes de rota (supertest): repositórios em memória, relógio
 * parado e bcrypt no custo mínimo. Nenhum banco, nenhuma porta, nenhum .env.
 */
export function createTestApp(options: Partial<Omit<AppOptions, 'repositories' | 'clock'>> = {}): TestApp {
  const clock = createTestClock()
  const repositories = { auth: createMemoryAuthRepository() }
  const app = createApp({ environment: 'test', passwordCost: 4, ...options, repositories, clock: clock.now })
  return { app, clock, repositories }
}
