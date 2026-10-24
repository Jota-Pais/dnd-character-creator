import { describe, it, expect } from 'vitest'
import { getProgressionChoiceBlocks } from '../progressionOptions'
import { getProgressionSpellIds } from '../progressionChoiceUtils'
import { getCasterEntries } from '../spellUtils'
import { allClassEntries } from '../multiclassUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'

// Segredos Mágicos (bardo 10/14/18, p. 54; Colégio do Conhecimento 6, p. 55) são magias: a
// Revisão e a ficha imprimível mostram junto das magias do bardo, não nas Escolhas de Progressão
// (onde apareciam como "Bola de Fogo. Nível 3 (evocação) - sorcerer, wizard").

const loreBard10: CharacterDraft = {
  ...structuredClone(EMPTY_DRAFT),
  class: 'bard',
  level: 10,
  classChoices: {
    ...structuredClone(EMPTY_DRAFT.classChoices),
    subclass: 'college-of-lore',
    progressionChoices: {
      'lore-magical-secrets-6': ['fireball', 'counterspell'],
      'bard-magical-secrets-10': ['revivify', 'haste'],
    },
  },
}

describe('Segredos Mágicos', () => {
  it('getProgressionSpellIds junta as magias dos slots do colégio e da classe', () => {
    const [entry] = allClassEntries(loreBard10)
    expect(getProgressionSpellIds(entry)).toEqual(['fireball', 'counterspell', 'revivify', 'haste'])
  })

  it('só os slots que o nível na classe já liberou contam', () => {
    const [entry] = allClassEntries({ ...loreBard10, level: 9 })
    expect(getProgressionSpellIds(entry)).toEqual(['fireball', 'counterspell'])
  })

  it('o bardo leva as magias como bonusSpells, fora das escolhidas na etapa Magias', () => {
    const [bard] = getCasterEntries(loreBard10)
    expect(bard.bonusSpells).toEqual(['fireball', 'counterspell', 'revivify', 'haste'])
    expect(bard.spells).toEqual([])
  })

  it('não entram nas Escolhas de Progressão', () => {
    expect(getProgressionChoiceBlocks(allClassEntries(loreBard10))).toEqual([])
  })
})

describe('getProgressionChoiceBlocks', () => {
  it('opção com texto direto: manobras do Mestre de Batalha, só os slots com escolha', () => {
    const draft: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'fighter',
      level: 7,
      classChoices: {
        ...structuredClone(EMPTY_DRAFT.classChoices),
        subclass: 'battle-master',
        progressionChoices: { 'battle-master-maneuvers-3': ['aparar'] },
      },
    }
    const [block] = getProgressionChoiceBlocks(allClassEntries(draft))
    expect(block.slots.map(s => s.slot.id)).toEqual(['battle-master-maneuvers-3'])
    expect(block.slots[0].picks[0]).toMatchObject({ id: 'aparar', name: 'Aparar' })
    expect(block.slots[0].picks[0].text).toMatch(/^Quando outra criatura causar dano/)
  })

  it('opção escalonada (totem): o texto é o do degrau alcançado', () => {
    const draft: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'barbarian',
      level: 3,
      classChoices: {
        ...structuredClone(EMPTY_DRAFT.classChoices),
        subclass: 'totem-warrior',
        progressionChoices: { 'totem-warrior-totem-3': ['eagle'] },
      },
    }
    const [block] = getProgressionChoiceBlocks(allClassEntries(draft))
    expect(block.slots[0].picks[0].text).toMatch(/^Quando estiver em fúria e não estiver vestindo/)
  })

  it('id desconhecido não vira linha vazia', () => {
    const draft: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'fighter',
      level: 3,
      classChoices: {
        ...structuredClone(EMPTY_DRAFT.classChoices),
        subclass: 'battle-master',
        progressionChoices: { 'battle-master-maneuvers-3': ['nao-existe'] },
      },
    }
    expect(getProgressionChoiceBlocks(allClassEntries(draft))).toEqual([])
  })
})
