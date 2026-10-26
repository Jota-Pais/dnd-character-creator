import { describe, it, expect } from 'vitest'
import { sequenceRoller } from '../../../../../core/dice'
import { formatGuideFormula, formatGuideNotation, type RollGuideEntry } from '../../../utils/rollGuide'
import { canRollEntry, rerollNaturalOne, rollGuideEntry } from '../playDice'

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
