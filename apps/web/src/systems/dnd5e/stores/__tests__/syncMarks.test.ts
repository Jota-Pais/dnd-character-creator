import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { applyDamage } from '@rpg/rules/systems/dnd5e/utils/playState'
import { characterKey, loadSyncMeta, playKey, updateSyncMeta } from '../../../../core/sync/syncStorage'
import { SYSTEM_ID, loadLibrary, putSyncedCharacter } from '../../storage/storage'
import { AUTOSAVE_DELAY_MS, useCharacterStore } from '../characterStore'
import { usePlayStore } from '../playStore'

/**
 * O que os stores do D&D fazem com o diário da sincronização, sem saber dele: a marca nasce na
 * camada de storage. Aqui se confere o que o jogador faz na tela, do começo ao fim.
 */
const docs = () => loadSyncMeta().docs
const sheetKey = (id: string) => characterKey(SYSTEM_ID, id)

/** Todo documento do diário passa a estar em dia, na revisão 1 (como depois de sincronizar). */
const markAllSynced = () => updateSyncMeta(meta => {
  for (const key of Object.keys(meta.docs)) meta.docs[key] = { revision: 1, dirty: false }
})

beforeEach(() => {
  // newCharacter grava a alteração pendente do teste anterior; só depois o storage é limpo.
  useCharacterStore.getState().newCharacter()
  usePlayStore.getState().close()
  localStorage.clear()
  useCharacterStore.setState({ library: [] })
})

afterEach(() => vi.useRealTimers())

describe('o criador', () => {
  it('a alteração do jogador fica a enviar depois do salvamento automático; navegar, não', () => {
    vi.useFakeTimers()
    const store = useCharacterStore.getState()
    store.importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    expect(docs()[sheetKey(id)]).toEqual({ revision: 0, dirty: true })

    markAllSynced()
    useCharacterStore.getState().goToStep('race')
    useCharacterStore.getState().nextStep()
    useCharacterStore.getState().prevStep()
    expect(docs()[sheetKey(id)]).toEqual({ revision: 1, dirty: false })

    useCharacterStore.getState().setName('Krusk, o Velho')
    expect(docs()[sheetKey(id)].dirty).toBe(false)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(docs()[sheetKey(id)]).toEqual({ revision: 1, dirty: true })
  })

  it('abrir a ficha e voltar à galeria sem mexer não marca nada', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    useCharacterStore.getState().goToGallery()
    markAllSynced()

    useCharacterStore.getState().openCharacter(id)
    useCharacterStore.getState().goToGallery()
    expect(docs()[sheetKey(id)]).toEqual({ revision: 1, dirty: false })
  })

  it('duplicar cria uma ficha a enviar; apagar deixa a lápide da que o servidor tem', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    useCharacterStore.getState().goToGallery()
    markAllSynced()

    useCharacterStore.getState().duplicateCharacter(id)
    const copy = useCharacterStore.getState().library.find(c => c.id !== id)!
    expect(docs()[sheetKey(copy.id)]).toEqual({ revision: 0, dirty: true })

    useCharacterStore.getState().deleteCharacter(id)
    expect(docs()[sheetKey(id)]).toEqual({ revision: 1, dirty: true, deleted: true })
    // A cópia nunca subiu: apagá-la só a tira do diário.
    useCharacterStore.getState().deleteCharacter(copy.id)
    expect(docs()[sheetKey(copy.id)]).toBeUndefined()
  })
})

describe('reler a biblioteca depois da sincronização', () => {
  it('traz o que veio do servidor sem mexer na ficha aberta nem agendar o salvamento automático', () => {
    vi.useFakeTimers()
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const before = useCharacterStore.getState()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    // A sincronização grava uma ficha que veio de outro aparelho, e avisa o store.
    putSyncedCharacter({ id: 'do-servidor', updatedAt: 5000, step: 'review', draft: { ...structuredClone(COMPLETE_DRAFT), name: 'Lia' } })
    setItem.mockClear()
    useCharacterStore.getState().reloadLibrary()

    const after = useCharacterStore.getState()
    expect(after.library.map(c => c.draft.name).sort()).toEqual(['Krusk', 'Lia'])
    expect(after.draft).toBe(before.draft)
    expect(after.currentId).toBe(before.currentId)
    expect(after.currentStep).toBe(before.currentStep)
    expect(after.view).toBe(before.view)

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
    expect(loadLibrary()).toHaveLength(2)
  })
})

describe('o jogo', () => {
  function saved() {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    useCharacterStore.getState().goToGallery()
    return id
  }

  it('abrir o jogo pela primeira vez não manda nada: o estado entra em dia', () => {
    const id = saved()
    markAllSynced()
    useCharacterStore.getState().playCharacter(id)

    expect(docs()[playKey(id)]).toEqual({ revision: 0, dirty: false })
    // E a ficha, que o jogo não altera, continua em dia.
    expect(docs()[sheetKey(id)]).toEqual({ revision: 1, dirty: false })
  })

  it('a primeira ação do jogador marca o estado; as seguintes não regravam o diário', () => {
    const id = saved()
    useCharacterStore.getState().playCharacter(id)
    usePlayStore.getState().run((state, sheet) => applyDamage(state, sheet, { amount: 3 }))
    expect(docs()[playKey(id)]).toEqual({ revision: 0, dirty: true })

    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    usePlayStore.getState().run((state, sheet) => applyDamage(state, sheet, { amount: 1 }))
    usePlayStore.getState().undo()
    expect(setItem.mock.calls.filter(([key]) => key === 'app-sync')).toEqual([])
    setItem.mockRestore()
  })

  it('reabrir o jogo de um estado já sincronizado não o marca', () => {
    const id = saved()
    useCharacterStore.getState().playCharacter(id)
    usePlayStore.getState().run((state, sheet) => applyDamage(state, sheet, { amount: 3 }))
    useCharacterStore.getState().exitPlay()
    markAllSynced()

    useCharacterStore.getState().playCharacter(id)
    useCharacterStore.getState().exitPlay()
    expect(docs()[playKey(id)]).toEqual({ revision: 1, dirty: false })
  })

  it('apagar a ficha leva o estado de jogo do diário, sem lápide própria', () => {
    const id = saved()
    useCharacterStore.getState().playCharacter(id)
    usePlayStore.getState().run((state, sheet) => applyDamage(state, sheet, { amount: 3 }))
    useCharacterStore.getState().exitPlay()
    markAllSynced()

    useCharacterStore.getState().deleteCharacter(id)
    expect(docs()[playKey(id)]).toBeUndefined()
    expect(docs()[sheetKey(id)]).toEqual({ revision: 1, dirty: true, deleted: true })
  })
})
