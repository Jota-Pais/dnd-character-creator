import { describe, it, expect } from 'vitest'
import { sequenceRoller } from '../../../../../core/dice'
import { formatGuideFormula, formatGuideNotation, type RollGuideEntry } from '../../../utils/rollGuide'
import {
  canRollEntry, describeRolledFormula, formatFreeRoll, formatRollCopyText, readFreeRollNumber, rerollNaturalOne, rollFree,
  rollGuideEntry,
} from '../playDice'

function entry(over: Partial<RollGuideEntry>): RollGuideEntry {
  return {
    id: 'skill:stealth', kind: 'd20', label: 'Furtividade', dice: '1d20', modifier: 3,
    formula: formatGuideFormula('1d20', 3), notation: formatGuideNotation('1d20', 3),
    mode: 'normal', advantage: [], disadvantage: [], autoFail: [], breakdown: [], notes: [],
    ...over,
  }
}

describe('rollGuideEntry', () => {
  it('rola a notação do guia e devolve o d20 natural', () => {
    const { record, natural } = rollGuideEntry(entry({}), { roller: sequenceRoller([17]), at: 1 })
    expect(record.total).toBe(20)
    expect(record.label).toBe('Furtividade')
    expect(natural).toBe(17)
  })

  it('com desvantagem, o natural é o d20 que ficou (o menor)', () => {
    const e = entry({ mode: 'disadvantage', notation: '2d20kl1+3' })
    const { record, natural } = rollGuideEntry(e, { roller: sequenceRoller([18, 4]) })
    expect(natural).toBe(4)
    expect(record.total).toBe(7)
  })

  it('com vantagem, o natural é o d20 que ficou (o maior)', () => {
    const e = entry({ mode: 'advantage', notation: '2d20kh1+3' })
    const { record, natural } = rollGuideEntry(e, { roller: sequenceRoller([4, 18]) })
    expect(natural).toBe(18)
    expect(record.total).toBe(21)
  })

  it('crítico de dano fixo (sem dado): não há o que rolar nem dobrar', () => {
    const e = entry({
      id: 'damage:unarmed', kind: 'damage', label: 'Golpe desarmado', dice: '', modifier: 4, notation: '4',
      crit: { dice: '', formula: '4 concussão', notation: '4' },
    })
    expect(canRollEntry(e)).toBe(false)
    const { record } = rollGuideEntry(e, { crit: true, roller: sequenceRoller([]) })
    expect(record.total).toBe(4)
    expect(record.terms.flatMap(t => t.dice)).toEqual([])
  })

  it('crit usa os dados dobrados e marca o rótulo; dano não tem natural', () => {
    const e = entry({
      id: 'damage:x', kind: 'damage', label: 'Machado', dice: '1d12', notation: '1d12+3',
      crit: { dice: '2d12', formula: '2d12 + 3', notation: '2d12+3' },
    })
    const { record, natural } = rollGuideEntry(e, { crit: true, roller: sequenceRoller([5, 7]) })
    expect(record.total).toBe(15)
    expect(record.label).toBe('Machado (crítico)')
    expect(natural).toBeNull()
  })

  it('dano fixo, sem dado, não é rolável', () => {
    expect(canRollEntry(entry({ kind: 'damage', dice: '', notation: '1' }))).toBe(false)
    expect(canRollEntry(entry({}))).toBe(true)
  })
})

describe('rerollNaturalOne (Sortudo)', () => {
  const death = entry({ id: 'death-save', label: 'Teste contra a morte', modifier: 0, notation: '1d20' })

  it('sem vantagem nem desvantagem: o d20 novo vale, num registro próprio', () => {
    const first = rollGuideEntry(death, { roller: sequenceRoller([1]) })
    const again = rerollNaturalOne(death, first, { roller: sequenceRoller([14]), source: 'Sortudo' })
    expect(again.natural).toBe(14)
    expect(again.record.label).toBe('Teste contra a morte — de novo (Sortudo)')
    expect(again.record.notation).toBe('1d20')
  })

  it('com desvantagem, só o dado que saiu 1 é rolado de novo e vale o menor do par', () => {
    const e = { ...death, mode: 'disadvantage' as const, notation: '2d20kl1' }
    const first = rollGuideEntry(e, { roller: sequenceRoller([15, 1]) })
    expect(first.natural).toBe(1)
    expect(rerollNaturalOne(e, first, { roller: sequenceRoller([12]) }).natural).toBe(12)
    expect(rerollNaturalOne(e, first, { roller: sequenceRoller([18]) }).natural).toBe(15)
    // Dois 1: o outro continua 1.
    const ones = rollGuideEntry(e, { roller: sequenceRoller([1, 1]) })
    expect(rerollNaturalOne(e, ones, { roller: sequenceRoller([20]) }).natural).toBe(1)
  })

  it('com vantagem (os dois saíram 1), vale o novo', () => {
    const e = { ...death, mode: 'advantage' as const, notation: '2d20kh1' }
    const first = rollGuideEntry(e, { roller: sequenceRoller([1, 1]) })
    expect(rerollNaturalOne(e, first, { roller: sequenceRoller([9]) }).natural).toBe(9)
  })
})

