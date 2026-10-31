import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import type { PlayState } from '../../types/playState'
import { NO_SESSION } from '../../types/session'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { getFinalAbilityScores } from '../asiUtils'
import { getSheetAttacks } from '../attackUtils'
import { describeToggleEffects, getCatalogToggles, getSessionToggles, getSheetSession, resolveActiveEffects } from '../activeEffects'
import { buildPlaySheet } from '../playSheet'
import { createPlayState } from '../playState'
import { getConcentrationGuide, getRollGuide } from '../rollGuide'
import { formatArmorClassBreakdown } from '../armorClassUtils'
import { getCastingRestrictions, getSheetArmorClass, getSheetToggles } from '../sheetEffects'

/** Itens comprados pelo método riqueza: as armas e a armadura que a ficha considera equipadas. */
const carrying = (...itemIds: string[]) => ({
  equipment: {
    ...structuredClone(EMPTY_DRAFT.equipment),
    method: 'wealth' as const,
    purchasedItems: itemIds.map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const })),
  },
})

/** Bárbaro meio-orc no nível dado, com um caminho e as escolhas dele. */
function barbarian(level: number, patch: Partial<CharacterDraft> = {}, subclass: string | null = null, picks: Record<string, string[]> = {}): CharacterDraft {
  const base = structuredClone(COMPLETE_DRAFT)
  return {
    ...base, level, ...patch,
    classChoices: { ...base.classChoices, subclass, progressionChoices: picks },
  }
}

const raging = (patch: Partial<PlayState> = {}): PlayState =>
  ({ ...createPlayState('c'), activeEffects: [{ id: 'rage', startedAt: 1 }], ...patch })

const kindsOf = (effects: { effect: { kind: string } }[]) => effects.map(e => e.effect.kind)

describe('getSheetToggles: a Fúria com o que a modifica', () => {
  it('bárbaro 1: o efeito, os benefícios sem armadura pesada e o lembrete do fim prematuro', () => {
    const [rage] = getSheetToggles(barbarian(1))
    expect(rage).toMatchObject({ id: 'rage', label: 'Em fúria', source: 'Fúria', page: 48, endsOn: ['unconscious', 'shortRest', 'longRest'], options: [] })
    expect(rage.benefits).toHaveLength(1)
    expect(rage.benefits[0].blockedBy).toBeUndefined()
    expect(kindsOf(rage.benefits[0].effects)).toEqual(['rollMode', 'damageDefenses'])
    expect(rage.earlyEndReminder).toContain('nem sofreu dano')
    // O meio-orc bárbaro não conjura: sem a restrição como efeito de estado.
    expect(rage.effects).toEqual([])
  })

  it('quem conjura ganha a restrição como estado, fora dos benefícios: tiefling bárbaro 1', () => {
    const [rage] = getSheetToggles(barbarian(1, { race: 'tiefling' }))
    expect(rage.effects).toEqual([
      { source: 'Fúria', effect: { kind: 'cannotCast', scope: 'gameState', page: 48 } },
      { source: 'Fúria', effect: { kind: 'endsConcentration', scope: 'gameState', page: 48 } },
    ])
  })

  it('Furioso 6: o Frenesi é a opção, com a exaustão ao fim; a Fúria Inconsciente, imunidade', () => {
    const [rage] = getSheetToggles(barbarian(6, {}, 'berserker'))
    expect(rage.options.map(o => [o.id, o.label, o.source, o.onEnd])).toEqual([['frenzy', 'Frenesi', 'Frenesi', { exhaustion: 1 }]])
    expect(rage.effects).toEqual([
      { source: 'Fúria Inconsciente', effect: { kind: 'conditionImmunity', conditions: ['charmed', 'frightened'], scope: 'gameState' } },
    ])
  })

  it('a Fúria Implacável (11) dá à Fúria o teste para ficar com 1 PV, com quem o dá', () => {
    expect(getSheetToggles(barbarian(10))[0].zeroHpSave).toBeUndefined()
    expect(getSheetToggles(barbarian(11))[0].zeroHpSave).toEqual({
      counter: 'relentless-rage', ability: 'CON', dc: 10, dcStep: 5, resetsOn: 'short', page: 49, source: 'Fúria Implacável',
    })
  })

  it('a Fúria Persistente (15) tira o lembrete do fim prematuro', () => {
    expect(getSheetToggles(barbarian(14))[0].earlyEndReminder).toBeDefined()
    expect('earlyEndReminder' in getSheetToggles(barbarian(15))[0]).toBe(false)
  })

  it('os totens entram com o nome do slot: o mesmo animal pode estar em duas características', () => {
    const totem = barbarian(14, {}, 'totem-warrior', {
      'totem-warrior-totem-3': ['bear'], 'totem-warrior-aspect-6': ['eagle'], 'totem-warrior-attunement-14': ['bear'],
    })
    const [rage] = getSheetToggles(totem)
    expect(rage.effects.map(e => [e.source, e.effect.kind])).toEqual([
      ['Totem Espiritual — Urso', 'damageDefenses'],
      ['Sintonia Totêmica — Urso', 'notice'],
      // O Conselheiro Espiritual conjura (p. 50): a restrição vem junto.
      ['Fúria', 'cannotCast'],
      ['Fúria', 'endsConcentration'],
    ])
  })

  it('sem a Fúria, nada', () => {
    expect(getSheetToggles({ ...structuredClone(EMPTY_DRAFT), class: 'wizard', level: 5 })).toEqual([])
  })
})

