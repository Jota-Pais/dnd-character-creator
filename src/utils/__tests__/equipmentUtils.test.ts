import { describe, it, expect } from 'vitest'
import { formatCurrency, resolvePackContents, validatePackRefs, FOCUS_GROUP_IDS, getEquippedArmor, getShopCatalog, getPurchasesTotalCopper, getItemCostCopper } from '../equipmentUtils'
import type { InventoryItem } from '../../types/equipment'
import { getClass } from '../classUtils'
import type { EquipmentDraft } from '../../types/equipment'

function fighterEquipment(overrides: Partial<EquipmentDraft> = {}): EquipmentDraft {
  return {
    method: 'standard',
    classResolutions: [],
    rolledGold: null,
    purchasedItems: [],
    ...overrides,
  }
}

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

describe('getShopCatalog / compras', () => {
  const catalog = getShopCatalog()

  it('inclui apenas itens com preço, de todas as categorias', () => {
    const cats = new Set(catalog.map(i => i.category))
    expect(cats).toContain('Armas')
    expect(cats).toContain('Armaduras')
    expect(cats).toContain('Ferramentas')
    expect(cats).toContain('Pacotes')
    expect(cats).toContain('Equipamento')
    expect(catalog.every(i => i.costCopper > 0)).toBe(true)
  })

  it('vem ordenado por nome', () => {
    const names = catalog.map(i => i.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })

  it('getItemCostCopper devolve o custo em cobre (adaga = 200)', () => {
    expect(getItemCostCopper('dagger')).toBe(200)
    expect(getItemCostCopper('inexistente')).toBeNull()
  })

  it('getPurchasesTotalCopper soma preço × quantidade', () => {
    const items: InventoryItem[] = [
      { itemId: 'dagger', quantity: 2, source: 'purchased' }, // 200 × 2 = 400
      { itemId: 'shield', quantity: 1, source: 'purchased' }, // 1000
    ]
    expect(getPurchasesTotalCopper(items)).toBe(1400)
  })

  it('itens sem preço no catálogo não contam no total', () => {
    expect(getPurchasesTotalCopper([{ itemId: 'inexistente', quantity: 5, source: 'purchased' }])).toBe(0)
  })
})

describe('getEquippedArmor', () => {
  const fighter = getClass('fighter')!

  it('detecta cota de malha e escudo escolhidos (guerreiro)', () => {
    // choice[0]→opção 0 = cota de malha; choice[1]→opção 0 = arma marcial + escudo
    const eq = fighterEquipment({
      classResolutions: [
        { optionIndex: 0, pickedIds: [] },
        { optionIndex: 0, pickedIds: ['longsword'] },
      ],
    })
    const { bodyArmor, hasShield } = getEquippedArmor(eq, fighter.startingEquipment)
    expect(bodyArmor?.id).toBe('chain-mail')
    expect(hasShield).toBe(true)
  })

  it('opção sem escudo não reporta escudo', () => {
    // choice[1]→opção 1 = duas armas marciais, sem escudo
    const eq = fighterEquipment({
      classResolutions: [
        { optionIndex: 1, pickedIds: ['longbow', 'arrows'] },
        { optionIndex: 1, pickedIds: ['longsword', 'battleaxe'] },
      ],
    })
    const { bodyArmor, hasShield } = getEquippedArmor(eq, fighter.startingEquipment)
    expect(bodyArmor?.id).toBe('leather')
    expect(hasShield).toBe(false)
  })

  it('escolhas não resolvidas não trazem armadura', () => {
    const { bodyArmor, hasShield } = getEquippedArmor(fighterEquipment(), fighter.startingEquipment)
    expect(bodyArmor).toBeUndefined()
    expect(hasShield).toBe(false)
  })

  it('método riqueza usa itens comprados', () => {
    const eq = fighterEquipment({
      method: 'wealth',
      purchasedItems: [
        { itemId: 'plate', quantity: 1, source: 'purchased' },
        { itemId: 'shield', quantity: 1, source: 'purchased' },
      ],
    })
    const { bodyArmor, hasShield } = getEquippedArmor(eq, fighter.startingEquipment)
    expect(bodyArmor?.id).toBe('plate')
    expect(hasShield).toBe(true)
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
