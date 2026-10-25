import { useState } from 'react'
import { completeLongRest, getHitDiceAvailable, previewLongRest } from '../../utils/playState'
import { countLabel } from '../../utils/textUtils'
import { ordinal } from './playFormat'
import type { PlayTabProps } from './usePlayView'

/**
 * Corta a escolha de Dados de Vida ao que o estado atual permite: cada tipo até o que foi gasto
 * dele, o total até o que volta (os maiores primeiro). Tipo que não está mais no poço sai.
 */
function fitHitDiceChoice(
  choice: Record<number, number>,
  pool: { die: number; spent: number }[],
  recoverable: number,
): Record<number, number> {
  let left = Math.max(0, recoverable)
  const fitted: Record<number, number> = {}
  for (const p of [...pool].sort((a, b) => b.die - a.die)) {
    const count = Math.max(0, Math.min(choice[p.die] ?? 0, p.spent, left))
    if (count > 0) fitted[p.die] = count
    left -= count
  }
  return fitted
}

/**
 * Descanso longo (pág. 188): a prévia do que volta (`previewLongRest`) e o "Confirmar"
 * (`completeLongRest`). A caixa "comeu e bebeu" vem marcada (decisão 14); na multiclasse o
 * jogador escolhe quais tipos de Dado de Vida voltam, com os maiores sugeridos (decisão 2).
 */
export function LongRestPanel({ view, onClose }: { view: PlayTabProps; onClose: () => void }) {
  const { state, sheet, run } = view
  const [ateAndDrank, setAteAndDrank] = useState(true)
  // null = a sugestão do app (os maiores primeiro).
  const [choice, setChoice] = useState<Record<number, number> | null>(null)

  const preview = previewLongRest(state, sheet, { ateAndDrank })
  const pool = getHitDiceAvailable(state, sheet)
  // A escolha é refeita contra o estado a cada render: um desfazer com o painel aberto pode baixar
  // os gastos (ou o que volta), e a escolha antiga seria recusada no confirmar.
  const hitDice = choice === null ? preview.hitDice.suggestion : fitHitDiceChoice(choice, pool, preview.hitDice.recoverable)
  const chosen = Object.values(hitDice).reduce((s, n) => s + n, 0)
  const pickTypes = pool.length > 1 && preview.hitDice.recoverable > 0
  const slots = preview.spellSlots.map((n, i) => ({ level: i + 1, n })).filter(s => s.n > 0)

  function setCount(die: number, count: number) {
    setChoice({ ...hitDice, [die]: count })
  }

  function confirm() {
    const result = run((st, sh) => completeLongRest(st, sh, { ateAndDrank, hitDice, now: Date.now() }))
    if (result && !result.notices.some(n => n.kind === 'refused')) onClose()
  }

  const items: string[] = preview.blocked ? [] : [
    preview.hp.after > preview.hp.before
      ? `PV ${preview.hp.before} → ${preview.hp.after} (o máximo)`
      : `PV ${preview.hp.before}: já no máximo`,
    ...(preview.hitDice.recoverable > 0 && !pickTypes
      ? [countLabel(preview.hitDice.recoverable, 'Dado de Vida', 'Dados de Vida')]
      : []),
    ...(slots.length > 0 ? [`Espaços de magia: ${slots.map(s => `${s.n} de ${ordinal(s.level)}`).join(', ')}`] : []),
    ...(preview.pactSlots > 0 ? [countLabel(preview.pactSlots, 'espaço de Pacto', 'espaços de Pacto')] : []),
    ...preview.resources.map(r => r.name),
  ]

  return (
    <div className="rounded-xl border border-parchment-800 bg-surface-raised p-3 space-y-3" aria-label="Descanso longo" role="group">
      {preview.notices.map((n, i) => <p key={i} className="text-xs text-parchment-400 leading-snug">{n.text}</p>)}

      {preview.blocked ? (
        <p className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-200">{preview.blockReason}</p>
      ) : (
        <>
          <div>
            <p className="text-sm text-parchment-300">Ao confirmar, voltam:</p>
            <ul className="mt-1 space-y-0.5" data-testid="long-rest-preview">
              {items.map((t, i) => <li key={i} className="text-sm text-parchment-100">• {t}</li>)}
            </ul>
            {preview.tempHpLost > 0 && (
              <p className="mt-1 text-xs text-parchment-400">Os {preview.tempHpLost} PV temporários acabam.</p>
            )}
          </div>

          {pickTypes && (
            <div>
              <p className="text-sm text-parchment-300">
                Dados de Vida que voltam: {chosen} de até {preview.hitDice.recoverable}. Escolha os tipos:
              </p>
              <ul className="mt-1 space-y-1">
                {pool.filter(p => p.spent > 0).map(p => {
                  const count = hitDice[p.die] ?? 0
                  return (
                    <li key={p.die} className="flex items-center gap-2">
                      <span className="w-12 text-sm text-parchment-200">d{p.die}</span>
                      <button
                        onClick={() => setCount(p.die, count - 1)}
                        disabled={count <= 0}
                        aria-label={`Um d${p.die} a menos`}
                        className="w-10 h-10 rounded-lg border border-parchment-800 text-parchment-300 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-fantasy font-bold text-parchment-100">{count}</span>
                      <button
                        onClick={() => setCount(p.die, count + 1)}
                        disabled={count >= p.spent || chosen >= preview.hitDice.recoverable}
                        aria-label={`Um d${p.die} a mais`}
                        className="w-10 h-10 rounded-lg border border-parchment-800 text-parchment-300 disabled:opacity-30"
                      >
                        +
                      </button>
                      <span className="text-[11px] text-parchment-500">{countLabel(p.spent, 'gasto', 'gastos')}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {preview.exhaustion.before > 0 && (
            <div>
              <label className="flex items-center gap-2 min-h-10 text-sm text-parchment-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ateAndDrank}
                  onChange={e => setAteAndDrank(e.target.checked)}
                  className="w-5 h-5 accent-gold-500"
                />
                Comeu e bebeu (tira 1 nível de exaustão)
              </label>
              <p className="text-xs text-parchment-400">
                Exaustão {preview.exhaustion.before} → {preview.exhaustion.after}
              </p>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={confirm}
          disabled={preview.blocked}
          className="min-h-10 rounded-lg bg-gold-500 px-4 font-fantasy font-bold text-sm text-on-accent disabled:opacity-40 hover:bg-gold-400 transition-colors"
        >
          Confirmar descanso longo
        </button>
        <button
          onClick={onClose}
          className="min-h-10 rounded-lg border border-parchment-700 px-4 text-sm text-parchment-300 hover:border-parchment-500"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
