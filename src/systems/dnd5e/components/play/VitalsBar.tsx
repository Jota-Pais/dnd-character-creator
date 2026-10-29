import { useEffect, useState, type ReactNode } from 'react'
import { formatMeters, formatModifier } from '../../utils/abilityScoreUtils'
import {
  endConcentration, formatHpAdjustment, getBaseMaxHp, getCurrentHp, getEffectiveMaxHp, getHitDiceAvailable,
  getPlayConditionEffects, getPlaySpeed, setInspiration,
} from '../../utils/playState'
import type { RollGuideEntry } from '../../utils/rollGuide'
import { getConditionalAcBonuses } from '../../utils/sheetEffects'
import { ChangeAnnouncer } from './ChangeAnnouncer'
import {
  describeHitDiceAvailable, describeHpForAnnouncement, formatHitDiceAvailable, getHpBand, getHpBarPercent, getHpFlash,
  HP_FLASH_MS, type HpBand, type HpFlash, type HpReading,
} from './hpVitals'
import { armorClassSource, passiveSource, type NumberSource } from './numberSources'
import { ModeMark } from './RollMarks'
import type { PlayView } from './usePlayView'

const LIFE_LABEL = { dying: 'Morrendo', stable: 'Estável', dead: 'Morto' } as const

const BAR_COLOR: Record<HpBand, string> = {
  healthy: 'bg-emerald-500',
  wounded: 'bg-amber-500',
  low: 'bg-red-500',
  zero: 'bg-transparent',
}

/**
 * A cor do número de PV durante o retorno. O pulso (`animate-hp-flash`, em index.css) só vem com
 * `motion-safe:`: com prefers-reduced-motion, fica só a cor.
 */
const FLASH_CLASS: Record<HpFlash, string> = {
  damage: 'text-red-400 motion-safe:animate-hp-flash',
  heal: 'text-emerald-300 motion-safe:animate-hp-flash',
}

/**
 * O retorno visual do PV: a cor acende quando o PV (ou a reserva temporária) muda entre um desenho
 * e o seguinte, e apaga depois de `HP_FLASH_MS`. Pega toda mudança, venha de onde vier (painel de
 * PV, descanso, desfazer); abrir a ficha não pisca. O `id` novo a cada golpe reinicia o pulso.
 */
function useHpFlash(reading: HpReading): { kind: HpFlash; id: number } | null {
  const [seen, setSeen] = useState({ ...reading, flashes: 0 })
  const [flash, setFlash] = useState<{ kind: HpFlash; id: number } | null>(null)
  if (seen.current !== reading.current || seen.tempHp !== reading.tempHp) {
    const kind = getHpFlash(seen, reading)
    setSeen({ ...reading, flashes: seen.flashes + (kind ? 1 : 0) })
    if (kind) setFlash({ kind, id: seen.flashes + 1 })
  }
  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), HP_FLASH_MS)
    return () => clearTimeout(timer)
  }, [flash])
  return flash
}

/**
 * A barra do PV atual sobre o máximo efetivo, com a cor da faixa (`getHpBand`). Os PV temporários
 * não entram nela: não somam ao PV (pág. 200), ficam no "+X temp." ao lado do número.
 */
function HpBar({ current, max, band }: { current: number; max: number; band: HpBand }) {
  return (
    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-parchment-800" aria-hidden="true">
      <span
        className={`block h-full rounded-full ${BAR_COLOR[band]} transition-[width] duration-500 motion-reduce:transition-none`}
        style={{ width: `${getHpBarPercent(current, max)}%` }}
        data-testid="hp-bar"
        data-band={band}
      />
    </span>
  )
}

