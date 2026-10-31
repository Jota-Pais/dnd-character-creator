import { describe, it, expect } from 'vitest'
import type { FeatureEffects } from '../../types/effects'
import type { LevelFeature } from '../../types/class'
import { EMPTY_DRAFT } from '../../types/character'
import { COMBAT_ACTIONS } from '../../utils/actionUtils'
import { ACTIVE_EFFECT_CATALOG } from '../../utils/activeEffects'
import { buildPlaySheet } from '../../utils/playSheet'
import { activateToggle, createPlayState } from '../../utils/playState'
import { getProgressionOptions } from '../../utils/progressionOptions'
import progressionFeatures from '../class-progression-features.json'
import progressionChoices from '../progression-choices.json'
import featsData from '../feats.json'
import racesData from '../races.json'
import spellsData from '../spells.json'

/**
 * Os efeitos ligados nos dados (Fase 2, onda `efeitos-ativos`): a Fúria e o que a modifica. A
 * declaração não repete custo nem texto — o custo é da ação que liga, o texto é o da
 * característica —, então o que este teste cobra é que as pontas se encontrem: toda chave de
 * efeito citada existe, o custo é um recurso da mesma característica, e toda declaração diz a
 * página.
 */

type Holder = { where: string; name: string; effects: FeatureEffects }

const features = progressionFeatures as unknown as Record<'classes' | 'subclasses', Record<string, LevelFeature[]>>
const optionLists = [...new Set(Object.values(progressionChoices as Record<string, { optionsListId: string }[]>)
  .flat().map(slot => slot.optionsListId))]
  .filter(id => id !== 'spells')

const FEATURES: Holder[] = (['classes', 'subclasses'] as const).flatMap(group =>
  Object.entries(features[group]).flatMap(([id, list]) => list.flatMap(f =>
    f.effects ? [{ where: `${group === 'classes' ? 'classe' : 'subclasse'} ${id}`, name: f.name, effects: f.effects }] : [])))

const OPTIONS: Holder[] = optionLists.flatMap(id => getProgressionOptions(id).flatMap(o =>
  o.effects ? [{ where: `opção ${id}`, name: o.name, effects: o.effects }] : []))

const HOLDERS = [...FEATURES, ...OPTIONS]

const TOGGLES = FEATURES.flatMap(h => (h.effects.toggle ? [{ ...h, toggle: h.effects.toggle }] : []))
const TOGGLE_IDS = new Set(TOGGLES.map(t => t.toggle.id))

