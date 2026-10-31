import { useMemo, useState, type ReactNode } from 'react'
import type { ResourceUnit } from '@rpg/rules/systems/dnd5e/types/effects'
import type { SpellbookEntry, SpellbookList, SpellbookStatus } from '@rpg/rules/systems/dnd5e/types/spellbook'
import type { Spell } from '@rpg/rules/systems/dnd5e/types/spell'
import { formatModifier } from '@rpg/rules/systems/dnd5e/utils/abilityScoreUtils'
import {
  describeResource, groupResourcesBySource, resourceGroupsNeedLabels, resourceSourceLabel, type SheetResource,
} from '@rpg/rules/systems/dnd5e/utils/classResourceUtils'
import {
  getPactSlotsAvailable, getResourceAvailable, getSpellSlotsAvailable,
  recoverPactSlot, recoverResource, recoverSpellSlot, spendPactSlot, spendResource, spendSpellSlot,
} from '@rpg/rules/systems/dnd5e/utils/playState'
import type { SpellcastingGuide } from '@rpg/rules/systems/dnd5e/utils/rollGuide'
import { getCasterSpellGuides, type SpellGuide } from '@rpg/rules/systems/dnd5e/utils/spellGuide'
import { getSpellMechanics, scalesWithCharacterLevel } from '@rpg/rules/systems/dnd5e/utils/spellMechanics'
import { getSpell } from '@rpg/rules/systems/dnd5e/utils/spellUtils'
import { spellSaveDcSource } from './numberSources'
import { ordinal, rollButtonLabel } from './playFormat'
import { RollMarks } from './RollMarks'
import { SpellCastSheet, type SpellCastTarget } from './SpellCastSheet'
import { SpellRecipe } from './SpellRecipe'
import { RemainingTrack, UsesTrack } from './UsesTrack'
import type { PlayTabProps } from './usePlayView'

const UNIT_LABEL: Record<ResourceUnit, string> = { uses: 'usos', points: 'pontos', hp: 'PV', dice: 'dados' }

/** Como a magia está no grimório, ao lado do nome; o truque diz o nível de personagem, quando cresce. */
const STATUS_LABEL: Record<SpellbookStatus, string | null> = {
  cantrip: null,
  prepared: 'preparada',
  known: 'conhecida',
  inSpellbook: 'no grimório',
  perRest: '1×/descanso longo',
}

