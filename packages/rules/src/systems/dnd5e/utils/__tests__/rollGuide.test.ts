import { describe, it, expect } from 'vitest'
import { parseNotation } from '../../../../core/dice'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import type { ClassChoiceSelections } from '../../types/class'
import type { ConditionId, ExhaustionLevel } from '../../types/condition'
import type { PlayState } from '../../types/playState'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { createPlayState } from '../playState'
import { formatModifier } from '../abilityScoreUtils'
import { getFinalAbilityScores } from '../asiUtils'
import { getPassiveScore, getSavingThrowChecks, getSkillChecks } from '../proficiencyUtils'
import { getFeatSpellBlocks } from '../spellUtils'
import {
  describeRollGuide, findRollGuideEntry, formatGuideFormula, getConcentrationGuide, getCritRecipe, getRollGuide, getZeroHpSaveGuide,
  parseDamageText, withInspirationSpent, withTableMode, type RollGuide, type RollGuideEntry,
} from '../rollGuide'

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), ...overrides }
}

const choices = (c: Partial<ClassChoiceSelections>): ClassChoiceSelections =>
  ({ ...structuredClone(EMPTY_DRAFT.classChoices), ...c })

function extraClass(classId: string, level: number) {
  return {
    classId, level, classChoices: choices({}),
    spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
  }
}

/** Itens comprados pelo método riqueza: as armas e a armadura que a ficha considera equipadas. */
const carrying = (...itemIds: string[]) => ({
  equipment: {
    ...structuredClone(EMPTY_DRAFT.equipment),
    method: 'wealth' as const,
    purchasedItems: itemIds.map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const })),
  },
})

const SCORES = { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 }

/** Guerreiro 1 sem raça (sem bônus racial): FOR +3, DES +2, CON +2, SAB +1, prof. +2. */
const fighter = (...items: string[]) =>
  draft({ class: 'fighter', level: 1, abilityScores: SCORES, classChoices: choices({ skills: ['athletics', 'perception'] }), ...carrying(...items) })

function play(patch: Partial<PlayState> = {}): PlayState {
  return { ...createPlayState('c1'), ...patch }
}

const withConditions = (...conditions: ConditionId[]) => play({ conditions })
const exhausted = (level: ExhaustionLevel) => play({ exhaustionLevel: level })

const labelsOf = (reasons: { label: string }[]) => reasons.map(r => r.label)

function allEntries(guide: RollGuide): RollGuideEntry[] {
  return [
    ...Object.values(guide.checks), ...Object.values(guide.saves), ...Object.values(guide.skills),
    guide.initiative, guide.deathSave, ...guide.hitDice,
    ...guide.attacks.flatMap(a => [a.attack, a.damage, a.versatile]).filter((e): e is RollGuideEntry => e !== null),
    ...guide.spellcasting.map(s => s.attack),
  ]
}

describe('parseDamageText', () => {
  it('lê dado, modificador e tipo como weaponFormat escreve', () => {
    expect(parseDamageText('1d8+3 cortante')).toEqual({ count: 1, sides: 8, modifier: 3, damageType: 'cortante' })
    expect(parseDamageText('2d6 cortante')).toEqual({ count: 2, sides: 6, modifier: 0, damageType: 'cortante' })
    expect(parseDamageText('1d4-1 perfurante')).toEqual({ count: 1, sides: 4, modifier: -1, damageType: 'perfurante' })
    expect(parseDamageText('1d10+3')).toEqual({ count: 1, sides: 10, modifier: 3, damageType: '' })
  })

  it('dano fixo sem dado (golpe desarmado, Zarabatana), inclusive negativo', () => {
    expect(parseDamageText('4 concussão')).toEqual({ count: 0, sides: 0, modifier: 4, damageType: 'concussão' })
    expect(parseDamageText('-1 concussão')).toEqual({ count: 0, sides: 0, modifier: -1, damageType: 'concussão' })
    expect(parseDamageText('0 concussão')).toEqual({ count: 0, sides: 0, modifier: 0, damageType: 'concussão' })
  })

  it('sem dano ("—", da Rede) ou texto estranho: null', () => {
    expect(parseDamageText('—')).toBeNull()
    expect(parseDamageText('')).toBeNull()
    expect(parseDamageText('cortante')).toBeNull()
    expect(parseDamageText('+3 cortante')).toBeNull()
    expect(parseDamageText('1d8+3 cortante (veja nota)')).toBeNull()
  })
})

describe('formatGuideFormula', () => {
  it('sinal ASCII com espaços, sem "+ 0"', () => {
    expect(formatGuideFormula('1d20', 5)).toBe('1d20 + 5')
    expect(formatGuideFormula('1d20', -1)).toBe('1d20 - 1')
    expect(formatGuideFormula('1d20', 0)).toBe('1d20')
    expect(formatGuideFormula('2d6', 3, 'cortante')).toBe('2d6 + 3 cortante')
    expect(formatGuideFormula('', 4, 'concussão')).toBe('4 concussão')
  })
})

describe('getRollGuide — os números da ficha', () => {
  const d = fighter('longsword', 'chain-mail')
  const guide = getRollGuide(d, play())
  const scores = getFinalAbilityScores(d)

  it('teste de atributo puro: só o modificador', () => {
    expect(guide.checks.STR).toMatchObject({
      id: 'check:STR', kind: 'd20', dice: '1d20', modifier: 3, formula: '1d20 + 3', notation: '1d20+3', mode: 'normal',
      breakdown: [{ label: 'Força', value: 3 }],
    })
    expect(guide.checks.INT.formula).toBe('1d20')
    expect(guide.checks.CHA).toMatchObject({ formula: '1d20 - 1', notation: '1d20-1' })
  })

  it('TR e perícias batem com getSavingThrowChecks / getSkillChecks, com a origem de cada parcela', () => {
    const saves = getSavingThrowChecks(d, scores)
    const skills = getSkillChecks(d, scores)
    for (const ab of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const) expect(guide.saves[ab].modifier).toBe(saves[ab].bonus)
    for (const id of Object.keys(skills)) expect(guide.skills[id].modifier).toBe(skills[id].bonus)
    expect(Object.keys(guide.skills)).toHaveLength(18)
    expect(guide.saves.STR.breakdown).toEqual([{ label: 'Força', value: 3 }, { label: 'Proficiência', value: 2 }])
    expect(guide.skills.athletics).toMatchObject({ label: 'Atletismo', ability: 'STR', formula: '1d20 + 5' })
    expect(guide.skills.athletics.breakdown).toEqual([{ label: 'Força', value: 3 }, { label: 'Proficiência', value: 2 }])
  })

  it('a soma do breakdown é sempre o modificador', () => {
    for (const entry of allEntries(guide)) {
      expect(entry.breakdown.reduce((s, b) => s + b.value, 0), entry.id).toBe(entry.modifier)
    }
  })

  it('a notação de toda entrada é lida pelo motor de dados', () => {
    for (const entry of allEntries(guide)) {
      expect(() => parseNotation(entry.notation), entry.id).not.toThrow()
      if (entry.crit) expect(() => parseNotation(entry.crit!.notation), entry.id).not.toThrow()
    }
  })

  it('Percepção passiva: o valor da ficha', () => {
    expect(guide.passivePerception).toMatchObject({
      value: getPassiveScore(d, 'perception', getSkillChecks(d, scores)), adjustment: 0,
    })
    expect(guide.passivePerception.value).toBe(13)
  })

  it('Furtividade com armadura pesada: desvantagem com o nome da armadura', () => {
    expect(guide.skills.stealth.mode).toBe('disadvantage')
    expect(labelsOf(guide.skills.stealth.disadvantage)).toEqual(['Cota de Malha'])
    expect(guide.skills.stealth.notation).toBe('2d20kl1+2')
    expect(guide.skills.acrobatics.mode).toBe('normal')
  })

  it('Dado de Vida: 1dX + CON', () => {
    expect(guide.hitDice).toEqual([expect.objectContaining({
      id: 'hit-die:10', kind: 'heal', formula: '1d10 + 2', notation: '1d10+2', breakdown: [{ label: 'Constituição', value: 2 }],
    })])
  })

  it('teste contra a morte: d20 puro, com as regras de 1 e 20', () => {
    expect(guide.deathSave).toMatchObject({ id: 'death-save', modifier: 0, formula: '1d20', notation: '1d20', breakdown: [] })
    expect(guide.deathSave.notes[0]).toContain('10 ou mais: sucesso; 1: dois fracassos; 20: recupera 1 PV')
  })

  it('findRollGuideEntry acha pelo id', () => {
    expect(findRollGuideEntry(guide, 'skill:stealth')).toBe(guide.skills.stealth)
    expect(findRollGuideEntry(guide, 'damage:longsword:versatile')?.label).toBe('Espada Longa — dano a duas mãos')
    expect(findRollGuideEntry(guide, 'nada')).toBeUndefined()
  })
})

