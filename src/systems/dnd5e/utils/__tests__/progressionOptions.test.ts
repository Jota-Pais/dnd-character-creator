import { describe, it, expect } from 'vitest'
import { getProgressionChoiceBlocks } from '../progressionOptions'
import { getProgressionSlotsUpToLevel, getProgressionSpellIds } from '../progressionChoiceUtils'
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

  // Guerreiro Totêmico (p. 50): Totem Espiritual (3º), Aspecto da Besta (6º) e Sintonia Totêmica
  // (14º) são três escolhas — "o mesmo animal ou um diferente" —, cada uma com o texto dela.
  function totemWarrior(level: number, progressionChoices: Record<string, string[]>): CharacterDraft {
    return {
      ...structuredClone(EMPTY_DRAFT),
      class: 'barbarian',
      level,
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'totem-warrior', progressionChoices },
    }
  }

  it('Guerreiro Totêmico: um slot por característica, liberado no nível dela', () => {
    const slotsAt = (level: number) => getProgressionSlotsUpToLevel('barbarian', 'totem-warrior', level).map(s => s.label)
    expect(slotsAt(3)).toEqual(['Totem Espiritual'])
    expect(slotsAt(13)).toEqual(['Totem Espiritual', 'Aspecto da Besta'])
    expect(slotsAt(14)).toEqual(['Totem Espiritual', 'Aspecto da Besta', 'Sintonia Totêmica'])
  })

  it('Guerreiro Totêmico: cada escolha com o benefício do animal nela, todas na ficha', () => {
    const draft = totemWarrior(14, {
      'totem-warrior-totem-3': ['eagle'],
      'totem-warrior-aspect-6': ['bear'],
      'totem-warrior-attunement-14': ['eagle'],
    })
    const [block] = getProgressionChoiceBlocks(allClassEntries(draft))
    expect(block.slots.map(s => [s.slot.label, s.picks[0].name])).toEqual([
      ['Totem Espiritual', 'Águia'],
      ['Aspecto da Besta', 'Urso'],
      ['Sintonia Totêmica', 'Águia'],
    ])
    expect(block.slots[0].picks[0].text).toMatch(/^Quando estiver em fúria e não estiver vestindo/)
    expect(block.slots[1].picks[0].text).toMatch(/^Você ganha a força de um urso/)
    expect(block.slots[2].picks[0].text).toMatch(/^Quando estiver em fúria, você adquire um deslocamento de voo/)
  })

  it('Guerreiro Totêmico: o texto do Totem Espiritual não muda com o nível (as outras são escolhas à parte)', () => {
    const [block] = getProgressionChoiceBlocks(allClassEntries(totemWarrior(20, { 'totem-warrior-totem-3': ['wolf'] })))
    expect(block.slots).toHaveLength(1)
    expect(block.slots[0].picks[0].text).toMatch(/^Quando estiver em fúria, seus amigos tem vantagem/)
  })

  it('Guerreiro Totêmico: escolha de nível ainda não alcançado fica fora da ficha', () => {
    const [block] = getProgressionChoiceBlocks(allClassEntries(totemWarrior(5, {
      'totem-warrior-totem-3': ['bear'],
      'totem-warrior-aspect-6': ['wolf'],
    })))
    expect(block.slots.map(s => s.slot.id)).toEqual(['totem-warrior-totem-3'])
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
