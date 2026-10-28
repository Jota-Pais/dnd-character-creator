import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useCharacterStore, AUTOSAVE_DELAY_MS } from '../characterStore'
import { EMPTY_DRAFT } from '../../types/character'
import { loadLibrary } from '../../utils/storage'
import { getMissingSteps } from '../../utils/draftValidation'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { useAppStore } from '../../../../core/stores/appStore'
import { usePlayStore } from '../playStore'
import { createPlayState, setInspiration } from '../../utils/playState'
import { loadOpenPlayId, loadPlayState, saveOpenPlayId, savePlayState } from '../../utils/playStorage'

beforeEach(() => {
  // newCharacter grava a alteração pendente do teste anterior — só depois o storage é limpo
  useCharacterStore.getState().newCharacter()
  localStorage.clear()
  useCharacterStore.setState({ library: [] })
})

const LIBRARY_KEY = 'dnd-character-library'

/** Esconde a aba (troca de app no celular): `visibilitychange` com o documento oculto. */
function hidePage(): void {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  try {
    document.dispatchEvent(new Event('visibilitychange'))
  } finally {
    Reflect.deleteProperty(document, 'visibilityState')
  }
}

/** Quantas vezes a biblioteca foi gravada desde que o espião começou. */
const libraryWrites = (setItem: { mock: { calls: unknown[][] } }) =>
  setItem.mock.calls.filter(([key]) => key === LIBRARY_KEY).length

describe('nextStep (navegação livre)', () => {
  it('avança mesmo com o passo atual incompleto (o gate é só na Revisão)', () => {
    useCharacterStore.getState().nextStep()
    expect(useCharacterStore.getState().currentStep).toBe('race')
  })

  it('não passa do último passo', () => {
    useCharacterStore.getState().goToStep('review')
    useCharacterStore.getState().nextStep()
    expect(useCharacterStore.getState().currentStep).toBe('review')
  })

  it('avança quando o passo atual está completo e persiste na biblioteca', () => {
    useCharacterStore.getState().setName('Conan')
    useCharacterStore.getState().nextStep()
    expect(useCharacterStore.getState().currentStep).toBe('race')
    // a ficha foi salva na biblioteca
    expect(useCharacterStore.getState().library.some(c => c.draft.name === 'Conan')).toBe(true)
    expect(loadLibrary().some(c => c.draft.name === 'Conan')).toBe(true)
  })
})

describe('importDraft', () => {
  it('leva ficha completa direto à revisão, no modo wizard, salva na biblioteca', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    expect(useCharacterStore.getState().view).toBe('wizard')
    expect(useCharacterStore.getState().currentStep).toBe('review')
    expect(useCharacterStore.getState().draft.name).toBe('Krusk')
    expect(loadLibrary().some(c => c.draft.name === 'Krusk')).toBe(true)
  })

  it('retoma ficha incompleta no primeiro passo pendente', () => {
    useCharacterStore.getState().importDraft({ ...structuredClone(EMPTY_DRAFT), name: 'Conan' })
    expect(useCharacterStore.getState().currentStep).toBe('race')
  })

  it('ficha sem antecedente retoma em background', () => {
    useCharacterStore.getState().importDraft({ ...structuredClone(COMPLETE_DRAFT), background: null })
    expect(useCharacterStore.getState().currentStep).toBe('background')
  })
})

describe('biblioteca', () => {
  it('newCharacter começa em branco no wizard', () => {
    useCharacterStore.getState().setName('X')
    useCharacterStore.getState().newCharacter()
    expect(useCharacterStore.getState().view).toBe('wizard')
    expect(useCharacterStore.getState().draft.name).toBe('')
    expect(useCharacterStore.getState().currentStep).toBe('name')
  })

  it('abrir e excluir uma ficha da biblioteca', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    useCharacterStore.getState().goToGallery()
    expect(useCharacterStore.getState().view).toBe('gallery')
    useCharacterStore.getState().openCharacter(id)
    expect(useCharacterStore.getState().view).toBe('wizard')
    expect(useCharacterStore.getState().draft.name).toBe('Krusk')
    useCharacterStore.getState().deleteCharacter(id)
    expect(useCharacterStore.getState().library.some(c => c.id === id)).toBe(false)
  })

  it('duplicar cria uma cópia com sufixo', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    useCharacterStore.getState().duplicateCharacter(id)
    const copies = useCharacterStore.getState().library.filter(c => c.draft.name.includes('cópia'))
    expect(copies.length).toBe(1)
  })
})

