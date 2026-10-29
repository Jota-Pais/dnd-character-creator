import { describe, it, expect } from 'vitest'
import { getKnownSpells, getStartingInventory, listKnownSpells } from '../sheetModel'
import { formatInventoryItem } from '../equipmentUtils'
import { getEquippedWeapons } from '../attackUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import type { EquipmentDraft } from '../../types/equipment'

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), race: 'human', ...overrides }
}

const equipment = (e: Partial<EquipmentDraft>): EquipmentDraft => ({ ...structuredClone(EMPTY_DRAFT.equipment), ...e })

/** Bardo acólito no método padrão: rapieira não, maça (arma simples), Pacote de Artista e alaúde. */
const bardAcolyte = (e: Partial<EquipmentDraft>) => draft({
  class: 'bard',
  background: 'acolyte',
  // O símbolo sagrado escolhido; o livro de preces ainda a escolher.
  backgroundChoices: { items: { 'holy-symbol': 'amulet' } },
  equipment: equipment({
    method: 'standard',
    classResolutions: [
      { optionIndex: 2, pickedIds: ['mace'] },
      { optionIndex: 1, pickedIds: [] },
      { optionIndex: 0, pickedIds: [] },
    ],
    ...e,
  }),
})

const summary = (d: CharacterDraft) => getStartingInventory(d).map(i => [i.source, i.id, i.quantity])

describe('getStartingInventory (o inventário da Revisão, da ficha imprimível e dos ataques)', () => {
  it('método padrão: itens fixos da classe, as opções escolhidas e o antecedente, nessa ordem', () => {
    expect(summary(bardAcolyte({}))).toEqual([
      ['class-fixed', 'leather', 1],
      ['class-fixed', 'dagger', 1],
      ['class-choice', 'mace', 1],
      ['class-choice', 'entertainers-pack', 1],
      ['class-choice', 'lute', 1],
      ['background', 'amulet', 1],
      ['background', null, 1],
      ['background', 'incense-stick', 5],
      ['background', 'vestments', 1],
      ['background', 'common-clothes', 1],
    ])
  })

  it('cada item com o rótulo de inventário; o do antecedente a escolher diz que falta', () => {
    const labels = getStartingInventory(bardAcolyte({})).map(i => i.label)
    expect(labels).toContain(formatInventoryItem('entertainers-pack'))
    expect(labels).toContain(formatInventoryItem('incense-stick', 5))
    expect(labels).toContain('Livro de Preces ou Conta de Orações (a escolher)')
  })

  it('opção ainda não escolhida fica de fora', () => {
    const d = bardAcolyte({ classResolutions: [{ optionIndex: -1, pickedIds: [] }] })
    expect(summary(d).filter(([source]) => source === 'class-choice')).toEqual([])
  })

  it('método riqueza: as compras no lugar do equipamento da classe; o do antecedente continua (a leitura do app, como no dinheiro)', () => {
    const d = bardAcolyte({ method: 'wealth', purchasedItems: [{ itemId: 'rapier', quantity: 2, source: 'purchased' }] })
    expect(summary(d)).toEqual([
      ['purchased', 'rapier', 2],
      ['background', 'amulet', 1],
      ['background', null, 1],
      ['background', 'incense-stick', 5],
      ['background', 'vestments', 1],
      ['background', 'common-clothes', 1],
    ])
  })

  it('carrinho de um método riqueza abandonado não entra no método padrão', () => {
    const d = bardAcolyte({ purchasedItems: [{ itemId: 'rapier', quantity: 1, source: 'purchased' }] })
    expect(summary(d).some(([source]) => source === 'purchased')).toBe(false)
  })

  it('as armas dos ataques saem do mesmo inventário: classe e antecedente', () => {
    expect(getEquippedWeapons(bardAcolyte({})).map(w => w.id)).toEqual(['dagger', 'mace'])
    const outlander = draft({ class: 'fighter', background: 'outlander', equipment: equipment({ method: 'wealth' }) })
    expect(getEquippedWeapons(outlander).map(w => w.id)).toEqual(['quarterstaff'])
  })
})