describe('getRollGuide — ataques', () => {
  it('arma versátil: ataque, dano e dano a duas mãos, com o crítico dobrando só os dados', () => {
    const guide = getRollGuide(fighter('longsword'), play())
    const sword = guide.attacks.find(a => a.key === 'longsword')!
    expect(sword.critThreshold).toBe(20)
    expect(sword.attack).toMatchObject({
      id: 'attack:longsword', formula: '1d20 + 5', notation: '1d20+5',
      breakdown: [{ label: 'Força', value: 3 }, { label: 'Proficiência', value: 2 }],
    })
    expect(sword.damage).toMatchObject({
      id: 'damage:longsword', kind: 'damage', dice: '1d8', modifier: 3, formula: '1d8 + 3 cortante', notation: '1d8+3',
      crit: { dice: '2d8', formula: '2d8 + 3 cortante', notation: '2d8+3' },
      breakdown: [{ label: 'Força', value: 3 }],
    })
    expect(sword.versatile).toMatchObject({
      id: 'damage:longsword:versatile', formula: '1d10 + 3 cortante', crit: { formula: '2d10 + 3 cortante' },
    })
    expect(sword.attack.notes.some(n => n.startsWith('20 natural'))).toBe(true)
  })

  it('crítico com dano fixo: golpe desarmado não muda, com nota', () => {
    const guide = getRollGuide(fighter(), play())
    const unarmed = guide.attacks.find(a => a.key === 'unarmed')!
    expect(unarmed.damage).toMatchObject({
      dice: '', modifier: 4, formula: '4 concussão', notation: '4',
      crit: { dice: '', formula: '4 concussão', notation: '4' },
      breakdown: [{ label: 'Golpe desarmado', value: 1 }, { label: 'Força', value: 3 }],
    })
    // Acertos Críticos é a pág. 198 do livro (o marcador PAGINA 196 do extract).
    expect(unarmed.damage!.notes).toContain('Dano fixo, sem dado: o acerto crítico não muda o valor (só os dados dobram, pág. 198).')
    expect(unarmed.versatile).toBeNull()
  })

  it('golpe desarmado com Força baixa: mostra 0 e diz que não causa dano (decisão de 2026-10-25)', () => {
    const noDamage = 'Não causa dano: o valor fixo mais o modificador dá 0 ou menos, e o dano nunca é negativo.'
    const weak = (STR: number) => getRollGuide(draft({ class: 'wizard', level: 1, abilityScores: { ...SCORES, STR } }), play())
      .attacks.find(a => a.key === 'unarmed')!.damage!
    // FOR 8: 1 − 1 = 0.
    expect(weak(8)).toMatchObject({ modifier: 0, formula: '0 concussão', notation: '0' })
    expect(weak(8).notes).toContain(noDamage)
    expect(weak(8).notes.some(n => n.startsWith('Dano fixo'))).toBe(false)
    // FOR 6: 1 − 2 = −1, com o piso 0 do dano; a conta fecha com a parcela do mínimo.
    expect(weak(6)).toMatchObject({ modifier: 0, formula: '0 concussão', crit: { formula: '0 concussão' } })
    expect(weak(6).breakdown).toEqual([
      { label: 'Golpe desarmado', value: 1 }, { label: 'Força', value: -2 }, { label: 'Mínimo 0', value: 1 },
    ])
    expect(weak(6).notes).toContain(noDamage)
    // FOR 10: 1, sem a nota.
    expect(weak(10).notes).not.toContain(noDamage)
  })

  it('bárbaro com Força 6 no golpe desarmado: o Dano de Fúria diz a conta com o piso 0 sobre o total', () => {
    const unarmed = getRollGuide(draft({ class: 'barbarian', level: 1, abilityScores: { ...SCORES, STR: 6 } }), play())
      .attacks.find(a => a.key === 'unarmed')!.damage!
    expect(unarmed).toMatchObject({ modifier: 0, formula: '0 concussão' })
    // Em fúria, 1 − 2 + 2 = 1: somar o bônus ao 0 da receita daria 2.
    expect(unarmed.notes).toContain('+2 de dano em fúria, sem armadura pesada (Dano de Fúria): com ele, o dano é 1 (1 − 2 + 2)')
  })

  it('Rede (sem dano): só a jogada de ataque', () => {
    const guide = getRollGuide(fighter('net'), play())
    const net = guide.attacks.find(a => a.key === 'net')!
    expect(net.damage).toBeNull()
    expect(net.attack.formula).toBe('1d20 + 4')
  })

  it('bônus que a ficha já somou (Arquearia) vira parcela do breakdown, não nota', () => {
    const d = draft({ class: 'fighter', level: 1, abilityScores: SCORES, classChoices: choices({ fightingStyle: 'archery' }), ...carrying('longbow') })
    const bow = getRollGuide(d, play()).attacks.find(a => a.key === 'longbow')!
    expect(bow.attack.modifier).toBe(6)
    expect(bow.attack.breakdown).toEqual([
      { label: 'Destreza', value: 2 }, { label: 'Proficiência', value: 2 }, { label: 'Arquearia', value: 2 },
    ])
    expect(bow.notes.some(n => n.includes('Arquearia'))).toBe(false)
  })

  // A margem é dos "ataques com armas" (p. 85), e o golpe desarmado é ataque com arma sem ser arma
  // (decisões 20 e 27 de regras-dano-e-morte.md, 2026-10-29). O ataque de magia não é.
  it('Campeão 3: crítico com 19 ou 20 nas armas e no golpe desarmado; o ataque de magia fica no 20', () => {
    const d = draft({
      class: 'fighter', level: 4, abilityScores: SCORES, classChoices: choices({ subclass: 'champion' }),
      additionalClasses: [extraClass('wizard', 1)], ...carrying('longsword'),
    })
    // Guerreiro 3 / Mago 1 (nível 4).
    const guide = getRollGuide(d, play())
    const sword = guide.attacks.find(a => a.key === 'longsword')!
    const unarmed = guide.attacks.find(a => a.key === 'unarmed')!
    const note = '19 ou 20 natural: crítico se acertar (Crítico Aprimorado) — role os dados de dano duas vezes; só o 20 acerta automaticamente. 1 natural: erra (pág. 196).'
    expect(sword.critThreshold).toBe(19)
    expect(sword.attack.notes).toContain(note)
    expect(unarmed.critThreshold).toBe(19)
    expect(unarmed.attack.notes).toContain(note)
    expect(guide.spellcasting[0].attack.notes.some(n => n.startsWith('20 natural: acerta e é crítico'))).toBe(true)
  })

  it('Campeão 3 / monge 2: a margem no golpe desarmado de Artes Marciais, que dobra o dado do monge no crítico', () => {
    // Sem armadura nem escudo: Artes Marciais (d4) em vigor; FOR +3 > DES +2.
    const d = draft({
      class: 'fighter', level: 5, abilityScores: SCORES, classChoices: choices({ subclass: 'champion' }),
      additionalClasses: [extraClass('monk', 2)], ...carrying(),
    })
    const unarmed = getRollGuide(d, play()).attacks.find(a => a.key === 'unarmed')!
    expect(unarmed.critThreshold).toBe(19)
    expect(unarmed.attack.notes.some(n => n.startsWith('19 ou 20 natural: crítico se acertar (Crítico Aprimorado)'))).toBe(true)
    expect(unarmed.damage).toMatchObject({ formula: '1d4 + 3 concussão', crit: { formula: '2d4 + 3 concussão' } })
  })

  it('só as jogadas de ataque (arma, golpe desarmado, magia) levam attackRoll: o 1 natural erra', () => {
    const d = draft({
      class: 'fighter', level: 2, abilityScores: SCORES, classChoices: choices({}),
      additionalClasses: [extraClass('wizard', 1)], ...carrying('longsword'),
    })
    const guide = getRollGuide(d, play())
    const attackIds = allEntries(guide).filter(e => e.attackRoll).map(e => e.id).sort()
    expect(attackIds).toEqual(['attack:longsword', 'attack:unarmed', 'spell-attack:wizard'])
  })

  it('Campeão 15: Crítico Superior, 18 a 20 nas armas e no golpe desarmado (decisão de 2026-10-29)', () => {
    const d = draft({ class: 'fighter', level: 15, abilityScores: SCORES, classChoices: choices({ subclass: 'champion' }), ...carrying('longsword', 'longbow') })
    const guide = getRollGuide(d, play())
    for (const key of ['longsword', 'longbow', 'unarmed']) {
      const attack = guide.attacks.find(a => a.key === key)!
      expect(attack.critThreshold, key).toBe(18)
      expect(attack.attack.notes.some(n => n.startsWith('18 a 20 natural: crítico se acertar (Crítico Superior)')), key).toBe(true)
    }
  })

  it('arma pesada nas mãos de criatura Pequena: desvantagem no ataque, com o motivo (pág. 149)', () => {
    const halfling = draft({
      class: 'fighter', level: 1, race: 'halfling', subrace: 'lightfoot-halfling', abilityScores: SCORES,
      ...carrying('greatsword', 'heavy-crossbow', 'longsword'),
    })
    const guide = getRollGuide(halfling, play())
    const greatsword = guide.attacks.find(a => a.key === 'greatsword')!.attack
    expect(greatsword.mode).toBe('disadvantage')
    expect(labelsOf(greatsword.disadvantage)).toEqual(['Espada Grande pesada para criatura Pequena'])
    expect(greatsword.notes.some(n => n.includes('pág. 149'))).toBe(true)
    expect(guide.attacks.find(a => a.key === 'heavy-crossbow')!.attack.mode).toBe('disadvantage')
    expect(guide.attacks.find(a => a.key === 'longsword')!.attack.mode).toBe('normal')
    // Humano (Médio) com a mesma arma: normal.
    const human = getRollGuide({ ...halfling, race: 'human', subrace: null }, play())
    expect(human.attacks.find(a => a.key === 'greatsword')!.attack.mode).toBe('normal')
  })

  it('Ataques Selvagens e Crítico Brutal: nota só no crítico das armas corpo a corpo, sem mexer na fórmula', () => {
    const halfOrc = draft({
      class: 'barbarian', level: 13, race: 'half-orc', abilityScores: SCORES, ...carrying('greataxe', 'longbow'),
    })
    const guide = getRollGuide(halfOrc, play())
    const axe = guide.attacks.find(a => a.key === 'greataxe')!
    // FOR 16 + 2 do meio-orc = +4.
    expect(axe.damage!.crit).toMatchObject({ formula: '2d12 + 4 cortante', notation: '2d12+4' })
    expect(axe.damage!.crit!.notes).toEqual([
      'Crítico Brutal: no acerto crítico com esta arma corpo a corpo, role mais 2d12 (o dado da arma neste ataque) e some ao dano.',
      'Ataques Selvagens: no acerto crítico com esta arma corpo a corpo, role mais 1d12 (o dado da arma neste ataque) e some ao dano.',
    ])
    expect(axe.damage!.notes.some(n => n.includes('Crítico Brutal'))).toBe(false)
    // Arco (à distância) e golpe desarmado de dano fixo, sem dado a rolar a mais (decisão 21): nada.
    expect(guide.attacks.find(a => a.key === 'longbow')!.damage!.crit!.notes).toBeUndefined()
    expect(guide.attacks.find(a => a.key === 'unarmed')!.damage!.crit!.notes).toBeUndefined()
    // Bárbaro 8 humano: sem nenhuma das duas.
    const human = getRollGuide({ ...halfOrc, level: 8, race: 'human' }, play())
    expect(human.attacks.find(a => a.key === 'greataxe')!.damage!.crit!.notes).toBeUndefined()
  })

  // Decisão 21 de regras-dano-e-morte.md, revista em 2026-10-29: o golpe desarmado é ataque corpo a
  // corpo com arma, e os dois valem nele só quando ele tem dado — o dele.
  it('Crítico Brutal e Ataques Selvagens no golpe desarmado com dado: o de Artes Marciais ou o do Especialista em Briga', () => {
    // Meio-orc bárbaro 9 / monge 2, sem armadura: Artes Marciais (d4).
    const monk = draft({
      class: 'barbarian', level: 11, race: 'half-orc', abilityScores: SCORES, additionalClasses: [extraClass('monk', 2)], ...carrying(),
    })
    const unarmed = getRollGuide(monk, play()).attacks.find(a => a.key === 'unarmed')!
    expect(unarmed.damage!.dice).toBe('1d4')
    expect(unarmed.damage!.crit!.notes).toEqual([
      'Crítico Brutal: no acerto crítico com o golpe desarmado, role mais 1d4 (o dado do golpe neste ataque) e some ao dano.',
      'Ataques Selvagens: no acerto crítico com o golpe desarmado, role mais 1d4 (o dado do golpe neste ataque) e some ao dano.',
    ])
    // Bárbaro 9 humano com Especialista em Briga: o d4 do talento.
    const brawler = draft({
      class: 'barbarian', level: 9, race: 'human', abilityScores: SCORES,
      asiChoices: [{ kind: 'feat', featId: 'especialista-em-briga' }], ...carrying(),
    })
    const brawlerUnarmed = getRollGuide(brawler, play()).attacks.find(a => a.key === 'unarmed')!
    expect(brawlerUnarmed.damage!.dice).toBe('1d4')
    expect(brawlerUnarmed.damage!.crit!.notes).toEqual([
      'Crítico Brutal: no acerto crítico com o golpe desarmado, role mais 1d4 (o dado do golpe neste ataque) e some ao dano.',
    ])
  })

  it('o dado extra do crítico é o da arma naquele ataque: o versátil a duas mãos, o de Artes Marciais no monge', () => {
    const barbarian = draft({ class: 'barbarian', level: 9, race: 'half-orc', abilityScores: SCORES, ...carrying('longsword') })
    const sword = getRollGuide(barbarian, play()).attacks.find(a => a.key === 'longsword')!
    expect(sword.damage!.crit!.notes).toEqual([
      'Crítico Brutal: no acerto crítico com esta arma corpo a corpo, role mais 1d8 (o dado da arma neste ataque) e some ao dano.',
      'Ataques Selvagens: no acerto crítico com esta arma corpo a corpo, role mais 1d8 (o dado da arma neste ataque) e some ao dano.',
    ])
    expect(sword.versatile!.crit!.notes).toEqual([
      'Crítico Brutal: no acerto crítico com esta arma corpo a corpo, role mais 1d10 (o dado da arma neste ataque) e some ao dano.',
      'Ataques Selvagens: no acerto crítico com esta arma corpo a corpo, role mais 1d10 (o dado da arma neste ataque) e some ao dano.',
    ])
    // Monge 11 meio-orc, sem armadura: a espada curta usa o d8 de Artes Marciais.
    const monk = draft({ class: 'monk', level: 11, race: 'half-orc', abilityScores: SCORES, ...carrying('shortsword') })
    const shortsword = getRollGuide(monk, play()).attacks.find(a => a.key === 'shortsword')!
    expect(shortsword.damage!.dice).toBe('1d8')
    expect(shortsword.damage!.crit!.notes).toEqual([
      'Ataques Selvagens: no acerto crítico com esta arma corpo a corpo, role mais 1d8 (o dado da arma neste ataque) e some ao dano.',
    ])
  })

  it('arma de arremesso: o dado extra do crítico só sem arremessar (arremessar é ataque à distância, pág. 149 e 197)', () => {
    const barbarian = draft({
      class: 'barbarian', level: 9, race: 'half-orc', abilityScores: SCORES, ...carrying('handaxe', 'dagger', 'greataxe'),
    })
    const guide = getRollGuide(barbarian, play())
    expect(guide.attacks.find(a => a.key === 'handaxe')!.damage!.crit!.notes).toEqual([
      'Crítico Brutal: no acerto crítico com esta arma corpo a corpo, sem arremessar, role mais 1d6 (o dado da arma neste ataque) e some ao dano.',
      'Ataques Selvagens: no acerto crítico com esta arma corpo a corpo, sem arremessar, role mais 1d6 (o dado da arma neste ataque) e some ao dano.',
    ])
    // A adaga (acuidade e arremesso) com Destreza continua corpo a corpo: a ressalva é só o arremesso.
    expect(guide.attacks.find(a => a.key === 'dagger')!.damage!.crit!.notes![0])
      .toBe('Crítico Brutal: no acerto crítico com esta arma corpo a corpo, sem arremessar, role mais 1d4 (o dado da arma neste ataque) e some ao dano.')
    // Sem arremesso, sem ressalva.
    expect(guide.attacks.find(a => a.key === 'greataxe')!.damage!.crit!.notes![0])
      .toBe('Crítico Brutal: no acerto crítico com esta arma corpo a corpo, role mais 1d12 (o dado da arma neste ataque) e some ao dano.')
  })

  it('notas da arma (Duelismo) também no ataque, no dano e no dano a duas mãos', () => {
    const d = draft({ class: 'fighter', level: 1, abilityScores: SCORES, classChoices: choices({ fightingStyle: 'dueling' }), ...carrying('longsword') })
    const sword = getRollGuide(d, play()).attacks.find(a => a.key === 'longsword')!
    const dueling = sword.notes.find(n => n.includes('Duelismo'))!
    expect(dueling).toBeDefined()
    expect(sword.attack.notes).toContain(dueling)
    expect(sword.damage!.notes).toContain(dueling)
    expect(sword.versatile!.notes).toContain(dueling)
  })

  it('Dano de Fúria: nota na receita do dano das armas corpo a corpo e do golpe desarmado, fora da fórmula', () => {
    const barbarian = draft({ class: 'barbarian', level: 9, abilityScores: SCORES, ...carrying('greataxe', 'longbow') })
    const guide = getRollGuide(barbarian, play())
    const axe = guide.attacks.find(a => a.key === 'greataxe')!
    const rage = '+3 de dano em fúria, sem armadura pesada (Dano de Fúria)'
    expect(axe.damage!.notes).toContain(rage)
    expect(axe.damage).toMatchObject({ formula: '1d12 + 3 cortante', breakdown: [{ label: 'Força', value: 3 }] })
    expect(axe.notes).toContain(rage)
    const hasRage = (key: string) => guide.attacks.find(a => a.key === key)!.damage!.notes.some(n => n.includes('Dano de Fúria'))
    expect(hasRage('longbow')).toBe(false)
    // p. 197 pelo inglês (decisão do dono, 2026-10-29): o golpe desarmado é ataque corpo a corpo com arma.
    const unarmed = guide.attacks.find(a => a.key === 'unarmed')!
    expect(unarmed.damage!.notes).toContain(rage)
    expect(unarmed.damage).toMatchObject({
      formula: '4 concussão', breakdown: [{ label: 'Golpe desarmado', value: 1 }, { label: 'Força', value: 3 }],
    })
  })

  it('outra mão (duas adagas): a regra-base no dano', () => {
    const d = draft({
      class: 'rogue', level: 1, abilityScores: SCORES,
      equipment: {
        ...structuredClone(EMPTY_DRAFT.equipment), method: 'wealth',
        purchasedItems: [{ itemId: 'dagger', quantity: 2, source: 'purchased' }],
      },
    })
    const dagger = getRollGuide(d, play()).attacks.find(a => a.key === 'dagger')!
    expect(dagger.damage!.notes.some(n => n.includes('sem somar o modificador no dano'))).toBe(true)
  })

  it('Ataque Extra (guerreiro 5): nota no ataque; besta pesada fica em 1, com a recarga no ataque e no dano', () => {
    const d = draft({ class: 'fighter', level: 5, abilityScores: SCORES, ...carrying('longsword', 'heavy-crossbow') })
    const guide = getRollGuide(d, play())
    const sword = guide.attacks.find(a => a.key === 'longsword')!
    expect(sword.attacksPerAction).toBe(2)
    expect(sword.attack.notes).toContain('Ataque Extra: você faz 2 ataques ao usar a ação de Atacar — role cada um.')
    const crossbow = guide.attacks.find(a => a.key === 'heavy-crossbow')!
    expect(crossbow.attacksPerAction).toBe(1)
    expect(crossbow.attack.notes.some(n => n.startsWith('Ataque Extra'))).toBe(false)
    expect(crossbow.attack.notes.some(n => n.startsWith('recarga'))).toBe(true)
    expect(crossbow.damage!.notes.some(n => n.startsWith('recarga'))).toBe(true)
    // Guerreiro 1 não tem a nota.
    expect(getRollGuide(fighter('longsword'), play()).attacks[0].attack.notes.some(n => n.startsWith('Ataque Extra'))).toBe(false)
  })

  it('modificador de dano negativo (FOR 8): "1d4 - 1", e o crítico só dobra o dado', () => {
    const d = draft({ class: 'wizard', level: 1, abilityScores: { ...SCORES, STR: 8 }, ...carrying('club') })
    const club = getRollGuide(d, play()).attacks.find(a => a.key === 'club')!
    expect(club.damage).toMatchObject({
      formula: '1d4 - 1 concussão', notation: '1d4-1',
      crit: { formula: '2d4 - 1 concussão', notation: '2d4-1' },
      breakdown: [{ label: 'Força', value: -1 }],
    })
  })

  it('monge 1, golpe desarmado com Artes Marciais: 1d4 + DES, com a Destreza no breakdown', () => {
    const monk = draft({ class: 'monk', level: 1, abilityScores: { ...SCORES, STR: 10, DEX: 16 } })
    const unarmed = getRollGuide(monk, play()).attacks.find(a => a.key === 'unarmed')!
    expect(unarmed.attack).toMatchObject({ formula: '1d20 + 5', breakdown: [{ label: 'Destreza', value: 3 }, { label: 'Proficiência', value: 2 }] })
    expect(unarmed.damage).toMatchObject({ formula: '1d4 + 3 concussão', breakdown: [{ label: 'Destreza', value: 3 }] })
    expect(unarmed.damage!.notes.some(n => n.includes('Artes Marciais'))).toBe(true)
  })
})

