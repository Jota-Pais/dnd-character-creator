import { describe, it, expect } from 'vitest'
import type { LevelFeature } from '../../types/class'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { ACTION_DESTINATIONS, COMBAT_ACTIONS } from '../../utils/actionUtils'
import { ACTIVE_EFFECT_CATALOG } from '../../utils/activeEffects'
import { createPlayState } from '../../utils/playState'
import { findRollGuideEntry, getRollGuide } from '../../utils/rollGuide'
import progressionFeatures from '../class-progression-features.json'

/**
 * As ações em combate que todo personagem tem (`data/combat-actions.json`, págs. 192-197,
 * `docs/regras-acoes-em-combate.md`, seções 3 a 8): como o catálogo dos efeitos recebidos, cada
 * entrada diz a página e as linhas do extrato, e as pontas se encontram — o efeito que ela liga
 * existe, e o lugar para onde ela leva também.
 */
describe('ações em combate nos dados', () => {
  const features = progressionFeatures as unknown as Record<'classes' | 'subclasses', Record<string, LevelFeature[]>>
  const featureActionIds = (['classes', 'subclasses'] as const).flatMap(group =>
    Object.values(features[group]).flatMap(list => list.flatMap(f => (f.effects?.actions ?? []).map(a => a.id))))

  it('as dezesseis do desenho, na ordem do livro, com o momento de cada uma', () => {
    expect(COMBAT_ACTIONS.map(a => [a.id, a.timing])).toEqual([
      ['attack', 'action'],
      ['cast-a-spell', 'action'],
      ['dash', 'action'],
      ['disengage', 'action'],
      ['dodge', 'action'],
      ['help', 'action'],
      ['hide', 'action'],
      ['ready', 'action'],
      ['search', 'action'],
      ['use-an-object', 'action'],
      ['grapple', 'action'],
      ['shove', 'action'],
      ['opportunity-attack', 'reaction'],
      ['two-weapon-fighting', 'bonusAction'],
      ['stand-up', 'movement'],
      ['interact', 'free'],
    ])
  })

  it('ids únicos, que não colidem com as ações das características', () => {
    const ids = COMBAT_ACTIONS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter(id => featureActionIds.includes(id))).toEqual([])
  })

  it('toda ação tem nome, resumo, página e as linhas do extrato', () => {
    for (const a of COMBAT_ACTIONS) {
      expect(a.name, a.id).not.toBe('')
      expect(a.summary, a.id).toBeTruthy()
      expect(a.page, a.id).toBeGreaterThan(0)
      expect(a.bookLines?.[0], a.id).toBeGreaterThan(0)
      expect(a.bookLines?.[1], a.id).toBeGreaterThanOrEqual(a.bookLines?.[0] ?? Infinity)
    }
  })

  it('todo efeito que uma ação liga existe no catálogo', () => {
    const toggles = COMBAT_ACTIONS.flatMap(a => (a.outcomes ?? []).flatMap(o => ('toggle' in o ? [o.toggle] : [])))
    expect(toggles).toEqual(['action:dodge'])
    for (const id of toggles) expect(ACTIVE_EFFECT_CATALOG.some(t => t.id === id), id).toBe(true)
  })

  it('todo link aponta para uma jogada que o guia gera ou para uma parte conhecida da tela', () => {
    const guide = getRollGuide(structuredClone(COMPLETE_DRAFT), createPlayState('c'))
    const links = COMBAT_ACTIONS.flatMap(a => (a.links ?? []).map(link => [a.id, link] as const))
    expect(links.length).toBeGreaterThan(0)
    const lost = links.filter(([, link]) =>
      !(ACTION_DESTINATIONS as readonly string[]).includes(link) && !findRollGuideEntry(guide, link))
    expect(lost).toEqual([])
  })

  it('o agarrão e o encontrão são feitos dentro de Atacar, no lugar de um ataque (págs. 197-198)', () => {
    expect(COMBAT_ACTIONS.filter(a => a.partOf === 'attack').map(a => a.id)).toEqual(['grapple', 'shove'])
  })

  // "Quando você realiza a ação de Ataque [...], você pode usar uma ação bônus" (linhas 17633-17636).
  it('o ataque com a outra mão vem depois de Atacar, que existe nos dados', () => {
    const after = COMBAT_ACTIONS.flatMap(a => (a.afterAction ? [[a.id, a.afterAction]] : []))
    expect(after).toEqual([['two-weapon-fighting', 'attack']])
    for (const [, id] of after) expect(COMBAT_ACTIONS.some(a => a.id === id), id).toBe(true)
  })

  it('a reação diz o gatilho', () => {
    for (const a of COMBAT_ACTIONS.filter(x => x.timing === 'reaction')) expect(a.trigger, a.id).toBeTruthy()
  })
})
