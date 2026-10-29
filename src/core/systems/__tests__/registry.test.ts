import { describe, it, expect } from 'vitest'
import { SYSTEMS } from '../registry'
import { COMPLETE_DRAFT } from '../../../test/fixtures'

describe('contrato "play" dos sistemas (decisão 10.2.12)', () => {
  it('o D&D 5e tem modo de jogo; o Ordem ainda não (Fase 3)', () => {
    expect(SYSTEMS.dnd5e.play).toBeDefined()
    expect(SYSTEMS.ordem.play).toBeUndefined()
  })

  it('no D&D, só a ficha sem etapa pendente pode ser jogada', () => {
    const play = SYSTEMS.dnd5e.play!
    expect(play.canPlay(structuredClone(COMPLETE_DRAFT))).toBe(true)
    expect(play.canPlay({ ...structuredClone(COMPLETE_DRAFT), background: null })).toBe(false)
  })
})
