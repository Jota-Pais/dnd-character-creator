import { describe, it, expect } from 'vitest'
import { CLASSES } from '../../utils/classUtils'
import { FOCUS_GROUP_IDS } from '../../utils/equipmentUtils'
import type { ItemType, EquipmentChoiceItem } from '../../types/equipment'
import weaponsData from '../weapons.json'
import armorsData from '../armors.json'
import toolsData from '../tools.json'
import generalItemsData from '../general-items.json'
import packsData from '../equipment-packs.json'

/**
 * Equipamento inicial de classe (PHB 2014, cap. 3). A adaga do bardo e a aljava do patrulheiro e
 * do ladino sumiram na transcrição sem nenhum teste reclamar: aqui todo id precisa existir no
 * catálogo do tipo que declara, e os itens fixos que já escaparam uma vez ficam travados no livro.
 */
const CATALOG: Record<ItemType, Set<string>> = {
  weapon: new Set(weaponsData.map(i => i.id)),
  armor: new Set(armorsData.map(i => i.id)),
  tool: new Set(toolsData.map(i => i.id)),
  general: new Set(generalItemsData.map(i => i.id)),
  pack: new Set(packsData.map(i => i.id)),
}

/** Todos os itens "specific" de uma classe (fixos + todas as opções de todas as escolhas). */
function specificItems(classId: string): { id: string; itemType: ItemType; where: string }[] {
  const cls = CLASSES.find(c => c.id === classId)!
  const { fixed, choices } = cls.startingEquipment
  const fromChoices = choices.flatMap((choice, ci) =>
    choice.options.flatMap((option, oi) =>
      option
        .filter((item): item is Extract<EquipmentChoiceItem, { kind: 'specific' }> => item.kind === 'specific')
        .map(item => ({ id: item.id, itemType: item.itemType, where: `escolha ${ci + 1}, opção ${oi + 1}` })),
    ),
  )
  return [...fixed.map(item => ({ id: item.id, itemType: item.itemType, where: 'fixo' })), ...fromChoices]
}

function fixedIds(classId: string): string[] {
  return CLASSES.find(c => c.id === classId)!.startingEquipment.fixed.map(i => i.id)
}

describe('equipamento inicial de classe (classes.json)', () => {
  it('todo id de item específico existe no catálogo do tipo declarado', () => {
    const missing = CLASSES.flatMap(cls =>
      specificItems(cls.id)
        .filter(item => !CATALOG[item.itemType].has(item.id))
        .map(item => `${cls.id} (${item.where}): ${item.itemType}/${item.id}`),
    )
    expect(missing).toEqual([])
  })

  it('os grupos de foco apontam para itens do catálogo geral', () => {
    const ids = Object.values(FOCUS_GROUP_IDS).flat()
    expect(ids.filter(id => !CATALOG.general.has(id))).toEqual([])
  })

  it('bardo: armadura de couro e uma adaga fixas (p. 52)', () => {
    expect(fixedIds('bard')).toEqual(['leather', 'dagger'])
  })

  it('patrulheiro: arco longo e aljava com 20 flechas fixos (p. 117)', () => {
    expect(fixedIds('ranger')).toEqual(['longbow', 'arrows', 'quiver'])
  })

  it('ladino: a opção do arco curto vem com a aljava e as 20 flechas (p. 91)', () => {
    const rogue = CLASSES.find(c => c.id === 'rogue')!
    const bowOption = rogue.startingEquipment.choices
      .flatMap(c => c.options)
      .find(option => option.some(i => i.kind === 'specific' && i.id === 'shortbow'))!
    expect(bowOption.map(i => (i.kind === 'specific' ? i.id : i.kind))).toEqual(['shortbow', 'arrows', 'quiver'])
  })
})
