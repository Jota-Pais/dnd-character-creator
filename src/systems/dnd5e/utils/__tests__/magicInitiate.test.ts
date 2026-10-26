import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft, type FeatSelections } from '../../types/character'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { isStepComplete, sanitizeImportedDraft } from '../draftValidation'
import { getStepPendingReasons } from '../pendingReasons'
import { getFeatChoiceSlots, getFeatSpellChoiceGaps, getSheetResources, isFeatChoiceComplete } from '../sheetEffects'
import {
  getFeatSpellBlocks, getFeatSpellcastingAbility, getFeatSpellOptions, getFeatSpellPicks, getRepeatedSpells,
  getSpellSources, formatRepeatedSpell,
} from '../spellUtils'
import { getFinalAbilityScores } from '../asiUtils'
import { formatResourceLine } from '../classResourceUtils'

// Talento Iniciado em Magia (p. 170): classe → 2 truques → 1 magia de 1º nível da lista dela,
// conjurada com o atributo daquela classe; a magia de 1º, uma vez por descanso longo.

const FEAT = 'iniciado-em-magia'

/** Bárbaro meio-orc 4 com o Iniciado em Magia no espaço de ASI do 4º nível. */
function barbarian(selections?: FeatSelections): CharacterDraft {
  return {
    ...structuredClone(COMPLETE_DRAFT),
    level: 4,
    asiChoices: [{ kind: 'feat', featId: FEAT }],
    featSelections: selections ? { [FEAT]: selections } : {},
  }
}

/** Mago 4 (Raio de Fogo, Luz e Mãos Mágicas; Sono no grimório) com o talento no 4º nível. */
function wizard(selections?: FeatSelections): CharacterDraft {
  return {
    ...barbarian(selections),
    class: 'wizard',
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['arcana', 'history'] },
    spellChoices: { cantrips: ['fire-bolt', 'light', 'mage-hand'], spells: ['sleep', 'shield'] },
  }
}

const WIZARD_PICKS: FeatSelections = { spellClass: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], spells: ['sleep'] }

describe('Iniciado em Magia — o slot', () => {
  it('abre classe, dois truques e uma magia de 1º nível, das seis classes do livro', () => {
    const [slot] = getFeatChoiceSlots(barbarian())
    expect(slot.feat.id).toBe(FEAT)
    expect(slot.choices.spellChoice).toEqual({
      classes: ['bard', 'warlock', 'cleric', 'druid', 'sorcerer', 'wizard'], cantrips: 2, spells: 1, spellLevel: 1,
    })
    expect(isFeatChoiceComplete(slot)).toBe(false)
  })

  it('o atributo de conjuração é o da classe escolhida (CAR bardo/bruxo/feiticeiro, SAB clérigo/druida, INT mago)', () => {
    expect(['bard', 'warlock', 'sorcerer', 'cleric', 'druid', 'wizard'].map(c => getFeatSpellcastingAbility(c as never)))
      .toEqual(['CHA', 'CHA', 'CHA', 'WIS', 'WIS', 'INT'])
  })

  it('o catálogo é a lista da classe no nível pedido', () => {
    expect(getFeatSpellOptions('cleric', 0).map(s => s.id)).toContain('sacred-flame')
    expect(getFeatSpellOptions('cleric', 0).map(s => s.id)).not.toContain('fire-bolt')
    expect(getFeatSpellOptions('wizard', 1).every(s => s.level === 1 && s.classes.includes('wizard'))).toBe(true)
  })

  it('sem classe, a etapa dona pede a classe', () => {
    const d = barbarian()
    expect(isStepComplete(d, 'improvements')).toBe(false)
    expect(getStepPendingReasons(d, 'improvements')).toEqual([
      expect.stringMatching(/talento Iniciado em Magia: escolha a classe de cuja lista vêm as magias$/),
    ])
  })

  it('com a classe, diz quantos truques e magias faltam', () => {
    const d = barbarian({ spellClass: 'wizard', cantrips: ['fire-bolt'] })
    expect(getFeatSpellChoiceGaps(getFeatChoiceSlots(d)[0])).toEqual({ needsClass: false, cantrips: 1, spells: 1, spellLevel: 1 })
    expect(getStepPendingReasons(d, 'improvements')).toEqual([
      expect.stringMatching(/talento Iniciado em Magia: escolha 1 truque e 1 magia de 1º nível$/),
    ])
  })

  it('classe, dois truques e a magia completam o talento', () => {
    const d = barbarian(WIZARD_PICKS)
    expect(isFeatChoiceComplete(getFeatChoiceSlots(d)[0])).toBe(true)
    expect(isStepComplete(d, 'improvements')).toBe(true)
    expect(getStepPendingReasons(d, 'improvements')).toEqual([])
  })

  it('magia de outra lista ou de outro nível não preenche (Curar Ferimentos não é de mago)', () => {
    const picks = getFeatSpellPicks(
      { classes: ['wizard'], cantrips: 2, spells: 1, spellLevel: 1 },
      { spellClass: 'wizard', cantrips: ['fire-bolt', 'sacred-flame', 'sleep'], spells: ['cure-wounds', 'fire-bolt'] },
    )
    expect(picks).toEqual({ spellClass: 'wizard', cantrips: ['fire-bolt'], spells: [] })
    expect(isStepComplete(barbarian({ spellClass: 'wizard', cantrips: ['fire-bolt', 'light'], spells: ['cure-wounds'] }), 'improvements')).toBe(false)
  })

  it('classe fora do talento (paladino) não vale', () => {
    const d = barbarian({ spellClass: 'paladin', cantrips: [], spells: ['cure-wounds'] })
    expect(getFeatSpellChoiceGaps(getFeatChoiceSlots(d)[0])?.needsClass).toBe(true)
  })

  it('pelo Humano Variante, a pendência fica na etapa Raça', () => {
    const d: CharacterDraft = {
      ...structuredClone(COMPLETE_DRAFT),
      race: 'human', subrace: 'variant-human',
      raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['athletics'], languages: ['elvish'], feat: FEAT },
    }
    expect(getStepPendingReasons(d, 'race')).toEqual(['Humano (Variante), talento Iniciado em Magia: escolha a classe de cuja lista vêm as magias'])
    expect(isStepComplete({ ...d, featSelections: { [FEAT]: WIZARD_PICKS } }, 'race')).toBe(true)
  })
})