describe('goToStep (navegação livre pelo stepper — F19)', () => {
  it('ficha completa: navega livremente pra qualquer etapa, em qualquer ordem', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useCharacterStore.getState().goToStep('abilities')
    expect(useCharacterStore.getState().currentStep).toBe('abilities')
    useCharacterStore.getState().goToStep('review')
    expect(useCharacterStore.getState().currentStep).toBe('review')
    useCharacterStore.getState().goToStep('name')
    expect(useCharacterStore.getState().currentStep).toBe('name')
  })

  it('ficha em branco: alcança qualquer etapa, mesmo com tudo incompleto', () => {
    useCharacterStore.getState().goToStep('equipment')
    expect(useCharacterStore.getState().currentStep).toBe('equipment')
    useCharacterStore.getState().goToStep('review')
    expect(useCharacterStore.getState().currentStep).toBe('review')
    useCharacterStore.getState().goToStep('background')
    expect(useCharacterStore.getState().currentStep).toBe('background')
  })

  it('ignora etapa inexistente', () => {
    useCharacterStore.getState().goToStep('spells')
    // @ts-expect-error — passo inválido vindo de fora (ex.: ficha salva de uma versão antiga)
    useCharacterStore.getState().goToStep('nao-existe')
    expect(useCharacterStore.getState().currentStep).toBe('spells')
  })

  it('navegar persiste a ficha na biblioteca (como próximo/anterior)', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useCharacterStore.getState().goToStep('class')
    expect(loadLibrary().some(c => c.draft.name === 'Krusk' && c.step === 'class')).toBe(true)
  })
})

describe('sair para a galeria global unificada (F14)', () => {
  it('goToGallery() zera o activeSystemId (volta ao Multiverso, não à galeria mono-sistema)', () => {
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().goToGallery()
    expect(useAppStore.getState().activeSystemId).toBeNull()
  })

  it('reset() (Concluir) zera o activeSystemId', () => {
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().setName('Krusk')
    useCharacterStore.getState().reset()
    expect(useAppStore.getState().activeSystemId).toBeNull()
  })
})

describe('troca de subclasse x magias escolhidas', () => {
  it('sair do Cavaleiro Arcano zera as magias do guerreiro; trocar a escola do mago não', () => {
    const store = useCharacterStore.getState()
    store.setClass('fighter')
    store.setLevel(3)
    useCharacterStore.getState().updateClassChoices({ subclass: 'eldritch-knight' })
    useCharacterStore.getState().updateSpellChoices({ cantrips: ['fire-bolt'], spells: ['shield'] })
    useCharacterStore.getState().updateClassChoices({ skills: ['athletics'] })
    expect(useCharacterStore.getState().draft.spellChoices.spells).toEqual(['shield'])
    useCharacterStore.getState().updateClassChoices({ subclass: 'champion' })
    expect(useCharacterStore.getState().draft.spellChoices).toEqual({ cantrips: [], spells: [] })

    useCharacterStore.getState().setClass('wizard')
    useCharacterStore.getState().updateClassChoices({ subclass: 'evocation' })
    useCharacterStore.getState().updateSpellChoices({ spells: ['shield'] })
    useCharacterStore.getState().updateClassChoices({ subclass: 'abjuration' })
    expect(useCharacterStore.getState().draft.spellChoices.spells).toEqual(['shield'])
  })

  it('vale também para a classe adicional da multiclasse', () => {
    useCharacterStore.getState().setClass('wizard')
    useCharacterStore.getState().setLevel(5)
    useCharacterStore.getState().addClass('rogue')
    useCharacterStore.getState().setAdditionalClassLevel('rogue', 3)
    useCharacterStore.getState().updateAdditionalClassChoices('rogue', { subclass: 'arcane-trickster' })
    useCharacterStore.getState().updateAdditionalSpellChoices('rogue', { spells: ['sleep'] })
    useCharacterStore.getState().updateAdditionalClassChoices('rogue', { subclass: 'thief' })
    expect(useCharacterStore.getState().draft.additionalClasses[0].spellChoices.spells).toEqual([])
  })
})

