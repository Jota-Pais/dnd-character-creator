import type { CharacterDraft } from '../types/character'
import type { AbilityScore, InnateSpell } from '../types/race'
import type { Spell } from '../types/spell'
import { getFinalAbilityScores } from './asiUtils'
import { getBackground, resolveBackgroundItems } from './backgroundUtils'
import { getClass, getSubclass } from './classUtils'
import { formatInventoryItem, getActivePurchases, resolveOptionItems } from './equipmentUtils'
import { allClassEntries } from './multiclassUtils'
import { getAvailableInnateSpells, getRace, getSubrace } from './raceUtils'
import {
  getCasterEntries, getFeatSpellBlocks, getSecretSpellGroups, getSpell, type CasterEntry, type FeatSpellBlock,
} from './spellUtils'

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

/**
 * Uma magia de classe conjuradora. `group`: o rótulo do slot de progressão de onde ela veio
 * (Segredos Mágicos, Truques do Livro das Sombras, Pacto da Corrente, de `getSecretSpellGroups`);
 * null nas escolhidas na etapa Magias e nos truques dados pela característica.
 */
export type ClassKnownSpell = { spell: Spell; group: string | null }

/** As magias que o personagem conhece, por via. Cada tela agrupa como mostra. */
export type KnownSpells = {
  /** Por classe conjuradora (`getCasterEntries`), cada magia uma vez: truques, magias e as de slot. */
  classes: { caster: CasterEntry; spells: ClassKnownSpell[] }[]
  /** Por talento que ensina magias (`getFeatSpellBlocks`: o Iniciado em Magia). */
  feats: FeatSpellBlock[]
  /** O truque escolhido na raça (Alto Elfo). */
  raceCantrip: Spell | null
  /** O truque escolhido na subclasse (Domínio da Natureza), por classe da multiclasse. */
  subclassCantrips: { classId: string; subclassName: string | null; spell: Spell }[]
  /** As magias inatas da raça já liberadas no nível do personagem. */
  innate: { innate: InnateSpell; spell: Spell }[]
}

/** As magias de uma classe conjuradora, sem repetir: a primeira origem fica. */
function casterSpells(caster: CasterEntry): ClassKnownSpell[] {
  const groupOf = new Map(getSecretSpellGroups(caster).flatMap(g => g.spells.map(s => [s.id, g.label] as const)))
  const seen = new Set<string>()
  const spells: ClassKnownSpell[] = []
  const add = (id: string, group: string | null) => {
    const spell = getSpell(id)
    if (!spell || seen.has(id)) return
    seen.add(id)
    spells.push({ spell, group })
  }
  caster.cantrips.forEach(id => add(id, null))
  caster.spells.forEach(id => add(id, null))
  caster.bonusSpells.forEach(id => add(id, groupOf.get(id) ?? null))
  return spells
}

/**
 * Toda magia que o personagem conhece, por qualquer via: a conjuração de cada classe (com os
 * Segredos Mágicos e as outras de slot de progressão), os talentos, o truque da raça e o da
 * subclasse, e as magias inatas. A Revisão, a ficha imprimível e a aba Regras do jogo leem daqui —
 * a lista montada em cada tela deixou o Iniciado em Magia de fora do jogo. Os atributos finais
 * são os da CD e do ataque das magias de talento.
 */
export function getKnownSpells(
  draft: CharacterDraft,
  finalScores: Record<AbilityScore, number> = getFinalAbilityScores(draft),
): KnownSpells {
  const race = draft.race ? getRace(draft.race) : undefined
  const subrace = race && draft.subrace ? getSubrace(race, draft.subrace) ?? null : null
  const raceCantripId = draft.raceChoices.cantrip
  return {
    classes: getCasterEntries(draft).map(caster => ({ caster, spells: casterSpells(caster) })),
    feats: getFeatSpellBlocks(draft, finalScores),
    raceCantrip: (raceCantripId ? getSpell(raceCantripId) : undefined) ?? null,
    subclassCantrips: allClassEntries(draft).flatMap(entry => {
      const id = entry.classChoices.subclassExtras.cantrip
      const spell = id ? getSpell(id) : undefined
      if (!spell) return []
      const cls = getClass(entry.classId)
      const subclass = cls && entry.classChoices.subclass ? getSubclass(cls, entry.classChoices.subclass) : undefined
      return [{ classId: entry.classId, subclassName: subclass?.name ?? null, spell }]
    }),
    innate: race
      ? getAvailableInnateSpells(race, subrace, draft.level ?? 1).flatMap(innate => {
        const spell = getSpell(innate.spellId)
        return spell ? [{ innate, spell }] : []
      })
      : [],
  }
}

/**
 * Cada magia conhecida uma vez, na ordem da mesa: truques primeiro, depois por nível, alfabética
 * dentro de cada um. O grimório da ficha imprimível, com o texto de cada uma.
 */
export function listKnownSpells(known: KnownSpells): Spell[] {
  const all = [
    ...known.classes.flatMap(c => c.spells.map(s => s.spell)),
    ...(known.raceCantrip ? [known.raceCantrip] : []),
    ...known.subclassCantrips.map(s => s.spell),
    ...known.innate.map(s => s.spell),
    ...known.feats.flatMap(b => [...b.cantrips, ...b.spells]),
  ]
  return [...new Map(all.map(s => [s.id, s])).values()]
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'))
}
