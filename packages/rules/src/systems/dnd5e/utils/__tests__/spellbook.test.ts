import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import type { ClassChoiceSelections } from '../../types/class'
import { buildPlaySheet } from '../playSheet'
import { createPlayState } from '../playState'
import { getRollGuide } from '../rollGuide'
import { getKnownSpells } from '../sheetModel'
import { findSpellbookEntry, getPlaySpellbook, SPELLBOOK_PREPARATION_NOTE } from '../spellbook'
import { getClass } from '../classUtils'
import { canCastAsRitual, castingTimeKind, describeCastingAids, SPELLS } from '../spellUtils'

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), ...overrides }
}

const choices = (c: Partial<ClassChoiceSelections> = {}): ClassChoiceSelections =>
  ({ ...structuredClone(EMPTY_DRAFT.classChoices), ...c })

const SCORES = { STR: 10, DEX: 14, CON: 14, INT: 16, WIS: 16, CHA: 16 }

const caster = (classId: string, level: number, cantrips: string[], spells: string[], extra: Partial<CharacterDraft> = {}) => draft({
  class: classId, level, abilityScores: SCORES, classChoices: choices(), spellChoices: { cantrips, spells }, ...extra,
})

const entry = (d: CharacterDraft, key: string, spellId: string) => findSpellbookEntry(getPlaySpellbook(d), key, spellId)?.entry

describe('grimório: o ritual pela regra de cada classe (págs. 53, 65, 73, 96, 203-204)', () => {
  it('o mago faz ritual de qualquer magia do grimório, sem preparar, e a lista diz que o app não sabe as preparadas', () => {
    const wizard = caster('wizard', 3, ['fire-bolt'], ['detect-magic', 'magic-missile', 'identify'])
    const [list] = getPlaySpellbook(wizard)
    expect(list).toMatchObject({ key: 'class:wizard', kind: 'class', ritualRule: 'spellbook', note: SPELLBOOK_PREPARATION_NOTE })
    expect(entry(wizard, 'class:wizard', 'detect-magic')).toMatchObject({ status: 'inSpellbook', ritual: true })
    expect(entry(wizard, 'class:wizard', 'identify')).toMatchObject({ status: 'inSpellbook', ritual: true })
    // Sem o descritor ritual, só pelas regras normais.
    expect(entry(wizard, 'class:wizard', 'magic-missile')).toMatchObject({ status: 'inSpellbook', ritual: false })
    expect(entry(wizard, 'class:wizard', 'fire-bolt')).toMatchObject({ status: 'cantrip', free: true, ritual: false })
  })

  it('o clérigo faz ritual só das preparadas (pelo inglês): a que não preparou nem está no grimório', () => {
    const cleric = caster('cleric', 3, ['sacred-flame'], ['detect-magic', 'cure-wounds'])
    expect(entry(cleric, 'class:cleric', 'detect-magic')).toMatchObject({ status: 'prepared', ritual: true })
    expect(entry(cleric, 'class:cleric', 'cure-wounds')).toMatchObject({ status: 'prepared', ritual: false })
    // Purificar Alimentos é ritual de clérigo, mas não foi preparada.
    expect(entry(cleric, 'class:cleric', 'purify-food-and-drink')).toBeUndefined()
    // A mesma regra da Revisão: uma só.
    expect(describeCastingAids(getClass('cleric')!.spellcasting!).ritual).toContain('preparadas')
    expect(canCastAsRitual('prepared', 'known', { ritual: true })).toBe(false)
  })

  it('o bardo faz ritual das conhecidas; o feiticeiro, sem a característica, não faz ritual', () => {
    const bard = caster('bard', 3, ['vicious-mockery'], ['comprehend-languages', 'healing-word'])
    expect(entry(bard, 'class:bard', 'comprehend-languages')).toMatchObject({ status: 'known', ritual: true })
    const sorcerer = caster('sorcerer', 3, ['fire-bolt'], ['comprehend-languages'])
    expect(getPlaySpellbook(sorcerer)[0].ritualRule).toBeNull()
    expect(entry(sorcerer, 'class:sorcerer', 'comprehend-languages')).toMatchObject({ status: 'known', ritual: false })
  })

  it('o Pacto da Corrente deixa convocar familiar ir como ritual (pág. 58); as outras magias do bruxo, não', () => {
    const warlock = caster('warlock', 3, ['eldritch-blast'], ['comprehend-languages'], {
      classChoices: choices({ subclass: 'fiend', progressionChoices: { 'warlock-pact-boon-3': ['pact-of-the-chain'] } }),
    })
    const [list] = getPlaySpellbook(warlock)
    expect(list.ritualRule).toBeNull()
    expect(entry(warlock, 'class:warlock', 'find-familiar')).toMatchObject({ status: 'known', origin: 'Pacto da Corrente', ritual: true, pactLevel: 2 })
    expect(entry(warlock, 'class:warlock', 'comprehend-languages')).toMatchObject({ ritual: false })
  })

  it('na multiclasse, cada classe faz ritual só das magias dela (pág. 166)', () => {
    const d = caster('wizard', 2, [], ['detect-magic'], {
      additionalClasses: [{
        classId: 'sorcerer', level: 1, classChoices: choices(), spellChoices: { cantrips: ['fire-bolt'], spells: ['comprehend-languages'] },
        asiChoices: [], hpRolls: [],
      }],
      multiclass: true,
    })
    expect(entry(d, 'class:wizard', 'detect-magic')?.ritual).toBe(true)
    expect(entry(d, 'class:sorcerer', 'comprehend-languages')?.ritual).toBe(false)
  })
})

