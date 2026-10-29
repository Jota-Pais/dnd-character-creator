import { describe, it, expect } from 'vitest'
import {
  stepValue, evaluateQuantity, evaluateResource, describeResource, formatResourceLine,
  groupResourcesBySource, resourceGroupsNeedLabels, resourceSourceLabel,
  type FinalScores, type ResourceSource, type SheetResource,
} from '../classResourceUtils'
import { getSheetResources } from '../sheetEffects'
import { EMPTY_DRAFT, type CharacterDraft, type ClassEntry } from '../../types/character'

const scores = (over: Partial<FinalScores> = {}): FinalScores =>
  ({ STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10, ...over })

function draft(classId: string, level: number, over: Partial<CharacterDraft> = {}): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), class: classId, level, ...over }
}

function withSubclass(classId: string, level: number, subclass: string): CharacterDraft {
  const d = draft(classId, level)
  d.classChoices = { ...d.classChoices, subclass }
  return d
}

function extra(classId: string, level: number, subclass: string | null = null): ClassEntry {
  return {
    classId, level,
    classChoices: { ...EMPTY_DRAFT.classChoices, subclass },
    spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
  }
}

const find = (rs: SheetResource[], id: string) => rs.find(r => r.id === id)

const classSource = (id: string, name = id): ResourceSource => ({ kind: 'class', id, name })

// ── Peças puras ────────────────────────────────────────────────────────────────

describe('stepValue', () => {
  const steps = [{ from: 3, value: 'b' }, { from: 1, value: 'a' }, { from: 17, value: 'c' }]
  it('pega o degrau alcançado, em qualquer ordem de declaração', () => {
    expect(stepValue(steps, 1)).toBe('a')
    expect(stepValue(steps, 16)).toBe('b')
    expect(stepValue(steps, 20)).toBe('c')
  })
  it('antes do primeiro degrau não há valor', () => {
    expect(stepValue([{ from: 2, value: 1 }], 1)).toBeUndefined()
  })
})

describe('evaluateQuantity', () => {
  it('número fixo passa direto', () => {
    expect(evaluateQuantity(3, 7, scores())).toBe(3)
  })
  it('múltiplo do nível (Cura pelas Mãos = 5 × nível)', () => {
    expect(evaluateQuantity({ perClassLevel: 5 }, 4, scores())).toBe(20)
  })
  it('metade do nível, para cima ou para baixo', () => {
    expect(evaluateQuantity({ halfClassLevel: 'up' }, 5, scores())).toBe(3)
    expect(evaluateQuantity({ halfClassLevel: 'down' }, 5, scores())).toBe(2)
  })
  it('modificador com mínimo (Inspiração de Bardo)', () => {
    expect(evaluateQuantity({ ability: 'CHA', min: 1 }, 1, scores({ CHA: 18 }))).toBe(4)
    expect(evaluateQuantity({ ability: 'CHA', min: 1 }, 1, scores({ CHA: 8 }))).toBe(1)
  })
  it('soma as parcelas (Proteção Arcana = 2 × nível + INT)', () => {
    expect(evaluateQuantity({ perClassLevel: 2, ability: 'INT' }, 6, scores({ INT: 16 }))).toBe(15)
  })
})

describe('evaluateResource', () => {
  it('monta o dado com quantidade e bônus (Retomar o Fôlego 1d10 + nível)', () => {
    const r = evaluateResource(
      { id: 'x', name: 'X', die: { count: 1, size: 10, bonus: { perClassLevel: 1 } }, uses: 1 },
      classSource('fighter'), 5, scores(),
    )
    expect(r.die).toBe('1d10+5')
  })
  it('usos nunca ficam negativos', () => {
    const r = evaluateResource({ id: 'x', name: 'X', uses: { ability: 'CHA', plus: 1 } }, classSource('paladin'), 1, scores({ CHA: 6 }))
    expect(r.uses).toBe(0)
  })
  it('ilimitado a partir do nível declarado, sem recarga', () => {
    const effect = { id: 'x', name: 'X', uses: 2, recharge: 'short' as const, unlimitedFrom: 20 }
    expect(evaluateResource(effect, classSource('druid'), 19, scores())).toMatchObject({ uses: 2, recharge: 'short' })
    const at20 = evaluateResource(effect, classSource('druid'), 20, scores())
    expect(at20.uses).toBe('unlimited')
    expect(at20.recharge).toBeUndefined()
  })
})

