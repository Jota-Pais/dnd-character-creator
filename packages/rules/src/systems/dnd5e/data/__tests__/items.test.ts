import { describe, it, expect } from 'vitest'
import type { GeneralItem, Weapon } from '../../types/equipment'
import { ACTIVE_EFFECT_CATALOG } from '../../utils/activeEffects'
import { getProgressionOptions } from '../../utils/progressionOptions'
import generalItemsData from '../general-items.json'
import weaponsData from '../weapons.json'

/**
 * Os itens da bolsa do jogo (Fase 2, onda `inventario`; `docs/regras-equipamentos.md`, seção 6): a
 * munição contada por peça e o "Usar" dos consumíveis, declarados nos dados com a página e as linhas
 * do extrato — como as ações em combate, as pontas se encontram: a arma aponta para uma munição que
 * existe, e o efeito que o uso liga está no catálogo.
 */
const ITEMS = generalItemsData as GeneralItem[]
const WEAPONS = weaponsData as Weapon[]
const item = (id: string) => ITEMS.find(i => i.id === id)

describe('munição', () => {
  it('toda arma com a propriedade munição aponta para um item de munição, e só elas', () => {
    for (const w of WEAPONS) {
      const usesAmmo = w.properties.some(p => p.kind === 'ammunition')
      expect(w.ammunition !== undefined, w.id).toBe(usesAmmo)
      if (w.ammunition) expect(item(w.ammunition)?.category, w.id).toBe('ammunition')
    }
  })

  // "arcos → flechas, bestas → virotes, funda → balas, zarabatana → agulhas" (desenho da onda).
  it('os arcos atiram flechas; as bestas, virotes; a funda, balas; a zarabatana, agulhas', () => {
    const byAmmo = Object.fromEntries(['arrows', 'crossbow-bolts', 'sling-bullets', 'blowgun-needles']
      .map(ammo => [ammo, WEAPONS.filter(w => w.ammunition === ammo).map(w => w.id)]))
    expect(byAmmo).toEqual({
      'arrows': ['shortbow', 'longbow'],
      'crossbow-bolts': ['light-crossbow', 'hand-crossbow', 'heavy-crossbow'],
      'sling-bullets': ['sling'],
      'blowgun-needles': ['blowgun'],
    })
  })

  // Tabela da pág. 152 (linhas 13616-13620): "Balas de Funda (20)", "Flechas (20)", "Virotes (20)",
  // "Zarabatana (50)". A munição é contada por peça, e o número da unidade é o do nome.
  it('toda munição diz quantas peças vêm na unidade, o número do nome', () => {
    const ammo = ITEMS.filter(i => i.category === 'ammunition')
    expect(ammo.map(i => [i.id, i.piecesPerUnit])).toEqual([
      ['sling-bullets', 20], ['arrows', 20], ['crossbow-bolts', 20], ['blowgun-needles', 50],
    ])
    for (const i of ammo) expect(i.name.endsWith(`(${i.piecesPerUnit})`), i.id).toBe(true)
  })

  // "O kit possui material suficiente para dez usos" (pág. 154, linhas 13834-13835).
  it('o Kit de Primeiros-Socorros conta dez usos', () => {
    expect(item('healers-kit')?.piecesPerUnit).toBe(10)
  })
})

describe('o Usar dos itens', () => {
  const withUse = ITEMS.filter(i => i.use)

  it('os sete do desenho, com o momento e o que cada um faz', () => {
    expect(Object.fromEntries(withUse.map(i => [i.id, [i.use!.timing, ...(i.use!.outcomes ?? []).map(o => o.kind)]]))).toEqual({
      'acid-vial': ['action', 'attack', 'roll'],
      'holy-water-flask': ['action', 'attack', 'roll'],
      // O livro não diz quanto tempo leva beber o antídoto (linhas 13686-13689): o app não marca o turno.
      'antitoxin': ['special', 'toggleOn'],
      'alchemists-fire': ['action', 'attack', 'roll'],
      'healers-kit': ['action'],
      'potion-of-healing': ['action', 'heal'],
      'basic-poison': ['action', 'roll'],
    })
  })

  it('todo uso tem resumo, página e as linhas do extrato', () => {
    for (const i of withUse) {
      expect(i.use!.summary, i.id).toBeTruthy()
      expect(i.use!.page, i.id).toBeGreaterThan(0)
      expect(i.use!.bookLines[0], i.id).toBeGreaterThan(0)
      expect(i.use!.bookLines[1], i.id).toBeGreaterThanOrEqual(i.use!.bookLines[0])
    }
  })

  it('o efeito que um uso liga existe no catálogo', () => {
    const toggles = withUse.flatMap(i => (i.use!.outcomes ?? []).flatMap(o => (o.kind === 'toggleOn' ? [o.toggle] : [])))
    expect(toggles).toEqual(['item:antitoxin'])
    for (const id of toggles) expect(ACTIVE_EFFECT_CATALOG.some(t => t.id === id), id).toBe(true)
  })

  // "recupera 2d4+2 pontos de vida. Beber ou administrar uma poção exige uma ação" (linhas 13895-13897).
  it('a Poção de Cura cura 2d4 + 2 com uma ação', () => {
    expect(item('potion-of-healing')?.use).toMatchObject({
      timing: 'action', page: 155, outcomes: [{ kind: 'heal', dice: { count: 2, sides: 4, bonus: 2 } }],
    })
  })

  // Ácido 2d6 ácido (linhas 13498-13504), água benta 2d6 radiante em corruptor ou morto-vivo (13660-13666),
  // fogo alquímico 1d4 fogo no início de cada turno do alvo (13799-13808), veneno básico TR de
  // Constituição CD 10 ou 1d4 de veneno (13931-13938). Só o dano do acerto dobra no crítico (pág. 196).
  it('o dano de cada um: o dado, o tipo, a situação e o TR', () => {
    const rolls = Object.fromEntries(withUse.flatMap(i => (i.use!.outcomes ?? []).flatMap(o => (o.kind === 'roll' ? [[i.id, o]] : []))))
    expect(rolls).toEqual({
      'acid-vial': { kind: 'roll', damage: { count: 2, sides: 6 }, damageType: 'acid', onHit: true },
      'holy-water-flask': { kind: 'roll', damage: { count: 2, sides: 6 }, damageType: 'radiant', when: 'se o alvo for um corruptor ou morto-vivo', onHit: true },
      'alchemists-fire': { kind: 'roll', damage: { count: 1, sides: 4 }, damageType: 'fire', when: 'no início de cada turno do alvo, até ele apagar as chamas' },
      'basic-poison': { kind: 'roll', damage: { count: 1, sides: 4 }, damageType: 'poison', save: { ability: 'CON', dc: 10 } },
    })
  })
})

describe('carga', () => {
  // "Sua capacidade de carga (incluindo carga máxima e capacidade de erguer) é dobrada" (Aspecto da
  // Besta, Urso, pág. 50, linhas 3873-3876). Os outros animais não mexem na carga.
  it('o Aspecto da Besta do Urso dobra a capacidade de carga; os outros animais, não', () => {
    const aspects = getProgressionOptions('totem-aspects')
    expect(aspects.map(o => [o.id, o.effects?.carryingCapacityMultiplier])).toEqual([
      ['eagle', undefined], ['wolf', undefined], ['bear', 2],
    ])
    expect(getProgressionOptions('totem-spirits').some(o => o.effects?.carryingCapacityMultiplier)).toBe(false)
    expect(getProgressionOptions('totem-attunements').some(o => o.effects?.carryingCapacityMultiplier)).toBe(false)
  })
})
