import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft, type FeatSelections } from '../../types/character'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { getCharacterFeats, getRepeatedFeatSlots } from '../asiUtils'
import { canPlayDraft, getMissingSteps, isStepComplete, sanitizeImportedDraft } from '../draftValidation'
import { getStepPendingReasons } from '../pendingReasons'
import { createPlayState } from '../playState'
import { getChosenDamageTypeSpellNotes, getFeatChoiceSlots, isFeatChoiceComplete } from '../sheetEffects'
import { getSpellGuide } from '../spellGuide'

// Adepto Elemental (pág. 167, linhas 14901-14913): "escolha um dos tipos de dano a seguir: ácido,
// elétrico, fogo, frio ou trovão. As magias que você conjurar ignoram resistência a dano do tipo
// escolhido. Além disso, [...] você pode tratar qualquer 1 num dado de dano como um 2." Decisão do
// dono de 2026-10-31: a escolha abre no criador, como slot do talento; o app guarda cada talento uma
// vez só, então é uma escolha.

const FEAT = 'adepto-elemental'

/** Mago 4 (Raio de Fogo, Raio de Gelo, Luz) com o Adepto Elemental no espaço de ASI do 4º nível. */
function wizard(selections?: FeatSelections): CharacterDraft {
  return {
    ...structuredClone(EMPTY_DRAFT),
    race: 'human',
    class: 'wizard',
    level: 4,
    abilityScores: { STR: 8, DEX: 14, CON: 13, INT: 16, WIS: 12, CHA: 10 },
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['arcana', 'history'] },
    spellChoices: { cantrips: ['fire-bolt', 'ray-of-frost', 'light'], spells: ['sleep', 'shield'] },
    asiChoices: [{ kind: 'feat', featId: FEAT }],
    featSelections: selections ? { [FEAT]: selections } : {},
  }
}

const NOTE = 'a magia ignora a resistência a esse tipo de dano, e você pode tratar o 1 em cada dado de dano dele como 2 (pág. 167).'

