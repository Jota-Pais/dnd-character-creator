import type { ReactNode } from 'react'
import { formatMeters, formatModifier } from '../../utils/abilityScoreUtils'
import {
  endConcentration, getCurrentHp, getEffectiveMaxHp, getPlayConditionEffects, getPlaySpeed, setInspiration,
} from '../../utils/playState'
import type { RollGuideEntry } from '../../utils/rollGuide'
import type { PlayView } from './usePlayView'

const LIFE_LABEL = { dying: 'Morrendo', stable: 'Estável', dead: 'Morto' } as const

/** ▲ vantagem / ▼ desvantagem ao lado de um número que é rolagem, com o texto para leitor de tela. */
function ModeMark({ entry }: { entry: RollGuideEntry }) {
  if (entry.mode === 'advantage') return <span className="text-emerald-300 text-xs" title="Com vantagem">▲<span className="sr-only"> com vantagem</span></span>
  if (entry.mode === 'disadvantage') return <span className="text-red-300 text-xs" title="Com desvantagem">▼<span className="sr-only"> com desvantagem</span></span>
  return null
}

function Stat({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-w-0 rounded-lg border border-parchment-900 bg-surface-raised px-1 py-1.5 min-h-12">
      <span className="text-[10px] uppercase tracking-wider text-parchment-600 leading-none">{label}</span>
      <span className="font-fantasy font-bold text-lg text-parchment-100 leading-tight">{children}</span>
      {sub && <span className="text-[10px] text-parchment-500 leading-none truncate max-w-full">{sub}</span>}
    </div>
  )
}

/**
 * Os vitais, fixos no topo da tela de jogo: PV (com o corte da exaustão à vista), PV temporários,
 * CA, deslocamento efetivo, iniciativa (tocável: abre a receita), Percepção passiva, inspiração,
 * concentração e as condições ativas (só leitura; quem mexe nelas é a aba Estado).
 */
export function VitalsBar({ view, onOpenRecipe }: { view: PlayView; onOpenRecipe: (entry: RollGuideEntry) => void }) {
  const { state, sheet, guide, armorClass, run } = view
  const current = getCurrentHp(state, sheet)
  const effMax = getEffectiveMaxHp(state, sheet)
  const sheetMax = Math.max(0, sheet.maxHp)
  const speed = getPlaySpeed(state, sheet)
  const effects = getPlayConditionEffects(state)
  const initiative = guide.initiative
  const passive = guide.passivePerception
  const life = state.lifeState === 'conscious' ? null : LIFE_LABEL[state.lifeState]

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 sm:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-1.5">
        <div
          className={[
            'col-span-4 sm:col-span-1 flex flex-col justify-center rounded-lg border px-2.5 py-1.5 min-h-12',
            life ? 'border-red-900 bg-red-950/30' : 'border-gold-800 bg-surface-raised',
          ].join(' ')}
          data-testid="vitals-hp"
        >
          <span className="text-[10px] uppercase tracking-wider text-parchment-600 leading-none">Pontos de vida</span>
          <span className="leading-tight">
            <span className="font-fantasy font-black text-2xl text-parchment-100" data-testid="hp-current">{current}</span>
            <span className="text-sm text-parchment-500"> / {effMax}</span>
            {state.tempHp > 0 && (
              <span className="ml-1.5 text-sm font-bold text-sky-300" title="PV temporários: somem antes dos seus PV">+{state.tempHp} temp.</span>
            )}
          </span>
          {life && <span className="text-xs font-bold text-red-300 leading-none">{life}</span>}
          {!life && effMax < sheetMax && (
            <span className="text-[10px] text-amber-300 leading-tight">
              Exaustão {state.exhaustionLevel}: máximo {sheetMax} → {effMax}
            </span>
          )}
        </div>
        <Stat label="CA">{armorClass.value}</Stat>
        <Stat
          label="Desloc."
          sub={speed !== sheet.speed ? <span className="text-amber-300">era {formatMeters(sheet.speed)}</span> : undefined}
        >
          <span className="text-sm">{formatMeters(speed)}</span>
        </Stat>
        <button
          onClick={() => onOpenRecipe(initiative)}
          aria-label={`Iniciativa ${formatModifier(initiative.modifier)}: ver o que rolar`}
          className="flex flex-col items-center justify-center min-w-0 rounded-lg border border-parchment-800 bg-surface-raised px-1 py-1.5 min-h-12 hover:border-gold-700 transition-colors"
        >
          <span className="text-[10px] uppercase tracking-wider text-gold-500 leading-none">Inic.</span>
          <span className="font-fantasy font-bold text-lg text-parchment-100 leading-tight">
            {formatModifier(initiative.modifier)} <ModeMark entry={initiative} />
          </span>
        </button>
        <Stat
          label="Percep."
          sub={passive.adjustment !== 0 ? `passiva ${passive.adjustment > 0 ? '+5' : '−5'}` : 'passiva'}
        >
          {passive.value}
        </Stat>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => run(st => setInspiration(st, !st.inspiration))}
          aria-pressed={state.inspiration}
          className={[
            'min-h-10 px-3 rounded-full border text-xs transition-colors',
            state.inspiration
              ? 'border-gold-500 bg-gold-900 text-gold-300'
              : 'border-parchment-800 text-parchment-600 hover:text-parchment-300',
          ].join(' ')}
          title="Inspiração: o Mestre concede; gaste para ter vantagem numa jogada"
        >
          {state.inspiration ? '★ Inspirado' : '☆ Sem inspiração'}
        </button>

        {state.concentration && (
          <span className="inline-flex items-center min-h-10 rounded-full border border-violet-800 bg-violet-950/40 pl-3 text-xs text-violet-200">
            Concentrado: {state.concentration.label}
            <button
              onClick={() => run(st => endConcentration(st))}
              className="min-h-10 px-3 text-violet-300 underline hover:text-violet-100"
            >
              encerrar
            </button>
          </span>
        )}

        {state.exhaustionLevel > 0 && (
          <span className="inline-flex items-center min-h-8 rounded-full border border-amber-800 px-3 text-xs text-amber-300">
            Exaustão {state.exhaustionLevel}
          </span>
        )}

        {effects.conditions.map(c => {
          const note = state.conditionNotes?.[c.id]
          return (
            <span
              key={c.id}
              className={[
                'inline-flex items-center min-h-8 rounded-full border px-3 text-xs',
                c.suspendedBy ? 'border-parchment-900 text-parchment-600' : 'border-red-900 text-red-200',
              ].join(' ')}
              title={note}
            >
              {c.name}
              {c.suspendedBy && ' (suspensa)'}
              {note && <span className="ml-1 text-parchment-500">· {note}</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}