describe('modo de jogo', () => {
  function savedKrusk(): string {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    useCharacterStore.getState().goToGallery()
    return id
  }

  it('playCharacter abre a ficha salva no modo de jogo', () => {
    const id = savedKrusk()
    useCharacterStore.getState().playCharacter(id)
    const s = useCharacterStore.getState()
    expect(s.view).toBe('play')
    expect(s.currentId).toBe(id)
    expect(s.draft.name).toBe('Krusk')
    expect(usePlayStore.getState()).toMatchObject({ characterId: id, characterName: 'Krusk' })
    expect(usePlayStore.getState().state?.characterId).toBe(id)
  })

  it('playCharacter com id desconhecido não faz nada', () => {
    useCharacterStore.getState().playCharacter('nao-existe')
    expect(useCharacterStore.getState().view).toBe('wizard')
    expect(usePlayStore.getState().characterId).not.toBe('nao-existe')
  })

  it('exitPlay fecha o jogo e volta para a galeria global sem regravar a ficha', () => {
    const id = savedKrusk()
    const before = localStorage.getItem('dnd-character-library')
    useCharacterStore.getState().playCharacter(id)
    usePlayStore.getState().run(st => setInspiration(st, true))
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().exitPlay()
    expect(useCharacterStore.getState().view).toBe('gallery')
    expect(useAppStore.getState().activeSystemId).toBeNull()
    expect(usePlayStore.getState().state).toBeNull()
    expect(localStorage.getItem('dnd-character-library')).toBe(before)
    expect(loadPlayState(id)?.inspiration).toBe(true)
  })

  it('excluir a ficha apaga também o estado de jogo dela', () => {
    const id = savedKrusk()
    useCharacterStore.getState().playCharacter(id)
    usePlayStore.getState().run(st => setInspiration(st, true))
    savePlayState(createPlayState('outra'))
    expect(loadPlayState(id)).not.toBeNull()
    useCharacterStore.getState().deleteCharacter(id)
    expect(loadPlayState(id)).toBeNull()
    expect(loadPlayState('outra')).not.toBeNull()
    expect(usePlayStore.getState().characterId).toBeNull()
    expect(loadOpenPlayId()).toBeNull()
  })

  it('a ficha aberta no jogo fica marcada até sair do jogo', () => {
    const id = savedKrusk()
    useCharacterStore.getState().playCharacter(id)
    expect(loadOpenPlayId()).toBe(id)
    useCharacterStore.getState().exitPlay()
    expect(loadOpenPlayId()).toBeNull()
  })

  it('excluir outra ficha não tira a marca da que está aberta no jogo', () => {
    const id = savedKrusk()
    const other = savedKrusk()
    useCharacterStore.getState().playCharacter(id)
    useCharacterStore.getState().deleteCharacter(other)
    expect(loadOpenPlayId()).toBe(id)
  })
})