describe('getRollGuide — condições e modo', () => {
  it('Envenenado + Furtividade com armadura pesada: as duas desvantagens, com os motivos', () => {
    const guide = getRollGuide(fighter('chain-mail'), withConditions('poisoned'))
    expect(guide.skills.stealth.mode).toBe('disadvantage')
    expect(labelsOf(guide.skills.stealth.disadvantage)).toEqual(['Envenenado', 'Cota de Malha'])
    expect(describeRollGuide(guide.skills.stealth)).toBe('1d20 + 2, com desvantagem (Envenenado, Cota de Malha)')
    expect(guide.attacks[0].attack.mode).toBe('disadvantage')
    expect(guide.initiative.mode).toBe('disadvantage')
    expect(guide.saves.CON.mode).toBe('normal')
    // −5 na Percepção passiva (decisão 9).
    expect(guide.passivePerception).toMatchObject({ value: 8, sheetValue: 13, adjustment: -5 })
    expect(guide.passivePerception.breakdown.at(-1)).toEqual({ label: 'Desvantagem (Envenenado)', value: -5 })
  })

  it('Exaustão 3: desvantagem nos TR (e no teste contra a morte) e nos testes (Exaustão 1)', () => {
    const guide = getRollGuide(fighter(), exhausted(3))
    expect(labelsOf(guide.saves.WIS.disadvantage)).toEqual(['Exaustão 3'])
    expect(guide.saves.WIS.notation).toBe('2d20kl1+1')
    expect(labelsOf(guide.deathSave.disadvantage)).toEqual(['Exaustão 3'])
    expect(labelsOf(guide.checks.INT.disadvantage)).toEqual(['Exaustão 1'])
    expect(labelsOf(guide.attacks[0].attack.disadvantage)).toEqual(['Exaustão 3'])
  })

  it('Paralisado: falha automática nos TR de FOR e DES, não nos outros nem no teste contra a morte', () => {
    const guide = getRollGuide(fighter(), withConditions('paralyzed'))
    expect(labelsOf(guide.saves.STR.autoFail)).toEqual(['Paralisado'])
    expect(labelsOf(guide.saves.DEX.autoFail)).toEqual(['Paralisado'])
    expect(guide.saves.CON.autoFail).toEqual([])
    expect(guide.deathSave.autoFail).toEqual([])
    expect(describeRollGuide(guide.saves.STR)).toBe('1d20 + 5 — falha automática (Paralisado)')
  })

  it('a 0 PV o Inconsciente derivado também dá falha automática', () => {
    const guide = getRollGuide(fighter(), play({ lifeState: 'dying' }))
    expect(labelsOf(guide.saves.DEX.autoFail)).toEqual(['Inconsciente'])
  })

  it('vantagem e desvantagem se anulam: modo normal, as duas listas guardadas', () => {
    const guide = getRollGuide(fighter('longsword'), withConditions('invisible', 'poisoned'))
    const attack = guide.attacks[0].attack
    expect(attack.mode).toBe('normal')
    expect(attack.notation).toBe('1d20+5')
    expect(labelsOf(attack.advantage)).toEqual(['Invisível'])
    expect(labelsOf(attack.disadvantage)).toEqual(['Envenenado'])
    expect(describeRollGuide(attack)).toBe('1d20 + 5, normal: vantagem (Invisível) e desvantagem (Envenenado) se anulam')
  })

  it('describeRollGuide com vantagem', () => {
    const attack = getRollGuide(fighter('longsword'), withConditions('invisible')).attacks[0].attack
    expect(attack.notation).toBe('2d20kh1+5')
    expect(describeRollGuide(attack)).toBe('1d20 + 5, com vantagem (Invisível)')
  })

  it('Exaustão 1: −5 na Percepção passiva, no valor e no breakdown', () => {
    const passive = getRollGuide(fighter(), exhausted(1)).passivePerception
    expect(passive).toMatchObject({ value: 8, sheetValue: 13, adjustment: -5 })
    expect(passive.breakdown.at(-1)).toEqual({ label: 'Desvantagem (Exaustão 1)', value: -5 })
  })

  it('condicional vira nota, nunca modo (Amedrontado, Cego)', () => {
    const guide = getRollGuide(fighter(), withConditions('frightened', 'blinded'))
    expect(guide.checks.WIS.mode).toBe('normal')
    expect(guide.checks.WIS.notes.some(n => n.includes('Amedrontado'))).toBe(true)
    expect(guide.checks.WIS.notes.some(n => n.includes('Cego'))).toBe(true)
    expect(guide.saves.WIS.notes).toEqual([])
    // Cego dá desvantagem incondicional nos ataques; Amedrontado, só nota.
    expect(labelsOf(guide.attacks[0].attack.disadvantage)).toEqual(['Cego'])
    expect(guide.attacks[0].attack.notes.some(n => n.includes('Amedrontado'))).toBe(true)
  })

  it('Inspiração: nota que muda com o modo', () => {
    const guide = getRollGuide(fighter(), play({ inspiration: true, conditions: ['poisoned'] }))
    expect(guide.saves.STR.notes.some(n => n.includes('rolar esta jogada com vantagem'))).toBe(true)
    expect(guide.checks.STR.notes.some(n => n.includes('anula a desvantagem'))).toBe(true)
    const without = getRollGuide(fighter(), play())
    expect(without.saves.STR.notes.some(n => n.includes('Inspiração'))).toBe(false)
  })

  it('Inspiração com falha automática: não adianta gastá-la', () => {
    const guide = getRollGuide(fighter(), play({ inspiration: true, conditions: ['paralyzed'] }))
    const dex = guide.saves.DEX.notes.filter(n => n.startsWith('Inspiração'))
    expect(dex).toEqual(['Inspiração: não adianta aqui — a jogada falha automaticamente.'])
    // Sem falha automática, a nota de sempre.
    expect(guide.saves.WIS.notes.some(n => n.includes('rolar esta jogada com vantagem'))).toBe(true)
  })

  it('Inspiração gasta: vantagem na jogada normal, anula a desvantagem, avisa quando não muda nada', () => {
    const guide = getRollGuide(fighter('longsword'), withConditions('poisoned'))
    // Jogada normal: vira vantagem, com a notação de dois d20.
    const save = withInspirationSpent(guide.saves.STR)
    expect(save.mode).toBe('advantage')
    expect(labelsOf(save.advantage)).toEqual(['Inspiração'])
    expect(save.notation).toBe('2d20kh1+5')
    expect(save.notes[0]).toBe('Inspiração gasta: role com vantagem (pág. 127).')
    // Envenenado: desvantagem no teste e no ataque, que a Inspiração anula.
    const check = withInspirationSpent(guide.checks.STR)
    expect(check.mode).toBe('normal')
    expect(check.notation).toBe('1d20+3')
    expect(check.notes[0]).toBe('Inspiração gasta: anula a desvantagem: role um d20 só (pág. 175).')
    expect(withInspirationSpent(guide.attacks[0].attack).mode).toBe('normal')
    // Já com vantagem: não muda nada, mas avisa.
    const already = withInspirationSpent({ ...guide.saves.STR, mode: 'advantage', advantage: [{ source: 'x', label: 'X' }] })
    expect(already.mode).toBe('advantage')
    expect(already.notes[0]).toContain('já tinha vantagem')
    // Gastar duas vezes não empilha a fonte.
    expect(withInspirationSpent(save)).toBe(save)
  })

  it('Inspiração gasta com vantagem e desvantagem já anuladas: a mesma frase da mesa (pág. 175)', () => {
    const guide = getRollGuide(fighter('longsword'), withConditions('invisible', 'poisoned'))
    const attack = withInspirationSpent(guide.attacks[0].attack)
    expect(attack.mode).toBe('normal')
    expect(attack.notes[0]).toBe('Inspiração gasta: não muda nada — vantagem e desvantagem já se anulavam, qualquer que seja a quantidade (pág. 175).')
  })

  it('Inspiração gasta: com falha automática avisa e não muda; dano volta igual', () => {
    const guide = getRollGuide(fighter('longsword'), withConditions('paralyzed'))
    const dex = withInspirationSpent(guide.saves.DEX)
    expect(dex.autoFail.length).toBeGreaterThan(0)
    expect(dex.notes[0]).toBe('Inspiração gasta: não muda nada — a jogada falha automaticamente.')
    const damage = guide.attacks[0].damage!
    expect(withInspirationSpent(damage)).toBe(damage)
  })

  it('Incapacitado (por Paralisado) e sem fala: notas no ataque, no ataque de magia e nas notas gerais', () => {
    const caster = draft({ class: 'wizard', level: 1, abilityScores: SCORES, ...carrying('dagger') })
    const guide = getRollGuide(caster, withConditions('paralyzed'))
    const cannotAct = 'Incapacitado (por Paralisado): não pode realizar ações nem reações (pág. 292).'
    expect(guide.attacks.find(a => a.key === 'dagger')!.attack.notes).toContain(cannotAct)
    expect(guide.spellcasting[0].attack.notes).toContain(cannotAct)
    expect(guide.spellcasting[0].attack.notes.some(n => n.startsWith('Não pode falar (Paralisado)'))).toBe(true)
    expect(guide.notes[0]).toBe(cannotAct)
    expect(guide.notes.some(n => n.includes('componente verbal'))).toBe(true)
    // Atordoado incapacita, mas fala (hesitante): sem a nota de fala.
    const stunned = getRollGuide(caster, withConditions('stunned'))
    expect(stunned.notes).toEqual(['Incapacitado (por Atordoado): não pode realizar ações nem reações (pág. 292).'])
    expect(getRollGuide(caster, play()).notes).toEqual([])
  })
})