describe('resolveActiveEffects', () => {
  it('a Fúria de Placas liga, mas fica com blockedBy e sem os benefícios; a restrição vale assim mesmo', () => {
    const toggles = getSheetToggles(barbarian(1, { race: 'tiefling', ...carrying('plate') }))
    const [rage] = resolveActiveEffects([{ id: 'rage', startedAt: 1 }], toggles)
    expect(rage.blockedBy).toBe('Placas')
    expect(kindsOf(rage.effects)).toEqual(['cannotCast', 'endsConcentration'])
  })

  it('o Urso, sem cláusula de armadura, resiste mesmo de Placas', () => {
    const toggles = getSheetToggles(barbarian(3, carrying('plate'), 'totem-warrior', { 'totem-warrior-totem-3': ['bear'] }))
    const [rage] = resolveActiveEffects([{ id: 'rage', startedAt: 1 }], toggles)
    expect(rage.blockedBy).toBe('Placas')
    expect(rage.effects.map(e => [e.source, e.effect.kind])).toEqual([
      ['Totem Espiritual — Urso', 'damageDefenses'],
      ['Fúria', 'cannotCast'],
      ['Fúria', 'endsConcentration'],
    ])
  })

  it('a opção escolhida ao ligar entra com os efeitos dela; a que não existe, não', () => {
    const toggles = getSheetToggles(barbarian(3, {}, 'berserker'))
    const [frenzy] = resolveActiveEffects([{ id: 'rage', startedAt: 1, option: 'frenzy' }], toggles)
    expect(frenzy.option?.id).toBe('frenzy')
    expect(frenzy.effects.at(-1)?.source).toBe('Frenesi')
    const [plain] = resolveActiveEffects([{ id: 'rage', startedAt: 1, option: 'inventada' }], toggles)
    expect(plain.option).toBeUndefined()
  })

  it('efeito que a ficha não tem fica de fora', () => {
    expect(resolveActiveEffects([{ id: 'rage', startedAt: 1 }], getSheetToggles({ ...structuredClone(EMPTY_DRAFT), class: 'fighter' }))).toEqual([])
  })

  it('getSheetSession resolve o estado contra a ficha, como o PlaySheet', () => {
    const d = barbarian(3, {}, 'berserker')
    const session = getSheetSession(d, raging())
    expect(session.active).toEqual(resolveActiveEffects(raging().activeEffects, buildPlaySheet(d).toggles))
    expect(getSheetSession(d, createPlayState('c')).active).toEqual([])
  })
})