describe('describeResource / formatResourceLine', () => {
  const base = { source: classSource('bard', 'Bardo'), unit: 'uses' as const, sharedWith: [], addedFrom: [] }

  it('usos viram círculos para marcar a lápis', () => {
    const r: SheetResource = { ...base, id: 'bi', name: 'Inspiração de Bardo', die: 'd6', uses: 4, recharge: 'long' }
    expect(formatResourceLine(r)).toBe('Inspiração de Bardo d6 — 4 usos ○ ○ ○ ○ (recupera em descanso longo)')
  })
  it('poço de PV vira número + "___ restantes"', () => {
    const r: SheetResource = { ...base, id: 'loh', name: 'Cura pelas Mãos', uses: 20, unit: 'hp', recharge: 'long' }
    expect(formatResourceLine(r)).toBe('Cura pelas Mãos — 20 PV, ___ restantes (recupera em descanso longo)')
  })
  it('poço grande de pontos também vira "___ restantes"', () => {
    const r: SheetResource = { ...base, id: 'ki', name: 'Pontos de Chi', uses: 13, unit: 'points', recharge: 'short' }
    expect(describeResource(r).track).toEqual({ kind: 'remaining' })
    expect(formatResourceLine(r)).toBe('Pontos de Chi — 13 pontos, ___ restantes (recupera em descanso curto ou longo)')
  })
  it('recurso que é só dado não ganha círculos', () => {
    const r: SheetResource = { ...base, id: 'sa', name: 'Ataque Furtivo', die: '3d6' }
    expect(describeResource(r).track).toBeNull()
    expect(formatResourceLine(r)).toBe('Ataque Furtivo 3d6')
  })
  it('zero usos não desenha círculo', () => {
    const r: SheetResource = { ...base, id: 'ds', name: 'Sentido Divino', uses: 0, recharge: 'long' }
    expect(describeResource(r).track).toBeNull()
    expect(describeResource(r).quantity).toBe('0 usos')
  })
  it('recurso compartilhado avisa que os usos não se somam', () => {
    const r: SheetResource = { ...base, id: 'cd', name: 'Canalizar Divindade', uses: 2, recharge: 'short', sharedWith: [classSource('paladin', 'Paladino')] }
    expect(describeResource(r).notes).toEqual(['um só recurso com o de Paladino — os usos não se somam (p. 166)'])
  })
})

describe('groupResourcesBySource', () => {
  const mk = (id: string, source: ResourceSource): SheetResource =>
    ({ id, name: id, source, unit: 'uses', sharedWith: [], addedFrom: [] })

  it('agrupa pela fonte, na ordem de aparição', () => {
    const groups = groupResourcesBySource([mk('a', classSource('monk')), mk('b', classSource('rogue')), mk('c', classSource('monk'))])
    expect(groups.map(g => [g.source.id, g.resources.map(r => r.id)])).toEqual([['monk', ['a', 'c']], ['rogue', ['b']]])
  })
  it('fontes de tipos diferentes com o mesmo id não se misturam', () => {
    const groups = groupResourcesBySource([
      mk('a', { kind: 'feat', id: 'x', name: 'X' }),
      mk('b', { kind: 'race', id: 'x', name: 'X' }),
    ])
    expect(groups).toHaveLength(2)
  })
  it('cabeçalho só quando há mais de uma fonte ou a fonte não é classe', () => {
    expect(resourceGroupsNeedLabels([{ source: classSource('bard') }])).toBe(false)
    expect(resourceGroupsNeedLabels([{ source: classSource('bard') }, { source: classSource('monk') }])).toBe(true)
    expect(resourceGroupsNeedLabels([{ source: { kind: 'feat', id: 'sortudo', name: 'Sortudo' } }])).toBe(true)
  })
  it('o cabeçalho diz de onde vem', () => {
    expect(resourceSourceLabel(classSource('bard', 'Bardo'))).toBe('Bardo')
    expect(resourceSourceLabel({ kind: 'feat', id: 'sortudo', name: 'Sortudo' })).toBe('Sortudo (talento)')
    expect(resourceSourceLabel({ kind: 'race', id: 'half-orc', name: 'Meio-Orc' })).toBe('Meio-Orc (raça)')
  })
})