describe('Iniciado em Magia — na ficha', () => {
  it('não conjurador ganha bloco de magias com CD e ataque pelo atributo da classe, com os atributos finais', () => {
    // Meio-orc: INT 12 (+1); proficiência +2 no 4º → CD 11, ataque +3.
    const d = barbarian(WIZARD_PICKS)
    const [block] = getFeatSpellBlocks(d, getFinalAbilityScores(d))
    expect(block).toMatchObject({ label: 'Iniciado em Magia (Mago)', ability: 'INT', saveDc: 11, attackBonus: '+3' })
    expect(block.cantrips.map(s => s.name)).toEqual(['Raio de Fogo', 'Mãos Mágicas'])
    expect(block.spells.map(s => s.name)).toEqual(['Sono'])
    expect(block.spellsTitle).toBe('1º nível — 1×/descanso longo, no menor nível possível')
  })

  it('clérigo usa Sabedoria (SAB 10 → CD 10, +2)', () => {
    const d = barbarian({ spellClass: 'cleric', cantrips: ['sacred-flame', 'guidance'], spells: ['cure-wounds'] })
    expect(getFeatSpellBlocks(d, getFinalAbilityScores(d))[0]).toMatchObject({ label: 'Iniciado em Magia (Clérigo)', ability: 'WIS', saveDc: 10, attackBonus: '+2' })
  })

  it('sem classe escolhida, nada sai na ficha', () => {
    const d = barbarian()
    expect(getFeatSpellBlocks(d, getFinalAbilityScores(d))).toEqual([])
  })

  it('o recurso de uso leva o nome da magia escolhida', () => {
    const d = barbarian(WIZARD_PICKS)
    const r = getSheetResources(d, getFinalAbilityScores(d)).find(x => x.id === 'magic-initiate-spell')!
    expect(r).toMatchObject({ name: 'Sono', uses: 1, recharge: 'long', source: { kind: 'feat', id: FEAT } })
    expect(formatResourceLine(r)).toBe('Sono — 1 uso ○ (recupera em descanso longo; conjurada pelo talento, no menor nível possível)')
  })

  it('sem a magia escolhida, o recurso fica com o nome genérico', () => {
    const d = barbarian({ spellClass: 'wizard' })
    expect(getSheetResources(d, getFinalAbilityScores(d)).find(x => x.id === 'magic-initiate-spell')?.name)
      .toBe('Magia de 1º nível do talento')
  })
})

describe('Iniciado em Magia — magia repetida', () => {
  it('truque do talento igual ao da classe vira aviso, com a fonte do talento', () => {
    const d = wizard(WIZARD_PICKS)
    expect(getSpellSources(d).find(s => s.key === `feat:${FEAT}`))
      .toMatchObject({ label: 'Iniciado em Magia (Mago)', classId: null, spellIds: ['fire-bolt', 'mage-hand'] })
    const repeated = getRepeatedSpells(d)
    expect(repeated.map(r => r.spellId)).toEqual(['fire-bolt', 'mage-hand'])
    expect(formatRepeatedSpell(repeated[0])).toMatch(/^Raio de Fogo aparece em Mago e Iniciado em Magia \(Mago\)\./)
  })

  it('a magia de 1º do talento igual à da classe não avisa: o uso por descanso longo não se repete', () => {
    const d = wizard({ spellClass: 'wizard', cantrips: ['ray-of-frost', 'prestidigitation'], spells: ['sleep'] })
    expect(getRepeatedSpells(d)).toEqual([])
  })

  it('o aviso não trava a etapa', () => {
    expect(isStepComplete(wizard(WIZARD_PICKS), 'improvements')).toBe(true)
  })
})

describe('Iniciado em Magia — importação', () => {
  it('classe do talento, truques e magia da lista dela, sem repetir e até o que o talento dá', () => {
    const raw = JSON.parse(JSON.stringify(barbarian()))
    raw.featSelections = {
      [FEAT]: { spellClass: 'wizard', cantrips: ['fire-bolt', 'fire-bolt', 'sacred-flame', 'light', 'mage-hand', 3], spells: ['cure-wounds', 'sleep', 'shield'] },
    }
    expect(sanitizeImportedDraft(raw)!.featSelections[FEAT]).toEqual({ spellClass: 'wizard', cantrips: ['fire-bolt', 'light'], spells: ['sleep'] })
  })

  it('classe fora do talento cai com as magias', () => {
    const raw = JSON.parse(JSON.stringify(barbarian()))
    raw.featSelections = { [FEAT]: { spellClass: 'paladin', spells: ['cure-wounds'] } }
    expect(sanitizeImportedDraft(raw)!.featSelections[FEAT]).toBeUndefined()
  })

  it('ficha antiga sem a escolha carrega e fica pendente', () => {
    const raw = JSON.parse(JSON.stringify(barbarian()))
    delete raw.featSelections
    const d = sanitizeImportedDraft(raw)!
    expect(d.featSelections).toEqual({})
    expect(isStepComplete(d, 'improvements')).toBe(false)
  })
})