describe('grimório: os espaços que servem', () => {
  it('multiclasse usa espaço acima do que conhece: patrulheiro 4 / mago 3 tem espaços de 3º nível para a magia de 1º (linhas 14828-14837)', () => {
    const d = caster('ranger', 7, [], ['cure-wounds'], {
      additionalClasses: [{
        classId: 'wizard', level: 3, classChoices: choices(), spellChoices: { cantrips: ['fire-bolt'], spells: ['magic-missile'] },
        asiChoices: [], hpRolls: [],
      }],
      multiclass: true,
    })
    // O exemplo do livro: personagem de 5º nível na tabela Multiclasse para Conjurador (4, 3 e 2).
    expect(buildPlaySheet(d).spellSlots.slice(0, 3)).toEqual([4, 3, 2])
    expect(entry(d, 'class:wizard', 'magic-missile')?.slotLevels).toEqual([1, 2, 3])
    expect(entry(d, 'class:ranger', 'cure-wounds')?.slotLevels).toEqual([1, 2, 3])
    expect(entry(d, 'class:wizard', 'magic-missile')?.pactLevel).toBeNull()
  })

  it('com Conjuração e Magia de Pacto, os dois servem às magias das duas (linhas 14845-14851); o bruxo sozinho só tem o Pacto', () => {
    const d = caster('warlock', 5, ['eldritch-blast'], ['hellish-rebuke'], {
      additionalClasses: [{
        classId: 'wizard', level: 2, classChoices: choices(), spellChoices: { cantrips: [], spells: ['magic-missile'] },
        asiChoices: [], hpRolls: [],
      }],
      multiclass: true,
    })
    expect(entry(d, 'class:warlock', 'hellish-rebuke')).toMatchObject({ slotLevels: [1], pactLevel: 2 })
    expect(entry(d, 'class:wizard', 'magic-missile')).toMatchObject({ slotLevels: [1], pactLevel: 2 })
    const warlock = caster('warlock', 5, ['eldritch-blast'], ['hellish-rebuke'])
    expect(entry(warlock, 'class:warlock', 'hellish-rebuke')).toMatchObject({ slotLevels: [], pactLevel: 3, free: false })
  })

  it('o Iniciado em Magia: os truques à vontade e a magia de 1º nível pelo uso do talento, no 1º nível (pág. 170)', () => {
    const d = draft({
      class: 'fighter', level: 4, abilityScores: SCORES, classChoices: choices(),
      asiChoices: [{ kind: 'feat', featId: 'iniciado-em-magia' }],
      featSelections: { 'iniciado-em-magia': { spellClass: 'cleric', cantrips: ['sacred-flame', 'guidance'], spells: ['cure-wounds'] } },
    })
    const [list] = getPlaySpellbook(d)
    expect(list).toMatchObject({ key: 'feat:iniciado-em-magia', kind: 'feat', ritualRule: null })
    expect(entry(d, 'feat:iniciado-em-magia', 'sacred-flame')).toMatchObject({ status: 'cantrip', free: true })
    expect(entry(d, 'feat:iniciado-em-magia', 'cure-wounds')).toMatchObject({
      status: 'perRest', resourceId: 'magic-initiate-spell', castLevel: 1, slotLevels: [], pactLevel: null, free: false,
    })
  })

  it('o tiferino: a taumaturgia à vontade e a repreensão infernal no 2º nível, uma vez por descanso longo, que o app ainda não conta', () => {
    const d = draft({ class: 'fighter', race: 'tiefling', level: 3, abilityScores: SCORES, classChoices: choices() })
    const [list] = getPlaySpellbook(d)
    expect(list).toMatchObject({ key: 'race:tiefling', kind: 'race', label: 'Tiefling' })
    expect(entry(d, 'race:tiefling', 'thaumaturgy')).toMatchObject({ status: 'cantrip', origin: 'da raça', free: true })
    expect(entry(d, 'race:tiefling', 'hellish-rebuke')).toMatchObject({ status: 'perRest', castLevel: 2, free: true })
    expect(entry(d, 'race:tiefling', 'hellish-rebuke')?.note).toContain('o app ainda não conta esse uso')
  })

  // Decisão de 2026-10-31: cada fonte de fora da classe e do talento é uma conjuração, com a chave
  // da CD e do ataque no guia de rolagens — a raça e o truque de cada subclasse.
  it('o Alto Elfo e o Domínio da Natureza: uma lista por conjuração, com a chave do guia de rolagens', () => {
    const d = draft({
      class: 'cleric', race: 'elf', subrace: 'high-elf', level: 1, abilityScores: SCORES,
      raceChoices: { cantrip: 'fire-bolt' },
      classChoices: choices({ subclass: 'nature-domain', subclassExtras: { cantrip: 'shillelagh' } }),
      spellChoices: { cantrips: ['sacred-flame', 'guidance', 'light'], spells: ['bless'] },
    })
    const book = getPlaySpellbook(d)
    expect(book.map(l => [l.key, l.kind, l.label, l.spells.map(s => s.spellId)])).toEqual([
      ['class:cleric', 'class', 'Clérigo', ['sacred-flame', 'guidance', 'light', 'bless']],
      ['race:elf', 'race', 'Alto Elfo', ['fire-bolt']],
      ['subclass:nature-domain', 'subclass', 'Domínio da Natureza', ['shillelagh']],
    ])
    expect(entry(d, 'subclass:nature-domain', 'shillelagh')).toMatchObject({ status: 'cantrip', origin: 'de Domínio da Natureza', free: true })
    expect(getRollGuide(d, createPlayState('')).spellcasting.map(s => s.key)).toEqual(book.map(l => l.key))
  })
})

