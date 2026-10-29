import type { CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import type { Spell } from '@rpg/rules/systems/dnd5e/types/spell'
import { ABILITY_LABELS, formatMeters } from '@rpg/rules/systems/dnd5e/utils/abilityScoreUtils'
import { getCharacterFeats, getSheetClassFeatures } from '@rpg/rules/systems/dnd5e/utils/asiUtils'
import { getClass } from '@rpg/rules/systems/dnd5e/utils/classUtils'
import { allClassEntries } from '@rpg/rules/systems/dnd5e/utils/multiclassUtils'
import { getProgressionChoiceBlocks } from '@rpg/rules/systems/dnd5e/utils/progressionOptions'
import {
  describeDarkvision, describeInnateSpellUsage, getEffectiveDarkvision,
  getEffectiveTraitsWithChoices, getRace, getSubrace,
} from '@rpg/rules/systems/dnd5e/utils/raceUtils'
import { formatCastingRestriction, getCastingRestrictions, getSheetFightingStyles } from '@rpg/rules/systems/dnd5e/utils/sheetEffects'
import { getKnownSpells } from '@rpg/rules/systems/dnd5e/utils/sheetModel'
import { FEAT_SPELL_USAGE } from '@rpg/rules/systems/dnd5e/utils/spellUtils'
import { ordinal } from './playFormat'

/**
 * O que a folha de uma linha mostra: a magia inteira (tempo, alcance, componentes, duração e o
 * texto) ou o texto de uma característica, traço ou talento, com a escolha feita nele.
 * `chosenLabel` é o rótulo da escolha, como na Revisão e no PDF ("Tipo de dano" na Afinidade
 * Elemental); null = "Escolha". `notes` da magia: o que proíbe conjurá-la numa situação (em fúria).
 */
export type RuleDetail =
  | { kind: 'spell'; spell: Spell; source: string | null; notes: string[] }
  | { kind: 'text'; kicker: string | null; text: string; chosen: string | null; chosenLabel: string | null }

/** Uma linha tocável: o nome, uma pista curta ao lado e a regra completa na folha. */
export type RuleEntry = { key: string; name: string; meta: string | null; detail: RuleDetail }

/** Linhas sob um subtítulo ("Truques", "1º nível", "Manobras"); `title` null = sem subtítulo. */
export type RuleGroup = { title: string | null; entries: RuleEntry[] }

/** Um bloco por classe (ou pelo talento, pela raça); `label` null quando não há o que distinguir. */
export type RuleBlock = { label: string | null; groups: RuleGroup[] }

/** `notes`: linhas que valem para a seção inteira (nas Magias, a restrição da Fúria). */
export type RuleSection = { id: 'spells' | 'class' | 'race' | 'feats'; title: string; notes?: string[]; blocks: RuleBlock[] }

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

/** `metaExtra`: a pista ao lado do nome, quando difere da origem que a folha mostra. */
function spellEntry(key: string, spell: Spell, source: string | null, notes: string[], metaExtra = source): RuleEntry {
  return { key, name: spell.name, meta: spellMeta(spell, metaExtra), detail: { kind: 'spell', spell, source, notes } }
}

/** Agrupa por nível de magia, truques primeiro, alfabético dentro de cada nível. */
function groupByLevel(items: { spell: Spell; source: string | null }[], keyPrefix: string, notes: string[]): RuleGroup[] {
  const levels = [...new Set(items.map(i => i.spell.level))].sort((a, b) => a - b)
  return levels.map(level => ({
    title: level === 0 ? 'Truques' : `${ordinal(level)} nível`,
    entries: items
      .filter(i => i.spell.level === level)
      .sort((a, b) => byName(a.spell, b.spell))
      .map(i => spellEntry(`${keyPrefix}:${i.spell.id}`, i.spell, i.source, notes)),
  }))
}

/**
 * Magias: as que o personagem conhece por qualquer via (`getKnownSpells`, as mesmas da Revisão e
 * da ficha imprimível) — um bloco por classe conjuradora, com a origem das de slot de progressão
 * (o grupo da Revisão e do PDF: Segredos Mágicos, Truques do Livro das Sombras, Pacto da
 * Corrente…, nunca um rótulo fixo), um por talento que ensina magias, e depois as que vêm de fora
 * da conjuração da classe — o truque da raça, o da subclasse e as magias inatas — com o jeito de
 * usar de `describeInnateSpellUsage`. A restrição de conjuração (em fúria,
 * `getCastingRestrictions`) vale para toda magia, de qualquer fonte: sai sob o título da seção e na
 * folha de cada uma.
 */
function spellSection(draft: CharacterDraft): RuleSection | null {
  const known = getKnownSpells(draft)
  const isMc = allClassEntries(draft).length > 1
  const notes = getCastingRestrictions(draft).map(formatCastingRestriction)
  const blocks: RuleBlock[] = known.classes.map(({ caster, spells }) => {
    // Conjuração de subclasse (Cavaleiro/Trapaceiro Arcano) se identifica mesmo sem multiclasse.
    const showLabel = isMc || caster.casting.casterId !== caster.cls.id
    const items = spells.map(({ spell, group }) => ({ spell, source: group }))
    return { label: showLabel ? caster.casting.label : null, groups: groupByLevel(items, caster.cls.id, notes) }
  })

  // Talento que ensina magias (Iniciado em Magia, p. 170): um bloco por talento, como na Revisão e
  // no PDF. A magia de 1º nível sai sob o título com o uso (`spellsTitle`), e a folha dela o repete:
  // é lá que a mesa lê antes de conjurar.
  for (const feat of known.feats) {
    const groups: RuleGroup[] = []
    const entries = (spells: Spell[], source: string) =>
      [...spells].sort(byName).map(s => spellEntry(`feat:${feat.featId}:${s.id}`, s, source, notes, null))
    if (feat.cantrips.length > 0) groups.push({ title: 'Truques', entries: entries(feat.cantrips, feat.label) })
    if (feat.spells.length > 0) {
      groups.push({ title: feat.spellsTitle, entries: entries(feat.spells, `${feat.label} · ${FEAT_SPELL_USAGE}`) })
    }
    blocks.push({ label: feat.label, groups })
  }

  const others: { spell: Spell; source: string | null }[] = [
    ...(known.raceCantrip ? [{ spell: known.raceCantrip, source: 'da raça' }] : []),
    ...known.subclassCantrips.map(({ spell, subclassName }) => ({
      spell, source: subclassName ? `de ${subclassName}` : 'da subclasse',
    })),
    ...known.innate.map(({ spell, innate }) => ({
      spell, source: `${describeInnateSpellUsage(innate, spell.level).text} · ${ABILITY_LABELS[innate.ability].short}`,
    })),
  ]
  if (others.length > 0) {
    blocks.push({ label: 'Outras magias', groups: groupByLevel(others, 'other', notes) })
  }

  const filled = blocks.filter(b => b.groups.length > 0)
  return filled.length > 0 ? { id: 'spells', title: 'Magias', notes, blocks: filled } : null
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
          detail: {
            kind: 'text',
            kicker: `${cls.name} · ${ordinal(f.level)} nível`,
            text: f.description,
            chosen: f.chosen,
            chosenLabel: f.chosenLabel ?? null,
          },
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
          detail: { kind: 'text', kicker: `${cls.name} · Estilo de Luta`, text: style.description, chosen: null, chosenLabel: null },
        }],
      })
    }
    for (const { slot, picks } of progression.find(b => b.entry.classId === entry.classId)?.slots ?? []) {
      groups.push({
        // Slot cumulativo se repete por nível (Invocações do 2º e do 5º): o nível distingue, como na Revisão.
        title: slot.cumulative ? `${slot.label} (${ordinal(slot.level)} nível)` : slot.label,
        entries: picks.map(p => ({
          key: `${entry.classId}:${slot.id}:${p.id}`,
          name: p.name,
          meta: null,
          detail: { kind: 'text', kicker: `${cls.name} · ${slot.label}`, text: p.text, chosen: null, chosenLabel: null },
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
        detail: { kind: 'text' as const, kicker, text: describeDarkvision(darkvision), chosen: null, chosenLabel: null },
      }]
      : []),
    ...getEffectiveTraitsWithChoices(race, subrace ?? null, draft.raceChoices).map(({ trait, chosen }, i) => ({
      key: `race:${i}:${trait.name}`,
      name: trait.name,
      meta: null,
      detail: { kind: 'text' as const, kicker, text: trait.description, chosen, chosenLabel: null },
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
          detail: { kind: 'text', kicker: `Talento · ${origin}`, text: feat.description, chosen: null, chosenLabel: null },
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
