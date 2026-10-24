import { describe, it, expect } from 'vitest'
import { getEquippedWeapons, getSheetAttacks } from '../attackUtils'
import {
  getMartialArts, getOwnedFightingStyleIds, getSheetArmorClass, getUnarmedDamageDie,
  getWeaponAttackEffects, getSheetFightingStyles,
} from '../sheetEffects'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import type { ClassChoiceSelections } from '../../types/class'

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), race: 'human', ...overrides }
}

const choices = (c: Partial<ClassChoiceSelections>): ClassChoiceSelections =>
  ({ ...structuredClone(EMPTY_DRAFT.classChoices), ...c })

function extraClass(classId: string, level: number, classChoices: Partial<ClassChoiceSelections> = {}) {
  return {
    classId, level, classChoices: choices(classChoices),
    spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
  }
}

/** Itens comprados pelo método riqueza — armas e armadura que a ficha considera equipadas. */
const carrying = (...itemIds: string[]) => ({
  equipment: {
    ...structuredClone(EMPTY_DRAFT.equipment),
    method: 'wealth' as const,
    purchasedItems: itemIds.map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const })),
  },
})

const scores = (m: Partial<Record<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', number>>) =>
  ({ STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10, ...m })

const monk = (level: number, ...items: string[]) => draft({ level, class: 'monk', ...carrying(...items) })

describe('getEquippedWeapons', () => {
  it('pega as armas compradas, sem repetir, e ignora o que não é arma', () => {
    const d = draft({ class: 'fighter', ...carrying('longsword', 'longsword', 'leather', 'dagger') })
    expect(getEquippedWeapons(d).map(w => w.id)).toEqual(['longsword', 'dagger'])
  })
})

describe('getSheetAttacks', () => {
  it('todo personagem tem o golpe desarmado no fim: 1 + Força, proficiente (p. 196)', () => {
    const attacks = getSheetAttacks(draft({ level: 1, class: 'wizard', ...carrying('dagger') }), scores({ STR: 14 }))
    expect(attacks.map(a => a.key)).toEqual(['dagger', 'unarmed'])
    expect(attacks[1]).toMatchObject({ name: 'Golpe desarmado', attackBonus: '+4', damage: '3 concussão', proficient: true })
  })

  it('guerreiro de Arquearia: +2 no arco longo, nada na espada longa', () => {
    const d = draft({ level: 1, class: 'fighter', classChoices: choices({ fightingStyle: 'archery' }), ...carrying('longbow', 'longsword') })
    const [bow, sword] = getSheetAttacks(d, scores({ STR: 14, DEX: 16 }))
    expect(bow.attackBonus).toBe('+7')
    expect(sword.attackBonus).toBe('+4')
    expect(sword.damage).toBe('1d8+2 cortante')
    expect(sword.versatileDamage).toBe('1d10+2')
  })

  it('monge 1 sem armadura: bordão e golpe desarmado com Destreza e o d4', () => {
    const [staff, unarmed] = getSheetAttacks(monk(1, 'quarterstaff'), scores({ STR: 10, DEX: 16 }))
    expect(staff).toMatchObject({ ability: 'Destreza', attackBonus: '+5', damage: '1d6+3 concussão' })
    expect(unarmed).toMatchObject({ ability: 'Destreza', attackBonus: '+5', damage: '1d4+3 concussão' })
  })

  it('monge 6 ganha a nota dos Golpes de Chi no golpe desarmado', () => {
    const unarmed = getSheetAttacks(monk(6), scores({ DEX: 16 })).at(-1)!
    expect(unarmed.damage).toBe('1d6+3 concussão')
    expect(unarmed.notes).toContain('conta como arma mágica contra resistência e imunidade a dano não-mágico (Golpes de Chi)')
  })

  it('monge de armadura ou escudo perde Artes Marciais, e a linha diz por quê', () => {
    for (const worn of [['leather'], ['shield']]) {
      const [staff, unarmed] = getSheetAttacks(monk(5, 'quarterstaff', ...worn), scores({ STR: 10, DEX: 16 }))
      expect(staff.ability).toBe('Força')
      expect(staff.damage).toBe('1d6 concussão')
      expect(unarmed.damage).toBe('1 concussão')
      expect(unarmed.notes.at(-1)).toMatch(/^Artes Marciais \(d6, Destreza\) fora deste número e das armas de monge: você está de /)
    }
  })

  it('guerreiro 1 de Arquearia / monge 5: os dois valem ao mesmo tempo', () => {
    const d = draft({
      level: 6, class: 'fighter', multiclass: true,
      classChoices: choices({ fightingStyle: 'archery' }),
      additionalClasses: [extraClass('monk', 5)],
      ...carrying('shortbow', 'shortsword'),
    })
    const [bow, sword, unarmed] = getSheetAttacks(d, scores({ STR: 10, DEX: 16 }))
    expect(bow.attackBonus).toBe('+8') // prof 3 + DES 3 + Arquearia 2
    expect(sword.damage).toBe('1d6+3 perfurante') // d6 da espada curta = d6 de Artes Marciais
    expect(unarmed.damage).toBe('1d6+3 concussão')
  })

  it('guerreiro 5: Ataque Extra na espada e no golpe desarmado, mas não na besta leve (recarga, p. 149)', () => {
    const d = draft({ level: 5, class: 'fighter', ...carrying('longsword', 'light-crossbow') })
    const [sword, crossbow, unarmed] = getSheetAttacks(d, scores({ STR: 16, DEX: 14 }))
    expect([sword.attacksPerAction, crossbow.attacksPerAction, unarmed.attacksPerAction]).toEqual([2, 1, 2])
    expect(crossbow.notes).toContain('recarga: um disparo por ação, ação bônus ou reação, mesmo com os 2 ataques de Ataque Extra')
  })

  it('guerreiro 5 com Especialista em Besta: a besta leve faz os 2 ataques (p. 169)', () => {
    const d = draft({
      level: 5, class: 'fighter', raceChoices: { feat: 'especialista-em-besta' }, ...carrying('light-crossbow'),
    })
    const [crossbow] = getSheetAttacks(d, scores({ DEX: 16 }))
    expect(crossbow.attacksPerAction).toBe(2)
    expect(crossbow.notes).toContain('inclui Especialista em Besta (ignora a recarga)')
  })

  describe('nota do ataque da outra mão (p. 196): só com duas armas leves corpo a corpo', () => {
    const TWF_BASE = 'com outra arma leve na outra mão: ataque extra como ação bônus, sem somar o modificador no dano (a menos que seja negativo)'
    const daggerNotes = (d: CharacterDraft) => getSheetAttacks(d, scores({ DEX: 14 })).find(a => a.key === 'dagger')!.notes

    it('mago com uma adaga só: sem a nota', () => {
      expect(daggerNotes(draft({ level: 1, class: 'wizard', ...carrying('dagger') }))).toEqual([])
    })

    it('adaga + espada curta, ou duas adagas compradas: com a nota', () => {
      expect(daggerNotes(draft({ level: 1, class: 'rogue', ...carrying('dagger', 'shortsword') }))).toEqual([TWF_BASE])
      const twoDaggers = draft({
        level: 1, class: 'wizard',
        equipment: {
          ...structuredClone(EMPTY_DRAFT.equipment),
          method: 'wealth',
          purchasedItems: [{ itemId: 'dagger', quantity: 2, source: 'purchased' }],
        },
      })
      expect(daggerNotes(twoDaggers)).toEqual([TWF_BASE])
    })

    it('feiticeiro no equipamento padrão: as duas adagas fixas da classe contam', () => {
      const d = draft({ level: 1, class: 'sorcerer', equipment: { ...structuredClone(EMPTY_DRAFT.equipment), method: 'standard' } })
      expect(daggerNotes(d)).toEqual([TWF_BASE])
    })

    it('adaga + besta de mão (leve, mas à distância): sem a nota', () => {
      expect(daggerNotes(draft({ level: 1, class: 'rogue', ...carrying('dagger', 'hand-crossbow') }))).toEqual([])
    })
  })

  it('Especialista em Briga dá 1d4 ao golpe desarmado de quem não é monge', () => {
    const d = draft({ level: 1, class: 'fighter', raceChoices: { feat: 'especialista-em-briga' } })
    expect(getUnarmedDamageDie(d)).toEqual({ source: 'Especialista em Briga', value: 4 })
    expect(getSheetAttacks(d, scores({ STR: 16 })).at(-1)!.damage).toBe('1d4+3 concussão')
  })
})

describe('compras de outro método não vestem o monge', () => {
  it('monge 10 no método padrão com Camisão de Malha que sobrou da riqueza: Defesa sem Armadura e Artes Marciais', () => {
    const d = draft({
      level: 10, class: 'monk',
      equipment: {
        ...structuredClone(EMPTY_DRAFT.equipment),
        method: 'standard',
        purchasedItems: [
          { itemId: 'chain-shirt', quantity: 1, source: 'purchased' },
          { itemId: 'smiths-tools', quantity: 1, source: 'purchased' },
        ],
      },
    })
    const s = scores({ DEX: 18, WIS: 16 })
    expect(getSheetArmorClass(d, s).value).toBe(17) // 10 + DES 4 + SAB 3
    expect(getMartialArts(d, s)).toMatchObject({ die: 6, active: true })
    expect(getSheetAttacks(d, s).at(-1)).toMatchObject({ ability: 'Destreza', damage: '1d6+4 concussão' })
  })
})

describe('getMartialArts', () => {
  it('dado pelo nível de monge (p. 103): d4, d6, d8, d10', () => {
    expect([1, 5, 11, 17].map(l => getMartialArts(monk(l), scores({}))?.die)).toEqual([4, 6, 8, 10])
  })

  it('na multiclasse segue o nível NA classe de monge', () => {
    const d = draft({ level: 7, class: 'fighter', multiclass: true, additionalClasses: [extraClass('monk', 2)] })
    expect(getMartialArts(d, scores({}))).toMatchObject({ die: 4, active: true })
  })

  it('quem não é monge não tem', () => {
    expect(getMartialArts(draft({ level: 5, class: 'fighter' }), scores({}))).toBeNull()
  })
})

describe('getSheetFightingStyles — o bloco "Estilo de Luta" da Revisão e da ficha', () => {
  it('guerreiro 1 de Proteção: o estilo aparece mesmo sem mexer em número', () => {
    const d = draft({ level: 1, class: 'fighter', classChoices: choices({ fightingStyle: 'protection' }) })
    expect(getSheetFightingStyles(d).map(s => [s.classId, s.style.name])).toEqual([['fighter', 'Proteção']])
    expect(getSheetFightingStyles(d)[0].style.description).not.toBe('')
  })

  it('paladino 2 / guerreiro 1: um estilo por classe, na ordem da multiclasse', () => {
    const d = draft({
      level: 3, class: 'paladin', multiclass: true,
      classChoices: choices({ fightingStyle: 'dueling' }),
      additionalClasses: [extraClass('fighter', 1, { fightingStyle: 'defense' })],
    })
    expect(getSheetFightingStyles(d).map(s => [s.classId, s.style.id])).toEqual([['paladin', 'dueling'], ['fighter', 'defense']])
  })

  it('id desconhecido ou nenhum: fica de fora', () => {
    expect(getSheetFightingStyles(draft({ level: 1, class: 'fighter', classChoices: choices({ fightingStyle: 'inexistente' }) }))).toEqual([])
    expect(getSheetFightingStyles(draft({ level: 1, class: 'fighter' }))).toEqual([])
  })

  it('o Estilo Adicional do campeão (slot de progressão) não entra — sai em Escolhas de Progressão', () => {
    const d = draft({
      level: 10, class: 'fighter',
      classChoices: choices({
        subclass: 'champion', fightingStyle: 'archery',
        progressionChoices: { 'champion-fighting-style-10': ['dueling'] },
      }),
    })
    expect(getSheetFightingStyles(d).map(s => s.style.id)).toEqual(['archery'])
  })
})

describe('Estilo de Luta Adicional do campeão (guerreiro 10)', () => {
  const champion = (extra: string) => draft({
    level: 10, class: 'fighter',
    classChoices: choices({
      subclass: 'champion', fightingStyle: 'archery',
      progressionChoices: { 'champion-fighting-style-10': [extra] },
    }),
  })

  it('soma o estilo do slot ao da classe', () => {
    expect(getOwnedFightingStyleIds(champion('dueling'))).toEqual(['archery', 'dueling'])
    expect(getWeaponAttackEffects(champion('dueling')).map(e => e.source)).toEqual(['Arquearia', 'Duelismo'])
  })

  it('Defesa escolhida no slot entra na CA', () => {
    const withArmor = { ...champion('defense'), ...carrying('chain-mail') }
    const without = { ...champion('dueling'), ...carrying('chain-mail') }
    expect(getSheetArmorClass(withArmor, scores({})).value - getSheetArmorClass(without, scores({})).value).toBe(1)
  })
})