// Pág. 175: várias situações do mesmo lado dão um d20 a mais só; vantagem e desvantagem juntas se
// anulam, "da mesma maneira se várias circunstâncias impõem desvantagem e apenas uma concede
// vantagem"; o Mestre também pode conceder vantagem ou impor desvantagem.
describe('withTableMode — a circunstância da mesa (pág. 175)', () => {
  const TABLE_LABEL = 'Circunstância da mesa'

  it('Normal e jogada que não é d20 voltam iguais', () => {
    const guide = getRollGuide(fighter('longsword'), play())
    expect(withTableMode(guide.saves.STR, 'normal')).toBe(guide.saves.STR)
    const damage = guide.attacks[0].damage!
    expect(withTableMode(damage, 'advantage')).toBe(damage)
  })

  it('na jogada normal, a escolha vira o modo, com o motivo e a notação de dois d20; o número não muda', () => {
    const guide = getRollGuide(fighter('longsword'), play())
    const attack = withTableMode(guide.attacks[0].attack, 'advantage')
    expect(attack.mode).toBe('advantage')
    expect(labelsOf(attack.advantage)).toEqual([TABLE_LABEL])
    expect(attack.notation).toBe('2d20kh1+5')
    expect(attack.formula).toBe(guide.attacks[0].attack.formula)
    expect(attack.notes).toEqual(guide.attacks[0].attack.notes)
    expect(describeRollGuide(attack)).toBe(`1d20 + 5, com vantagem (${TABLE_LABEL})`)
    const save = withTableMode(guide.saves.STR, 'disadvantage')
    expect(save.mode).toBe('disadvantage')
    expect(labelsOf(save.disadvantage)).toEqual([TABLE_LABEL])
    expect(save.notation).toBe('2d20kl1+5')
    expect(save.modifier).toBe(guide.saves.STR.modifier)
  })

  it('várias desvantagens e uma vantagem da mesa: jogada normal, um d20 só', () => {
    const guide = getRollGuide(fighter('chain-mail'), withConditions('poisoned'))
    const stealth = withTableMode(guide.skills.stealth, 'advantage')
    expect(stealth.mode).toBe('normal')
    expect(stealth.notation).toBe('1d20+2')
    expect(labelsOf(stealth.disadvantage)).toEqual(['Envenenado', 'Cota de Malha'])
    expect(stealth.notes[0]).toBe('Vantagem da mesa: anula a desvantagem: role um d20 só (pág. 175).')
    expect(describeRollGuide(stealth))
      .toBe(`1d20 + 2, normal: vantagem (${TABLE_LABEL}) e desvantagem (Envenenado, Cota de Malha) se anulam`)
  })

  it('do mesmo lado não soma: continua um d20 a mais, e a nota diz por quê', () => {
    const guide = getRollGuide(fighter('longsword'), withConditions('invisible'))
    const attack = withTableMode(guide.attacks[0].attack, 'advantage')
    expect(attack.mode).toBe('advantage')
    expect(attack.notation).toBe('2d20kh1+5')
    expect(labelsOf(attack.advantage)).toEqual(['Invisível', TABLE_LABEL])
    expect(attack.notes[0]).toBe('Vantagem da mesa: a jogada já tinha vantagem; não muda nada (vantagens não se somam, pág. 175).')
    const poisoned = getRollGuide(fighter('longsword'), withConditions('poisoned'))
    const check = withTableMode(poisoned.checks.STR, 'disadvantage')
    expect(check.notation).toBe('2d20kl1+3')
    expect(check.notes[0]).toBe('Desvantagem da mesa: a jogada já tinha desvantagem; não muda nada (desvantagens não se somam, pág. 175).')
  })

  it('já anuladas: a escolha da mesa não desempata', () => {
    const guide = getRollGuide(fighter('longsword'), withConditions('invisible', 'poisoned'))
    const attack = withTableMode(guide.attacks[0].attack, 'disadvantage')
    expect(attack.mode).toBe('normal')
    expect(attack.notation).toBe('1d20+5')
    expect(labelsOf(attack.disadvantage)).toEqual(['Envenenado', TABLE_LABEL])
    expect(attack.notes[0]).toBe('Desvantagem da mesa: não muda nada — vantagem e desvantagem já se anulavam, qualquer que seja a quantidade (pág. 175).')
  })

  it('falha automática: avisa e mantém a falha', () => {
    const guide = getRollGuide(fighter(), withConditions('paralyzed'))
    const dex = withTableMode(guide.saves.DEX, 'advantage')
    expect(labelsOf(dex.autoFail)).toEqual(['Paralisado'])
    expect(dex.notes[0]).toBe('Vantagem da mesa: não muda nada — a jogada falha automaticamente.')
  })

  it('a nota da Inspiração ainda não gasta acompanha o modo da mesa', () => {
    const guide = getRollGuide(fighter(), play({ inspiration: true }))
    const save = withTableMode(guide.saves.STR, 'disadvantage')
    expect(save.notes).toContain('Inspiração: gastá-la anula a desvantagem e a jogada sai normal (pág. 175).')
    expect(save.notes.filter(n => n.startsWith('Inspiração'))).toHaveLength(1)
    const adv = withTableMode(guide.saves.STR, 'advantage')
    expect(adv.notes).toContain('Inspiração: a jogada já tem vantagem; gastá-la não muda nada (vantagens não se somam, pág. 175).')
  })

  it('a nota da Inspiração é trocada mesmo que outra composição tenha mudado o modo antes', () => {
    const guide = getRollGuide(fighter(), play({ inspiration: true }))
    // A nota foi escrita para a jogada normal; alguém pôs desvantagem sem reescrevê-la.
    const before = { ...guide.saves.STR, mode: 'disadvantage' as const, disadvantage: [{ source: 'x', label: 'X' }] }
    const save = withTableMode(before, 'advantage')
    expect(save.mode).toBe('normal')
    expect(save.notes.filter(n => n.startsWith('Inspiração'))).toEqual([
      'Inspiração: aqui não muda nada — vantagem e desvantagem já se anulam, qualquer que seja a quantidade (pág. 175).',
    ])
  })

  it('com a Inspiração gasta por cima, as fontes se combinam pela mesma regra', () => {
    const guide = getRollGuide(fighter(), play())
    const save = withInspirationSpent(withTableMode(guide.saves.STR, 'disadvantage'))
    expect(save.mode).toBe('normal')
    expect(save.notation).toBe('1d20+5')
    expect(save.notes[0]).toBe('Inspiração gasta: anula a desvantagem: role um d20 só (pág. 175).')
    const adv = withInspirationSpent(withTableMode(guide.saves.STR, 'advantage'))
    expect(adv.mode).toBe('advantage')
    expect(adv.notes[0]).toContain('já tinha vantagem')
  })

  it('aplicar duas vezes não empilha a fonte', () => {
    const save = withTableMode(getRollGuide(fighter(), play()).saves.STR, 'advantage')
    expect(withTableMode(save, 'advantage')).toBe(save)
  })
})