// ── Motor com os dados reais (class-progression-features.json) ──────────────────

describe('getSheetResources — bardo', () => {
  it('Inspiração de Bardo: usos = mod. de CAR (CAR 18 → 4)', () => {
    const bi = find(getSheetResources(draft('bard', 4), scores({ CHA: 18 })), 'bardic-inspiration')
    expect(bi).toMatchObject({ die: 'd6', uses: 4, recharge: 'long' })
  })
  it('Inspiração de Bardo: mínimo 1 (CAR 8 → 1)', () => {
    expect(find(getSheetResources(draft('bard', 1), scores({ CHA: 8 })), 'bardic-inspiration')?.uses).toBe(1)
  })
  it('Fonte de Inspiração: a recarga passa a curto ou longo no 5º nível, e o dado vira d8', () => {
    expect(find(getSheetResources(draft('bard', 4), scores()), 'bardic-inspiration')?.recharge).toBe('long')
    expect(find(getSheetResources(draft('bard', 5), scores()), 'bardic-inspiration'))
      .toMatchObject({ recharge: 'short', die: 'd8' })
    expect(find(getSheetResources(draft('bard', 15), scores()), 'bardic-inspiration')?.die).toBe('d12')
  })
  it('Canção de Descanso: d6 no 2º, d8 no 9º, d10 no 13º, d12 no 17º (p. 54)', () => {
    const die = (lv: number) => find(getSheetResources(draft('bard', lv), scores()), 'song-of-rest')?.die
    expect(die(1)).toBeUndefined()
    expect(die(2)).toBe('d6')
    expect(die(8)).toBe('d6')
    expect(die(9)).toBe('d8')
    expect(die(13)).toBe('d10')
    expect(die(17)).toBe('d12')
  })
})

describe('getSheetResources — guerreiro', () => {
  it('nível 1: só Retomar o Fôlego, 1d10 + nível, curto ou longo', () => {
    const rs = getSheetResources(draft('fighter', 1), scores())
    expect(rs.map(r => r.id)).toEqual(['second-wind'])
    expect(rs[0]).toMatchObject({ die: '1d10+1', uses: 1, recharge: 'short' })
  })
  it('Surto de Ação 1 no 2º, 2 no 17º; Indomável 1/2/3 nos níveis 9/13/17', () => {
    const at = (lv: number) => getSheetResources(draft('fighter', lv), scores())
    expect(find(at(2), 'action-surge')?.uses).toBe(1)
    expect(find(at(16), 'action-surge')?.uses).toBe(1)
    expect(find(at(17), 'action-surge')?.uses).toBe(2)
    expect(find(at(8), 'indomitable')).toBeUndefined()
    expect(find(at(9), 'indomitable')).toMatchObject({ uses: 1, recharge: 'long' })
    expect(find(at(13), 'indomitable')?.uses).toBe(2)
    expect(find(at(17), 'indomitable')?.uses).toBe(3)
  })
  it('Mestre de Batalha: 4d8 no 3º, 5 dados no 7º, d10 no 10º, 6 dados no 15º, d12 no 18º', () => {
    const sd = (lv: number) => find(getSheetResources(withSubclass('fighter', lv, 'battle-master'), scores()), 'superiority-dice')
    expect(sd(3)).toMatchObject({ die: 'd8', uses: 4, unit: 'dice', recharge: 'short' })
    expect(sd(7)?.uses).toBe(5)
    expect(sd(10)?.die).toBe('d10')
    expect(sd(15)?.uses).toBe(6)
    expect(sd(18)?.die).toBe('d12')
    expect(find(getSheetResources(withSubclass('fighter', 3, 'champion'), scores()), 'superiority-dice')).toBeUndefined()
  })
})

