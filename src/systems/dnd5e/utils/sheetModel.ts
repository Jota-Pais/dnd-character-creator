import type { CharacterDraft } from '../types/character'
import { getBackground, resolveBackgroundItems } from './backgroundUtils'
import { getClass } from './classUtils'
import { formatInventoryItem, getActivePurchases, resolveOptionItems } from './equipmentUtils'

// O modelo de ficha: as listas que a Revisão, a ficha imprimível e o jogo mostram, agregadas aqui
// uma vez só. A conta feita dentro de um componente é a que some de uma das telas.

/** De onde vem um item: a Revisão mostra por origem, a ficha imprimível tudo junto. */
export type InventorySource = 'class-fixed' | 'class-choice' | 'purchased' | 'background'

export type InventoryEntry = {
  /** null: item do antecedente ainda a escolher (o rótulo diz "a escolher"). */
  id: string | null
  quantity: number
  /** "2× Adaga"; o pacote com o conteúdo (`formatInventoryItem`). */
  label: string
  source: InventorySource
}

/**
 * O inventário inicial resolvido, na ordem da ficha: o equipamento da classe (itens fixos e as
 * opções escolhidas) no método padrão, as compras no método riqueza (`getActivePurchases`) e o do
 * antecedente (`resolveBackgroundItems`), que vem nos dois métodos — a leitura do app, a mesma do
 * dinheiro (`getStartingMoney`). Pode repetir id (duas fontes da mesma arma): é o que o
 * personagem carrega, e daí saem também as linhas de ataque.
 */
export function getStartingInventory(draft: CharacterDraft): InventoryEntry[] {
  const items: InventoryEntry[] = []
  const add = (id: string, quantity: number, source: InventorySource) =>
    items.push({ id, quantity, label: formatInventoryItem(id, quantity), source })
  const cls = draft.class ? getClass(draft.class) : undefined
  const bg = draft.background ? getBackground(draft.background) : undefined
  const eq = draft.equipment

  if (eq.method === 'standard' && cls) {
    for (const item of cls.startingEquipment.fixed) add(item.id, item.quantity, 'class-fixed')
    cls.startingEquipment.choices.forEach((choice, i) => {
      const res = eq.classResolutions[i]
      if (!res || res.optionIndex < 0) return
      const option = choice.options[res.optionIndex]
      if (!option) return
      for (const item of resolveOptionItems(option, res.pickedIds)) add(item.id, item.quantity, 'class-choice')
    })
  }
  for (const p of getActivePurchases(eq)) add(p.itemId, p.quantity, 'purchased')
  if (bg) {
    for (const item of resolveBackgroundItems(bg, draft.backgroundChoices)) {
      items.push({ id: item.id, quantity: item.quantity, label: item.label, source: 'background' })
    }
  }
  return items
}