describe('getRollGuide — linhas condicionais da ficha (traços e características)', () => {
  const has = (entry: RollGuideEntry, prefix: string) => entry.notes.some(n => n.startsWith(prefix))

  it('Sortudo (halfling): no ataque, nos testes, nos TR, na iniciativa e no teste contra a morte; nunca no passivo', () => {
    const halfling = draft({ class: 'fighter', level: 1, race: 'halfling', subrace: 'lightfoot-halfling', abilityScores: SCORES, ...carrying('longsword') })
    const guide = getRollGuide(halfling, play())
    const lucky = 'Sortudo: tirou 1 natural no d20?'
    expect(has(guide.attacks[0].attack, lucky)).toBe(true)
    expect(has(guide.checks.INT, lucky)).toBe(true)
    expect(has(guide.skills.stealth, lucky)).toBe(true)
    expect(has(guide.saves.WIS, lucky)).toBe(true)
    expect(has(guide.initiative, lucky)).toBe(true)
    expect(has(guide.deathSave, lucky)).toBe(true)
    expect(guide.passivePerception.notes.some(n => n.startsWith(lucky))).toBe(false)
    // O dano não é d20.
    expect(has(guide.attacks[0].damage!, lucky)).toBe(false)
    // Nunca muda o modo.
    expect(guide.saves.WIS.mode).toBe('normal')
    expect(has(getConcentrationGuide(halfling, play(), 10), lucky)).toBe(true)
    // O teste contra a morte leva também quem deixa jogar de novo (decisão de 2026-10-25).
    expect(guide.deathSave.rerollNaturalOne).toEqual(['Sortudo'])
    expect(getRollGuide(fighter(), play()).deathSave.rerollNaturalOne).toBeUndefined()
  })

  it('Bravura (halfling): em todo TR, não nos testes nem no teste contra a morte', () => {
    const guide = getRollGuide(draft({ class: 'fighter', level: 1, race: 'halfling', subrace: 'stout-halfling', abilityScores: SCORES }), play())
    expect(has(guide.saves.WIS, 'Bravura: vantagem se o teste de resistência for contra ficar amedrontado')).toBe(true)
    expect(has(guide.saves.STR, 'Bravura')).toBe(true)
    expect(has(guide.checks.WIS, 'Bravura')).toBe(false)
    expect(has(guide.deathSave, 'Bravura')).toBe(false)
  })

  it('Resiliência Anã: nos TR (contra veneno), sem mudar o modo', () => {
    const guide = getRollGuide(draft({ class: 'fighter', level: 1, race: 'dwarf', subrace: 'hill-dwarf', abilityScores: SCORES }), play())
    expect(has(guide.saves.CON, 'Resiliência Anã: vantagem se o teste de resistência for contra veneno')).toBe(true)
    expect(guide.saves.CON.mode).toBe('normal')
    expect(has(guide.checks.CON, 'Resiliência Anã')).toBe(false)
    expect(has(guide.attacks[0].attack, 'Resiliência Anã')).toBe(false)
  })

  // "Você tem vantagem em testes de resistência contra veneno e tem resistência contra dano de veneno"
  // (Resiliência dos Robustos, pág. 28, linhas 2173-2175): a mesma nota da Resiliência Anã.
  it('Resiliência dos Robustos (halfling robusto): nos TR (contra veneno), sem mudar o modo; o pés leves não', () => {
    const stout = getRollGuide(draft({ class: 'fighter', level: 1, race: 'halfling', subrace: 'stout-halfling', abilityScores: SCORES }), play())
    expect(has(stout.saves.CON, 'Resiliência dos Robustos: vantagem se o teste de resistência for contra veneno (pág. 28).')).toBe(true)
    expect(has(stout.saves.WIS, 'Resiliência dos Robustos')).toBe(true)
    expect(stout.saves.CON.mode).toBe('normal')
    expect(has(stout.checks.CON, 'Resiliência dos Robustos')).toBe(false)
    expect(has(stout.deathSave, 'Resiliência dos Robustos')).toBe(false)
    const lightfoot = getRollGuide(draft({ class: 'fighter', level: 1, race: 'halfling', subrace: 'lightfoot-halfling', abilityScores: SCORES }), play())
    expect(has(lightfoot.saves.CON, 'Resiliência dos Robustos')).toBe(false)
  })

  // O mesmo defeito da Resiliência dos Robustos (decisão de 2026-10-31): "Você tem vantagem nos testes
  // de resistência para resistir a ser enfeitiçado" (Ancestral Feérico do elfo, pág. 23, linhas
  // 1825-1827) e "vantagem em todos os testes de resistência de Inteligência, Sabedoria e Carisma
  // contra magia" (Esperteza Gnômica, pág. 37, linhas 2827-2829).
  it('Ancestral Feérico (elfo) em todo TR; Esperteza Gnômica só nos de INT, SAB e CAR; sem mudar o modo', () => {
    const elf = getRollGuide(draft({ class: 'fighter', level: 1, race: 'elf', subrace: 'wood-elf', abilityScores: SCORES }), play())
    expect(has(elf.saves.WIS, 'Ancestral Feérico: vantagem se o teste de resistência for contra ficar enfeitiçado (pág. 23).')).toBe(true)
    expect(has(elf.saves.STR, 'Ancestral Feérico')).toBe(true)
    expect(elf.saves.WIS.mode).toBe('normal')
    expect(has(elf.checks.WIS, 'Ancestral Feérico')).toBe(false)
    const gnome = getRollGuide(draft({ class: 'fighter', level: 1, race: 'gnome', subrace: 'rock-gnome', abilityScores: SCORES }), play())
    for (const ab of ['INT', 'WIS', 'CHA'] as const) expect(has(gnome.saves[ab], 'Esperteza Gnômica: vantagem se o teste de resistência for contra magia (pág. 37).'), ab).toBe(true)
    for (const ab of ['STR', 'DEX', 'CON'] as const) expect(has(gnome.saves[ab], 'Esperteza Gnômica'), ab).toBe(false)
  })

  // "A partir do 14° nível, você tem vantagem em testes de resistência contra magia" (Resistência à
  // Magia, pág. 98, linhas 8555-8557) e "vantagem em testes de resistência contra magias conjuradas por
  // criaturas a até 1,5 metro de você" (Matador de Conjuradores, pág. 170, linhas 15223-15225).
  it('Resistência à Magia (abjurador 14) e Matador de Conjuradores: a nota nos TR, sem mudar o modo', () => {
    const abjurer = (level: number) => draft({
      class: 'wizard', level, abilityScores: SCORES,
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'abjuration' },
    })
    const guide = getRollGuide(abjurer(14), play())
    expect(has(guide.saves.DEX, 'Resistência à Magia: vantagem se o teste de resistência for contra magia (pág. 98).')).toBe(true)
    expect(guide.saves.DEX.mode).toBe('normal')
    expect(has(getRollGuide(abjurer(13), play()).saves.DEX, 'Resistência à Magia')).toBe(false)
    const slayer = getRollGuide(draft({ class: 'fighter', level: 4, abilityScores: SCORES, asiChoices: [{ kind: 'feat', featId: 'matador-de-conjuradores' }] }), play())
    expect(has(slayer.saves.CON, 'Matador de Conjuradores: vantagem se o teste de resistência for contra magia conjurada por uma criatura a até 1,5 m de você (pág. 170).')).toBe(true)
    expect(has(slayer.checks.CON, 'Matador de Conjuradores')).toBe(false)
  })

  it('Sentido de Perigo (bárbaro 2): só no TR de Destreza, com a ressalva', () => {
    const barbarian = (level: number) => draft({ class: 'barbarian', level, abilityScores: SCORES })
    const guide = getRollGuide(barbarian(2), play())
    expect(guide.saves.DEX.notes.find(n => n.startsWith('Sentido de Perigo'))).toContain('não vale se estiver cego, surdo ou incapacitado')
    expect(guide.saves.DEX.mode).toBe('normal')
    expect(has(guide.saves.WIS, 'Sentido de Perigo')).toBe(false)
    expect(has(guide.checks.DEX, 'Sentido de Perigo')).toBe(false)
    expect(has(getRollGuide(barbarian(1), play()).saves.DEX, 'Sentido de Perigo')).toBe(false)
  })

  it('Sentido de Perigo some com Cego, Surdo ou Incapacitado, inclusive derivado (decisão de 2026-10-25)', () => {
    const barbarian = draft({ class: 'barbarian', level: 2, abilityScores: SCORES })
    for (const id of ['blinded', 'deafened', 'incapacitated', 'stunned', 'paralyzed'] as ConditionId[]) {
      expect(has(getRollGuide(barbarian, withConditions(id)).saves.DEX, 'Sentido de Perigo'), id).toBe(false)
    }
    // A 0 PV: o Inconsciente derivado incapacita.
    expect(has(getRollGuide(barbarian, play({ lifeState: 'stable', damageTaken: 99 })).saves.DEX, 'Sentido de Perigo')).toBe(false)
    // Outras condições não tiram a linha.
    expect(has(getRollGuide(barbarian, withConditions('poisoned')).saves.DEX, 'Sentido de Perigo')).toBe(true)
  })
})

describe('getRollGuide — armadura sem proficiência (pág. 144)', () => {
  const wizard = draft({ class: 'wizard', level: 1, abilityScores: SCORES, ...carrying('chain-mail', 'dagger') })
  const guide = getRollGuide(wizard, play())

  it('desvantagem em teste, TR e ataque de FOR ou DES, e na iniciativa', () => {
    const reason = ['Cota de Malha sem proficiência']
    expect(labelsOf(guide.checks.STR.disadvantage)).toEqual(reason)
    expect(labelsOf(guide.saves.DEX.disadvantage)).toEqual(reason)
    expect(labelsOf(guide.skills.athletics.disadvantage)).toEqual(reason)
    expect(labelsOf(guide.initiative.disadvantage)).toEqual(reason)
    expect(guide.attacks.find(a => a.key === 'dagger')!.attack.mode).toBe('disadvantage')
    expect(guide.checks.INT.disadvantage).toEqual([])
    expect(guide.saves.WIS.disadvantage).toEqual([])
  })

  it('aviso de que não dá para conjurar, na ficha e no ataque de magia', () => {
    expect(guide.notes).toEqual(['Usando Cota de Malha sem proficiência, você não pode conjurar magias (pág. 144).'])
    expect(guide.spellcasting[0].attack.notes[0]).toBe(guide.notes[0])
  })
})

// A armadura vestida no jogo (onda `armadura`): o guia deriva a sessão do estado, com ela.
describe('getRollGuide — a armadura vestida no jogo', () => {
  // O anão da montanha tem proficiência em armadura leve e média (pág. 20), não na pesada. O criador
  // equipa o Camisão de Malha (o primeiro); no jogo, a Cota de Malha.
  const wizard = draft({
    class: 'wizard', level: 1, race: 'dwarf', subrace: 'mountain-dwarf', abilityScores: SCORES,
    ...carrying('chain-shirt', 'chain-mail', 'dagger'),
  })
  const basis = { bodyArmorId: 'chain-shirt', shield: false }
  const inChainMail = play({ wornArmor: { bodyArmorId: 'chain-mail', shield: false, basis } })

  it('sem a troca, o Camisão de Malha: sem desvantagem, e conjura', () => {
    const guide = getRollGuide(wizard, play())
    expect(guide.checks.STR.disadvantage).toEqual([])
    expect(guide.skills.stealth.disadvantage).toEqual([])
    expect(guide.notes).toEqual([])
  })

  it('mago de Cota de Malha vestida no jogo: desvantagem em FOR e DES, na Furtividade, e não conjura', () => {
    const guide = getRollGuide(wizard, inChainMail)
    expect(labelsOf(guide.checks.STR.disadvantage)).toEqual(['Cota de Malha sem proficiência'])
    expect(labelsOf(guide.saves.DEX.disadvantage)).toEqual(['Cota de Malha sem proficiência'])
    expect(guide.attacks.find(a => a.key === 'dagger')!.attack.mode).toBe('disadvantage')
    expect(labelsOf(guide.skills.stealth.disadvantage)).toEqual(['Cota de Malha sem proficiência', 'Cota de Malha'])
    expect(guide.notes).toEqual(['Usando Cota de Malha sem proficiência, você não pode conjurar magias (pág. 144).'])
  })

  it('a troca que o criador deixou para trás (outra base) não vale: o criador manda', () => {
    const stale = play({ wornArmor: { bodyArmorId: 'chain-mail', shield: false, basis: { bodyArmorId: null, shield: false } } })
    expect(getRollGuide(wizard, stale).notes).toEqual([])
  })
})

