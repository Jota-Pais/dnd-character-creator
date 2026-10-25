import type { ReactNode } from 'react'
import type { ResourceUnit } from '../../types/effects'
import { formatModifier } from '../../utils/abilityScoreUtils'
import {
  describeResource, groupResourcesBySource, resourceGroupsNeedLabels, resourceSourceLabel, type SheetResource,
} from '../../utils/classResourceUtils'
import {
  getHitDiceAvailable, getPactSlotsAvailable, getResourceAvailable, getSpellSlotsAvailable,
  recoverPactSlot, recoverResource, recoverSpellSlot, spendPactSlot, spendResource, spendSpellSlot,
} from '../../utils/playState'
import { pluralize } from '../../utils/textUtils'
import { ordinal, rollButtonLabel } from './playFormat'
import { RollMarks } from './RollMarks'
import { RemainingTrack, UsesTrack } from './UsesTrack'
import type { PlayTabProps } from './usePlayView'

const UNIT_LABEL: Record<ResourceUnit, string> = { uses: 'usos', points: 'pontos', hp: 'PV', dice: 'dados' }

/** Os textos de `describeResource` são pedaços de linha ("recupera em descanso longo"): aqui viram frase. */
const sentence = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? '' : '.'}`

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
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
 * Aba "Magia": por classe conjuradora a CD e o ataque de magia (tocável); os espaços
 * do pool e os de Magia de Pacto, à parte, como bolinhas que gastam e recuperam com um toque;
 * os recursos da ficha (`sheet.resources`) com os usos e a recarga; e os Dados de Vida que restam.
 */
export function MagicTab(view: PlayTabProps) {
  const { state, sheet, guide, run, openRecipe } = view
  const slotsAvailable = getSpellSlotsAvailable(state, sheet)
  const slotLevels = sheet.spellSlots.map((max, i) => ({ level: i + 1, max })).filter(s => s.max > 0)
  const pact = sheet.pactSlots
  const groups = groupResourcesBySource(sheet.resources)
  const labelGroups = resourceGroupsNeedLabels(groups)
  const hitDice = getHitDiceAvailable(state, sheet)

  return (
    <div className="space-y-5">
      {guide.notes.length > 0 && (
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-3 space-y-1">
          {guide.notes.map((n, i) => <p key={i} className="text-sm text-red-200 leading-snug">{n}</p>)}
        </div>
      )}

      {guide.spellcasting.length > 0 && (
        <Section title="Conjuração">
          <ul className="space-y-2">
            {guide.spellcasting.map(sc => (
              <li key={sc.classId} className="rounded-xl border border-parchment-900 bg-surface-raised p-3">
                <p className="font-fantasy text-parchment-100">{sc.label}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <div
                    className="min-h-10 flex items-center gap-1.5 rounded-lg border border-parchment-900 px-3"
                    title={sc.saveDcBreakdown.map(b => `${b.label} ${formatModifier(b.value)}`).join(', ')}
                  >
                    <span className="text-[10px] uppercase tracking-wider text-parchment-500">CD de magia</span>
                    <span className="font-fantasy font-bold text-lg text-parchment-100">{sc.saveDc}</span>
                  </div>
                  <button
                    onClick={() => openRecipe(sc.attack)}
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
              </li>
            ))}
          </ul>
        </Section>
      )}

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

      {groups.length > 0 && (
        <Section title="Recursos">
          <div className="space-y-3">
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

      {guide.spellcasting.length === 0 && slotLevels.length === 0 && !pact && groups.length === 0 && (
        <p className="text-sm text-parchment-500">Sem magias nem recursos com usos nesta ficha.</p>
      )}

      {hitDice.length > 0 && (
        <Section title="Dados de Vida">
          <ul className="space-y-1">
            {hitDice.map(h => (
              <li key={h.die} className="text-sm text-parchment-200" data-testid={`hit-dice-d${h.die}`}>
                d{h.die}: <span className="font-fantasy font-bold">{h.available}</span> de {h.total} {pluralize(h.available, 'disponível', 'disponíveis')}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-parchment-500">Gaste no descanso curto, na aba Estado. O descanso longo devolve metade.</p>
        </Section>
      )}
    </div>
  )
}