describe('getSheetResources — paladino', () => {
  it('Cura pelas Mãos = 5 × nível de paladino, em PV', () => {
    expect(find(getSheetResources(draft('paladin', 1), scores()), 'lay-on-hands'))
      .toMatchObject({ uses: 5, unit: 'hp', recharge: 'long' })
    expect(find(getSheetResources(draft('paladin', 7), scores()), 'lay-on-hands')?.uses).toBe(35)
  })
  it('Sentido Divino = 1 + mod. de CAR (p. 110), mínimo 1 (decisão de 2026-10-25)', () => {
    const ds = (cha: number) => find(getSheetResources(draft('paladin', 1), scores({ CHA: cha })), 'divine-sense')?.uses
    expect(ds(16)).toBe(4)
    expect(ds(10)).toBe(1)
    expect(ds(8)).toBe(1)
    expect(ds(4)).toBe(1)
  })
  it('Toque Purificador no 14º: mod. de CAR, mínimo 1', () => {
    expect(find(getSheetResources(draft('paladin', 13), scores()), 'cleansing-touch')).toBeUndefined()
    expect(find(getSheetResources(draft('paladin', 14), scores({ CHA: 8 })), 'cleansing-touch')?.uses).toBe(1)
    expect(find(getSheetResources(draft('paladin', 14), scores({ CHA: 18 })), 'cleansing-touch')?.uses).toBe(4)
  })
})

describe('getSheetResources — demais classes', () => {
  it('druida: Forma Selvagem 2 vezes (curto); ilimitada no 20º (Arquidruida)', () => {
    expect(find(getSheetResources(draft('druid', 2), scores()), 'wild-shape')).toMatchObject({ uses: 2, recharge: 'short' })
    const ws = find(getSheetResources(draft('druid', 20), scores()), 'wild-shape')
    expect(ws?.uses).toBe('unlimited')
    expect(formatResourceLine(ws!)).toBe('Forma Selvagem — usos ilimitados')
  })
  it('bárbaro: Fúrias 2 → 6 e ilimitadas no 20º; dano +2/+3/+4', () => {
    const at = (lv: number) => getSheetResources(draft('barbarian', lv), scores())
    expect(find(at(1), 'rage')).toMatchObject({ uses: 2, recharge: 'long' })
    expect(find(at(17), 'rage')?.uses).toBe(6)
    expect(find(at(20), 'rage')?.uses).toBe('unlimited')
    expect(find(at(8), 'rage-damage')?.amount).toEqual({ value: 2, unit: 'bonus' })
    expect(find(at(16), 'rage-damage')?.amount).toEqual({ value: 4, unit: 'bonus' })
  })
  it('clérigo da Guerra: Sacerdote da Guerra = mod. de SAB (mín. 1), mais Canalizar Divindade 1/2/3', () => {
    const rs = getSheetResources(withSubclass('cleric', 6, 'war-domain'), scores({ WIS: 16 }))
    expect(find(rs, 'war-priest')).toMatchObject({ uses: 3, recharge: 'long' })
    expect(find(rs, 'channel-divinity')).toMatchObject({ uses: 2, recharge: 'short' })
  })
  it('mago: Recuperação Arcana uma vez por dia, até metade do nível (para cima)', () => {
    const ar = find(getSheetResources(draft('wizard', 5), scores()), 'arcane-recovery')
    expect(ar).toMatchObject({ uses: 1, recharge: 'day', amount: { value: 3, unit: 'slotLevels' } })
  })
  it('druida da Terra: Recuperação Natural até metade do nível (para baixo)', () => {
    const nr = find(getSheetResources(withSubclass('druid', 5, 'circle-of-the-land'), scores()), 'natural-recovery')
    expect(nr?.amount).toEqual({ value: 2, unit: 'slotLevels' })
  })
  it('ladino: Ataque Furtivo ⌈nível/2⌉d6, Golpe de Sorte no 20º', () => {
    expect(find(getSheetResources(draft('rogue', 5), scores()), 'sneak-attack')?.die).toBe('3d6')
    expect(find(getSheetResources(draft('rogue', 19), scores()), 'stroke-of-luck')).toBeUndefined()
    expect(find(getSheetResources(draft('rogue', 20), scores()), 'stroke-of-luck')).toMatchObject({ uses: 1, recharge: 'short' })
  })
  it('bruxo: Invocações não são recurso (não se gastam)', () => {
    expect(getSheetResources(draft('warlock', 5), scores()).map(r => r.id)).not.toContain('invocations')
    expect(getSheetResources(draft('warlock', 5), scores())).toEqual([])
  })
  it('monge da Mão Aberta: Integridade Corporal cura 3 × nível de monge', () => {
    const wb = find(getSheetResources(withSubclass('monk', 6, 'open-hand'), scores()), 'wholeness-of-body')
    expect(formatResourceLine(wb!)).toBe('Integridade Corporal — cura 18 PV · 1 uso ○ (recupera em descanso longo)')
  })
})