describe('getRollGuide — meia proficiência, Especialização, Alerta', () => {
  it('Versatilidade (bardo 2): no teste de atributo, nas perícias sem proficiência e na iniciativa', () => {
    const bard = draft({ class: 'bard', level: 2, abilityScores: SCORES })
    const guide = getRollGuide(bard, play())
    expect(guide.checks.STR.breakdown).toEqual([{ label: 'Força', value: 3 }, { label: 'Versatilidade', value: 1 }])
    expect(guide.checks.STR.modifier).toBe(4)
    expect(guide.initiative.breakdown).toEqual([{ label: 'Destreza', value: 2 }, { label: 'Versatilidade', value: 1 }])
    expect(guide.skills.arcana.breakdown).toEqual([{ label: 'Inteligência', value: 0 }, { label: 'Versatilidade', value: 1 }])
    // TR não leva a meia proficiência (pág. 54).
    expect(guide.saves.STR.breakdown).toEqual([{ label: 'Força', value: 3 }])
  })

  it('Atletismo Extraordinário (campeão 7): no teste de Força, não no TR', () => {
    const champion = draft({ class: 'fighter', level: 7, abilityScores: SCORES, classChoices: choices({ subclass: 'champion' }) })
    const guide = getRollGuide(champion, play())
    expect(guide.checks.STR.breakdown).toEqual([{ label: 'Força', value: 3 }, { label: 'Atletismo Extraordinário', value: 2 }])
    expect(guide.checks.INT.breakdown).toEqual([{ label: 'Inteligência', value: 0 }])
    expect(guide.saves.DEX.breakdown).toEqual([{ label: 'Destreza', value: 2 }])
  })

  it('Especialização do ladino: o bônus dobrado com o nome', () => {
    const rogue = draft({
      class: 'rogue', level: 1, abilityScores: SCORES,
      classChoices: choices({ skills: ['stealth', 'perception', 'acrobatics', 'insight'], expertiseItems: ['stealth', 'thieves-tools'] }),
    })
    const stealth = getRollGuide(rogue, play()).skills.stealth
    expect(stealth.breakdown).toEqual([{ label: 'Destreza', value: 2 }, { label: 'Especialização', value: 4 }])
    expect(stealth.formula).toBe('1d20 + 6')
  })

  it('Instinto Selvagem (bárbaro 7): vantagem na iniciativa; com Exaustão 1, se anulam', () => {
    const barbarian = (level: number) => draft({ class: 'barbarian', level, abilityScores: SCORES })
    const initiative = getRollGuide(barbarian(7), play()).initiative
    expect(initiative.mode).toBe('advantage')
    expect(initiative.notation).toBe('2d20kh1+2')
    expect(describeRollGuide(initiative)).toBe('1d20 + 2, com vantagem (Instinto Selvagem)')
    const tired = getRollGuide(barbarian(7), exhausted(1)).initiative
    expect(tired.mode).toBe('normal')
    expect(describeRollGuide(tired)).toBe('1d20 + 2, normal: vantagem (Instinto Selvagem) e desvantagem (Exaustão 1) se anulam')
    expect(getRollGuide(barbarian(6), play()).initiative.mode).toBe('normal')
    // Só a iniciativa: o teste de Destreza comum não ganha a vantagem.
    expect(getRollGuide(barbarian(7), play()).checks.DEX.mode).toBe('normal')
  })

  it('Alerta: +5 na iniciativa com o nome do talento', () => {
    const d = draft({
      class: 'fighter', level: 4, abilityScores: SCORES,
      asiChoices: [{ kind: 'feat', featId: 'alerta' }],
    })
    const initiative = getRollGuide(d, play()).initiative
    expect(initiative.breakdown).toEqual([{ label: 'Destreza', value: 2 }, { label: 'Alerta', value: 5 }])
    expect(initiative.formula).toBe('1d20 + 7')
  })
})

describe('getRollGuide — conjurador multiclasse', () => {
  it('uma CD e um ataque de magia por classe, cada um com o seu atributo', () => {
    const d = draft({
      class: 'wizard', level: 5,
      abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 16, WIS: 14, CHA: 10 },
      additionalClasses: [extraClass('cleric', 2)],
    })
    const guide = getRollGuide(d, play())
    expect(guide.spellcasting.map(s => [s.classId, s.ability, s.saveDc, s.attack.formula])).toEqual([
      ['wizard', 'INT', 14, '1d20 + 6'],
      ['cleric', 'WIS', 13, '1d20 + 5'],
    ])
    expect(guide.spellcasting[0].saveDcBreakdown).toEqual([
      { label: 'Base', value: 8 }, { label: 'Proficiência', value: 3 }, { label: 'Inteligência', value: 3 },
    ])
    expect(guide.spellcasting[1].attack.id).toBe('spell-attack:cleric')
    // O poço de Dados de Vida das duas classes.
    expect(guide.hitDice.map(h => h.id)).toEqual(['hit-die:8', 'hit-die:6'])
  })
})

describe('getRollGuide — magias de talento (Iniciado em Magia, p. 170)', () => {
  const FEAT = 'iniciado-em-magia'
  const withMagicInitiate = (d: CharacterDraft): CharacterDraft => ({
    ...d,
    asiChoices: [{ kind: 'feat', featId: FEAT }],
    featSelections: { [FEAT]: { spellClass: 'cleric', cantrips: ['sacred-flame', 'guidance'], spells: ['cure-wounds'] } },
  })

  it('guerreiro sem conjuração ganha a CD e o ataque do talento, pelo atributo da classe escolhida', () => {
    // Guerreiro 4: SAB 12 (+1), proficiência +2 → CD 11, ataque +3.
    const d = withMagicInitiate(draft({ class: 'fighter', level: 4, abilityScores: SCORES }))
    const guide = getRollGuide(d, play())
    expect(guide.spellcasting).toHaveLength(1)
    const [sc] = guide.spellcasting
    expect(sc).toMatchObject({
      key: `feat:${FEAT}`, classId: 'cleric', featId: FEAT, label: 'Iniciado em Magia (Clérigo)', ability: 'WIS', saveDc: 11,
    })
    expect(sc.saveDcBreakdown).toEqual([
      { label: 'Base', value: 8 }, { label: 'Proficiência', value: 2 }, { label: 'Sabedoria', value: 1 },
    ])
    expect(sc.attack).toMatchObject({
      id: `spell-attack:feat:${FEAT}`, label: 'Ataque de magia — Iniciado em Magia (Clérigo)', formula: '1d20 + 3', attackRoll: true,
    })
    expect(sc.attack.breakdown).toEqual([{ label: 'Sabedoria', value: 1 }, { label: 'Proficiência', value: 2 }])
    expect(sc.attack.notes.some(n => n.startsWith('20 natural: acerta e é crítico'))).toBe(true)
    expect(findRollGuideEntry(guide, sc.attack.id)).toBe(sc.attack)
    // Os números são os da Revisão e do PDF.
    const [block] = getFeatSpellBlocks(d, getFinalAbilityScores(d))
    expect([sc.saveDc, formatModifier(sc.attack.modifier)]).toEqual([block.saveDc, block.attackBonus])
  })

  it('clérigo com Iniciado em Magia de clérigo: duas conjurações, com chaves e jogadas que não colidem', () => {
    const guide = getRollGuide(withMagicInitiate(draft({ class: 'cleric', level: 4, abilityScores: SCORES })), play())
    expect(guide.spellcasting.map(s => [s.key, s.attack.id, s.label])).toEqual([
      ['class:cleric', 'spell-attack:cleric', 'Clérigo'],
      [`feat:${FEAT}`, `spell-attack:feat:${FEAT}`, 'Iniciado em Magia (Clérigo)'],
    ])
    expect(findRollGuideEntry(guide, 'spell-attack:cleric')?.label).toBe('Ataque de magia — Clérigo')
    expect(findRollGuideEntry(guide, `spell-attack:feat:${FEAT}`)?.label).toBe('Ataque de magia — Iniciado em Magia (Clérigo)')
  })

  it('armadura sem proficiência impede também a magia do talento (pág. 144)', () => {
    // Bárbaro não tem proficiência com armadura pesada.
    const d = withMagicInitiate(draft({ class: 'barbarian', level: 4, abilityScores: SCORES, ...carrying('chain-mail') }))
    const [sc] = getRollGuide(d, play()).spellcasting
    expect(sc.attack.notes[0]).toBe('Usando Cota de Malha sem proficiência, você não pode conjurar magias (pág. 144).')
  })

  it('sem a classe escolhida no talento, sem conjuração', () => {
    const d = { ...withMagicInitiate(draft({ class: 'fighter', level: 4, abilityScores: SCORES })), featSelections: {} }
    expect(getRollGuide(d, play()).spellcasting).toEqual([])
  })
})

describe('getRollGuide — em fúria não se conjura (pág. 48)', () => {
  const RAGE = 'Fúria: em fúria, você não pode conjurar magias nem se concentrar nelas (pág. 48); entrar em fúria encerra a concentração.'
  const FEAT = 'iniciado-em-magia'
  // Bárbaro 2 / mago 1: INT 10 (+0), proficiência +2.
  const barbarianWizard = draft({
    class: 'barbarian', level: 3, abilityScores: SCORES, multiclass: true, additionalClasses: [extraClass('wizard', 1)],
  })

  it('bárbaro / mago: nota no ataque de magia, sem mexer no número nem no modo; fora das notas em vigor', () => {
    const guide = getRollGuide(barbarianWizard, play())
    expect(guide.castingRestrictions).toEqual([RAGE])
    expect(guide.notes).toEqual([])
    const [sc] = guide.spellcasting
    expect(sc.attack.notes).toContain(RAGE)
    expect(sc.attack).toMatchObject({ formula: '1d20 + 2', mode: 'normal' })
  })

  it('bárbaro com Iniciado em Magia: também no ataque de magia do talento, depois da armadura que impede', () => {
    const d = draft({
      class: 'barbarian', level: 4, abilityScores: SCORES, ...carrying('chain-mail'),
      asiChoices: [{ kind: 'feat', featId: FEAT }],
      featSelections: { [FEAT]: { spellClass: 'cleric', cantrips: ['sacred-flame', 'guidance'], spells: ['cure-wounds'] } },
    })
    const [sc] = getRollGuide(d, play()).spellcasting
    expect(sc.key).toBe(`feat:${FEAT}`)
    expect(sc.attack.notes.slice(0, 2)).toEqual([
      'Usando Cota de Malha sem proficiência, você não pode conjurar magias (pág. 144).',
      RAGE,
    ])
  })

  it('a concentração lembra a regra e que entrar em fúria a encerra (decisão de 2026-10-29); o mago sem Fúria não', () => {
    const state = play({ concentration: { label: 'Escudo Arcano', startedAt: 0 } })
    expect(getConcentrationGuide(barbarianWizard, state, 10).notes[0]).toBe(RAGE)
    const wizard = draft({ class: 'wizard', level: 3, abilityScores: SCORES })
    expect(getConcentrationGuide(wizard, state, 10).notes.some(n => n.includes('fúria'))).toBe(false)
    expect(getRollGuide(wizard, play()).castingRestrictions).toEqual([])
  })

  it('tiefling bárbaro: sem conjuração de classe, a restrição vale pela magia inata, também no ataque da raça', () => {
    const guide = getRollGuide(draft({ class: 'barbarian', level: 3, race: 'tiefling', abilityScores: SCORES }), play())
    // Carisma 10 (8 + 2 do tiferino): +0; a proficiência do 3º nível, +2.
    expect(guide.spellcasting.map(s => [s.key, s.kind, s.classId, s.ability, s.saveDc, s.attack.formula])).toEqual([
      ['race:tiefling', 'race', null, 'CHA', 10, '1d20 + 2'],
    ])
    expect(guide.castingRestrictions).toEqual([RAGE])
    expect(guide.spellcasting[0].attack.notes).toContain(RAGE)
  })
})

