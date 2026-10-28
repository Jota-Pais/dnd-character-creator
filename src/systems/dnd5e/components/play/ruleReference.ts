import type { CharacterDraft } from '../../types/character'
import type { Spell } from '../../types/spell'
import { ABILITY_LABELS, formatMeters } from '../../utils/abilityScoreUtils'
import { getCharacterFeats, getSheetClassFeatures } from '../../utils/asiUtils'
import { getClass, getSubclass } from '../../utils/classUtils'
import { allClassEntries } from '../../utils/multiclassUtils'
import { getProgressionChoiceBlocks } from '../../utils/progressionOptions'
import {
  describeDarkvision, describeInnateSpellUsage, getAvailableInnateSpells, getEffectiveDarkvision,
  getEffectiveTraitsWithChoices, getRace, getSubrace,
} from '../../utils/raceUtils'
import { getSheetFightingStyles } from '../../utils/sheetEffects'
import { getCasterEntries, getSecretSpellGroups, getSpell } from '../../utils/spellUtils'
import { ordinal } from './playFormat'

/**
 * O que a folha de uma linha mostra: a magia inteira (tempo, alcance, componentes, duração e o
 * texto) ou o texto de uma característica, traço ou talento, com a escolha feita nele.
 */
export type RuleDetail =
  | { kind: 'spell'; spell: Spell; source: string | null }
  | { kind: 'text'; kicker: string | null; text: string; chosen: string | null }

/** Uma linha tocável: o nome, uma pista curta ao lado e a regra completa na folha. */
export type RuleEntry = { key: string; name: string; meta: string | null; detail: RuleDetail }

/** Linhas sob um subtítulo ("Truques", "1º nível", "Manobras"); `title` null = sem subtítulo. */
export type RuleGroup = { title: string | null; entries: RuleEntry[] }

/** Um bloco por classe (ou pela raça); `label` null quando não há o que distinguir. */
export type RuleBlock = { label: string | null; groups: RuleGroup[] }

export type RuleSection = { id: 'spells' | 'class' | 'race' | 'feats'; title: string; blocks: RuleBlock[] }

const byName = (a: Spell, b: Spell) => a.name.localeCompare(b.name, 'pt-BR')

/** "Truque de evocação", "1º nível de evocação (ritual)". */
export function describeSpellKind(spell: Spell): string {
  const kind = spell.level === 0 ? `Truque de ${spell.school}` : `${ordinal(spell.level)} nível de ${spell.school}`
  return spell.ritual ? `${kind} (ritual)` : kind
}

/** A duração como a mesa lê: "Concentração, até 1 minuto". */
export function describeSpellDuration(spell: Spell): string {
  return spell.concentration ? `Concentração, ${spell.duration}` : spell.duration
}

/** Pista ao lado do nome: o tempo de conjuração (sem a condição da reação) e as marcas. */
function spellMeta(spell: Spell, extra: string | null): string {
  return [
    spell.castingTime.split(',')[0],
    spell.concentration ? 'concentração' : null,
    spell.ritual ? 'ritual' : null,
    extra,
  ].filter(Boolean).join(' · ')
}

function spellEntry(key: string, spell: Spell, source: string | null): RuleEntry {
  return { key, name: spell.name, meta: spellMeta(spell, source), detail: { kind: 'spell', spell, source } }
}

/** Agrupa por nível de magia, truques primeiro, alfabético dentro de cada nível. */
function groupByLevel(items: { spell: Spell; source: string | null }[], keyPrefix: string): RuleGroup[] {
  const levels = [...new Set(items.map(i => i.spell.level))].sort((a, b) => a - b)
  return levels.map(level => ({
    title: level === 0 ? 'Truques' : `${ordinal(level)} nível`,
    entries: items
      .filter(i => i.spell.level === level)
      .sort((a, b) => byName(a.spell, b.spell))
      .map(i => spellEntry(`${keyPrefix}:${i.spell.id}`, i.spell, i.source)),
  }))
}