const choices = (c: Partial<CharacterDraft['classChoices']>) => ({ ...structuredClone(EMPTY_DRAFT.classChoices), ...c })
const ids = (spells: { id: string }[]) => spells.map(s => s.id)

describe('getKnownSpells (as magias da Revisão, da ficha imprimível e da aba Regras)', () => {
  it('a classe conjuradora: truques, magias e as de slot com o grupo, cada uma uma vez', () => {
    const warlock = draft({
      class: 'warlock',
      level: 3,
      classChoices: choices({
        subclass: 'fiend',
        progressionChoices: {
          'warlock-pact-boon-3': ['pact-of-the-tome'],
          'warlock-pact-tome-cantrips-3': ['guidance', 'eldritch-blast', 'sacred-flame'],
        },
      }),
      spellChoices: { cantrips: ['eldritch-blast', 'chill-touch'], spells: ['hex'] },
    })
    const [cls] = getKnownSpells(warlock).classes
    expect(cls.caster.entry.classId).toBe('warlock')
    // A rajada mística também é Truque do Livro das Sombras: fica a origem da escolha da classe.
    expect(cls.spells.map(s => [s.spell.id, s.group])).toEqual([
      ['eldritch-blast', null],
      ['chill-touch', null],
      ['hex', null],
      ['guidance', 'Truques do Livro das Sombras'],
      ['sacred-flame', 'Truques do Livro das Sombras'],
    ])
  })

  it('o talento: o bloco do Iniciado em Magia, mesmo sem classe conjuradora', () => {
    const fighter = draft({
      class: 'fighter',
      level: 4,
      asiChoices: [{ kind: 'feat', featId: 'iniciado-em-magia' }],
      featSelections: { 'iniciado-em-magia': { spellClass: 'cleric', cantrips: ['sacred-flame', 'guidance'], spells: ['cure-wounds'] } },
    })
    const known = getKnownSpells(fighter)
    expect(known.classes).toEqual([])
    expect(known.feats.map(b => [b.label, ids(b.cantrips), ids(b.spells)])).toEqual([
      ['Iniciado em Magia (Clérigo)', ['sacred-flame', 'guidance'], ['cure-wounds']],
    ])
    // Chama Sagrada, Orientação, Curar Ferimentos: o grimório da ficha imprimível as tem.
    expect(ids(listKnownSpells(known))).toEqual(['sacred-flame', 'guidance', 'cure-wounds'])
  })

  it('a raça e a subclasse: o truque escolhido em cada uma, com o nome da subclasse', () => {
    const cleric = draft({
      race: 'elf',
      subrace: 'high-elf',
      raceChoices: { cantrip: 'prestidigitation' },
      class: 'cleric',
      classChoices: choices({ subclass: 'nature-domain', subclassExtras: { cantrip: 'shillelagh' } }),
    })
    const known = getKnownSpells(cleric)
    expect(known.raceCantrip?.id).toBe('prestidigitation')
    expect(known.subclassCantrips.map(s => [s.classId, s.subclassName, s.spell.id]))
      .toEqual([['cleric', 'Domínio da Natureza', 'shillelagh']])
  })

  it('as inatas da raça entram no nível em que o traço as libera', () => {
    const tiefling = (level: number) => getKnownSpells(draft({ race: 'tiefling', class: 'barbarian', level }))
    expect(tiefling(1).innate.map(s => s.spell.id)).toEqual(['thaumaturgy'])
    expect(tiefling(3).innate.map(s => [s.spell.id, s.innate.ability])).toEqual([
      ['thaumaturgy', 'CHA'],
      ['hellish-rebuke', 'CHA'],
    ])
  })

  it('listKnownSpells: todas as vias, cada magia uma vez, truques primeiro e por nível', () => {
    const wizard = draft({
      race: 'elf',
      subrace: 'high-elf',
      raceChoices: { cantrip: 'light' },
      class: 'wizard',
      level: 5,
      spellChoices: { cantrips: ['light', 'fire-bolt', 'mage-hand'], spells: ['fireball', 'shield', 'magic-missile'] },
    })
    expect(ids(listKnownSpells(getKnownSpells(wizard))))
      .toEqual(['light', 'mage-hand', 'fire-bolt', 'shield', 'magic-missile', 'fireball'])
  })
})