// Ligada a fúria (o estado de jogo), a condição do Dano de Fúria e a da restrição de conjuração são
// satisfeitas: o bônus entra no número e a restrição fica em vigor. Desligar é um ciclo exato.
describe('getRollGuide — em fúria (efeito ligado)', () => {
  const RAGE_ON = 'Em fúria agora (Fúria): você não pode conjurar magias nem se concentrar nelas (pág. 48); entrar em fúria encerra a concentração.'
  const RAGE = 'Fúria: em fúria, você não pode conjurar magias nem se concentrar nelas (pág. 48); entrar em fúria encerra a concentração.'
  const raging = (patch: Partial<PlayState> = {}) => play({ activeEffects: [{ id: 'rage', startedAt: 1 }], ...patch })
  // Bárbaro 3 sem raça: FOR 16 (+3), DES 14 (+2).
  const barbarian = (...items: string[]) => draft({ class: 'barbarian', level: 3, abilityScores: SCORES, ...carrying(...items) })
  const attack = (guide: RollGuide, key: string) => guide.attacks.find(a => a.key === key)!

  it('bárbaro 3: machado grande 1d12+5, com a parcela Dano de Fúria +2 no "de onde vem"', () => {
    const damage = attack(getRollGuide(barbarian('greataxe'), raging()), 'greataxe').damage!
    expect(damage.formula).toBe('1d12 + 5 cortante')
    expect(damage.breakdown).toEqual([{ label: 'Força', value: 3 }, { label: 'Dano de Fúria', value: 2 }])
    expect(damage.notes).toEqual([])
    expect(damage.crit?.formula).toBe('2d12 + 5 cortante')
  })

  it('rapieira com a Destreza maior: continua nota', () => {
    const d = draft({ class: 'barbarian', level: 3, abilityScores: { ...SCORES, STR: 10, DEX: 16 }, ...carrying('rapier') })
    const damage = attack(getRollGuide(d, raging()), 'rapier').damage!
    expect(damage.formula).toBe('1d8 + 3 perfurante')
    expect(damage.notes).toContain('+2 de dano em fúria, sem armadura pesada, atacando com Força em vez de Destreza (Dano de Fúria)')
  })

  it('machadinha corpo a corpo: soma, com a nota de arremesso', () => {
    const line = attack(getRollGuide(barbarian('handaxe'), raging()), 'handaxe')
    expect(line.damage?.formula).toBe('1d6 + 5 cortante')
    expect(line.notes).toEqual(['arremessando, sem o Dano de Fúria'])
  })

  it('golpe desarmado com FOR 6 em fúria: 1, com a conta inteira no "de onde vem"', () => {
    const d = draft({ class: 'barbarian', level: 3, abilityScores: { ...SCORES, STR: 6 } })
    const damage = attack(getRollGuide(d, raging()), 'unarmed').damage!
    expect(damage.formula).toBe('1 concussão')
    expect(damage.breakdown).toEqual([
      { label: 'Golpe desarmado', value: 1 }, { label: 'Força', value: -2 }, { label: 'Dano de Fúria', value: 2 },
    ])
    // Desligada, a linha mostra 0 e a nota diz quanto causaria em fúria.
    expect(attack(getRollGuide(d, play()), 'unarmed').damage?.formula).toBe('0 concussão')
  })

  it('de Placas: a nota diz que não vale agora, e o número fica', () => {
    const line = attack(getRollGuide(barbarian('greataxe', 'plate'), raging()), 'greataxe')
    expect(line.damage?.formula).toBe('1d12 + 3 cortante')
    expect(line.notes).toContain('+2 de dano em fúria, sem armadura pesada (Dano de Fúria) — não vale agora: você está de Placas')
  })

  it('a Arquearia continua parcela, sem a nota', () => {
    const d = draft({ class: 'fighter', level: 1, abilityScores: SCORES, classChoices: choices({ fightingStyle: 'archery' }), ...carrying('longbow') })
    const bow = attack(getRollGuide(d, play()), 'longbow')
    expect(bow.attack.breakdown).toEqual([{ label: 'Destreza', value: 2 }, { label: 'Proficiência', value: 2 }, { label: 'Arquearia', value: 2 }])
    expect(bow.notes.some(n => n.includes('Arquearia'))).toBe(false)
  })

  it('desligar a fúria devolve o guia de antes', () => {
    const d = barbarian('greataxe', 'handaxe', 'rapier')
    expect(getRollGuide(d, raging())).not.toEqual(getRollGuide(d, play()))
    expect(getRollGuide(d, raging({ activeEffects: [] }))).toEqual(getRollGuide(d, play()))
  })

  it('a restrição sai das condicionais e entra nas notas em vigor, no ataque de magia e na concentração', () => {
    const d = draft({ class: 'barbarian', level: 3, abilityScores: SCORES, multiclass: true, additionalClasses: [extraClass('wizard', 1)] })
    const guide = getRollGuide(d, raging())
    expect(guide.castingRestrictions).toEqual([])
    expect(guide.activeCastingRestrictions).toEqual([RAGE_ON])
    expect(guide.notes).toEqual([RAGE_ON])
    expect(guide.spellcasting[0].attack.notes).toContain(RAGE_ON)
    expect(getConcentrationGuide(d, raging(), 10).notes[0]).toBe(RAGE_ON)
    // Desligada, como antes.
    expect(getRollGuide(d, play()).castingRestrictions).toEqual([RAGE])
    expect(getRollGuide(d, play()).activeCastingRestrictions).toEqual([])
  })
})

describe('getRollGuide — fixture completa', () => {
  it('meio-orc bárbaro: números da ficha e d12', () => {
    const guide = getRollGuide(COMPLETE_DRAFT, play())
    expect(guide.saves.STR.formula).toBe('1d20 + 5')
    expect(guide.hitDice[0].formula).toBe('1d12 + 2')
    expect(guide.notes).toEqual([])
    // Não conjura nada: a Fúria não tem o que restringir.
    expect(guide.castingRestrictions).toEqual([])
  })
})

describe('getConcentrationGuide', () => {
  const caster = draft({ class: 'wizard', level: 1, abilityScores: SCORES })

  it('CD = max(10, metade do dano para baixo), TR de Constituição da ficha', () => {
    expect(getConcentrationGuide(caster, play(), 7)).toMatchObject({ id: 'concentration', dc: 10, formula: '1d20 + 2', ability: 'CON' })
    expect(getConcentrationGuide(caster, play(), 25).dc).toBe(12)
    expect(getConcentrationGuide(caster, play(), Number.NaN).dc).toBe(10)
    expect(getConcentrationGuide(caster, play(), -8).dc).toBe(10)
  })

  it('o nome da magia no rótulo e as fontes de TR de CON (Exaustão 3)', () => {
    const state = play({ exhaustionLevel: 3, concentration: { label: 'Bênção', startedAt: 0 } })
    const guide = getConcentrationGuide(caster, state, 10)
    expect(guide.label).toBe('Concentração em Bênção — TR de Constituição')
    expect(guide.mode).toBe('disadvantage')
  })

  it('Conjurador de Guerra: vantagem na concentração; no TR de CON comum, só nota', () => {
    const d = draft({ class: 'wizard', level: 4, abilityScores: SCORES, asiChoices: [{ kind: 'feat', featId: 'conjurador-de-guerra' }] })
    const guide = getConcentrationGuide(d, play(), 30)
    expect(guide).toMatchObject({ mode: 'advantage', dc: 15, notation: '2d20kh1+2' })
    expect(labelsOf(guide.advantage)).toEqual(['Conjurador de Guerra'])
    const save = getRollGuide(d, play()).saves.CON
    expect(save.mode).toBe('normal')
    expect(save.notes.some(n => n.startsWith('Conjurador de Guerra'))).toBe(true)
  })
})

// "Se você cair para 0 pontos de vida enquanto estiver em fúria e não morrer, você pode realizar
// um teste de resistência de Constituição CD 10" (Fúria Implacável, pág. 49).
describe('getZeroHpSaveGuide', () => {
  const save = { ability: 'CON' as const, source: 'Fúria Implacável' }
  const berserker = draft({ class: 'barbarian', level: 11, abilityScores: SCORES, classChoices: choices({ subclass: 'berserker' }) })

  it('o TR de Constituição da ficha, com a CD do aviso, o nome de quem dá e o id próprio', () => {
    const before = play({ activeEffects: [{ id: 'rage', startedAt: 1, option: 'frenzy' }] })
    expect(getZeroHpSaveGuide(berserker, before, save, 15)).toMatchObject({
      id: 'zero-hp-save', label: 'Fúria Implacável — TR de Constituição', dc: 15, ability: 'CON', formula: '1d20 + 6', mode: 'normal',
    })
  })

  // Quem passa não caiu: a exaustão que o Frenesi daria na queda (2 → 3) não entra no teste.
  it('lê o estado que recebe, o de antes do dano: na exaustão 2 sem desvantagem, na 3 com', () => {
    const before = play({ exhaustionLevel: 2, activeEffects: [{ id: 'rage', startedAt: 1, option: 'frenzy' }] })
    expect(getZeroHpSaveGuide(berserker, before, save, 10).mode).toBe('normal')
    const after = play({ exhaustionLevel: 3, lifeState: 'dying' })
    expect(labelsOf(getZeroHpSaveGuide(berserker, after, save, 10).disadvantage)).toEqual(['Exaustão 3'])
  })

  // Aura de Proteção (pág. 111, linhas 9969-9975): "Você deve estar consciente para garantir esse
  // bônus". Quem passa não caiu: o teste é feito no estado de antes, ainda consciente (como ainda em
  // fúria), e a aura entra no número; no de depois, a 0 PV, não.
  it('bárbaro 11 / paladino 6: a Aura de Proteção entra no teste, com a parcela, pelo estado de antes', () => {
    const d = draft({
      class: 'barbarian', level: 17, abilityScores: { ...SCORES, CHA: 16 }, multiclass: true,
      additionalClasses: [extraClass('paladin', 6)],
    })
    const con = getSavingThrowChecks(d, getFinalAbilityScores(d)).CON.bonus
    const before = play({ activeEffects: [{ id: 'rage', startedAt: 1 }] })
    const entry = getZeroHpSaveGuide(d, before, save, 10)
    expect(entry.modifier).toBe(con + 3)
    expect(entry.breakdown.at(-1)).toEqual({ label: 'Aura de Proteção', value: 3 })
    const after = play({ lifeState: 'dying' })
    expect(getZeroHpSaveGuide(d, after, save, 10).modifier).toBe(con)
  })
})

describe('getRollGuide — bônus condicional nas resistências', () => {
  // Aura de Proteção (pág. 111, linhas 9969-9975): "Você deve estar consciente para garantir esse
  // bônus". No jogo, consciente, entra no número dos TR do próprio paladino, com a parcela nomeada
  // (decisão de 2026-10-30, o critério das Auras de Coragem e de Devoção); sem estar, fica a nota da
  // Revisão e do PDF.
  const aura = '+3 em todos os testes de resistência (Aura de Proteção: você e criaturas amigáveis a até 3 m, enquanto você estiver consciente; mínimo +1)'
  const paladin = draft({ class: 'paladin', level: 6, abilityScores: { ...SCORES, CHA: 16 } })
  const saves = getSavingThrowChecks(paladin, getFinalAbilityScores(paladin))

  it('paladino 6 com CAR 16, consciente: +3 em todo TR, com a parcela da aura e sem a nota', () => {
    const guide = getRollGuide(paladin, play())
    for (const ab of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const) {
      expect(guide.saves[ab].modifier).toBe(saves[ab].bonus + 3)
      expect(guide.saves[ab].breakdown.at(-1)).toEqual({ label: 'Aura de Proteção', value: 3 })
      expect(guide.saves[ab].notes).not.toContain(aura)
    }
    expect(guide.saves.WIS.formula).toBe(`1d20 + ${saves.WIS.bonus + 3}`)
    // A concentração é TR de Constituição: a aura vale nela também.
    expect(getConcentrationGuide(paladin, play(), 10).modifier).toBe(saves.CON.bonus + 3)
  })

  it('com o Inconsciente gravado, fora do número e de volta à nota', () => {
    const guide = getRollGuide(paladin, play({ conditions: ['unconscious'] }))
    expect(guide.saves.WIS.modifier).toBe(saves.WIS.bonus)
    expect(guide.saves.WIS.notes).toContain(aura)
    expect(guide.saves.WIS.breakdown.some(b => b.label === 'Aura de Proteção')).toBe(false)
  })

  it('a 0 PV e morto, também fora do número; o teste contra a morte nunca a teve', () => {
    for (const lifeState of ['dying', 'stable', 'dead'] as const) {
      expect(getRollGuide(paladin, play({ lifeState })).saves.CON.modifier).toBe(saves.CON.bonus)
    }
    expect(getRollGuide(paladin, play({ lifeState: 'dying' })).deathSave.modifier).toBe(0)
  })

  it('antes do 6º nível de paladino, nada', () => {
    const d = draft({ class: 'paladin', level: 5, abilityScores: { ...SCORES, CHA: 16 } })
    expect(getRollGuide(d, play()).saves.WIS.notes.some(n => n.includes('Aura de Proteção'))).toBe(false)
  })
})