/**
 * Magias: as de cada classe conjuradora (`getCasterEntries`, as mesmas da Revisão e da ficha
 * imprimível: truques com os dados pela característica, magias conhecidas ou preparadas e as de
 * slot de progressão, com o rótulo do grupo de `getSecretSpellGroups`), e depois as que vêm de
 * fora da conjuração da classe — o truque da raça, o da subclasse e as magias inatas — com o
 * jeito de usar de `describeInnateSpellUsage`.
 */
function spellSection(draft: CharacterDraft): RuleSection | null {
  const casters = getCasterEntries(draft)
  const isMc = allClassEntries(draft).length > 1
  const blocks: RuleBlock[] = casters.map(caster => {
    const seen = new Set<string>()
    const items: { spell: Spell; source: string | null }[] = []
    const add = (id: string, source: string | null) => {
      const spell = getSpell(id)
      if (!spell || seen.has(id)) return
      seen.add(id)
      items.push({ spell, source })
    }
    caster.cantrips.forEach(id => add(id, null))
    caster.spells.forEach(id => add(id, null))
    // A origem de cada magia de slot é o grupo da Revisão e do PDF (Segredos Mágicos, Truques do
    // Livro das Sombras, Pacto da Corrente…), nunca um rótulo fixo.
    const groupLabel = new Map(getSecretSpellGroups(caster).flatMap(g => g.spells.map(s => [s.id, g.label] as const)))
    caster.bonusSpells.forEach(id => add(id, groupLabel.get(id) ?? null))
    // Conjuração de subclasse (Cavaleiro/Trapaceiro Arcano) se identifica mesmo sem multiclasse.
    const showLabel = isMc || caster.casting.casterId !== caster.cls.id
    return { label: showLabel ? caster.casting.label : null, groups: groupByLevel(items, caster.cls.id) }
  })

  const race = draft.race ? getRace(draft.race) : undefined
  const subrace = race && draft.subrace ? getSubrace(race, draft.subrace) : undefined
  const others: { spell: Spell; source: string | null }[] = []
  const racialCantrip = draft.raceChoices.cantrip ? getSpell(draft.raceChoices.cantrip) : undefined
  if (racialCantrip) others.push({ spell: racialCantrip, source: 'da raça' })
  for (const entry of allClassEntries(draft)) {
    const cantrip = entry.classChoices.subclassExtras.cantrip ? getSpell(entry.classChoices.subclassExtras.cantrip) : undefined
    const cls = getClass(entry.classId)
    const sub = cls && entry.classChoices.subclass ? getSubclass(cls, entry.classChoices.subclass) : undefined
    if (cantrip) others.push({ spell: cantrip, source: sub ? `de ${sub.name}` : 'da subclasse' })
  }
  if (race) {
    for (const innate of getAvailableInnateSpells(race, subrace ?? null, draft.level ?? 1)) {
      const spell = getSpell(innate.spellId)
      if (!spell) continue
      const usage = describeInnateSpellUsage(innate, spell.level)
      others.push({ spell, source: `${usage.text} · ${ABILITY_LABELS[innate.ability].short}` })
    }
  }
  if (others.length > 0) {
    blocks.push({ label: 'Outras magias', groups: groupByLevel(others, 'other') })
  }

  const filled = blocks.filter(b => b.groups.length > 0)
  return filled.length > 0 ? { id: 'spells', title: 'Magias', blocks: filled } : null
}

/**
 * Características de classe: por classe da multiclasse, as de `getSheetClassFeatures` (classe,
 * subclasse e Incrementos, no nível que tem nela), o Estilo de Luta e as Escolhas de Progressão
 * (`getProgressionChoiceBlocks`, sem os Segredos Mágicos, que estão nas magias).
 */
