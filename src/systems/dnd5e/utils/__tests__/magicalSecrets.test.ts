import { describe, it, expect } from 'vitest'
import {
  getCasterEntries,
  getCantripColumn,
  getSpellColumn,
  describeSecretsInColumn,
  getSpellChoiceOverflow,
  getSpellChoiceOverflows,
  getCantripChoiceOverflow,
  getMaxSpellLevel,
  getSpell,
} from '../spellUtils'
import { isStepComplete } from '../draftValidation'
import { getSecretSpellOptions } from '../progressionOptions'
import { getFinalAbilityScores } from '../asiUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'

// Segredos Mágicos do bardo (p. 54) "já estão incluídos no número da coluna Magias Conhecidas":
// ocupam vaga em vez de somar por cima. Decisão do usuário: Segredo truque ocupa vaga de Truques
// Conhecidos. Os Adicionais do Colégio do Conhecimento (p. 55) continuam por cima.

const BARD_CANTRIPS = ['friends', 'true-strike', 'mending', 'dancing-lights']
const BARD_SPELLS = [
  'calm-emotions', 'animal-friendship', 'plant-growth', 'planar-binding', 'animate-objects',
  'enhance-ability', 'knock', 'magic-mouth', 'enthrall', 'blindness-deafness',
  'teleportation-circle', 'clairvoyance', 'comprehend-languages', 'compulsion',
]

function bard10(opts: {
  subclass: string
  cantrips: string[]
  spells: string[]
  progressionChoices: Record<string, string[]>
}): CharacterDraft {
  return {
    ...structuredClone(EMPTY_DRAFT),
    class: 'bard',
    level: 10,
    abilityScores: { STR: 10, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 16 },
    classChoices: {
      ...structuredClone(EMPTY_DRAFT.classChoices),
      subclass: opts.subclass,
      progressionChoices: opts.progressionChoices,
    },
    spellChoices: { cantrips: opts.cantrips, spells: opts.spells },
  }
}

function columns(draft: CharacterDraft) {
  const [caster] = getCasterEntries(draft)
  const scores = getFinalAbilityScores(draft)
  return {
    caster,
    scores,
    cantrips: getCantripColumn(caster.casting, caster.entry.level, caster.entry.spellChoices, caster.knownSecrets),
    spells: getSpellColumn(caster.casting, caster.entry.level, scores, caster.entry.spellChoices, caster.knownSecrets),
  }
}