describe('getSheetResources — multiclasse', () => {
  it('cada recurso usa o nível NA classe dona: monge 3 / ladino 2', () => {
    const d = draft('monk', 5, { multiclass: true, additionalClasses: [extra('rogue', 2)] })
    const rs = getSheetResources(d, scores())
    expect(find(rs, 'ki')).toMatchObject({ uses: 3, source: { kind: 'class', id: 'monk' } })
    expect(find(rs, 'sneak-attack')).toMatchObject({ die: '1d6', source: { kind: 'class', id: 'rogue' } })
  })
  it('Canalizar Divindade de clérigo 6 e paladino 4 é um recurso só, com os usos do maior (p. 166)', () => {
    const d = draft('cleric', 10, { multiclass: true, additionalClasses: [extra('paladin', 4, 'oath-of-devotion')] })
    const cds = getSheetResources(d, scores()).filter(r => r.id === 'channel-divinity')
    expect(cds).toHaveLength(1)
    expect(cds[0]).toMatchObject({ uses: 2, source: { id: 'cleric' }, sharedWith: [{ kind: 'class', id: 'paladin', name: 'Paladino' }] })
  })
  it('bardo 1 numa multiclasse ainda usa o CAR final e não ganha a Canção de Descanso', () => {
    const d = draft('fighter', 3, { multiclass: true, additionalClasses: [extra('bard', 1)] })
    const rs = getSheetResources(d, scores({ CHA: 14 }))
    expect(find(rs, 'bardic-inspiration')).toMatchObject({ uses: 2, die: 'd6', recharge: 'long' })
    expect(find(rs, 'song-of-rest')).toBeUndefined()
    expect(find(rs, 'action-surge')?.uses).toBe(1)
  })
})

// ── Talentos e traços raciais (feats.json, races.json) ─────────────────────────

/** O talento do Humano Variante é o jeito mais curto de dar um talento a um draft de teste. */
function withFeat(d: CharacterDraft, featId: string): CharacterDraft {
  return { ...d, race: 'human', subrace: 'variant-human', raceChoices: { ...d.raceChoices, feat: featId } }
}

function withRace(d: CharacterDraft, race: string, subrace: string | null = null): CharacterDraft {
  return { ...d, race, subrace }
}

describe('getSheetResources — talentos', () => {
  it('Sortudo: 3 pontos de sorte, recuperados em descanso longo (p. 172), com a origem', () => {
    const luck = find(getSheetResources(withFeat(draft('bard', 4), 'sortudo'), scores()), 'luck-points')
    expect(luck).toMatchObject({ uses: 3, unit: 'points', recharge: 'long', source: { kind: 'feat', id: 'sortudo', name: 'Sortudo' } })
    expect(formatResourceLine(luck!)).toBe('Pontos de Sorte — 3 pontos ○ ○ ○ (recupera em descanso longo)')
  })
  it('Adepto Marcial sem Mestre de Batalha: um dado de superioridade d6, curto ou longo (p. 167)', () => {
    const sd = find(getSheetResources(withFeat(draft('bard', 4), 'adepto-marcial'), scores()), 'superiority-dice')
    expect(sd).toMatchObject({ die: 'd6', uses: 1, unit: 'dice', recharge: 'short', source: { kind: 'feat', id: 'adepto-marcial' } })
  })
  it('Adepto Marcial com Mestre de Batalha: +1 dado no poço da classe, que mantém o d8', () => {
    const d = withFeat(withSubclass('fighter', 3, 'battle-master'), 'adepto-marcial')
    const sds = getSheetResources(d, scores()).filter(r => r.id === 'superiority-dice')
    expect(sds).toHaveLength(1)
    expect(sds[0]).toMatchObject({ die: 'd8', uses: 5, source: { kind: 'class', id: 'fighter' } })
    expect(formatResourceLine(sds[0])).toBe(
      'Dados de Superioridade d8 — 5 dados ○ ○ ○ ○ ○ (recupera em descanso curto ou longo; inclui 1 dado de Adepto Marcial (talento))',
    )
  })
  it('Adepto Marcial soma ao Mestre de Batalha mesmo vindo de uma classe adicional', () => {
    const d = withFeat(draft('rogue', 6, { multiclass: true, additionalClasses: [extra('fighter', 3, 'battle-master')] }), 'adepto-marcial')
    expect(find(getSheetResources(d, scores()), 'superiority-dice')).toMatchObject({ die: 'd8', uses: 5 })
  })
  it('Iniciado em Magia: a magia de 1º nível do talento uma vez por descanso longo (p. 170)', () => {
    expect(find(getSheetResources(withFeat(draft('fighter', 1), 'iniciado-em-magia'), scores()), 'magic-initiate-spell'))
      .toMatchObject({ uses: 1, recharge: 'long', source: { kind: 'feat' } })
  })
  it('talento sem uso limitado não vira recurso', () => {
    expect(getSheetResources(withFeat(draft('wizard', 1), 'alerta'), scores()).map(r => r.source.kind)).not.toContain('feat')
  })
})

