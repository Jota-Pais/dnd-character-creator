import { describe, it, expect, beforeEach } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { loadLibrary, saveCharacterEntry, type SavedCharacter } from '../storage'
import { buildPlaySheet } from '@rpg/rules/systems/dnd5e/utils/playSheet'
import {
  addCondition, applyDamage, completeLongRest, completeShortRest, createPlayState, setExhaustion,
  spendHitDie, spendPactSlot, spendResource, spendSpellSlot, startConcentration,
} from '@rpg/rules/systems/dnd5e/utils/playState'
import {
  PLAY_OPEN_KEY, PLAY_PREFERENCES_KEY, PLAY_STATES_KEY, PLAY_STORAGE_VERSION, deletePlayState, listPlayStateIds,
  loadOpenPlayId, loadOrCreatePlayState, loadPlayPreferences, loadPlayState, loadPlayStateFor, saveOpenPlayId,
  savePlayPreferences, savePlayState,
} from '../playStorage'

const LIBRARY_KEY = 'dnd-character-library'

function character(id: string): SavedCharacter {
  const draft: CharacterDraft = {
    ...structuredClone(EMPTY_DRAFT),
    name: 'Morgana',
    class: 'warlock',
    race: 'human',
    level: 5,
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 15, WIS: 10, CHA: 15 },
    additionalClasses: [{
      classId: 'wizard', level: 2, classChoices: structuredClone(EMPTY_DRAFT.classChoices),
      spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
    }],
  }
  return { id, updatedAt: 1000, step: 'review', draft }
}

beforeEach(() => {
  localStorage.clear()
})

describe('playStorage', () => {
  it('salva e carrega um estado por ficha, carimbando updatedAt', () => {
    const saved = savePlayState({ ...createPlayState('a'), damageTaken: 4 }, 123)
    expect(saved.updatedAt).toBe(123)
    savePlayState({ ...createPlayState('b'), tempHp: 2 }, 124)
    expect(loadPlayState('a')).toEqual(saved)
    expect(loadPlayState('b')?.tempHp).toBe(2)
    expect(listPlayStateIds().sort()).toEqual(['a', 'b'])
  })

  it('a nota de duração das condições vai e volta do armazenamento (sem subir a versão)', () => {
    const saved = savePlayState({ ...createPlayState('a'), conditions: ['poisoned'], conditionNotes: { poisoned: '1 hora' } }, 5)
    expect(loadPlayState('a')?.conditionNotes).toEqual({ poisoned: '1 hora' })
    expect(loadPlayState('a')).toEqual(saved)
    expect(JSON.parse(localStorage.getItem(PLAY_STATES_KEY)!).version).toBe(PLAY_STORAGE_VERSION)
  })

  it('sem estado salvo: null, ou um novo com loadOrCreate (sem gravar)', () => {
    expect(loadPlayState('x')).toBeNull()
    expect(loadOrCreatePlayState('x', 9)).toEqual(createPlayState('x', 9))
    expect(localStorage.getItem(PLAY_STATES_KEY)).toBeNull()
  })

  it('apaga só o estado pedido', () => {
    savePlayState(createPlayState('a'), 1)
    savePlayState(createPlayState('b'), 1)
    deletePlayState('a')
    expect(loadPlayState('a')).toBeNull()
    expect(loadPlayState('b')).not.toBeNull()
    deletePlayState('nunca-existiu')
    expect(listPlayStateIds()).toEqual(['b'])
  })

  it('JSON quebrado ou versão diferente do contêiner: descarta a chave', () => {
    localStorage.setItem(PLAY_STATES_KEY, '{nada disso')
    expect(loadPlayState('a')).toBeNull()
    expect(localStorage.getItem(PLAY_STATES_KEY)).toBeNull()

    localStorage.setItem(PLAY_STATES_KEY, JSON.stringify({ version: PLAY_STORAGE_VERSION + 1, states: { a: {} } }))
    expect(loadPlayState('a')).toBeNull()
    expect(localStorage.getItem(PLAY_STATES_KEY)).toBeNull()

    localStorage.setItem(PLAY_STATES_KEY, JSON.stringify({ version: PLAY_STORAGE_VERSION, states: [] }))
    expect(listPlayStateIds()).toEqual([])
  })

  it('entrada com lixo sai sanitizada, com o id da chave', () => {
    localStorage.setItem(PLAY_STATES_KEY, JSON.stringify({
      version: PLAY_STORAGE_VERSION,
      states: { a: { characterId: 'z', damageTaken: -3, conditions: ['poisoned', 'xyz'], exhaustionLevel: 9 } },
    }))
    const s = loadPlayState('a')
    expect(s?.characterId).toBe('a')
    expect(s?.damageTaken).toBe(0)
    expect(s?.conditions).toEqual(['poisoned'])
    expect(s?.exhaustionLevel).toBe(6)
  })

  it('loadPlayStateFor devolve o salvo já reconciliado com a ficha mudada no criador', () => {
    const base = buildPlaySheet(character('c1').draft)
    // Salvo na exaustão 4 com 10/10 numa ficha de 20; a ficha sobe para 30.
    savePlayState({ ...createPlayState('c1'), exhaustionLevel: 4, damageTaken: 10 }, 1)
    const r = loadPlayStateFor('c1', { ...base, maxHp: 30 }, 2)
    expect(r.state.damageTaken).toBe(15)
    expect(r.notices.map(n => n.kind)).toEqual(['hpCut'])
    // Ficha que encolheu: consciente fica com 1 PV, nunca 0.
    savePlayState({ ...createPlayState('c2'), damageTaken: 25 }, 1)
    expect(loadPlayStateFor('c2', { ...base, maxHp: 20 }, 2).state.damageTaken).toBe(19)
    // Sem estado salvo: um novo, sem avisos, e nada gravado.
    const fresh = loadPlayStateFor('c3', base, 7)
    expect(fresh.state).toEqual(createPlayState('c3', 7))
    expect(fresh.notices).toEqual([])
    expect(listPlayStateIds().sort()).toEqual(['c1', 'c2'])
  })

  it('jogar não toca a biblioteca de fichas: o draft salvo continua idêntico (ficha imutável)', () => {
    saveCharacterEntry(character('c1'))
    const libraryBefore = localStorage.getItem(LIBRARY_KEY)
    const entry = loadLibrary()[0]
    const draftBefore = structuredClone(entry.draft)

    const sheet = buildPlaySheet(entry.draft)
    let state = loadOrCreatePlayState(entry.id, 1)
    const steps = [
      (s: typeof state) => startConcentration(s, { label: 'Hex' }, 2),
      (s: typeof state) => spendPactSlot(s, sheet),
      (s: typeof state) => spendSpellSlot(s, sheet, 1),
      (s: typeof state) => spendResource(s, sheet, 'arcane-recovery'),
      (s: typeof state) => applyDamage(s, sheet, { amount: 9, critical: true }),
      (s: typeof state) => addCondition(s, 'poisoned'),
      (s: typeof state) => setExhaustion(s, sheet, 4),
      (s: typeof state) => spendHitDie(s, sheet, { die: 8, value: 6 }),
      (s: typeof state) => completeShortRest(s, sheet),
      (s: typeof state) => applyDamage(s, sheet, { amount: 100 }),
      (s: typeof state) => completeLongRest(s, sheet),
    ]
    for (const step of steps) {
      state = step(state).state
      state = savePlayState(state, 5)
    }

    expect(localStorage.getItem(LIBRARY_KEY)).toBe(libraryBefore)
    expect(entry.draft).toEqual(draftBefore)
    expect(loadLibrary()[0].draft).toEqual(draftBefore)
    expect(buildPlaySheet(loadLibrary()[0].draft)).toEqual(sheet)
    expect(loadPlayState('c1')?.characterId).toBe('c1')
  })
})