describe('getCatalogToggles: as magias e ações recebidas', () => {
  const human = (patch: Partial<CharacterDraft> = {}): CharacterDraft =>
    ({ ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'fighter', level: 1, ...patch })
  const ids = (d: CharacterDraft) => getCatalogToggles(d).map(t => t.id)

  it('qualquer ficha liga as que um aliado conjura; as de alcance Pessoal, só quem conhece a magia', () => {
    expect(ids(human())).toEqual([
      'spell:bless', 'spell:bane', 'spell:mage-armor', 'spell:shield-of-faith', 'spell:haste',
      'spell:longstrider', 'spell:barkskin', 'action:dodge',
    ])
    const wizard = human({ class: 'wizard', spellChoices: { cantrips: [], spells: ['shield'] } })
    expect(ids(wizard)).toContain('spell:shield')
    expect(ids(wizard)).not.toContain('spell:divine-favor')
    const paladin = human({ class: 'paladin', level: 2, spellChoices: { cantrips: [], spells: ['divine-favor'] } })
    expect(ids(paladin)).toContain('spell:divine-favor')
  })

  it('a concentração e o alcance vêm de spells.json; a ficha que conhece a magia pode tê-la conjurado em si', () => {
    const byId = (d: CharacterDraft) => Object.fromEntries(getCatalogToggles(d).map(t => [t.id, t]))
    const paladin = byId(human({ class: 'paladin', level: 2, spellChoices: { cantrips: [], spells: ['divine-favor', 'bless'] } }))
    expect(paladin['spell:divine-favor']).toMatchObject({ concentration: true, selfOnly: true, known: true })
    expect(paladin['spell:bless']).toMatchObject({ concentration: true, known: true })
    expect(paladin['spell:bless'].selfOnly).toBeUndefined()
    expect(paladin['spell:mage-armor'].concentration).toBeUndefined()
    expect(byId(human())['spell:bless'].known).toBeUndefined()
  })

  it('a fonte é o nome da magia (spells.json) ou o da ação; o rótulo e a página são os da declaração', () => {
    const [bless] = getCatalogToggles(human())
    expect(bless).toMatchObject({ id: 'spell:bless', label: 'Sob a Bênção', source: 'Bênção', page: 223, spellId: 'bless' })
    expect(getCatalogToggles(human()).at(-1)).toMatchObject({ id: 'action:dodge', label: 'Esquivando', source: 'Esquivar', page: 194 })
  })

  // A conta das durações (`spells.json`), como a da Fúria: a Bênção (1 minuto) acaba nos dois
  // descansos; a Armadura Arcana (8 horas), só no longo, que tem pelo menos 8 horas (p. 188).
  it('o descanso encerra pela duração da magia, sem cópia dela', () => {
    const byId = Object.fromEntries(getCatalogToggles(human()).map(t => [t.id, t.endsOn]))
    expect(byId['spell:bless']).toEqual(['shortRest', 'longRest'])
    expect(byId['spell:mage-armor']).toEqual(['donArmor', 'longRest'])
    expect(byId['spell:longstrider']).toEqual(['shortRest', 'longRest'])
    expect(byId['action:dodge']).toEqual(['startOfYourTurn', 'incapacitated', 'speedZero', 'shortRest', 'longRest'])
  })

  it('a Armadura Arcana fica sem os benefícios de armadura vestida; o escudo não a impede', () => {
    const mageArmor = (d: CharacterDraft) => getCatalogToggles(d).find(t => t.id === 'spell:mage-armor')?.benefits[0]
    expect(mageArmor(human(carrying('chain-mail')))?.blockedBy).toBe('Cota de Malha')
    expect(mageArmor(human(carrying('shield')))?.blockedBy).toBeUndefined()
  })

  it('o PlaySheet e a sessão levam os da ficha e os do catálogo', () => {
    const d = barbarian(1)
    expect(getSessionToggles(d).map(t => t.id)).toEqual(['rage', ...ids(d)])
    expect(buildPlaySheet(d).toggles.map(t => t.id)).toEqual(getSessionToggles(d).map(t => t.id))
    const blessed = { ...createPlayState('c'), activeEffects: [{ id: 'spell:bless', startedAt: 1 }] }
    expect(getSheetSession(d, blessed).active.map(t => [t.id, t.source])).toEqual([['spell:bless', 'Bênção']])
  })
})

// Duas portas, sem conta paralela: sem sessão, NO_SESSION e a sessão de um estado sem efeito
// ligado dão a mesma ficha. A Revisão e o PDF nunca passam sessão.
describe('sem sessão ≡ NO_SESSION ≡ estado sem efeito ligado', () => {
  const drafts: [string, CharacterDraft][] = [
    ['a ficha de fixtures (Krusk, bárbaro 1)', COMPLETE_DRAFT],
    ['bárbaro 3 com machado grande, rapieira e machadinha', barbarian(3, carrying('greataxe', 'rapier', 'handaxe'))],
    ['tiefling bárbaro 5 de Placas', barbarian(5, { race: 'tiefling', ...carrying('plate', 'greatsword') })],
    ['Guerreiro Totêmico 14 (Urso, Águia, Águia)', barbarian(14, {}, 'totem-warrior', {
      'totem-warrior-totem-3': ['bear'], 'totem-warrior-aspect-6': ['eagle'], 'totem-warrior-attunement-14': ['eagle'],
    })],
  ]

  it.each(drafts)('%s: linhas de ataque, restrições e guia inteiro', (_, d) => {
    const scores = getFinalAbilityScores(d)
    expect(getSheetAttacks(d, scores, NO_SESSION)).toEqual(getSheetAttacks(d, scores))
    expect(getCastingRestrictions(d, NO_SESSION)).toEqual(getCastingRestrictions(d))
    const empty = createPlayState('c')
    // Um id que a ficha não tem não muda nada.
    const unknown = { ...empty, activeEffects: [{ id: 'spell:inventada', startedAt: 1 }] }
    expect(getRollGuide(d, unknown)).toEqual(getRollGuide(d, empty))
    expect(getConcentrationGuide(d, unknown, 10)).toEqual(getConcentrationGuide(d, empty, 10))
  })
})

