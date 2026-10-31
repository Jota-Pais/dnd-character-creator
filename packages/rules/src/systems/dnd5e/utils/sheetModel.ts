import type { CharacterDraft } from '../types/character'
import type { AbilityScore, CantripChoice, InnateSpell, Race, Subrace } from '../types/race'
import type { Spell } from '../types/spell'
import { getFinalAbilityScores } from './asiUtils'
import { getBackground, resolveBackgroundItems } from './backgroundUtils'
import { getClass, getSubclass } from './classUtils'
import { formatInventoryItem, getActivePurchases, resolveOptionItems } from './equipmentUtils'
import { allClassEntries } from './multiclassUtils'
import { getAllChoices, getAvailableInnateSpells, getRace, getSubrace } from './raceUtils'
import {
  getCasterEntries, getEntrySpellcasting, getFeatSpellBlocks, getSecretSpellGroups, getSpell, type CasterEntry, type FeatSpellBlock,
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

/** O truque escolhido na subclasse (o Acólito da Natureza), com a classe dona e a subclasse. */
export type SubclassCantrip = { classId: string; subclassId: string; subclassName: string; spell: Spell }

/** As magias que o personagem conhece, por via. Cada tela agrupa como mostra. */
export type KnownSpells = {
  /** Por classe conjuradora (`getCasterEntries`), cada magia uma vez: truques, magias e as de slot. */
  classes: { caster: CasterEntry; spells: ClassKnownSpell[] }[]
  /** Por talento que ensina magias (`getFeatSpellBlocks`: o Iniciado em Magia). */
  feats: FeatSpellBlock[]
  /** O truque escolhido na raça (Alto Elfo). */
  raceCantrip: Spell | null
  /** O truque escolhido na subclasse (Domínio da Natureza), por classe da multiclasse. */
  subclassCantrips: SubclassCantrip[]
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
  return {
    classes: getCasterEntries(draft).map(caster => ({ caster, spells: casterSpells(caster) })),
    feats: getFeatSpellBlocks(draft, finalScores),
    raceCantrip: race ? getRaceCantrip(draft, race, subrace)?.spell ?? null : null,
    subclassCantrips: getSubclassCantrips(draft),
    innate: race ? getRaceInnateSpells(draft, race, subrace) : [],
  }
}

/**
 * O truque escolhido na raça (o Alto Elfo, pág. 24), com o atributo que o traço declara. Só o da
 * raça que dá a escolha: a sobra de uma ficha importada com outra raça não vira magia.
 */
function getRaceCantrip(draft: CharacterDraft, race: Race, subrace: Subrace | null): { spell: Spell; ability: AbilityScore } | null {
  const id = draft.raceChoices.cantrip
  const spell = id ? getSpell(id) : undefined
  const choice = getAllChoices(race, subrace).find((c): c is CantripChoice => c.kind === 'cantrip')
  return spell && choice ? { spell, ability: choice.spellcastingAbility } : null
}

/** As magias inatas da raça já liberadas no nível do personagem (Magia Drow, Legado Infernal, Ilusionista Nato). */
function getRaceInnateSpells(draft: CharacterDraft, race: Race, subrace: Subrace | null): KnownSpells['innate'] {
  return getAvailableInnateSpells(race, subrace, draft.level ?? 1).flatMap(innate => {
    const spell = getSpell(innate.spellId)
    return spell ? [{ innate, spell }] : []
  })
}

/**
 * O truque escolhido na subclasse de cada classe da multiclasse (o Domínio da Natureza). Só o da
 * subclasse que dá a escolha: a sobra de outra subclasse (trocada, ficha importada) não vira magia.
 */
function getSubclassCantrips(draft: CharacterDraft): SubclassCantrip[] {
  return allClassEntries(draft).flatMap(entry => {
    const cls = getClass(entry.classId)
    const subclass = cls && entry.classChoices.subclass ? getSubclass(cls, entry.classChoices.subclass) : undefined
    const id = entry.classChoices.subclassExtras.cantrip
    const spell = id ? getSpell(id) : undefined
    if (!spell || !subclass?.extras?.cantripChoice) return []
    return [{ classId: entry.classId, subclassId: subclass.id, subclassName: subclass.name, spell }]
  })
}

// ── Conjurações de fora da classe e do talento (decisão de 2026-10-31) ─────────

/**
 * Uma conjuração de fora da classe e do talento, com o atributo que o dado declara: a da raça — o
 * truque do Alto Elfo, Inteligência (pág. 24, `CantripChoice.spellcastingAbility`); as magias
 * inatas do drow e do tiferino, Carisma (págs. 24 e 43, `InnateSpell.ability`), e a ilusão menor do
 * gnomo da floresta, Inteligência (pág. 37) — e a do truque da
 * subclasse, que usa o atributo de conjuração da classe dona: a magia que uma característica de
 * classe dá está associada a essa classe (pág. 166, linhas 14812-14814), e o Acólito da Natureza
 * conjura o truque de druida com a Sabedoria do clérigo. A chave é a da conjuração no guia de
 * rolagens (`RollGuide.spellcasting`, de onde vêm a CD e o ataque) e a da lista no grimório, como a
 * `feat:<talento>`.
 */
export type OtherSpellcasting = {
  /** 'race:<raça>' ou 'subclass:<subclasse>'. */
  key: string
  kind: 'race' | 'subclass'
  /** A sub-raça ou a raça ("Alto Elfo", "Tiefling"); a subclasse ("Domínio da Natureza"). */
  label: string
  /** A classe dona da subclasse, a do atributo; null na raça. */
  classId: string | null
  ability: AbilityScore
}

/** A chave da conjuração das magias da raça (o truque e as inatas): uma por personagem. */
export const raceSpellcastingKey = (raceId: string): string => `race:${raceId}`

/** A chave da conjuração do truque de uma subclasse. */
export const subclassSpellcastingKey = (subclassId: string): string => `subclass:${subclassId}`

/**
 * As conjurações de fora da classe e do talento que a ficha tem, sobre as mesmas magias de
 * `getKnownSpells`: a da raça, com o truque escolhido nela ou alguma inata liberada no nível, e a de
 * cada truque de subclasse, com o atributo da Conjuração da classe dona (o clérigo conjura desde o
 * 1º nível, e o truque só existe na subclasse que o dá). O atributo da raça é o que o traço declara,
 * um só por raça e sub-raça: o teste do modelo de ficha confere isso nos dados.
 */
export function getOtherSpellcastings(draft: CharacterDraft): OtherSpellcasting[] {
  const out: OtherSpellcasting[] = []
  const race = draft.race ? getRace(draft.race) : undefined
  if (race) {
    const subrace = draft.subrace ? getSubrace(race, draft.subrace) ?? null : null
    const [ability] = [
      getRaceCantrip(draft, race, subrace)?.ability,
      ...getRaceInnateSpells(draft, race, subrace).map(s => s.innate.ability),
    ].filter((a): a is AbilityScore => a !== undefined)
    if (ability) out.push({ key: raceSpellcastingKey(race.id), kind: 'race', label: subrace?.name ?? race.name, classId: null, ability })
  }
  for (const { classId, subclassId, subclassName } of getSubclassCantrips(draft)) {
    const ability = getEntrySpellcasting(getClass(classId), subclassId)?.spellcasting.ability
    if (ability) out.push({ key: subclassSpellcastingKey(subclassId), kind: 'subclass', label: subclassName, classId, ability })
  }
  return out
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
