import { describe, it, expect } from 'vitest'
import {
  stepValue, evaluateQuantity, evaluateResource, describeResource, formatResourceLine,
  groupResourcesByClass, type FinalScores, type SheetResource,
} from '../classResourceUtils'
import { getClassResources } from '../sheetEffects'
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
      'fighter', 5, scores(),
    )
    expect(r.die).toBe('1d10+5')
  })
  it('usos nunca ficam negativos', () => {
    const r = evaluateResource({ id: 'x', name: 'X', uses: { ability: 'CHA', plus: 1 } }, 'paladin', 1, scores({ CHA: 6 }))
    expect(r.uses).toBe(0)
  })
  it('ilimitado a partir do nível declarado, sem recarga', () => {
    const effect = { id: 'x', name: 'X', uses: 2, recharge: 'short' as const, unlimitedFrom: 20 }
    expect(evaluateResource(effect, 'druid', 19, scores())).toMatchObject({ uses: 2, recharge: 'short' })
    const at20 = evaluateResource(effect, 'druid', 20, scores())
    expect(at20.uses).toBe('unlimited')
    expect(at20.recharge).toBeUndefined()
  })
})

describe('describeResource / formatResourceLine', () => {
  const base = { classId: 'bard', unit: 'uses' as const, sharedWith: [] }

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
    const r: SheetResource = { ...base, id: 'cd', name: 'Canalizar Divindade', uses: 2, recharge: 'short', sharedWith: ['paladin'] }
    expect(describeResource(r).notes).toEqual(['um só recurso com o de Paladino — os usos não se somam (p. 166)'])
  })
})

describe('groupResourcesByClass', () => {
  it('agrupa pela classe dona, na ordem de aparição', () => {
    const mk = (id: string, classId: string): SheetResource => ({ id, name: id, classId, unit: 'uses', sharedWith: [] })
    const groups = groupResourcesByClass([mk('a', 'monk'), mk('b', 'rogue'), mk('c', 'monk')])
    expect(groups.map(g => [g.classId, g.resources.map(r => r.id)])).toEqual([['monk', ['a', 'c']], ['rogue', ['b']]])
  })
})

// ── Motor com os dados reais (class-progression-features.json) ──────────────────

describe('getClassResources — bardo', () => {
  it('Inspiração de Bardo: usos = mod. de CAR (CAR 18 → 4)', () => {
    const bi = find(getClassResources(draft('bard', 4), scores({ CHA: 18 })), 'bardic-inspiration')
    expect(bi).toMatchObject({ die: 'd6', uses: 4, recharge: 'long' })
  })
  it('Inspiração de Bardo: mínimo 1 (CAR 8 → 1)', () => {
    expect(find(getClassResources(draft('bard', 1), scores({ CHA: 8 })), 'bardic-inspiration')?.uses).toBe(1)
  })
  it('Fonte de Inspiração: a recarga passa a curto ou longo no 5º nível, e o dado vira d8', () => {
    expect(find(getClassResources(draft('bard', 4), scores()), 'bardic-inspiration')?.recharge).toBe('long')
    expect(find(getClassResources(draft('bard', 5), scores()), 'bardic-inspiration'))
      .toMatchObject({ recharge: 'short', die: 'd8' })
    expect(find(getClassResources(draft('bard', 15), scores()), 'bardic-inspiration')?.die).toBe('d12')
  })
  it('Canção de Descanso: d6 no 2º, d8 no 9º, d10 no 13º, d12 no 17º (p. 54)', () => {
    const die = (lv: number) => find(getClassResources(draft('bard', lv), scores()), 'song-of-rest')?.die
    expect(die(1)).toBeUndefined()
    expect(die(2)).toBe('d6')
    expect(die(8)).toBe('d6')
    expect(die(9)).toBe('d8')
    expect(die(13)).toBe('d10')
    expect(die(17)).toBe('d12')
  })
})