describe('Segredos Mágicos ocupam vaga das conhecidas (p. 54)', () => {
  it('bardo Bravura 10: 12 escolhidas + 2 Segredos = 14, a etapa fecha e não há excesso', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS.slice(0, 12),
      progressionChoices: { 'bard-magical-secrets-10': ['fireball', 'counterspell'] },
    })
    const { caster, scores, spells, cantrips } = columns(draft)
    expect(caster.knownSecrets).toEqual({ cantrips: [], spells: ['fireball', 'counterspell'] })
    expect(spells).toEqual({ total: 14, chosen: 12, fromSecrets: 2, toChoose: 12 })
    expect(describeSecretsInColumn(spells)).toBe('12 + 2 de Segredos Mágicos = 14')
    expect(cantrips.toChoose).toBe(4)
    expect(isStepComplete(draft, 'spells')).toBe(true)
    expect(getSpellChoiceOverflows(caster, scores)).toEqual([])
  })

  it('bardo Bravura 10 com só 11 escolhidas: falta uma', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS.slice(0, 11),
      progressionChoices: { 'bard-magical-secrets-10': ['fireball', 'counterspell'] },
    })
    expect(isStepComplete(draft, 'spells')).toBe(false)
  })

  it('bardo 10 com um Segredo truque e um magia: cada um desconta da sua coluna', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS.slice(0, 3),
      spells: BARD_SPELLS.slice(0, 13),
      progressionChoices: { 'bard-magical-secrets-10': ['fire-bolt', 'fireball'] },
    })
    const { caster, scores, cantrips, spells } = columns(draft)
    expect(caster.knownSecrets).toEqual({ cantrips: ['fire-bolt'], spells: ['fireball'] })
    expect(cantrips).toEqual({ total: 4, chosen: 3, fromSecrets: 1, toChoose: 3 })
    expect(spells).toEqual({ total: 14, chosen: 13, fromSecrets: 1, toChoose: 13 })
    expect(describeSecretsInColumn(cantrips)).toBe('3 + 1 de Segredos Mágicos = 4')
    expect(isStepComplete(draft, 'spells')).toBe(true)
    expect(getSpellChoiceOverflows(caster, scores)).toEqual([])

    // Um truque a menos ou uma magia a menos: a etapa não fecha.
    expect(isStepComplete({ ...draft, spellChoices: { cantrips: BARD_CANTRIPS.slice(0, 2), spells: BARD_SPELLS.slice(0, 13) } }, 'spells')).toBe(false)
    expect(isStepComplete({ ...draft, spellChoices: { cantrips: BARD_CANTRIPS.slice(0, 3), spells: BARD_SPELLS.slice(0, 12) } }, 'spells')).toBe(false)
  })

  it('Conhecimento 10: 12 + 2 Segredos, e os 2 Adicionais do 6° vêm por cima (p. 55)', () => {
    const draft = bard10({
      subclass: 'college-of-lore',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS.slice(0, 12),
      progressionChoices: {
        'lore-magical-secrets-6': ['revivify', 'haste'],
        'bard-magical-secrets-10': ['fireball', 'counterspell'],
      },
    })
    const { caster, scores, spells } = columns(draft)
    expect(caster.bonusSpells).toEqual(['revivify', 'haste', 'fireball', 'counterspell'])
    expect(caster.knownSecrets.spells).toEqual(['fireball', 'counterspell'])
    expect(spells).toEqual({ total: 14, chosen: 12, fromSecrets: 2, toChoose: 12 })
    expect(isStepComplete(draft, 'spells')).toBe(true)
    expect(getSpellChoiceOverflows(caster, scores)).toEqual([])
  })

  it('bardo 10 salvo com 14 + 2 (o número antigo): aviso de excesso dizendo o que desmarcar, nada apagado', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS,
      progressionChoices: { 'bard-magical-secrets-10': ['fireball', 'counterspell'] },
    })
    const { caster, scores } = columns(draft)
    const overflow = getSpellChoiceOverflow(caster, scores)
    expect(caster.spells).toHaveLength(14)
    expect(overflow).toMatchObject({ label: 'Bardo', chosen: 16, max: 14, excess: 2, fromSecrets: 2 })
    expect(overflow?.text).toContain('14 magias conhecidas escolhidas + 2 de Segredos Mágicos = 16')
    expect(overflow?.text).toContain('desmarque 2 das 14 escolhidas na etapa Magias')
    expect(overflow?.text).toContain('(fica 12 + 2 = 14)')
  })

  it('Segredo truque em ficha antiga com os 4 truques: aviso na coluna de truques', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS.slice(0, 13),
      progressionChoices: { 'bard-magical-secrets-10': ['fire-bolt', 'fireball'] },
    })
    const { caster } = columns(draft)
    const overflow = getCantripChoiceOverflow(caster)
    expect(overflow).toMatchObject({ chosen: 5, max: 4, excess: 1, fromSecrets: 1 })
    expect(overflow?.text).toContain('desmarque um dos 4 escolhidos na etapa Magias')
  })

  it('Segredo que repete uma magia já escolhida não ocupa duas vagas', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS.slice(0, 13),
      progressionChoices: { 'bard-magical-secrets-10': [BARD_SPELLS[0], 'fireball'] },
    })
    const { spells } = columns(draft)
    expect(spells).toEqual({ total: 14, chosen: 13, fromSecrets: 1, toChoose: 13 })
    expect(isStepComplete(draft, 'spells')).toBe(true)
  })
})

describe('seletor de Segredos Mágicos: nível que o bardo conjura, ou truque (pp. 54-55)', () => {
  it('bardo 10 conjura até o 5°: oferece truques e até 5°, nada de 6° em diante', () => {
    expect(getMaxSpellLevel('bard', 10)).toBe(5)
    const options = getSecretSpellOptions(5)
    const levels = new Set(options.map(o => getSpell(o.id)!.level))
    expect(levels.has(0)).toBe(true)
    expect(levels.has(5)).toBe(true)
    expect([...levels].some(l => l > 5)).toBe(false)
  })

  it('escolha antiga acima do limite fica na lista, sinalizada, para dar pra desmarcar', () => {
    const options = getSecretSpellOptions(3, ['wish'])
    const wish = options.find(o => o.id === 'wish')
    expect(wish?.description).toContain('acima do 3º nível')
    expect(options.some(o => o.id === 'meteor-swarm')).toBe(false)
  })
})