describe('efeitos ligados nos dados', () => {
  it('a Fúria declara o efeito, as duas ações e as chaves dos condicionais', () => {
    const rage = FEATURES.find(h => h.where === 'classe barbarian' && h.name === 'Fúria')?.effects
    expect(rage?.toggle).toMatchObject({ id: 'rage', label: 'Em fúria', page: 48, endsOn: ['unconscious', 'shortRest', 'longRest'] })
    expect(rage?.toggle?.benefits?.requires).toBe('noHeavyArmor')
    expect(rage?.actions?.map(a => [a.id, a.timing])).toEqual([['rage-enter', 'bonusAction'], ['rage-end', 'bonusAction']])
    expect(rage?.weaponAttacks?.[0].conditionalDamage?.toggle).toBe('rage')
    // A restrição fica fora dos benefícios: vale mesmo de armadura pesada (linhas 3647-3661).
    expect(rage?.castingRestriction).toMatchObject({ toggle: 'rage', blocks: ['cast', 'concentrate'] })
  })

  it('ids de efeito ligado e de ação são únicos', () => {
    expect(TOGGLES.length).toBe(TOGGLE_IDS.size)
    const actionIds = HOLDERS.flatMap(h => (h.effects.actions ?? []).map(a => a.id))
    expect(new Set(actionIds).size).toBe(actionIds.length)
  })

  it('todo efeito citado em conditionalDamage, castingRestriction, ações e modificadores existe', () => {
    const cited = HOLDERS.flatMap(h => {
      const label = `${h.where}: ${h.name}`
      return [
        ...(h.effects.weaponAttacks ?? []).flatMap(w => (w.conditionalDamage?.toggle ? [[label, w.conditionalDamage.toggle]] : [])),
        ...(h.effects.castingRestriction?.toggle ? [[label, h.effects.castingRestriction.toggle]] : []),
        ...(h.effects.actions ?? []).flatMap(a => [
          ...(a.requiresToggle ? [[label, a.requiresToggle]] : []),
          ...(a.outcomes ?? []).flatMap(o => ('toggle' in o ? [[label, o.toggle]] : [])),
        ]),
        ...(h.effects.toggleModifiers ?? []).map(m => [label, m.toggle]),
      ]
    })
    expect(cited.length).toBeGreaterThan(0)
    expect(cited.filter(([, id]) => !TOGGLE_IDS.has(id))).toEqual([])
  })

  it('o custo de toda ação é um recurso declarado na mesma característica', () => {
    const missing = HOLDERS.flatMap(h => (h.effects.actions ?? []).flatMap(a => (a.cost ?? [])
      .filter(c => !(h.effects.resources ?? []).some(r => r.id === c.resource))
      .map(c => `${h.where}: ${h.name} → ${a.id} (${c.resource})`)))
    expect(missing).toEqual([])
  })

  it('toda declaração tem página: o efeito ligado e cada ação', () => {
    for (const { where, name, toggle } of TOGGLES) expect(toggle.page, `${where}: ${name}`).toBeGreaterThan(0)
    for (const h of HOLDERS) {
      for (const a of h.effects.actions ?? []) expect(a.page, `${h.where}: ${a.id}`).toBeGreaterThan(0)
    }
  })

  it('as opções de um efeito ligado têm id único e rótulo', () => {
    for (const id of TOGGLE_IDS) {
      const options = HOLDERS.flatMap(h => (h.effects.toggleModifiers ?? []).filter(m => m.toggle === id).flatMap(m => m.options ?? []))
      expect(new Set(options.map(o => o.id)).size, id).toBe(options.length)
      for (const o of options) expect(o.label, `${id}: ${o.id}`).not.toBe('')
    }
    expect(HOLDERS.find(h => h.name === 'Frenesi')?.effects.toggleModifiers?.[0].options?.[0])
      .toMatchObject({ id: 'frenzy', onEnd: { exhaustion: 1 } })
  })

  // "Teste de resistência de Constituição CD 10 [...] a CD aumenta em 5. Assim que você terminar um
  // descanso curto ou longo a CD volta para 10" (linhas 3733-3741).
  it('a Fúria Implacável modifica a Fúria com o teste: CON, CD 10, +5 a cada uso, volta no descanso curto', () => {
    const relentless = FEATURES.find(h => h.where === 'classe barbarian' && h.name === 'Fúria Implacável')
    expect(relentless?.effects.toggleModifiers).toEqual([{
      toggle: 'rage',
      zeroHpSave: { counter: 'relentless-rage', ability: 'CON', dc: 10, dcStep: 5, resetsOn: 'short', page: 49 },
    }])
    // O contador é de quem o declara: dois testes não dividem a mesma contagem.
    const counters = HOLDERS.flatMap(h => (h.effects.toggleModifiers ?? []).flatMap(m => (m.zeroHpSave ? [m.zeroHpSave.counter] : [])))
    expect(new Set(counters).size).toBe(counters.length)
  })

  it('os totens modificam a Fúria pela tabela das opções: o Urso resiste a tudo menos psíquico, sem cláusula de armadura', () => {
    const bear = OPTIONS.find(h => h.where === 'opção totem-spirits' && h.name === 'Urso')
    expect(bear?.effects.toggleModifiers).toEqual([{
      toggle: 'rage',
      effects: [{ kind: 'damageDefenses', defenses: { resistances: { allExcept: ['psychic'] } }, scope: 'sheet' }],
    }])
    expect(OPTIONS.find(h => h.where === 'opção totem-spirits' && h.name === 'Águia')?.effects.toggleModifiers?.[0].benefits?.requires)
      .toBe('noHeavyArmor')
    expect(OPTIONS.find(h => h.where === 'opção totem-attunements' && h.name === 'Águia')?.effects.toggleModifiers?.[0].effects?.[0])
      .toEqual({ kind: 'flySpeed', feet: 'walking', scope: 'sheet' })
    // O Aspecto da Besta não depende da Fúria.
    expect(OPTIONS.some(h => h.where === 'opção totem-aspects')).toBe(false)
  })

  // As ações a ficha lê também nos talentos e traços raciais (`getSheetActions`); o efeito ligado e o
  // modificador, só nas features de classe e nas opções.
  it('efeito ligado e modificador só nas features de classe e nas opções, onde a ficha os lê', () => {
    type Loose = { name: string; effects?: Record<string, unknown> }
    const races = racesData as unknown as { traits: Loose[]; subraces: { traits: Loose[] }[] }[]
    const elsewhere = [
      ...(featsData as unknown as Loose[]),
      ...races.flatMap(r => [...r.traits, ...r.subraces.flatMap(s => s.traits)]),
    ].filter(x => x.effects && ['toggle', 'toggleModifiers'].some(k => k in x.effects!))
    expect(elsewhere.map(x => x.name)).toEqual([])
    // O efeito ligado é de feature de classe; opção só o modifica.
    expect(OPTIONS.filter(h => h.effects.toggle).map(h => h.name)).toEqual([])
  })
})

