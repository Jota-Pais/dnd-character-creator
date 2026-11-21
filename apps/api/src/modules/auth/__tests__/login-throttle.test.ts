import { describe, it, expect } from 'vitest'
import { createTestClock } from '../../../testing/test-app'
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, createLoginThrottle } from '../login-throttle'

const MINUTE = 60_000

describe('limite de tentativas de entrar', () => {
  it('libera até o limite e trava a partir dele, dizendo os minutos que faltam', () => {
    const clock = createTestClock()
    const throttle = createLoginThrottle(clock.now)
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) throttle.fail('a@x.com')
    expect(throttle.minutesToWait('a@x.com')).toBe(0)

    throttle.fail('a@x.com')
    expect(throttle.minutesToWait('a@x.com')).toBe(15)
    clock.advance(10 * MINUTE + 1)
    expect(throttle.minutesToWait('a@x.com')).toBe(5)
  })

  it('a janela conta da primeira falha, e passada ela a conta volta a poder tentar', () => {
    const clock = createTestClock()
    const throttle = createLoginThrottle(clock.now)
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) throttle.fail('a@x.com')
    clock.advance(LOGIN_WINDOW_MS - 1)
    expect(throttle.minutesToWait('a@x.com')).toBe(1)
    clock.advance(1)
    expect(throttle.minutesToWait('a@x.com')).toBe(0)
    // Zerou: a falha seguinte é a primeira de uma janela nova.
    throttle.fail('a@x.com')
    expect(throttle.minutesToWait('a@x.com')).toBe(0)
  })

  it('cada e-mail tem a sua contagem, e acertar a senha zera a dele', () => {
    const throttle = createLoginThrottle(createTestClock().now)
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) throttle.fail('a@x.com')
    expect(throttle.minutesToWait('b@x.com')).toBe(0)
    throttle.reset('a@x.com')
    expect(throttle.minutesToWait('a@x.com')).toBe(0)
  })
})