describe('describeToggleEffects: o que o efeito ligado está fazendo', () => {
  const describe1 = (d: CharacterDraft, option?: string) => {
    const [t] = resolveActiveEffects([{ id: 'rage', startedAt: 1, ...(option ? { option } : {}) }], getSheetToggles(d))
    return describeToggleEffects(d, t, 30)
  }

  it('bárbaro 9: a vantagem, o Dano de Fúria do nível e a resistência, com a origem', () => {
    expect(describe1(barbarian(9))).toEqual([
      'Vantagem em testes e testes de resistência de Força (Fúria)',
      '+3 de dano nos ataques com arma corpo a corpo usando Força (Dano de Fúria)',
      'Resistência a concussão, cortante e perfurante (Fúria)',
    ])
  })

  it('de Placas vestidas no jogo, com a sessão: sem os benefícios e sem o Dano de Fúria', () => {
    // Gibão no criador; Placas vestidas no jogo (a base é o Gibão).
    const d = barbarian(3, carrying('hide', 'plate'))
    const lines = (bodyArmorId: string | null) => {
      const session = getSheetSession(d, raging({ wornArmor: { bodyArmorId, shield: false, basis: { bodyArmorId: 'hide', shield: false } } }))
      return describeToggleEffects(d, session.active[0], 30, session)
    }
    expect(lines('plate')).toEqual([])
    expect(lines(null)).toContain('+2 de dano nos ataques com arma corpo a corpo usando Força (Dano de Fúria)')
  })

  it('de Placas, sem os benefícios: só o que fica proibido, para quem conjura', () => {
    expect(describe1(barbarian(3, { race: 'tiefling', ...carrying('plate') }))).toEqual([
      'Não pode conjurar magias nem se concentrar nelas (Fúria)',
    ])
  })

  it('Furioso 6 em frenesi: a imunidade e o lembrete do Frenesi', () => {
    expect(describe1(barbarian(6, {}, 'berserker'), 'frenzy').slice(2)).toEqual([
      'Resistência a concussão, cortante e perfurante (Fúria)',
      'Imunidade às condições Enfeitiçado e Amedrontado (Fúria Inconsciente)',
      'Em cada um dos seus turnos seguintes, você pode fazer um único ataque corpo-a-corpo com arma como ação bônus (Frenesi)',
    ])
  })

  it('Guerreiro Totêmico 14 (Urso, Águia): a resistência do Urso e o voo pelo deslocamento de caminhada', () => {
    const totem = barbarian(14, {}, 'totem-warrior', { 'totem-warrior-totem-3': ['bear'], 'totem-warrior-attunement-14': ['eagle'] })
    const lines = describe1(totem)
    expect(lines).toContain('Resistência a todo dano, exceto psíquico (Totem Espiritual — Urso)')
    expect(lines).toContain('Deslocamento de voo de 9 m, igual ao de caminhada (Sintonia Totêmica — Águia)')
    expect(lines.at(-1)).toBe('Não pode conjurar magias nem se concentrar nelas (Fúria)')
  })
})

