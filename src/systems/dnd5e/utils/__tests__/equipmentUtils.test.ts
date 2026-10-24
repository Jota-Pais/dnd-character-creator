import { describe, it, expect } from 'vitest'
import { formatCurrency, resolvePackContents, validatePackRefs, FOCUS_GROUP_IDS, getEquippedArmor, getShopCatalog, getPurchasesTotalCopper, getItemCostCopper, formatInventoryItem, describeResolvedOption, formatCoins, getStartingMoney, describeStartingMoneySource, getCarriedToolIds, getToolById } from '../equipmentUtils'
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

describe('formatInventoryItem / describeResolvedOption (inventário da ficha e da Revisão)', () => {
  it('item comum sai com a quantidade; pacote sai com o conteúdo (p. 153)', () => {
    expect(formatInventoryItem('dagger')).toBe('Adaga')
    expect(formatInventoryItem('dagger', 2)).toBe('2× Adaga')
    expect(formatInventoryItem('entertainers-pack')).toBe(
      'Pacote de Artista (Mochila, Saco de Dormir, 2× Roupas de Entretenimento, 5× Vela, '
      + '5× Rações de Viagem (1 dia), Cantil, Kit de Disfarce)',
    )
  })

  it('bardo: itens específicos e escolhidos em filtro, com o pacote aberto', () => {
    const bard = getClass('bard')!
    const [weaponChoice, packChoice, instrumentChoice] = bard.startingEquipment.choices
    // (c) qualquer arma simples → a escolhida vem dos pickedIds
    expect(describeResolvedOption(weaponChoice.options[2], ['mace'])).toEqual(['Maça'])
    expect(describeResolvedOption(packChoice.options[1], [])[0]).toMatch(/^Pacote de Artista \(Mochila, .*Kit de Disfarce\)$/)
    expect(describeResolvedOption(instrumentChoice.options[0], [])).toEqual(['Alaúde'])
  })

  it('opção com item específico + escolha em filtro consome os pickedIds na ordem', () => {
    const fighter = getClass('fighter')!
    // (a) uma arma marcial e um escudo
    expect(describeResolvedOption(fighter.startingEquipment.choices[1].options[0], ['longsword']))
      .toEqual(['Espada Longa', 'Escudo'])
    // (b) duas armas marciais
    expect(describeResolvedOption(fighter.startingEquipment.choices[1].options[1], ['longsword', 'rapier']))
      .toEqual(['Espada Longa', 'Rapieira'])
  })
})

describe('formatCoins (dinheiro da algibeira)', () => {
  it('fala em po, sem trocar 10 po por platina', () => {
    expect(formatCoins(1000)).toBe('10 po')
    expect(formatCoins(1500)).toBe('15 po')
    expect(formatCoins(12000)).toBe('120 po')
  })

  it('quebra o troco em pp e pc', () => {
    expect(formatCoins(755)).toBe('7 po 5 pp 5 pc')
    expect(formatCoins(50)).toBe('5 pp')
    expect(formatCoins(0)).toBe('0 po')
  })
})

describe('getStartingMoney / describeStartingMoneySource', () => {
  it('método padrão: só a algibeira do antecedente (Charlatão 15 po, Eremita 5 po — cap. 4)', () => {
    const charlatan = getStartingMoney(fighterEquipment(), 15)
    expect(charlatan.totalCopper).toBe(1500)
    expect(describeStartingMoneySource(charlatan)).toBe('antecedente')
    expect(getStartingMoney(fighterEquipment(), 5).totalCopper).toBe(500)
  })

  it('sem antecedente nem riqueza: zero, sem origem a explicar', () => {
    const money = getStartingMoney(fighterEquipment({ method: null }), 0)
    expect(money.totalCopper).toBe(0)
    expect(describeStartingMoneySource(money)).toBeNull()
  })

  it('método riqueza: rolado − compras + antecedente (p. 145)', () => {
    const equipment = fighterEquipment({
      method: 'wealth',
      rolledGold: 120,
      purchasedItems: [
        { itemId: 'lute', quantity: 1, source: 'purchased' },   // 35 po
        { itemId: 'dagger', quantity: 2, source: 'purchased' }, // 2× 2 po
      ],
    })
    const money = getStartingMoney(equipment, 15)
    expect(money.spentCopper).toBe(3900)
    expect(money.totalCopper).toBe(12000 - 3900 + 1500)
    expect(formatCoins(money.totalCopper)).toBe('96 po')
    expect(describeStartingMoneySource(money)).toBe('riqueza 120 po − 39 po em compras + 15 po do antecedente')
  })

  it('método riqueza antes de rolar: só o antecedente; compras de outro método não descontam', () => {
    expect(getStartingMoney(fighterEquipment({ method: 'wealth', rolledGold: null }), 10).totalCopper).toBe(1000)
    const standard = fighterEquipment({
      method: 'standard',
      rolledGold: 50,
      purchasedItems: [{ itemId: 'lute', quantity: 1, source: 'purchased' }],
    })
    expect(getStartingMoney(standard, 10).totalCopper).toBe(1000)
  })
})

describe('getCarriedToolIds', () => {
  const bardEquipment = getClass('bard')!.startingEquipment
  const rogueEquipment = getClass('rogue')!.startingEquipment

  it('itens fixos da classe (ferramentas de ladrão do ladino)', () => {
    expect(getCarriedToolIds(fighterEquipment(), rogueEquipment)).toEqual(['thieves-tools'])
  })

  it('opção específica (alaúde) e conteúdo do pacote (kit de disfarce do Pacote de Artista)', () => {
    const eq = fighterEquipment({
      classResolutions: [{ optionIndex: 0, pickedIds: [] }, { optionIndex: 1, pickedIds: [] }, { optionIndex: 0, pickedIds: [] }],
    })
    expect(getCarriedToolIds(eq, bardEquipment)).toEqual(['disguise-kit', 'lute'])
  })

  it('escolha num tool-filter entra; arma escolhida num weapon-filter não', () => {
    const eq = fighterEquipment({
      classResolutions: [{ optionIndex: 2, pickedIds: ['club'] }, { optionIndex: 0, pickedIds: [] }, { optionIndex: 1, pickedIds: ['lyre'] }],
    })
    expect(getCarriedToolIds(eq, bardEquipment)).toEqual(['lyre'])
  })

  it('compras do método riqueza (e ignora as escolhas de classe que sobraram)', () => {
    const eq = fighterEquipment({
      method: 'wealth',
      classResolutions: [{ optionIndex: 0, pickedIds: [] }, { optionIndex: 0, pickedIds: [] }, { optionIndex: 0, pickedIds: [] }],
      purchasedItems: [
        { itemId: 'drum', quantity: 1, source: 'purchased' },
        { itemId: 'entertainers-pack', quantity: 1, source: 'purchased' },
        { itemId: 'dagger', quantity: 2, source: 'purchased' },
      ],
    })
    expect(getCarriedToolIds(eq, bardEquipment)).toEqual(['drum', 'disguise-kit'])
  })

  it('sem método escolhido, nada', () => {
    expect(getCarriedToolIds(fighterEquipment({ method: null }), rogueEquipment)).toEqual([])
  })
})

describe('getToolById', () => {
  it('acha instrumento e devolve undefined pra item que não é ferramenta', () => {
    expect(getToolById('lute')?.category).toBe('musical-instrument')
    expect(getToolById('dagger')).toBeUndefined()
  })
})