describe('copiar resultado', () => {
  it('rótulo, total, fórmula e faces; o d20 descartado dito por extenso', () => {
    const e = entry({ label: 'Atletismo', modifier: 5, formula: '1d20 + 5', mode: 'advantage', notation: '2d20kh1+5' })
    const { record } = rollGuideEntry(e, { roller: sequenceRoller([4, 12]) })
    expect(formatRollCopyText({ label: record.label!, formula: describeRolledFormula(e), record }))
      .toBe('Atletismo: 17 (1d20 + 5, com vantagem; dados: 4 descartado, 12)')
  })

  it('desvantagem, normal e o dano do crítico com os dados dobrados', () => {
    expect(describeRolledFormula(entry({ mode: 'disadvantage' }))).toBe('1d20 + 3, com desvantagem')
    expect(describeRolledFormula(entry({}))).toBe('1d20 + 3')
    const damage = entry({
      id: 'damage:x', kind: 'damage', label: 'Machado — dano', dice: '1d12', formula: '1d12 + 3 cortante', notation: '1d12+3',
      crit: { dice: '2d12', formula: '2d12 + 3 cortante', notation: '2d12+3' },
    })
    expect(describeRolledFormula(damage, true)).toBe('2d12 + 3 cortante')
    const { record } = rollGuideEntry(damage, { crit: true, roller: sequenceRoller([5, 7]) })
    expect(formatRollCopyText({ label: record.label!, formula: describeRolledFormula(damage, true), record }))
      .toBe('Machado — dano (crítico): 15 (2d12 + 3 cortante; dados: 5, 7)')
  })
})

describe('rolador livre', () => {
  it('lê o número digitado, preso entre o mínimo e o máximo; vazio ou texto dá o padrão', () => {
    expect(readFreeRollNumber('3', 1, 100, 1)).toBe(3)
    expect(readFreeRollNumber(' -2 ', -99, 99, 0)).toBe(-2)
    expect(readFreeRollNumber('−4', -99, 99, 0)).toBe(-4)
    // A meia-risca que o teclado do celular oferece no lugar do hífen, como no campo de PV.
    expect(readFreeRollNumber('–2', -99, 99, 0)).toBe(-2)
    expect(readFreeRollNumber('+1', -99, 99, 0)).toBe(1)
    expect(readFreeRollNumber('0', 1, 100, 1)).toBe(1)
    expect(readFreeRollNumber('500', 1, 100, 1)).toBe(100)
    expect(readFreeRollNumber('', 1, 100, 1)).toBe(1)
    expect(readFreeRollNumber('-', -99, 99, 0)).toBe(0)
    expect(readFreeRollNumber('2.5', 1, 100, 1)).toBe(1)
  })

  it('a fórmula como nas receitas, e a rolagem com o rótulo do histórico', () => {
    expect(formatFreeRoll({ count: 2, sides: 6, modifier: 3 })).toBe('2d6 + 3')
    expect(formatFreeRoll({ count: 1, sides: 100, modifier: 0 })).toBe('1d100')
    expect(formatFreeRoll({ count: 1, sides: 4, modifier: -1 })).toBe('1d4 - 1')
    const { record, natural } = rollFree({ count: 2, sides: 6, modifier: 3 }, { roller: sequenceRoller([4, 2]), at: 1 })
    expect(record.label).toBe('Rolagem livre: 2d6 + 3')
    expect(record.notation).toBe('2d6+3')
    expect(record.total).toBe(9)
    expect(natural).toBeNull()
    expect(formatRollCopyText({ label: 'Rolagem livre', formula: '2d6 + 3', record })).toBe('Rolagem livre: 9 (2d6 + 3; dados: 4, 2)')
  })

  it('d100 sai de 1 a 100 direto; só um d20 sozinho tem natural', () => {
    expect(rollFree({ count: 1, sides: 100, modifier: 0 }, { roller: sequenceRoller([73]) }).record.total).toBe(73)
    expect(rollFree({ count: 1, sides: 20, modifier: 2 }, { roller: sequenceRoller([20]) }).natural).toBe(20)
    expect(rollFree({ count: 2, sides: 20, modifier: 0 }, { roller: sequenceRoller([20, 3]) }).natural).toBeNull()
  })
})