function classSection(draft: CharacterDraft): RuleSection | null {
  const entries = allClassEntries(draft)
  const isMc = entries.length > 1
  const styles = getSheetFightingStyles(draft)
  const progression = getProgressionChoiceBlocks(entries)
  const blocks: RuleBlock[] = entries.flatMap(entry => {
    const cls = getClass(entry.classId)
    if (!cls) return []
    const groups: RuleGroup[] = []
    const features = getSheetClassFeatures(entry)
    if (features.length > 0) {
      groups.push({
        title: null,
        entries: features.map((f, i) => ({
          key: `${entry.classId}:feature:${i}`,
          name: f.name,
          meta: `${ordinal(f.level)} nível`,
          detail: { kind: 'text', kicker: `${cls.name} · ${ordinal(f.level)} nível`, text: f.description, chosen: f.chosen },
        })),
      })
    }
    const style = styles.find(s => s.classId === entry.classId)?.style
    if (style) {
      groups.push({
        title: 'Estilo de Luta',
        entries: [{
          key: `${entry.classId}:style`,
          name: style.name,
          meta: null,
          detail: { kind: 'text', kicker: `${cls.name} · Estilo de Luta`, text: style.description, chosen: null },
        }],
      })
    }
    for (const { slot, picks } of progression.find(b => b.entry.classId === entry.classId)?.slots ?? []) {
      groups.push({
        title: slot.label,
        entries: picks.map(p => ({
          key: `${entry.classId}:${slot.id}:${p.id}`,
          name: p.name,
          meta: null,
          detail: { kind: 'text', kicker: `${cls.name} · ${slot.label}`, text: p.text, chosen: null },
        })),
      })
    }
    return groups.length > 0 ? [{ label: isMc ? `${cls.name} ${ordinal(entry.level)}` : null, groups }] : []
  })
  return blocks.length > 0 ? { id: 'class', title: 'Características de classe', blocks } : null
}

/**
 * Traços da raça e da sub-raça, com a escolha feita em cada um (`getEffectiveTraitsWithChoices`).
 * A Visão no Escuro vem antes, como no livro: os dados guardam só o alcance (`getEffectiveDarkvision`,
 * o mesmo da Revisão e da ficha imprimível), fora de `traits`.
 */
function raceSection(draft: CharacterDraft): RuleSection | null {
  const race = draft.race ? getRace(draft.race) : undefined
  if (!race) return null
  const subrace = draft.subrace ? getSubrace(race, draft.subrace) : undefined
  const raceName = subrace?.name ?? race.name
  const kicker = `Traço · ${raceName}`
  const darkvision = getEffectiveDarkvision(race, subrace ?? null)
  const entries: RuleEntry[] = [
    ...(darkvision > 0
      ? [{
        key: 'race:darkvision',
        name: 'Visão no Escuro',
        meta: formatMeters(darkvision),
        detail: { kind: 'text' as const, kicker, text: describeDarkvision(darkvision), chosen: null },
      }]
      : []),
    ...getEffectiveTraitsWithChoices(race, subrace ?? null, draft.raceChoices).map(({ trait, chosen }, i) => ({
      key: `race:${i}:${trait.name}`,
      name: trait.name,
      meta: null,
      detail: { kind: 'text' as const, kicker, text: trait.description, chosen },
    })),
  ]
  if (entries.length === 0) return null
  return { id: 'race', title: 'Traços raciais', blocks: [{ label: null, groups: [{ title: null, entries }] }] }
}

/** Talentos (`getCharacterFeats`: o racial do Humano Variante e os dos Incrementos), com a origem. */
function featSection(draft: CharacterDraft): RuleSection | null {
  const feats = getCharacterFeats(draft)
  if (feats.length === 0) return null
  return {
    id: 'feats',
    title: 'Talentos',
    blocks: [{
      label: null,
      groups: [{
        title: null,
        entries: feats.map(({ feat, origin }) => ({
          key: `feat:${feat.id}`,
          name: feat.name,
          meta: origin,
          detail: { kind: 'text', kicker: `Talento · ${origin}`, text: feat.description, chosen: null },
        })),
      }],
    }],
  }
}

/**
 * A aba "Regras": o que o personagem sabe fazer, só para leitura, montado das mesmas funções que
 * a Revisão e a ficha imprimível usam — nenhuma lista é agregada aqui. Seções vazias ficam de fora.
 */
export function getRuleReference(draft: CharacterDraft): RuleSection[] {
  return [spellSection(draft), classSection(draft), raceSection(draft), featSection(draft)]
    .filter((s): s is RuleSection => s !== null)
}