describe('getClassResources — guerreiro', () => {
  it('nível 1: só Retomar o Fôlego, 1d10 + nível, curto ou longo', () => {
    const rs = getClassResources(draft('fighter', 1), scores())
    expect(rs.map(r => r.id)).toEqual(['second-wind'])
    expect(rs[0]).toMatchObject({ die: '1d10+1', uses: 1, recharge: 'short' })
  })
  it('Surto de Ação 1 no 2º, 2 no 17º; Indomável 1/2/3 nos níveis 9/13/17', () => {
    const at = (lv: number) => getClassResources(draft('fighter', lv), scores())
    expect(find(at(2), 'action-surge')?.uses).toBe(1)
    expect(find(at(16), 'action-surge')?.uses).toBe(1)
    expect(find(at(17), 'action-surge')?.uses).toBe(2)
    expect(find(at(8), 'indomitable')).toBeUndefined()
    expect(find(at(9), 'indomitable')).toMatchObject({ uses: 1, recharge: 'long' })
    expect(find(at(13), 'indomitable')?.uses).toBe(2)
    expect(find(at(17), 'indomitable')?.uses).toBe(3)
  })
  it('Mestre de Batalha: 4d8 no 3º, 5 dados no 7º, d10 no 10º, 6 dados no 15º, d12 no 18º', () => {
    const sd = (lv: number) => find(getClassResources(withSubclass('fighter', lv, 'battle-master'), scores()), 'superiority-dice')
    expect(sd(3)).toMatchObject({ die: 'd8', uses: 4, unit: 'dice', recharge: 'short' })
    expect(sd(7)?.uses).toBe(5)
    expect(sd(10)?.die).toBe('d10')
    expect(sd(15)?.uses).toBe(6)
    expect(sd(18)?.die).toBe('d12')
    expect(find(getClassResources(withSubclass('fighter', 3, 'champion'), scores()), 'superiority-dice')).toBeUndefined()
  })
})

describe('getClassResources — paladino', () => {
  it('Cura pelas Mãos = 5 × nível de paladino, em PV', () => {
    expect(find(getClassResources(draft('paladin', 1), scores()), 'lay-on-hands'))
      .toMatchObject({ uses: 5, unit: 'hp', recharge: 'long' })
    expect(find(getClassResources(draft('paladin', 7), scores()), 'lay-on-hands')?.uses).toBe(35)
  })
  it('Sentido Divino = 1 + mod. de CAR, sem mínimo (p. 110), nunca negativo', () => {
    const ds = (cha: number) => find(getClassResources(draft('paladin', 1), scores({ CHA: cha })), 'divine-sense')?.uses
    expect(ds(16)).toBe(4)
    expect(ds(8)).toBe(0)
    expect(ds(4)).toBe(0)
  })
  it('Toque Purificador no 14º: mod. de CAR, mínimo 1', () => {
    expect(find(getClassResources(draft('paladin', 13), scores()), 'cleansing-touch')).toBeUndefined()
    expect(find(getClassResources(draft('paladin', 14), scores({ CHA: 8 })), 'cleansing-touch')?.uses).toBe(1)
    expect(find(getClassResources(draft('paladin', 14), scores({ CHA: 18 })), 'cleansing-touch')?.uses).toBe(4)
  })
})