describe('recarregar a página no modo de jogo', () => {
  afterEach(() => { vi.resetModules() })

  /** Carrega os stores do zero, como um recarregar da página, com o localStorage atual. */
  async function reload() {
    vi.resetModules()
    const chars = await import('../characterStore')
    const play = await import('../playStore')
    const app = await import('../../../../core/stores/appStore')
    return { chars: chars.useCharacterStore, play: play.usePlayStore, app: app.useAppStore }
  }

  it('volta ao modo de jogo da mesma ficha, com o estado salvo', async () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    useCharacterStore.getState().playCharacter(id)
    usePlayStore.getState().run(st => setInspiration(st, true))

    const { chars, play, app } = await reload()
    expect(chars.getState()).toMatchObject({ view: 'play', currentId: id })
    expect(chars.getState().draft.name).toBe('Krusk')
    expect(play.getState().characterId).toBe(id)
    expect(play.getState().state?.inspiration).toBe(true)
    expect(play.getState().undoStack).toEqual([])
    expect(app.getState().activeSystemId).toBe('dnd5e')
  })

  it('o jogo retomado não regrava a ficha ao fechar ou esconder a aba', async () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    useCharacterStore.getState().playCharacter(id)
    const before = localStorage.getItem(LIBRARY_KEY)

    const { chars, play } = await reload()
    expect(chars.getState()).toMatchObject({ view: 'play', currentId: id })
    vi.useFakeTimers()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    try {
      play.getState().run(st => setInspiration(st, true))
      window.dispatchEvent(new Event('pagehide'))
      hidePage()
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
      expect(libraryWrites(setItem)).toBe(0)
      expect(localStorage.getItem(LIBRARY_KEY)).toBe(before)
    } finally {
      setItem.mockRestore()
      vi.useRealTimers()
    }
  })

  it('não volta ao jogo de uma ficha que ganhou pendência, como o "Jogar" da galeria', async () => {
    // Bárbaro com Atletismo da classe + Marinheiro, que também dá Atletismo: a perícia repetida
    // deixa a etapa Classe pendente (ficha antiga, de antes da regra).
    useCharacterStore.getState().importDraft({
      ...structuredClone(COMPLETE_DRAFT),
      classChoices: { ...structuredClone(COMPLETE_DRAFT.classChoices), skills: ['athletics', 'survival'] },
    })
    const id = useCharacterStore.getState().currentId!
    expect(getMissingSteps(useCharacterStore.getState().draft)).toEqual(['class'])
    saveOpenPlayId(id)
    savePlayState({ ...createPlayState(id), inspiration: true })

    const { chars, play, app } = await reload()
    expect(chars.getState().view).toBe('gallery')
    expect(play.getState().characterId).toBeNull()
    expect(app.getState().activeSystemId).toBeNull()
    expect(loadOpenPlayId()).toBeNull()
    expect(loadPlayState(id)?.inspiration).toBe(true)
  })

  it('ignora (e limpa) a marca de uma ficha que não existe mais', async () => {
    saveOpenPlayId('sumiu')
    const { chars, play, app } = await reload()
    expect(chars.getState().view).not.toBe('play')
    expect(play.getState().characterId).toBeNull()
    expect(app.getState().activeSystemId).toBeNull()
    expect(loadOpenPlayId()).toBeNull()
  })
})