describe('os efeitos recebidos nos números, pela sessão', () => {
  const wizard = (patch: Partial<CharacterDraft> = {}): CharacterDraft => ({
    ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'wizard', level: 3,
    abilityScores: { STR: 8, DEX: 16, CON: 12, INT: 16, WIS: 10, CHA: 10 },
    spellChoices: { cantrips: [], spells: ['shield', 'mage-armor'] }, ...patch,
  })
  const on = (...ids: string[]) => ({ ...createPlayState('c'), activeEffects: ids.map((id, i) => ({ id, startedAt: i })) })
  const ac = (d: CharacterDraft, ...ids: string[]) => getSheetArmorClass(d, getFinalAbilityScores(d), getSheetSession(d, on(...ids)))

  it('a CA: a Armadura Arcana disputa a base e o Escudo Arcano é parcela, com o nome da magia', () => {
    // Humano +1 em tudo: DES 17 (+3).
    expect(ac(wizard()).value).toBe(13)
    expect(ac(wizard(), 'spell:mage-armor').components).toEqual([
      { label: 'Armadura Arcana', value: 13 }, { label: 'DES', value: 3 },
    ])
    expect(formatArmorClassBreakdown(ac(wizard(), 'spell:mage-armor', 'spell:shield'))).toBe('13 (Armadura Arcana) + 3 (DES) + 5 (Escudo Arcano)')
    // A Revisão e o PDF não passam sessão.
    expect(getSheetArmorClass(wizard(), getFinalAbilityScores(wizard())).value).toBe(13)
  })

  it('de armadura vestida, a Armadura Arcana fica sem os benefícios e a CA é a da armadura', () => {
    const armored = wizard(carrying('leather'))
    expect(ac(armored, 'spell:mage-armor').value).toBe(14)
    expect(getSheetSession(armored, on('spell:mage-armor')).active[0].blockedBy).toBe('Couro')
  })

  it('a Armadura Arcana do catálogo olha a armadura vestida no jogo, não a do criador', () => {
    // Couro no criador; no jogo, tirou o Couro (base Couro) e recebeu a magia: 13 + DES 3.
    const armored = wizard(carrying('leather', 'chain-mail'))
    const off = { ...on('spell:mage-armor'), wornArmor: { bodyArmorId: null, shield: false, basis: { bodyArmorId: 'leather', shield: false } } }
    const session = getSheetSession(armored, off)
    expect(session.active[0].blockedBy).toBeUndefined()
    expect(getSheetArmorClass(armored, getFinalAbilityScores(armored), session).components).toEqual([
      { label: 'Armadura Arcana', value: 13 }, { label: 'DES', value: 3 },
    ])
    // A lista do PlaySheet (`getCatalogToggles` com a sessão), nos dois sentidos.
    const mageArmor = (worn?: PlayState['wornArmor']) =>
      buildPlaySheet(armored, worn).toggles.find(t => t.id === 'spell:mage-armor')?.benefits[0].blockedBy
    expect(mageArmor()).toBe('Couro')
    expect(mageArmor(off.wornArmor)).toBeUndefined()
    expect(mageArmor({ bodyArmorId: 'chain-mail', shield: false, basis: { bodyArmorId: 'leather', shield: false } })).toBe('Cota de Malha')
  })

  it('a Pele de Árvore é piso, e o Escudo da Fé com a Velocidade somam +4', () => {
    expect(ac(wizard(), 'spell:barkskin').value).toBe(16)
    expect(ac(wizard(), 'spell:shield-of-faith', 'spell:haste').value).toBe(17)
  })

  it('describeToggleEffects diz o que cada um faz, com a magia', () => {
    const lines = (id: string) => {
      const d = wizard()
      const [t] = getSheetSession(d, on(id)).active
      return describeToggleEffects(d, t, 30)
    }
    expect(lines('spell:bless')).toEqual(['+1d4 nas jogadas de ataque e testes de resistência, inclusive no teste contra a morte (Bênção)'])
    expect(lines('spell:bane')).toEqual(['−1d4 nas jogadas de ataque e testes de resistência, inclusive no teste contra a morte (Perdição)'])
    expect(lines('spell:shield')).toEqual(['+5 na CA (Escudo Arcano)', 'Você não sofre dano de mísseis mágicos (Escudo Arcano)'])
    expect(lines('spell:mage-armor')).toEqual(['CA sem armadura de 13 + Destreza, se for a maior (Armadura Arcana)'])
    expect(lines('spell:haste')).toEqual([
      'Vantagem em testes de resistência de Destreza (Velocidade)',
      '+2 na CA (Velocidade)',
      'Deslocamento dobrado (Velocidade)',
      'Uma ação a mais em cada um dos seus turnos, só para Atacar (um ataque com arma, apenas), Disparada, Desengajar, Esconder ou Usar um Objeto (Velocidade)',
    ])
    expect(lines('spell:longstrider')).toEqual(['+3 m de deslocamento (Passos Longos)'])
    expect(lines('spell:barkskin')).toEqual(['CA mínima de 16 (Pele de Árvore)'])
    expect(lines('action:dodge')).toEqual([
      'Vantagem em testes de resistência de Destreza (Esquivar)',
      'Toda jogada de ataque contra você tem desvantagem, se você puder ver o atacante (Esquivar)',
    ])
    const paladin: CharacterDraft = { ...wizard(), class: 'paladin', spellChoices: { cantrips: [], spells: ['divine-favor'] } }
    const [favor] = getSheetSession(paladin, on('spell:divine-favor')).active
    expect(describeToggleEffects(paladin, favor, 30)).toEqual(['+1d4 radiante nos ataques com arma (Auxílio Divino)'])
  })
})
