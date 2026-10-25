import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayStore, UNDO_LIMIT } from '../playStore'
import {
  applyDamage, applyHealing, createPlayState, getCurrentHp, setInspiration, setNote,
} from '../../utils/playState'
import { loadPlayPreferences, loadPlayState, savePlayState } from '../../utils/playStorage'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'

const draft = () => structuredClone(COMPLETE_DRAFT)

beforeEach(() => {
  localStorage.clear()
  usePlayStore.getState().close()
})

describe('usePlayStore', () => {
  it('open monta a ficha e começa um estado novo, sem gravar', () => {
    usePlayStore.getState().open('c1', draft())
    const s = usePlayStore.getState()
    expect(s.characterId).toBe('c1')
    expect(s.characterName).toBe('Krusk')
    expect(s.sheet?.maxHp).toBeGreaterThan(0)
    expect(s.state?.characterId).toBe('c1')
    expect(s.undoStack).toEqual([])
    expect(loadPlayState('c1')).toBeNull()
  })

  it('open carrega o estado salvo da ficha', () => {
    savePlayState({ ...createPlayState('c1'), damageTaken: 3, inspiration: true })
    usePlayStore.getState().open('c1', draft())
    expect(usePlayStore.getState().state).toMatchObject({ damageTaken: 3, inspiration: true })
  })

  it('run aplica, grava pelo playStorage, empilha o anterior e guarda os avisos', () => {
    usePlayStore.getState().open('c1', draft())
    const before = usePlayStore.getState().state!
    const result = usePlayStore.getState().run((st, sh) => applyDamage(st, sh, { amount: 5 }))
    const s = usePlayStore.getState()
    expect(result?.state).toBe(s.state)
    expect(s.state?.damageTaken).toBe(5)
    expect(s.undoStack).toEqual([before])
    expect(loadPlayState('c1')?.damageTaken).toBe(5)
    expect(getCurrentHp(s.state!, s.sheet!)).toBe(s.sheet!.maxHp - 5)
  })

  it('operação recusada ou sem efeito não empilha nem grava, mas mostra os avisos', () => {
    usePlayStore.getState().open('c1', draft())
    usePlayStore.getState().run((st, sh) => applyHealing(st, sh, Number.NaN))
    expect(usePlayStore.getState().undoStack).toEqual([])
    expect(usePlayStore.getState().notices.map(n => n.kind)).toEqual(['refused'])
    usePlayStore.getState().run(st => setNote(st, ''))
    expect(usePlayStore.getState().undoStack).toEqual([])
    expect(loadPlayState('c1')).toBeNull()
  })

  it('undo volta um passo e grava', () => {
    usePlayStore.getState().open('c1', draft())
    usePlayStore.getState().run((st, sh) => applyDamage(st, sh, { amount: 4 }))
    usePlayStore.getState().run(st => setInspiration(st, true))
    usePlayStore.getState().undo()
    expect(usePlayStore.getState().state).toMatchObject({ damageTaken: 4, inspiration: false })
    expect(loadPlayState('c1')).toMatchObject({ damageTaken: 4, inspiration: false })
    usePlayStore.getState().undo()
    expect(usePlayStore.getState().state?.damageTaken).toBe(0)
    expect(loadPlayState('c1')?.damageTaken).toBe(0)
    usePlayStore.getState().undo()
    expect(usePlayStore.getState().state?.damageTaken).toBe(0)
  })

  it(`a pilha do desfazer guarda no máximo ${UNDO_LIMIT} estados`, () => {
    usePlayStore.getState().open('c1', draft())
    for (let i = 1; i <= UNDO_LIMIT + 5; i++) usePlayStore.getState().run(st => setNote(st, `nota ${i}`))
    const s = usePlayStore.getState()
    expect(s.undoStack).toHaveLength(UNDO_LIMIT)
    expect(s.undoStack.at(-1)?.note).toBe(`nota ${UNDO_LIMIT + 4}`)
    expect(s.undoStack[0].note).toBe('nota 5')
  })

  it('lastActionChanged diz se a última ação mudou o estado (o que o undo desfaria)', () => {
    usePlayStore.getState().open('c1', draft())
    expect(usePlayStore.getState().lastActionChanged).toBe(false)
    usePlayStore.getState().run((st, sh) => applyDamage(st, sh, { amount: 4 }))
    expect(usePlayStore.getState().lastActionChanged).toBe(true)
    usePlayStore.getState().run((st, sh) => applyHealing(st, sh, Number.NaN))
    expect(usePlayStore.getState().lastActionChanged).toBe(false)
    usePlayStore.getState().run(st => setInspiration(st, true))
    usePlayStore.getState().undo()
    expect(usePlayStore.getState().lastActionChanged).toBe(false)
  })

  it('dismissNotices limpa os avisos', () => {
    usePlayStore.getState().open('c1', draft())
    usePlayStore.getState().run((st, sh) => applyHealing(st, sh, Number.NaN))
    usePlayStore.getState().dismissNotices()
    expect(usePlayStore.getState().notices).toEqual([])
  })

  it('setAppDice grava a preferência (desligada por padrão)', () => {
    expect(usePlayStore.getState().prefs.appDice).toBe(false)
    usePlayStore.getState().setAppDice(true)
    expect(usePlayStore.getState().prefs.appDice).toBe(true)
    expect(loadPlayPreferences().appDice).toBe(true)
  })

  it('close esvazia a tela e run vira no-op', () => {
    usePlayStore.getState().open('c1', draft())
    usePlayStore.getState().close()
    const s = usePlayStore.getState()
    expect(s.characterId).toBeNull()
    expect(s.state).toBeNull()
    expect(s.sheet).toBeNull()
    expect(usePlayStore.getState().run(st => setInspiration(st, true))).toBeNull()
  })
})