describe('preferências do modo de jogo', () => {
  it('padrão: dados do app desligados e tela acesa ligada, sem gravar nada', () => {
    expect(loadPlayPreferences()).toEqual({ appDice: false, keepScreenOn: true })
    expect(localStorage.getItem(PLAY_PREFERENCES_KEY)).toBeNull()
  })

  it('salva e carrega, numa chave própria', () => {
    expect(savePlayPreferences({ appDice: true, keepScreenOn: false })).toEqual({ appDice: true, keepScreenOn: false })
    expect(loadPlayPreferences()).toEqual({ appDice: true, keepScreenOn: false })
    expect(localStorage.getItem(PLAY_STATES_KEY)).toBeNull()
    savePlayPreferences({ appDice: false, keepScreenOn: true })
    expect(loadPlayPreferences()).toEqual({ appDice: false, keepScreenOn: true })
  })

  it('preferência gravada antes da tela acesa existir fica com ela ligada', () => {
    localStorage.setItem(PLAY_PREFERENCES_KEY, '{"appDice":true}')
    expect(loadPlayPreferences()).toEqual({ appDice: true, keepScreenOn: true })
  })

  it('tolera JSON inválido e campo estranho', () => {
    for (const raw of ['{quebrado', 'null', '42', '{"appDice":"sim","keepScreenOn":"não"}', '[]']) {
      localStorage.setItem(PLAY_PREFERENCES_KEY, raw)
      expect(loadPlayPreferences(), raw).toEqual({ appDice: false, keepScreenOn: true })
    }
  })
})

describe('ficha aberta no modo de jogo', () => {
  it('grava, lê e limpa o id numa chave própria', () => {
    expect(loadOpenPlayId()).toBeNull()
    saveOpenPlayId('c1')
    expect(localStorage.getItem(PLAY_OPEN_KEY)).toBe('c1')
    expect(loadOpenPlayId()).toBe('c1')
    saveOpenPlayId(null)
    expect(localStorage.getItem(PLAY_OPEN_KEY)).toBeNull()
    expect(loadOpenPlayId()).toBeNull()
  })

  it('valor vazio vale como nenhum', () => {
    localStorage.setItem(PLAY_OPEN_KEY, '  ')
    expect(loadOpenPlayId()).toBeNull()
  })
})