describe('salvamento automático a cada alteração (decisão de 2026-10-26)', () => {
  const stored = (id: string) => loadLibrary().find(c => c.id === id)
  /** Abre uma ficha que já está na biblioteca e devolve o id dela. */
  const openSaved = (name = 'Krusk') => {
    useCharacterStore.getState().importDraft({ ...structuredClone(COMPLETE_DRAFT), name })
    return useCharacterStore.getState().currentId!
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('grava a alteração depois da espera, sem precisar navegar, e a galeria acompanha', () => {
    const id = openSaved()
    useCharacterStore.getState().setName('Krusk, o Breve')
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1)
    expect(stored(id)?.draft.name).toBe('Krusk')
    vi.advanceTimersByTime(1)
    expect(stored(id)?.draft.name).toBe('Krusk, o Breve')
    expect(stored(id)?.step).toBe('review')
    expect(useCharacterStore.getState().library.find(c => c.id === id)?.draft.name).toBe('Krusk, o Breve')
  })

  it('várias alterações em sequência viram uma gravação só', () => {
    const id = openSaved()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const store = useCharacterStore.getState()
    store.setName('K')
    vi.advanceTimersByTime(100)
    store.setName('Ku')
    vi.advanceTimersByTime(100)
    store.setLevel(5)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1)
    expect(setItem).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(stored(id)?.draft).toMatchObject({ name: 'Ku', level: 5 })
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('setter que não muda o draft não grava; navegar grava na hora e descarta o timer', () => {
    openSaved()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    useCharacterStore.getState().addClass(COMPLETE_DRAFT.class!) // a primária não se repete: nada muda
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(setItem).not.toHaveBeenCalled()

    useCharacterStore.getState().setName('Krusk II')
    useCharacterStore.getState().goToStep('name')
    expect(setItem).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('ficha nova sem nome não vira entrada na galeria; com nome, passa a existir', () => {
    useCharacterStore.getState().setLevel(3)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(loadLibrary()).toEqual([])
    expect(useCharacterStore.getState().library).toEqual([])

    useCharacterStore.getState().setName('Conan')
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    const id = useCharacterStore.getState().currentId!
    expect(stored(id)?.draft).toMatchObject({ name: 'Conan', level: 3 })
    expect(stored(id)?.step).toBe('name')
  })

  it('percorrer o wizard em branco não deixa "(sem nome)" na galeria', () => {
    const { nextStep, goToStep, prevStep, goToGallery } = useCharacterStore.getState()
    nextStep()
    goToStep('background')
    prevStep()
    expect(useCharacterStore.getState().currentStep).toBe('spells')
    goToGallery()
    expect(loadLibrary()).toEqual([])
    expect(useCharacterStore.getState().library).toEqual([])
  })

  it('ficha nova sem nome, mas com uma escolha, é guardada', () => {
    useCharacterStore.getState().setRace('half-orc')
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    const id = useCharacterStore.getState().currentId!
    expect(stored(id)?.draft).toMatchObject({ name: '', race: 'half-orc' })

    useCharacterStore.getState().newCharacter()
    useCharacterStore.getState().setRace('elf')
    useCharacterStore.getState().nextStep() // a navegação também grava
    expect(loadLibrary().map(c => c.draft.race).sort()).toEqual(['elf', 'half-orc'])
  })

  it('trocar de ficha grava a pendente na ficha certa — o timer não escreve na outra', () => {
    const idA = openSaved('Alda')
    const idB = openSaved('Bento')
    useCharacterStore.getState().openCharacter(idA)
    useCharacterStore.getState().setName('Alda, a Breve')
    const bBefore = stored(idB)

    useCharacterStore.getState().openCharacter(idB) // antes da espera acabar
    expect(stored(idA)?.draft.name).toBe('Alda, a Breve')
    expect(useCharacterStore.getState().draft.name).toBe('Bento')

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(stored(idB)).toEqual(bBefore)
    expect(stored(idA)?.draft.name).toBe('Alda, a Breve')
  })

  it('ficha nova ou volta à galeria também gravam a pendente antes de trocar', () => {
    const id = openSaved()
    useCharacterStore.getState().setLevel(7)
    useCharacterStore.getState().newCharacter()
    expect(stored(id)?.draft.level).toBe(7)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(loadLibrary()).toHaveLength(1) // a ficha em branco não entrou

    useCharacterStore.getState().openCharacter(id)
    useCharacterStore.getState().setName('') // sem nome, a galeria sozinha não gravaria
    useCharacterStore.getState().goToGallery()
    expect(stored(id)?.draft.name).toBe('')
  })

  it('excluir a ficha aberta descarta a gravação pendente (não a recria)', () => {
    const id = openSaved()
    useCharacterStore.getState().setName('Fantasma')
    useCharacterStore.getState().deleteCharacter(id)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(stored(id)).toBeUndefined()
    expect(loadLibrary()).toEqual([])
  })

  it('fechar ou esconder a aba grava na hora, sem esperar o timer', () => {
    const id = openSaved()
    useCharacterStore.getState().setName('Último clique')
    window.dispatchEvent(new Event('pagehide'))
    expect(stored(id)?.draft.name).toBe('Último clique')

    useCharacterStore.getState().setName('Aba escondida')
    hidePage()
    expect(stored(id)?.draft.name).toBe('Aba escondida')
  })

  it('o modo de jogo não regrava a ficha: fechar ou esconder a aba no jogo, ou depois de sair, não toca a biblioteca', () => {
    const id = openSaved()
    useCharacterStore.getState().setName('Krusk, o Breve')
    useCharacterStore.getState().playCharacter(id) // a pendente vai para a ficha antes do jogo
    expect(stored(id)?.draft.name).toBe('Krusk, o Breve')
    const before = localStorage.getItem(LIBRARY_KEY)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    // O jogo grava no estado de jogo (playStore/playStorage), nunca num setter de draft.
    usePlayStore.getState().run(st => setInspiration(st, true))
    window.dispatchEvent(new Event('pagehide'))
    hidePage()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(libraryWrites(setItem)).toBe(0)
    expect(loadPlayState(id)?.inspiration).toBe(true)

    useCharacterStore.getState().exitPlay()
    window.dispatchEvent(new Event('pagehide'))
    hidePage()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(libraryWrites(setItem)).toBe(0)
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(before)
  })

  it('abrir outra ficha no modo de jogo grava a pendente na ficha que estava aberta', () => {
    const idA = openSaved('Alda')
    const idB = openSaved('Bento')
    useCharacterStore.getState().openCharacter(idA)
    useCharacterStore.getState().setName('Alda, a Breve')
    const bBefore = stored(idB)

    useCharacterStore.getState().playCharacter(idB)
    expect(stored(idA)?.draft.name).toBe('Alda, a Breve')
    expect(useCharacterStore.getState().draft.name).toBe('Bento')
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(stored(idB)).toEqual(bBefore)
    useCharacterStore.getState().exitPlay()
  })
})