/** Os textos de `describeResource` são pedaços de linha ("recupera em descanso longo"): aqui viram frase. */
const sentence = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? '' : '.'}`

function Section({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={className}>
      <h2 className="text-[11px] uppercase tracking-wider text-parchment-600 font-fantasy mb-1.5">{title}</h2>
      {children}
    </section>
  )
}

/** Um recurso: nome, dado e grandeza, os usos (bolinhas ou "restam X de Y") e a recarga escrita. */
function ResourceRow({ resource, view }: { resource: SheetResource; view: PlayTabProps }) {
  const { state, sheet, run } = view
  const d = describeResource(resource)
  const available = getResourceAvailable(state, sheet, resource.id)
  const head = [d.die, d.amount].filter(Boolean).join(' · ')
  const spend = (amount: number) => run((st, sh) => spendResource(st, sh, resource.id, amount))
  const recover = (amount: number) => run((st, sh) => recoverResource(st, sh, resource.id, amount))

  return (
    <li className="py-2">
      <p className="text-sm text-parchment-100">
        {d.name}
        {head && <span className="ml-1.5 text-parchment-400">{head}</span>}
      </p>
      {typeof resource.uses === 'number' && typeof available === 'number' && d.track?.kind === 'circles' && (
        <UsesTrack
          label={d.name}
          total={resource.uses}
          available={available}
          onSpend={() => spend(1)}
          onRecover={() => recover(1)}
        />
      )}
      {typeof resource.uses === 'number' && typeof available === 'number' && d.track?.kind === 'remaining' && (
        <RemainingTrack
          label={d.name}
          unitLabel={UNIT_LABEL[resource.unit]}
          total={resource.uses}
          available={available}
          amountInput={resource.unit === 'hp'}
          onSpend={spend}
          onRecover={recover}
        />
      )}
      {resource.uses === 'unlimited' && <p className="text-xs text-parchment-400">Usos ilimitados.</p>}
      {d.recharge && <p className="text-[11px] text-parchment-500">{sentence(d.recharge)}</p>}
      {d.notes.map((n, i) => <p key={i} className="text-[11px] text-parchment-500 leading-snug">{sentence(n)}</p>)}
    </li>
  )
}

/**
 * A pista ao lado do nome: o tempo de conjuração (sem o gatilho da reação), a concentração, o
 * ritual (só quando a ficha o faz), como ela está no grimório, a origem e, no truque que cresce, o
 * nível de personagem de que a conta parte (decisão de 2026-10-29).
 */
function spellMeta(spell: Spell, entry: SpellbookEntry, characterLevel: number): string {
  const mech = getSpellMechanics(spell.id)
  return [
    spell.castingTime.split(',')[0],
    spell.concentration ? 'concentração' : null,
    entry.ritual ? 'ritual' : null,
    STATUS_LABEL[entry.status],
    entry.origin,
    spell.level === 0 && mech && scalesWithCharacterLevel(mech) ? `escala pelo nível de personagem: ${characterLevel}` : null,
  ].filter(Boolean).join(' · ')
}

/** A CD e o ataque de magia de uma conjuração (o guia de rolagens): a CD abre o "de onde vem", o ataque, a receita. */
function CastingNumbers({ sc, view }: { sc: SpellcastingGuide; view: PlayTabProps }) {
  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => view.openSource(spellSaveDcSource(sc))}
          aria-label={`CD de magia ${sc.saveDc}: de onde vem`}
          className="min-h-10 flex items-center gap-1.5 rounded-lg border border-parchment-800 px-3 hover:border-gold-600 transition-colors"
        >
          <span className="text-[10px] uppercase tracking-wider text-gold-500">CD de magia</span>
          <span className="font-fantasy font-bold text-lg text-parchment-100" aria-hidden="true">{sc.saveDc}</span>
        </button>
        <button
          onClick={() => view.openRecipe(sc.attack)}
          aria-label={rollButtonLabel(sc.attack)}
          className="min-h-10 flex items-center gap-1.5 rounded-lg border border-gold-800 px-3 hover:border-gold-600 transition-colors"
        >
          <span className="text-[10px] uppercase tracking-wider text-gold-500">Ataque de magia</span>
          <span className="font-fantasy font-bold text-lg text-parchment-100" aria-hidden="true">
            {formatModifier(sc.attack.modifier)} <RollMarks entry={sc.attack} />
          </span>
        </button>
      </div>
      <p className="mt-1 text-[11px] text-parchment-600">
        A CD é o que os alvos das suas magias precisam tirar no teste de resistência.
      </p>
    </>
  )
}

/**
 * As magias de uma conjuração por nível (truques primeiro), cada uma com a pista, o que rolar
 * (`SpellRecipe`, pelo guia da magia no espaço mais baixo) e o "Conjurar", que abre a folha.
 */
function SpellbookSpells({ list, guides, view, onCast }: {
  list: SpellbookList
  guides: Map<string, SpellGuide>
  view: PlayTabProps
  onCast: (target: SpellCastTarget) => void
}) {
  const characterLevel = view.draft.level ?? 1
  const spells = list.spells
    .flatMap(entry => {
      const spell = getSpell(entry.spellId)
      return spell ? [{ entry, spell }] : []
    })
    .sort((a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name, 'pt-BR'))
  const levels = [...new Set(spells.map(s => s.spell.level))]
  return (
    <div className="mt-2.5 space-y-2 border-t border-parchment-900 pt-2">
      {levels.map(level => (
        <div key={level}>
          <h3 className="text-[11px] uppercase tracking-wider text-parchment-600">{level === 0 ? 'Truques' : `${ordinal(level)} nível`}</h3>
          <ul className="divide-y divide-parchment-900">
            {spells.filter(s => s.spell.level === level).map(({ entry, spell }) => {
              const guide = guides.get(spell.id)
              return (
                <li key={spell.id} className="py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-parchment-100">{spell.name}</p>
                      <p className="text-[11px] text-parchment-400 leading-snug">{spellMeta(spell, entry, characterLevel)}</p>
                    </div>
                    <button
                      onClick={() => onCast({ casterKey: list.key, spellId: spell.id })}
                      aria-label={`Conjurar: ${spell.name}`}
                      className="min-h-10 shrink-0 rounded-lg border border-gold-800 px-3 text-sm text-gold-300 hover:border-gold-600"
                    >
                      Conjurar
                    </button>
                  </div>
                  {guide && <SpellRecipe guide={guide} openRecipe={view.openRecipe} />}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * Aba "Magia", o grimório (Fase 2, onda `grimorio`; decisão de 2026-10-30): os espaços do pool e os de
 * Magia de Pacto, como bolinhas; as magias por conjuração (`PlaySheet.spellbook`: cada classe, cada
 * talento que ensina magias e as de fora delas) e nível, com a CD e o ataque da conjuração, a pista de
 * cada uma, o que rolar e o "Conjurar", que abre a folha (`SpellCastSheet`) e gasta pelo `castSpell`
 * — nenhum gasto de espaço é feito aqui; as bolinhas são o toque que corrige. Com a restrição de
 * conjuração da ficha (Fúria) numa linha, e os recursos da ficha (`sheet.resources`) com os usos e a
 * recarga. O texto inteiro de cada magia fica na aba Regras, só leitura; os Dados de Vida, nos
 * vitais fixos, junto do "Descanso".
 */
export function MagicTab(view: PlayTabProps) {
  const { draft, state, sheet, guide, run } = view
  const [casting, setCasting] = useState<SpellCastTarget | null>(null)
  // O que rolar em cada magia, pelo guia que a tela já montou, por conjuração e magia.
  const spellGuides = useMemo(
    () => new Map(getCasterSpellGuides(draft, state, guide, sheet.spellbook)
      .map(c => [c.casterKey, new Map(c.guides.map(g => [g.ref.spellId, g]))])),
    [draft, state, guide, sheet.spellbook],
  )
  const slotsAvailable = getSpellSlotsAvailable(state, sheet)
  const slotLevels = sheet.spellSlots.map((max, i) => ({ level: i + 1, max })).filter(s => s.max > 0)
  const pact = sheet.pactSlots
  const hasSlots = slotLevels.length > 0 || (pact !== null && pact.slots > 0)
  const groups = groupResourcesBySource(sheet.resources)
  const labelGroups = resourceGroupsNeedLabels(groups)
  // As conjurações com CD e ataque (o guia de rolagens), cada uma com a lista dela, e depois as
  // listas de fora delas (o truque da raça, o da subclasse, as inatas).
  const casters = [
    ...guide.spellcasting.map(sc => ({ key: sc.key, sc, list: sheet.spellbook.find(l => l.key === sc.key) ?? null })),
    ...sheet.spellbook.filter(l => !guide.spellcasting.some(sc => sc.key === l.key)).map(list => ({ key: list.key, sc: null, list })),
  ]

  // Do md para cima, duas colunas: os espaços (os do pool e os de Pacto) ao lado do grimório, e os
  // recursos embaixo, na largura toda, com uma origem (classe, raça, talento) por coluna.
  return (
    <>
      <div className="space-y-5 md:space-y-0 md:grid md:grid-cols-2 md:items-start md:gap-x-6 md:gap-y-5">
        {guide.notes.length > 0 && (
          <div className="rounded-xl border border-red-900 bg-red-950/30 p-3 space-y-1 md:col-span-2">
            {guide.notes.map((n, i) => <p key={i} className="text-sm text-red-200 leading-snug">{n}</p>)}
          </div>
        )}

        {hasSlots && (
          <div className="space-y-5">
            {slotLevels.length > 0 && (
              <Section title="Espaços de magia">
                <ul className="space-y-1">
                  {slotLevels.map(({ level, max }) => (
                    <li key={level} className="flex flex-wrap items-center gap-2">
                      <span className="w-16 shrink-0 text-sm text-parchment-300">{ordinal(level)} nível</span>
                      <UsesTrack
                        label={`Espaço de ${ordinal(level)} nível`}
                        total={max}
                        available={slotsAvailable[level - 1]}
                        onSpend={() => run((st, sh) => spendSpellSlot(st, sh, level))}
                        onRecover={() => run((st, sh) => recoverSpellSlot(st, sh, level))}
                      />
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-parchment-500">Voltam no descanso longo.</p>
              </Section>
            )}

            {pact && pact.slots > 0 && (
              <Section title="Magia de Pacto">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-16 shrink-0 text-sm text-parchment-300">{ordinal(pact.slotLevel)} nível</span>
                  <UsesTrack
                    label={`Espaço de Pacto (${ordinal(pact.slotLevel)} nível)`}
                    total={pact.slots}
                    available={getPactSlotsAvailable(state, sheet)}
                    onSpend={() => run((st, sh) => spendPactSlot(st, sh))}
                    onRecover={() => run((st, sh) => recoverPactSlot(st, sh))}
                  />
                </div>
                <p className="mt-1 text-[11px] text-parchment-500">Voltam no descanso curto ou longo.</p>
              </Section>
            )}
            <p className="text-[11px] text-parchment-500 leading-snug">
              O Conjurar gasta o espaço sozinho; o toque na bolinha corrige.
            </p>
          </div>
        )}

        {casters.length > 0 && (
          <Section title="Grimório" className={hasSlots ? undefined : 'md:col-span-2'}>
            <ul className="space-y-2">
              {casters.map(({ key, sc, list }) => (
                <li key={key} className="rounded-xl border border-parchment-900 bg-surface-raised p-3">
                  <p className="font-fantasy text-parchment-100">{sc?.label ?? list?.label}</p>
                  {sc && <CastingNumbers sc={sc} view={view} />}
                  {!sc && (
                    <p className="mt-1 text-[11px] text-parchment-500 leading-snug">
                      A CD e o ataque destas o app ainda não calcula.
                    </p>
                  )}
                  {list?.note && <p className="mt-1.5 text-xs text-amber-200 leading-snug">{list.note}</p>}
                  {list && (
                    <SpellbookSpells list={list} guides={spellGuides.get(list.key) ?? new Map()} view={view} onCast={setCasting} />
                  )}
                </li>
              ))}
            </ul>
            {/* Condicional (em fúria, pág. 48): vale para toda conjuração, e a ficha não sabe se você
                está em fúria — por isso não vai à caixa vermelha, que é só o que está em vigor. */}
            {guide.castingRestrictions.map((r, i) => (
              <p key={i} className="mt-1.5 text-xs text-amber-200 leading-snug">{r}</p>
            ))}
            <p className="mt-1.5 text-[11px] text-parchment-500">
              O texto inteiro de cada magia está na aba Regras.
            </p>
          </Section>
        )}

        {groups.length > 0 && (
          <Section title="Recursos" className="md:col-span-2">
            <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:items-start md:gap-x-6 md:gap-y-3">
              {groups.map(g => (
                <div key={`${g.source.kind}:${g.source.id}`}>
                  {labelGroups && <p className="font-fantasy text-sm text-gold-400">{resourceSourceLabel(g.source)}</p>}
                  <ul className="divide-y divide-parchment-900">
                    {g.resources.map(r => <ResourceRow key={r.id} resource={r} view={view} />)}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        )}

        {casters.length === 0 && !hasSlots && groups.length === 0 && (
          <p className="text-sm text-parchment-500 md:col-span-2">Sem magias nem recursos com usos nesta ficha.</p>
        )}
      </div>
      {/* Fora do space-y: a folha é fixa, e a margem do irmão a deslocaria. */}
      {casting && <SpellCastSheet view={view} target={casting} onClose={() => setCasting(null)} />}
    </>
  )
}