/** Um número dos vitais. Com `onOpen`, vira botão (rótulo dourado, como a iniciativa): "de onde vem". */
function Stat({ label, children, sub, onOpen, ariaLabel }: {
  label: string
  children: ReactNode
  sub?: ReactNode
  onOpen?: () => void
  ariaLabel?: string
}) {
  const content = (
    <>
      <span className={`text-[10px] uppercase tracking-wider leading-none ${onOpen ? 'text-gold-500' : 'text-parchment-600'}`}>{label}</span>
      <span className="font-fantasy font-bold text-lg text-parchment-100 leading-tight">{children}</span>
      {sub && <span className="text-[10px] text-parchment-500 leading-none truncate max-w-full">{sub}</span>}
    </>
  )
  const box = 'flex flex-col items-center justify-center min-w-0 rounded-lg border bg-surface-raised px-1 py-1.5 min-h-12'
  if (!onOpen) return <div className={`${box} border-parchment-900`}>{content}</div>
  return (
    <button onClick={onOpen} aria-label={ariaLabel} className={`${box} border-parchment-800 hover:border-gold-700 transition-colors`}>
      {content}
    </button>
  )
}

/**
 * Os vitais, fixos no topo da tela de jogo: PV (com a barra por faixa, o aviso de PV baixo e o
 * corte da exaustão à vista), PV temporários, os Dados de Vida que restam (tocável: leva aos
 * descansos), CA, deslocamento efetivo, iniciativa (tocável: abre a receita), Percepção passiva,
 * inspiração, concentração e as condições ativas (só leitura; quem mexe nelas é a aba Estado).
 */
