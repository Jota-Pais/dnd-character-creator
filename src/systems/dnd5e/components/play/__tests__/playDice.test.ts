import { describe, it, expect } from 'vitest'
import { sequenceRoller } from '../../../../../core/dice'
import { formatGuideFormula, formatGuideNotation, type RollGuideEntry } from '../../../utils/rollGuide'
import { canRollEntry, rollGuideEntry } from '../playDice'

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