describe('getClassResources — demais classes', () => {
  it('druida: Forma Selvagem 2 vezes (curto); ilimitada no 20º (Arquidruida)', () => {
    expect(find(getClassResources(draft('druid', 2), scores()), 'wild-shape')).toMatchObject({ uses: 2, recharge: 'short' })
    const ws = find(getClassResources(draft('druid', 20), scores()), 'wild-shape')
    expect(ws?.uses).toBe('unlimited')
    expect(formatResourceLine(ws!)).toBe('Forma Selvagem — usos ilimitados')
  })
  it('bárbaro: Fúrias 2 → 6 e ilimitadas no 20º; dano +2/+3/+4', () => {
    const at = (lv: number) => getClassResources(draft('barbarian', lv), scores())
    expect(find(at(1), 'rage')).toMatchObject({ uses: 2, recharge: 'long' })
    expect(find(at(17), 'rage')?.uses).toBe(6)
    expect(find(at(20), 'rage')?.uses).toBe('unlimited')
    expect(find(at(8), 'rage-damage')?.amount).toEqual({ value: 2, unit: 'bonus' })
    expect(find(at(16), 'rage-damage')?.amount).toEqual({ value: 4, unit: 'bonus' })
  })
  it('clérigo da Guerra: Sacerdote da Guerra = mod. de SAB (mín. 1), mais Canalizar Divindade 1/2/3', () => {
    const rs = getClassResources(withSubclass('cleric', 6, 'war-domain'), scores({ WIS: 16 }))
    expect(find(rs, 'war-priest')).toMatchObject({ uses: 3, recharge: 'long' })
    expect(find(rs, 'channel-divinity')).toMatchObject({ uses: 2, recharge: 'short' })
  })
  it('mago: Recuperação Arcana uma vez por dia, até metade do nível (para cima)', () => {
    const ar = find(getClassResources(draft('wizard', 5), scores()), 'arcane-recovery')
    expect(ar).toMatchObject({ uses: 1, recharge: 'day', amount: { value: 3, unit: 'slotLevels' } })
  })
  it('druida da Terra: Recuperação Natural até metade do nível (para baixo)', () => {
    const nr = find(getClassResources(withSubclass('druid', 5, 'circle-of-the-land'), scores()), 'natural-recovery')
    expect(nr?.amount).toEqual({ value: 2, unit: 'slotLevels' })
  })
  it('ladino: Ataque Furtivo ⌈nível/2⌉d6, Golpe de Sorte no 20º', () => {
    expect(find(getClassResources(draft('rogue', 5), scores()), 'sneak-attack')?.die).toBe('3d6')
    expect(find(getClassResources(draft('rogue', 19), scores()), 'stroke-of-luck')).toBeUndefined()
    expect(find(getClassResources(draft('rogue', 20), scores()), 'stroke-of-luck')).toMatchObject({ uses: 1, recharge: 'short' })
  })
  it('bruxo: Invocações não são recurso (não se gastam)', () => {
    expect(getClassResources(draft('warlock', 5), scores()).map(r => r.id)).not.toContain('invocations')
    expect(getClassResources(draft('warlock', 5), scores())).toEqual([])
  })
  it('monge da Mão Aberta: Integridade Corporal cura 3 × nível de monge', () => {
    const wb = find(getClassResources(withSubclass('monk', 6, 'open-hand'), scores()), 'wholeness-of-body')
    expect(formatResourceLine(wb!)).toBe('Integridade Corporal — cura 18 PV · 1 uso ○ (recupera em descanso longo)')
  })
})

describe('getClassResources — multiclasse', () => {
  it('cada recurso usa o nível NA classe dona: monge 3 / ladino 2', () => {
    const d = draft('monk', 5, { multiclass: true, additionalClasses: [extra('rogue', 2)] })
    const rs = getClassResources(d, scores())
    expect(find(rs, 'ki')).toMatchObject({ uses: 3, classId: 'monk' })
    expect(find(rs, 'sneak-attack')).toMatchObject({ die: '1d6', classId: 'rogue' })
  })
  it('Canalizar Divindade de clérigo 6 e paladino 4 é um recurso só, com os usos do maior (p. 166)', () => {
    const d = draft('cleric', 10, { multiclass: true, additionalClasses: [extra('paladin', 4, 'oath-of-devotion')] })
    const cds = getClassResources(d, scores()).filter(r => r.id === 'channel-divinity')
    expect(cds).toHaveLength(1)
    expect(cds[0]).toMatchObject({ uses: 2, classId: 'cleric', sharedWith: ['paladin'] })
  })
  it('bardo 1 numa multiclasse ainda usa o CAR final e não ganha a Canção de Descanso', () => {
    const d = draft('fighter', 3, { multiclass: true, additionalClasses: [extra('bard', 1)] })
    const rs = getClassResources(d, scores({ CHA: 14 }))
    expect(find(rs, 'bardic-inspiration')).toMatchObject({ uses: 2, die: 'd6', recharge: 'long' })
    expect(find(rs, 'song-of-rest')).toBeUndefined()
    expect(find(rs, 'action-surge')?.uses).toBe(1)
  })
})
