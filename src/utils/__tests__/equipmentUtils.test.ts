import { describe, it, expect } from 'vitest'
import { formatCurrency, resolvePackContents, validatePackRefs, FOCUS_GROUP_IDS } from '../equipmentUtils'

describe('formatCurrency', () => {
  it('retorna "—" para null', () => {
    expect(formatCurrency(null)).toBe('—')
  })

  it('retorna "0 pc" para zero', () => {
    expect(formatCurrency(0)).toBe('0 pc')
  })

  it('converte múltiplos de 100 pc para po', () => {
    expect(formatCurrency(100)).toBe('1 po')
    expect(formatCurrency(200)).toBe('2 po')
    expect(formatCurrency(1500)).toBe('15 po')
  })

  it('converte múltiplos de 10 pc para pp', () => {
    expect(formatCurrency(10)).toBe('1 pp')
    expect(formatCurrency(50)).toBe('5 pp')
  })

  it('converte múltiplos de 1000 pc para ppt', () => {
    expect(formatCurrency(1000)).toBe('1 ppt')
    expect(formatCurrency(5000)).toBe('5 ppt')
  })

  it('exibe pc para valores não redondos', () => {
    expect(formatCurrency(1)).toBe('1 pc')
    expect(formatCurrency(5)).toBe('5 pc')
    expect(formatCurrency(45)).toBe('45 pc')
  })
})

describe('resolvePackContents', () => {
  it('retorna [] para pacote desconhecido', () => {
    expect(resolvePackContents('pacote-inexistente')).toEqual([])
  })

  it('retorna itens para pacote conhecido', () => {
    const items = resolvePackContents('explorers-pack')
    expect(items.length).toBeGreaterThan(0)
  })

  it('todos os itens têm os campos obrigatórios', () => {
    const items = resolvePackContents('dungeoneers-pack')
    for (const item of items) {
      expect(typeof item.itemId).toBe('string')
      expect(typeof item.quantity).toBe('number')
      expect(item.quantity).toBeGreaterThan(0)
      expect(item.source).toBeDefined()
    }
  })

  it('usa source "class" por padrão', () => {
    const items = resolvePackContents('burglars-pack')
    expect(items.every(i => i.source === 'class')).toBe(true)
  })

  it('respeita o source informado', () => {
    const items = resolvePackContents('explorers-pack', 'background')
    expect(items.every(i => i.source === 'background')).toBe(true)
  })
})

describe('validatePackRefs', () => {
  it('todos os refs dos pacotes apontam para itens conhecidos', () => {
    const errors = validatePackRefs()
    expect(errors).toEqual([])
  })
})

describe('FOCUS_GROUP_IDS', () => {
  it('grupo arcano contém as variantes esperadas', () => {
    expect(FOCUS_GROUP_IDS.arcane).toContain('wand')
    expect(FOCUS_GROUP_IDS.arcane).toContain('crystal')
    expect(FOCUS_GROUP_IDS.arcane).toContain('orb')
    expect(FOCUS_GROUP_IDS.arcane).toContain('rod')
  })

  it('grupo sagrado contém as variantes esperadas', () => {
    expect(FOCUS_GROUP_IDS.holy).toContain('amulet')
    expect(FOCUS_GROUP_IDS.holy).toContain('emblem')
    expect(FOCUS_GROUP_IDS.holy).toContain('reliquary')
  })

  it('grupo druídico contém as variantes esperadas', () => {
    expect(FOCUS_GROUP_IDS.druidic).toContain('totem')
    expect(FOCUS_GROUP_IDS.druidic).toContain('sprig-of-mistletoe')
    expect(FOCUS_GROUP_IDS.druidic).toContain('wooden-staff')
  })
})