describe('getSheetResources — traços raciais', () => {
  it('Arma de Sopro: 2d6, CD 8 + CON + proficiência, curto ou longo (p. 34)', () => {
    const bw = find(getSheetResources(withRace(draft('fighter', 1), 'dragonborn', 'red-dragonborn'), scores({ CON: 14 })), 'breath-weapon')
    expect(bw).toMatchObject({
      die: '2d6', uses: 1, recharge: 'short', amount: { value: 12, unit: 'saveDc' },
      source: { kind: 'race', id: 'red-dragonborn', name: 'Draconato Vermelho' },
    })
    expect(formatResourceLine(bw!)).toBe('Arma de Sopro 2d6 — CD 12 · 1 uso ○ (recupera em descanso curto ou longo)')
  })
  it('Arma de Sopro cresce no 6º, 11º e 16º nível de personagem, e a CD acompanha a proficiência', () => {
    const bw = (lv: number) => find(getSheetResources(withRace(draft('fighter', lv), 'dragonborn', 'red-dragonborn'), scores()), 'breath-weapon')
    expect(bw(5)).toMatchObject({ die: '2d6', amount: { value: 11 } })
    expect(bw(6)?.die).toBe('3d6')
    expect(bw(10)?.die).toBe('3d6')
    expect(bw(11)?.die).toBe('4d6')
    expect(bw(16)).toMatchObject({ die: '5d6', amount: { value: 13 } })
  })
  it('na multiclasse, a Arma de Sopro usa o nível de personagem, não o de uma classe', () => {
    const d = withRace(draft('fighter', 6, { multiclass: true, additionalClasses: [extra('bard', 3)] }), 'dragonborn', 'red-dragonborn')
    expect(find(getSheetResources(d, scores()), 'breath-weapon')?.die).toBe('3d6')
  })
  it('Resistência Implacável do meio-orc: uma vez por descanso longo (p. 41)', () => {
    expect(find(getSheetResources(withRace(draft('barbarian', 1), 'half-orc'), scores()), 'relentless-endurance'))
      .toMatchObject({ uses: 1, recharge: 'long', source: { kind: 'race', id: 'half-orc', name: 'Meio-Orc' } })
  })
  it('a ficha lista classe, depois raça, depois talentos', () => {
    const d = withFeat(draft('bard', 4), 'sortudo')
    const rs = getSheetResources(withRace(d, 'human', 'variant-human'), scores({ CHA: 18 }))
    expect(rs.map(r => r.source.kind)).toEqual(['class', 'class', 'feat'])
    // Talento de um espaço de ASI (bárbaro 4), não do Humano Variante.
    const d2 = withRace(draft('barbarian', 4, { asiChoices: [{ kind: 'feat', featId: 'sortudo' }] }), 'half-orc')
    expect(groupResourcesBySource(getSheetResources(d2, scores())).map(g => g.source.kind)).toEqual(['class', 'race', 'feat'])
  })
  it('sem classe, os recursos da raça ainda aparecem', () => {
    const d = withRace({ ...structuredClone(EMPTY_DRAFT), level: 1 }, 'half-orc')
    expect(getSheetResources(d, scores()).map(r => r.id)).toEqual(['relentless-endurance'])
  })
})