// Bênção (linhas 20601-20604) e Perdição (linhas 25999-26002): o d4 entra na fórmula, com o d20
// primeiro na notação (o natural sai dele); alcançam o teste contra a morte (decisão 22).
describe('getRollGuide — efeitos recebidos: os dados a mais', () => {
  const on = (...ids: string[]) => play({ activeEffects: ids.map((id, i) => ({ id, startedAt: i })) })

  it('Bênção no ataque, no TR e no teste contra a morte; não nos testes de habilidade', () => {
    const guide = getRollGuide(fighter('longsword'), on('spell:bless'))
    const attack = guide.attacks[0].attack
    expect(attack.formula).toBe('1d20 + 5 + 1d4')
    expect(attack.notation).toBe('1d20+5+1d4')
    expect(attack.extraDice).toEqual([{ label: 'Bênção', count: 1, sides: 4, sign: 1 }])
    expect(guide.saves.STR.formula).toBe('1d20 + 5 + 1d4')
    expect(guide.saves.WIS.notation).toBe('1d20+1+1d4')
    expect(guide.deathSave.formula).toBe('1d20 + 1d4')
    expect(guide.deathSave.notation).toBe('1d20+1d4')
    expect(guide.checks.STR.extraDice).toBeUndefined()
    expect(guide.skills.athletics.formula).toBe('1d20 + 5')
    // O número da aba é o mesmo: o dado se rola por cima.
    expect(attack.modifier).toBe(5)
    expect(() => parseNotation(attack.notation)).not.toThrow()
  })

  it('Perdição subtrai; as duas juntas ficam as duas', () => {
    const bane = getRollGuide(fighter('longsword'), on('spell:bane')).attacks[0].attack
    expect(bane.formula).toBe('1d20 + 5 - 1d4')
    expect(bane.notation).toBe('1d20+5-1d4')
    const both = getRollGuide(fighter('longsword'), on('spell:bless', 'spell:bane')).saves.CON
    expect(both.formula).toBe('1d20 + 4 + 1d4 - 1d4')
    expect(both.extraDice?.map(d => d.label)).toEqual(['Bênção', 'Perdição'])
  })

  it('Bênção com vantagem da mesa e com a Inspiração gasta: o d4 continua', () => {
    const attack = getRollGuide(fighter('longsword'), on('spell:bless')).attacks[0].attack
    expect(withTableMode(attack, 'advantage').notation).toBe('2d20kh1+5+1d4')
    expect(withInspirationSpent(attack).notation).toBe('2d20kh1+5+1d4')
    expect(withTableMode(attack, 'advantage').formula).toBe('1d20 + 5 + 1d4')
  })

  it('a concentração e o ataque de magia também levam a Bênção', () => {
    const wizard = draft({ class: 'wizard', level: 1, abilityScores: SCORES })
    expect(getConcentrationGuide(wizard, on('spell:bless'), 10).formula).toBe('1d20 + 2 + 1d4')
    expect(getRollGuide(wizard, on('spell:bless')).spellcasting[0].attack.formula).toBe('1d20 + 2 + 1d4')
  })

  it('sem o efeito ligado, nada muda', () => {
    expect(getRollGuide(fighter('longsword'), play())).toEqual(getRollGuide(fighter('longsword'), on()))
  })

  // Antídoto (linhas 13686-13689): "vantagem em testes de resistência contra venenos". Só contra
  // veneno: nota em todo TR, o modo não muda (regra de ouro); não no teste contra a morte, que não é
  // contra veneno, nem nos testes de habilidade.
  it('o Antídoto bebido é nota de vantagem nos TR, com o modo de sempre', () => {
    const guide = getRollGuide(fighter('longsword'), on('item:antitoxin'))
    const note = 'Vantagem nos testes de resistência contra veneno (Antídoto)'
    for (const ab of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const) {
      expect(guide.saves[ab].notes, ab).toContain(note)
      expect(guide.saves[ab].mode, ab).toBe('normal')
    }
    expect(guide.deathSave.notes).not.toContain(note)
    expect(guide.checks.CON.notes).not.toContain(note)
  })
})

// Auxílio Divino (linhas 20519-20521): "seus ataques com arma causam 1d4 de dano radiante extra".
// O crítico dobra todos os dados, inclusive os somados (pág. 198, linhas 17752-17764).
describe('getRollGuide — dano extra na arma (Auxílio Divino)', () => {
  const paladin = (...items: string[]) =>
    draft({ class: 'paladin', level: 2, abilityScores: SCORES, spellChoices: { cantrips: [], spells: ['divine-favor'] }, ...carrying(...items) })
  const favored = play({ activeEffects: [{ id: 'spell:divine-favor', startedAt: 1 }] })

  it('a espada longa: 1d8 + 3 cortante + 1d4 radiante, nas duas empunhaduras', () => {
    const [sword] = getRollGuide(paladin('longsword'), favored).attacks
    expect(sword.damage?.formula).toBe('1d8 + 3 cortante + 1d4 radiante')
    expect(sword.damage?.notation).toBe('1d8+3+1d4')
    expect(sword.versatile?.formula).toBe('1d10 + 3 cortante + 1d4 radiante')
    expect(sword.damage?.extraDice).toEqual([{ label: 'Auxílio Divino', count: 1, sides: 4, sign: 1, damageType: 'radiante' }])
  })

  it('crítico com Auxílio Divino: 2d8 + 3 + 2d4', () => {
    const crit = getRollGuide(paladin('longsword'), favored).attacks[0].damage?.crit
    expect(crit?.formula).toBe('2d8 + 3 cortante + 2d4 radiante')
    expect(crit?.notation).toBe('2d8+3+2d4')
  })

  it('o jogador pode tirar um grupo do dobro (item 6 de regras-dano-e-morte.md)', () => {
    const damage = getRollGuide(paladin('longsword'), favored).attacks[0].damage!
    expect(getCritRecipe(damage, ['Auxílio Divino'])).toMatchObject({ formula: '2d8 + 3 cortante + 1d4 radiante', notation: '2d8+3+1d4' })
    expect(getCritRecipe(damage, [])).toBe(damage.crit)
  })

  it('arma à distância e golpe desarmado também (ataque com arma; decisão a)', () => {
    const guide = getRollGuide(paladin('light-crossbow'), favored)
    expect(guide.attacks[0].damage?.formula).toBe('1d8 + 2 perfurante + 1d4 radiante')
    const unarmed = guide.attacks.find(a => a.key === 'unarmed')!.damage!
    expect(unarmed.formula).toBe('4 concussão + 1d4 radiante')
    expect(unarmed.notation).toBe('4+1d4')
    // O fixo não dobra; o dado a mais, sim.
    expect(unarmed.crit?.formula).toBe('4 concussão + 2d4 radiante')
    expect(unarmed.notes).toContain('Dano fixo: no acerto crítico, só os dados a mais dobram (pág. 198).')
  })

  // A Rede é arma e acerta sem causar dano (pág. 150, linhas 13476-13488): com o Auxílio Divino, o
  // acerto causa o 1d4 radiante (decisão de 2026-10-30), sem o modificador do atributo.
  it('a Rede: o dano é só o 1d4 radiante, que o crítico dobra', () => {
    const net = getRollGuide(paladin('net'), favored).attacks.find(a => a.key === 'net')!
    expect(net.damage).toMatchObject({
      dice: '', modifier: 0, formula: '1d4 radiante', notation: '1d4', breakdown: [],
      crit: { formula: '2d4 radiante', notation: '2d4' },
    })
    expect(net.damage?.extraDice).toEqual([{ label: 'Auxílio Divino', count: 1, sides: 4, sign: 1, damageType: 'radiante' }])
    expect(net.damage?.notes).toContain('A arma não causa dano: o acerto causa só o dano extra.')
    expect(net.damage?.notes.some(n => n.startsWith('Dano fixo') || n.startsWith('Não causa dano'))).toBe(false)
    expect(getCritRecipe(net.damage!, ['Auxílio Divino'])).toMatchObject({ formula: '1d4 radiante', notation: '1d4' })
    expect(net.versatile).toBeNull()
    // Sem o Auxílio Divino, a Rede continua sem dano.
    expect(getRollGuide(paladin('net'), play()).attacks.find(a => a.key === 'net')!.damage).toBeNull()
  })

  // O mínimo 0 do golpe desarmado com dano extra de outro tipo é por parcela, decidido em 2026-10-30
  // (regras-efeitos-ativos.md, seção 6): 0 concussão + 1d4 radiante, e o 1d4 radiante é dano — a
  // ficha não diz "Não causa dano".
  it('golpe desarmado com Força 7: o fixo fica em 0, e com o 1d4 radiante ele causa dano', () => {
    const weak = draft({
      class: 'paladin', level: 2, abilityScores: { ...SCORES, STR: 7 }, spellChoices: { cantrips: [], spells: ['divine-favor'] },
    })
    const unarmed = getRollGuide(weak, favored).attacks.find(a => a.key === 'unarmed')!.damage!
    expect(unarmed.formula).toBe('0 concussão + 1d4 radiante')
    expect(unarmed.crit?.formula).toBe('0 concussão + 2d4 radiante')
    expect(unarmed.notes.some(n => n.startsWith('Não causa dano'))).toBe(false)
    expect(unarmed.notes).toContain('Dano fixo: no acerto crítico, só os dados a mais dobram (pág. 198).')
    // Sem o Auxílio Divino, não causa dano, como antes.
    expect(getRollGuide(weak, play()).attacks.find(a => a.key === 'unarmed')!.damage!.notes.some(n => n.startsWith('Não causa dano'))).toBe(true)
  })

  it('a Revisão e o PDF não têm sessão: o dano fica como era', () => {
    const [sword] = getRollGuide(paladin('longsword'), play()).attacks
    expect(sword.damage?.formula).toBe('1d8 + 3 cortante')
    expect(sword.damage?.extraDice).toBeUndefined()
  })
})

// Destruição Divina Aprimorada (paladino 11, linhas 9984-9991): "sempre que você atingir uma
// criatura com uma arma corpo-a-corpo [...] 1d8 de dano radiante extra" — incondicional, entra no
// número na Revisão, no PDF e no jogo. Só arma: o golpe desarmado fica de fora (decisão c).
describe('getRollGuide — Destruição Divina Aprimorada no número', () => {
  const paladin = (level: number) => draft({ class: 'paladin', level, abilityScores: SCORES, ...carrying('longsword', 'javelin') })
  const attack = (level: number, key: string) => getRollGuide(paladin(level), play()).attacks.find(a => a.key === key)!

  it('espada longa: +1d8 radiante, nas duas empunhaduras', () => {
    expect(attack(11, 'longsword').damage?.formula).toBe('1d8 + 3 cortante + 1d8 radiante')
    expect(attack(11, 'longsword').versatile?.formula).toBe('1d10 + 3 cortante + 1d8 radiante')
    expect(attack(11, 'longsword').damage?.extraDice?.[0].label).toBe('Destruição Divina Aprimorada')
  })

  it('crítico: 2d8 + 2d8', () => {
    expect(attack(11, 'longsword').damage?.crit?.formula).toBe('2d8 + 3 cortante + 2d8 radiante')
    expect(attack(11, 'longsword').damage?.crit?.notation).toBe('2d8+3+2d8')
  })

  it('golpe desarmado: sem; azagaia arremessada: sem, com a nota', () => {
    expect(attack(11, 'unarmed').damage?.extraDice).toBeUndefined()
    const javelin = attack(11, 'javelin')
    expect(javelin.damage?.formula).toBe('1d6 + 3 perfurante + 1d8 radiante')
    expect(javelin.notes).toContain('arremessando, sem o 1d8 radiante (Destruição Divina Aprimorada)')
  })

  it('paladino 10: sem', () => {
    expect(attack(10, 'longsword').damage?.formula).toBe('1d8 + 3 cortante')
  })
})