describe('grimório: a mesma lista da aba Regras', () => {
  it('cada conjuração tem as magias de getKnownSpells, nem uma a mais', () => {
    const d = caster('bard', 10, ['vicious-mockery', 'minor-illusion', 'light'], ['healing-word', 'comprehend-languages'], {
      race: 'tiefling',
      asiChoices: [{ kind: 'feat', featId: 'iniciado-em-magia' }],
      featSelections: { 'iniciado-em-magia': { spellClass: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], spells: ['shield'] } },
    })
    const known = getKnownSpells(d)
    const book = getPlaySpellbook(d)
    const ids = (key: string) => book.find(l => l.key === key)?.spells.map(s => s.spellId)
    expect(ids('class:bard')).toEqual(known.classes[0].spells.map(s => s.spell.id))
    expect(ids('feat:iniciado-em-magia')).toEqual([...known.feats[0].cantrips, ...known.feats[0].spells].map(s => s.id))
    expect(ids('race:tiefling')).toEqual(known.innate.map(s => s.spell.id))
    expect(buildPlaySheet(d).spellbook).toEqual(book)
  })

  it('quem não conjura não tem grimório', () => {
    expect(getPlaySpellbook(draft({ class: 'fighter', race: 'human', level: 3, abilityScores: SCORES, classChoices: choices() }))).toEqual([])
  })
})

describe('castingTimeKind', () => {
  // Os 13 valores de spells.json (regras-conjuracao.md, seção 5): um valor novo falha aqui.
  const EXPECTED: Record<string, ReturnType<typeof castingTimeKind>> = {
    '1 ação': 'action',
    '1 ação bônus': 'bonusAction',
    '1 ação ou 8 horas': 'action',
    '1 reação, que você realiza quando vê uma criatura a até 18 metros conjurando uma magia': 'reaction',
    '1 reação, que você faz quando é atingido por um ataque ou alvo da magia mísseis mágicos': 'reaction',
    '1 reação, que você realiza quando você ou uma criatura a até 18 metros cair': 'reaction',
    '1 reação, que você faz em resposta ao sofre dano de uma criatura a até 18 metros de você e que você possa ver': 'reaction',
    '1 minuto': 'longer',
    '10 minutos': 'longer',
    '1 hora': 'longer',
    '8 horas': 'longer',
    '12 horas': 'longer',
    '24 horas': 'longer',
  }

  it('cobre os 13 valores de castingTime', () => {
    const values = [...new Set(SPELLS.map(s => s.castingTime))].sort()
    expect(values).toEqual(Object.keys(EXPECTED).sort())
    for (const [castingTime, kind] of Object.entries(EXPECTED)) expect(castingTimeKind({ castingTime })).toBe(kind)
  })
})