describe('Adepto Elemental: a escolha do tipo de dano', () => {
  it('abre o slot com os cinco tipos do livro, e o talento só fica completo com um deles', () => {
    const [slot] = getFeatChoiceSlots(wizard())
    expect(slot.feat.id).toBe(FEAT)
    expect(slot.choices.damageTypeChoice).toEqual({ from: ['acid', 'lightning', 'fire', 'cold', 'thunder'] })
    expect(isFeatChoiceComplete(slot)).toBe(false)
    expect(isFeatChoiceComplete(getFeatChoiceSlots(wizard({ damageType: 'fire' }))[0])).toBe(true)
    // Fora da lista do talento não vale (ficha editada à mão).
    expect(isFeatChoiceComplete(getFeatChoiceSlots(wizard({ damageType: 'poison' }))[0])).toBe(false)
  })

  it('sem o tipo, a etapa Aprimoramentos fica pendente e diz o que falta', () => {
    expect(isStepComplete(wizard(), 'improvements')).toBe(false)
    expect(getStepPendingReasons(wizard(), 'improvements')).toContainEqual(expect.stringContaining('talento Adepto Elemental: escolha o tipo de dano'))
    expect(isStepComplete(wizard({ damageType: 'cold' }), 'improvements')).toBe(true)
    expect(getStepPendingReasons(wizard({ damageType: 'cold' }), 'improvements')).toEqual([])
  })

  // "Você pode escolher esse talento diversas vezes. A cada vez que o fizer, você deve escolher um
  // tipo diferente de dano" (linhas 14911-14913). A ficha guarda o talento uma vez só, com um tipo:
  // o segundo espaço sumia em silêncio (getOwnedFeats junta os dois). Agora a etapa trava e diz.
  it('em dois Incrementos, a etapa trava: o livro deixa, mas a ficha guarda um tipo só', () => {
    const twice: CharacterDraft = {
      ...wizard({ damageType: 'fire' }), level: 8,
      asiChoices: [{ kind: 'feat', featId: FEAT }, { kind: 'feat', featId: FEAT }],
    }
    expect(getRepeatedFeatSlots(twice)).toEqual([{ classId: 'wizard', slot: 1, featId: FEAT }])
    expect(isStepComplete(twice, 'improvements')).toBe(false)
    expect(getStepPendingReasons(twice, 'improvements')).toEqual([
      'Incremento do 8º nível: Adepto Elemental já está na ficha — o livro deixa repetir este talento (p. 167), mas a ficha guarda cada talento uma vez só; troque por outro',
    ])
    const other: CharacterDraft = { ...twice, asiChoices: [{ kind: 'feat', featId: FEAT }, { kind: 'asi', abilities: ['INT', 'INT'] }] }
    expect(getRepeatedFeatSlots(other)).toEqual([])
    expect(isStepComplete(other, 'improvements')).toBe(true)
  })

  // A ficha completa salva antes da leva não tem o tipo: a etapa fica pendente, e o "Jogar" da
  // galeria e a volta ao jogo ao recarregar (canPlayDraft) esperam a escolha — a regra de toda
  // pendência (decisão de 2026-10-28), como a perícia repetida da ficha antiga.
  it('a ficha salva sem o tipo sai do jogo até a escolha (canPlayDraft)', () => {
    const cleric = (selections?: FeatSelections): CharacterDraft => ({
      ...structuredClone(COMPLETE_DRAFT), class: 'cleric', level: 4,
      abilityScores: { STR: 14, DEX: 10, CON: 13, INT: 8, WIS: 15, CHA: 12 },
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['history', 'insight'], subclass: 'light-domain' },
      spellChoices: { cantrips: ['sacred-flame', 'guidance', 'spare-the-dying', 'thaumaturgy'], spells: ['cure-wounds', 'bless'] },
      asiChoices: [{ kind: 'feat', featId: FEAT }],
      featSelections: selections ? { [FEAT]: selections } : {},
    })
    expect(getMissingSteps(cleric())).toEqual(['improvements'])
    expect(canPlayDraft(cleric())).toBe(false)
    expect(canPlayDraft(cleric({ damageType: 'thunder' }))).toBe(true)
  })

  it('a ficha importada guarda só um tipo que o talento oferece', () => {
    const imported = (damageType: unknown) =>
      sanitizeImportedDraft({ ...wizard(), featSelections: { [FEAT]: { damageType } } })?.featSelections[FEAT]
    expect(imported('thunder')).toEqual({ damageType: 'thunder' })
    expect(imported('poison')).toBeUndefined()
    expect(imported('qualquer')).toBeUndefined()
  })

  it('a Revisão, o PDF e a aba Regras mostram o tipo ao lado do talento (getCharacterFeats)', () => {
    expect(getCharacterFeats(wizard({ damageType: 'fire' }))).toMatchObject([
      { feat: { id: FEAT }, chosen: 'fogo', chosenLabel: 'Tipo de dano' },
    ])
    expect(getCharacterFeats(wizard())[0].chosen).toBeUndefined()
  })
})

describe('Adepto Elemental: a nota condicional no dano das magias do tipo escolhido', () => {
  const guide = (selections: FeatSelections | undefined, spellId: string) =>
    getSpellGuide(wizard(selections), createPlayState(''), { casterKey: 'class:wizard', spellId })!

  it('a nota diz o tipo escolhido, no dano do Raio de Fogo (fogo) e não no do Raio de Gelo (frio)', () => {
    expect(getChosenDamageTypeSpellNotes(wizard({ damageType: 'fire' }))).toEqual([{ source: 'Adepto Elemental', damageType: 'fire', text: NOTE }])
    const fire = guide({ damageType: 'fire' }, 'fire-bolt')
    expect(fire.damage[0].notes).toContain(`Adepto Elemental (fogo): ${NOTE}`)
    expect(fire.notes).toContain(`Adepto Elemental (fogo): ${NOTE}`)
    const frost = guide({ damageType: 'fire' }, 'ray-of-frost')
    expect(frost.notes.some(n => n.startsWith('Adepto Elemental'))).toBe(false)
    expect(guide({ damageType: 'cold' }, 'ray-of-frost').damage[0].notes).toContain(`Adepto Elemental (frio): ${NOTE}`)
  })

  it('sem o tipo escolhido, não há nota: o guia não sabe em que dano ela vale', () => {
    expect(getChosenDamageTypeSpellNotes(wizard())).toEqual([])
    expect(guide(undefined, 'fire-bolt').notes.some(n => n.startsWith('Adepto Elemental'))).toBe(false)
  })
})