/**
 * O catálogo das magias e ações recebidas (onda `efeitos-recebidos`): a declaração só diz o que o
 * efeito faz, com a página e as linhas do extrato; o nome, o texto, a duração e a concentração são
 * os de `spells.json`, sem cópia.
 */
describe('catálogo de efeitos de magia e de ação', () => {
  const SPELLS = spellsData as { id: string; name: string }[]
  // As chaves que uma entrada do catálogo pode ter: nenhum texto da magia (descrição, duração,
  // alcance, concentração) entra aqui.
  const ALLOWED = new Set(['id', 'label', 'spellId', 'name', 'page', 'bookLines', 'effects', 'benefits', 'endsOn', 'onEnd'])

  it('cada entrada tem id único, que não colide com o da ficha, rótulo, página e as linhas do extrato', () => {
    const ids = ACTIVE_EFFECT_CATALOG.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter(id => TOGGLE_IDS.has(id))).toEqual([])
    for (const t of ACTIVE_EFFECT_CATALOG) {
      expect(t.label, t.id).not.toBe('')
      expect(t.page, t.id).toBeGreaterThan(0)
      expect(t.bookLines?.[0], t.id).toBeGreaterThan(0)
      expect(t.bookLines?.[1], t.id).toBeGreaterThanOrEqual(t.bookLines?.[0] ?? Infinity)
    }
  })

  it('a magia existe em spells.json; o nome próprio é só do que não é magia (a ação)', () => {
    for (const t of ACTIVE_EFFECT_CATALOG) {
      if (t.spellId) {
        expect(SPELLS.some(s => s.id === t.spellId), t.id).toBe(true)
        expect(t.id).toBe(`spell:${t.spellId}`)
        expect(t.name, t.id).toBeUndefined()
      } else {
        expect(t.name, t.id).toBeTruthy()
        expect(t.id.startsWith('action:'), t.id).toBe(true)
      }
    }
  })

  it('nenhum campo de texto copiado de spells.json: só as chaves da declaração', () => {
    const extra = ACTIVE_EFFECT_CATALOG.flatMap(t => Object.keys(t).filter(k => !ALLOWED.has(k)).map(k => `${t.id}: ${k}`))
    expect(extra).toEqual([])
    // O texto curto dos avisos não repete a descrição da magia.
    const descriptions = (spellsData as { id: string; description: string }[])
    for (const t of ACTIVE_EFFECT_CATALOG) {
      const description = descriptions.find(s => s.id === t.spellId)?.description ?? ''
      const texts = [...(t.effects ?? []), ...(t.benefits?.effects ?? [])].flatMap(e => ('text' in e ? [e.text] : []))
      for (const text of texts) expect(description.includes(text), `${t.id}: ${text}`).toBe(false)
    }
  })

  it('as dez entradas do desenho, com o que cada uma faz', () => {
    const kinds = Object.fromEntries(ACTIVE_EFFECT_CATALOG.map(t =>
      [t.id, [...(t.effects ?? []), ...(t.benefits?.effects ?? [])].map(e => e.kind)]))
    expect(kinds).toEqual({
      'spell:bless': ['rollDice'],
      'spell:bane': ['rollDice'],
      'spell:shield': ['acBonus', 'notice'],
      'spell:mage-armor': ['acFormula'],
      'spell:shield-of-faith': ['acBonus'],
      'spell:haste': ['acBonus', 'rollMode', 'speedMultiplier', 'notice', 'extraTurnAction'],
      'spell:longstrider': ['speedBonus'],
      'spell:divine-favor': ['weaponDamage'],
      'spell:barkskin': ['acMinimum'],
      'action:dodge': ['againstYou', 'rollMode'],
    })
  })

  // "o alvo pode jogar um d4 e adicionar" (linhas 20601-20604); "deve rolar um d4 e subtrair"
  // (linhas 26000-26002). As duas alcançam o teste contra a morte (decisão 22, pelo Sortudo).
  it('a Bênção soma 1d4 e a Perdição subtrai, no ataque e no TR, também no teste contra a morte', () => {
    const dice = (id: string) => ACTIVE_EFFECT_CATALOG.find(t => t.id === id)?.effects?.[0]
    expect(dice('spell:bless')).toEqual({ kind: 'rollDice', rolls: ['attack', 'save'], dice: { count: 1, sides: 4 }, sign: 1, deathSave: true, scope: 'sheet' })
    expect(dice('spell:bane')).toMatchObject({ rolls: ['attack', 'save'], sign: -1, deathSave: true })
  })

  // "A magia acaba se o alvo colocar uma armadura" (linhas 20253-20255); o escudo soma +2 e não a
  // encerra (decisão de 2026-10-30).
  it('a Armadura Arcana vale sem armadura vestida e acaba ao vestir uma; o escudo não conta', () => {
    const mageArmor = ACTIVE_EFFECT_CATALOG.find(t => t.id === 'spell:mage-armor')
    expect(mageArmor?.benefits?.requires).toBe('noArmor')
    expect(mageArmor?.endsOn).toEqual(['donArmor'])
    expect(mageArmor?.benefits?.effects).toEqual([
      { kind: 'acFormula', formula: { id: 'mage-armor', base: 13, abilities: ['DEX'] }, scope: 'sheet' },
    ])
  })

  // "ganha uma ação adicional em cada um dos turnos dele. A ação pode ser usada apenas para realizar
  // as ações de Ataque (um ataque com arma, apenas), Disparada, Desengajar, Esconder ou Usar um
  // Objeto" (linhas 28213-28217).
  it('a ação a mais da Velocidade aponta para as ações em combate que o aviso dela nomeia', () => {
    const haste = ACTIVE_EFFECT_CATALOG.find(t => t.id === 'spell:haste')
    const extra = haste?.effects?.find(e => e.kind === 'extraTurnAction')
    const notice = haste?.effects?.find(e => e.kind === 'notice')
    expect(extra && 'actions' in extra ? extra.actions : []).toEqual(['attack', 'dash', 'disengage', 'hide', 'use-an-object'])
    for (const id of extra && 'actions' in extra ? extra.actions : []) {
      const action = COMBAT_ACTIONS.find(a => a.id === id)
      expect(action, id).toBeDefined()
      expect(notice && 'text' in notice ? notice.text : '', id).toContain(action?.name ?? id)
    }
  })

  it('a mesma magia não liga duas vezes: um id, um efeito (pág. 207)', () => {
    const sheet = buildPlaySheet({ ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'fighter', level: 1 })
    const once = activateToggle(createPlayState('c'), sheet, 'spell:bless', { now: 1 })
    expect(once.state.activeEffects.map(a => a.id)).toEqual(['spell:bless'])
    const twice = activateToggle(once.state, sheet, 'spell:bless', { now: 2 })
    expect(twice.state).toBe(once.state)
    expect(twice.notices).toEqual([{ kind: 'refused', text: 'Já está sob a Bênção.' }])
    // Magias diferentes somam.
    const both = activateToggle(once.state, sheet, 'spell:shield-of-faith', { now: 3 })
    expect(both.state.activeEffects.map(a => a.id)).toEqual(['spell:bless', 'spell:shield-of-faith'])
  })
})