export function VitalsBar({ view, onOpenRecipe, onOpenSource, onOpenRests }: {
  view: PlayView
  onOpenRecipe: (entry: RollGuideEntry) => void
  onOpenSource: (source: NumberSource) => void
  /** Leva aos descansos curto e longo (aba Estado). */
  onOpenRests: () => void
}) {
  const { draft, state, sheet, guide, armorClass, run } = view
  const current = getCurrentHp(state, sheet)
  const effMax = getEffectiveMaxHp(state, sheet)
  // O máximo antes da exaustão: o da ficha com o ajuste temporário (Ajuda).
  const baseMax = getBaseMaxHp(state, sheet)
  const speed = getPlaySpeed(state, sheet)
  const effects = getPlayConditionEffects(state)
  const initiative = guide.initiative
  const passive = guide.passivePerception
  const life = state.lifeState === 'conscious' ? null : LIFE_LABEL[state.lifeState]
  const band = getHpBand(current, effMax)
  const hitDice = getHitDiceAvailable(state, sheet)
  const flash = useHpFlash({ current, tempHp: state.tempHp })

  return (
    <div className="space-y-2">
      {/* O dano e a cura só aparecem no número (o aviso da ação, quando há, fala do resto). Primeiro
          filho: no fim, o space-y daria margem à faixa de chips. */}
      <ChangeAnnouncer text={describeHpForAnnouncement(current, effMax, state.tempHp)} />
      {/* No celular, duas linhas: PV e Descanso (largo o bastante para "Dados de Vida" em 360 px),
          depois os outros quatro. Do sm para cima, as linhas somem (`contents`) e é uma fila só. */}
      <div className="space-y-1.5 sm:space-y-0 sm:grid sm:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] sm:gap-1.5">
        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-1.5 sm:contents">
          <div
            className={[
              'flex flex-col justify-center rounded-lg border px-2.5 py-1.5 min-h-12',
              life ? 'border-red-900 bg-red-950/30' : band === 'low' ? 'border-red-900 bg-surface-raised' : 'border-gold-800 bg-surface-raised',
            ].join(' ')}
            data-testid="vitals-hp"
          >
            {/* Na fila única do sm a caixa é estreita: o "PV baixo" desce de linha, sem quebrar. */}
            <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 leading-none">
              <span className="whitespace-nowrap text-[10px] uppercase tracking-wider text-parchment-600">Pontos de vida</span>
              {band === 'low' && (
                <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-red-300">PV baixo</span>
              )}
            </span>
            <span className="leading-tight">
              <span
                key={flash?.id ?? 'idle'}
                className={`inline-block font-fantasy font-black text-2xl ${flash ? FLASH_CLASS[flash.kind] : 'text-parchment-100'}`}
                data-testid="hp-current"
                data-flash={flash?.kind}
              >
                {current}
              </span>
              <span className="text-sm text-parchment-500"> / {effMax}</span>
              {state.maxHpAdjustment !== 0 && (
                <span className="ml-1 text-[10px] text-sky-300" title="Ajuste temporário do PV máximo, até o descanso longo">
                  (máx. {formatHpAdjustment(state.maxHpAdjustment)})
                </span>
              )}
              {state.tempHp > 0 && (
                <span className="ml-1.5 text-sm font-bold text-sky-300" title="PV temporários: somem antes dos seus PV">+{state.tempHp} temp.</span>
              )}
            </span>
            <HpBar current={current} max={effMax} band={band} />
            {life && <span className="text-xs font-bold text-red-300 leading-none">{life}</span>}
            {!life && effMax < baseMax && (
              <span className="text-[10px] text-amber-300 leading-tight">
                Exaustão {state.exhaustionLevel}: máximo {baseMax} → {effMax}
              </span>
            )}
          </div>
          <Stat
            label="Descanso"
            sub="Dados de Vida"
            onOpen={onOpenRests}
            ariaLabel={`Descanso. Dados de Vida disponíveis: ${describeHitDiceAvailable(hitDice) || 'nenhum'}. Abre os descansos curto e longo`}
          >
            {hitDice.length === 0 ? '—' : formatHitDiceAvailable(hitDice).map((text, i) => (
              <span
                key={hitDice[i].die}
                className={`block text-sm ${hitDice[i].available === 0 ? 'text-parchment-600' : ''}`}
                data-testid={`vitals-hit-dice-d${hitDice[i].die}`}
              >
                {text}
              </span>
            ))}
          </Stat>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:contents">
          <Stat
            label="CA"
            onOpen={() => onOpenSource(armorClassSource(armorClass, getConditionalAcBonuses(draft)))}
            ariaLabel={`Classe de Armadura ${armorClass.value}: de onde vem`}
          >
            {armorClass.value}
          </Stat>
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
            onOpen={() => onOpenSource(passiveSource(passive))}
            ariaLabel={`Percepção passiva ${passive.value}: de onde vem`}
          >
            {passive.value}
          </Stat>
        </div>
      </div>

      {/* Uma faixa só, que rola de lado: com várias condições os vitais fixos não comem a tela. */}
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto -mx-4 px-4 [scrollbar-width:none]" data-testid="vitals-chips">
        <button
          onClick={() => run(st => setInspiration(st, !st.inspiration))}
          aria-pressed={state.inspiration}
          className={[
            'shrink-0 whitespace-nowrap min-h-10 px-3 rounded-full border text-xs transition-colors',
            state.inspiration
              ? 'border-gold-500 bg-gold-900 text-gold-300'
              : 'border-parchment-800 text-parchment-600 hover:text-parchment-300',
          ].join(' ')}
          title="Inspiração: o Mestre concede; gaste para ter vantagem numa jogada"
        >
          {state.inspiration ? '★ Inspirado' : '☆ Sem inspiração'}
        </button>

        {state.concentration && (
          <span className="shrink-0 whitespace-nowrap inline-flex items-center min-h-10 rounded-full border border-violet-800 bg-violet-950/40 pl-3 text-xs text-violet-200">
            <span className="max-w-[11rem] truncate" title={state.concentration.label}>Concentrado: {state.concentration.label}</span>
            <button
              onClick={() => run(st => endConcentration(st))}
              className="min-h-10 px-3 text-violet-300 underline hover:text-violet-100"
            >
              encerrar
            </button>
          </span>
        )}

        {state.exhaustionLevel > 0 && (
          <span className="shrink-0 whitespace-nowrap inline-flex items-center min-h-8 rounded-full border border-amber-800 px-3 text-xs text-amber-300">
            Exaustão {state.exhaustionLevel}
          </span>
        )}

        {effects.conditions.map(c => {
          const note = state.conditionNotes?.[c.id]
          return (
            <span
              key={c.id}
              className={[
                'shrink-0 whitespace-nowrap inline-flex items-center min-h-8 rounded-full border px-3 text-xs',
                c.suspendedBy ? 'border-parchment-900 text-parchment-600' : 'border-red-900 text-red-200',
              ].join(' ')}
              title={note}
            >
              {c.name}
              {c.suspendedBy && ' (suspensa)'}
              {/* A nota inteira fica na aba Estado (e no title); aqui, uma linha cortada. */}
              {note && <span className="ml-1 max-w-[8rem] truncate text-parchment-500">· {note}</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}
