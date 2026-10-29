import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import type { DeathSaveCount } from '../../types/playState'
import { roll } from '../../../../core/dice'
import { usePlayStore } from '../../stores/playStore'
import { recordDeathSave, recordRoll, regainHpWhileStable, revive, stabilize } from '../../utils/playState'
import { describeRollGuide } from '../../utils/rollGuide'
import { rerollNaturalOne, rollGuideEntry, type GuideRoll } from './playDice'
import { getDeathSaveScrollDelta } from './deathSaveScroll'
import type { PlayView } from './usePlayView'

function Marks({ label, count, filled }: { label: string; count: DeathSaveCount; filled: string }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${label}: ${count} de 3`} role="img">
      <span className="w-20 text-xs text-parchment-500">{label}</span>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={`w-5 h-5 rounded-full border-2 ${i < count ? filled : 'border-parchment-700'}`}
        />
      ))}
    </div>
  )
}

/**
 * A 0 PV, no lugar do PV: os testes contra a morte (pág. 199). O jogador rola o d20 e digita o
 * natural que valeu; o app soma o que vale para todo teste de resistência (`guide.deathSave`) e
 * chama `recordDeathSave`. Estável e morto mostram o que ainda dá para fazer.
 */
export function DeathSaves({ view, bottomInset = 0 }: {
  view: PlayView
  /** Altura do aviso preso ao pé da tela (0 sem aviso): o d20 não pode ficar embaixo dele. */
  bottomInset?: number
}) {
  const { state, guide, appDice, run } = view
  const rootRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const insetRef = useRef(bottomInset)
  const [text, setText] = useState('')

  useLayoutEffect(() => {
    insetRef.current = bottomInset
  })
  // Caiu a 0 PV: o teste contra a morte vem para o meio da tela, com o d20 e o "Registrar" acima
  // do aviso da queda. Um quadro depois: o aviso já mediu a altura e a folga de fundo já cresceu.
  useEffect(() => {
    if (state.lifeState !== 'dying' || typeof requestAnimationFrame === 'undefined') return
    const frame = requestAnimationFrame(() => {
      const panel = rootRef.current?.getBoundingClientRect()
      const form = formRef.current?.getBoundingClientRect()
      // Sem layout (o jsdom dos testes), nada a rolar.
      if (!panel || !form || panel.height === 0) return
      const delta = getDeathSaveScrollDelta({
        panel, form, viewportHeight: window.innerHeight, bottomInset: insetRef.current,
      })
      if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [state.lifeState])
  // A rolagem do app que preencheu o campo: vai para o histórico junto com o teste.
  const [rolled, setRolled] = useState<GuideRoll | null>(null)
  // Já jogou de novo pelo Sortudo: o novo resultado é o que vale, sem terceira chance (pág. 28).
  const [luckUsed, setLuckUsed] = useState(false)
  const logRoll = usePlayStore(s => s.logRoll)
  const entry = guide.deathSave
  const natural = /^\d+$/.test(text.trim()) ? Number(text.trim()) : null
  const valid = natural !== null && natural >= 1 && natural <= 20
  // Sortudo: o 1 natural que os dados do app tiraram pode ser jogado de novo antes de registrar.
  const luckSource = entry.rerollNaturalOne?.join(', ')
  const offerLuck = Boolean(luckSource) && !luckUsed && rolled !== null && rolled.natural === 1 && natural === 1

  function handleRoll() {
    const result = rollGuideEntry(entry)
    setRolled(result)
    setLuckUsed(false)
    setText(result.natural === null ? '' : String(result.natural))
  }

  function handleLuck() {
    if (!rolled) return
    // A primeira rolagem aconteceu: fica no histórico; o teste registra a nova.
    logRoll(rolled.record)
    const again = rerollNaturalOne(entry, rolled, luckSource ? { source: luckSource } : {})
    setRolled(again)
    setLuckUsed(true)
    setText(again.natural === null ? '' : String(again.natural))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const record = rolled && rolled.natural === natural ? rolled.record : null
    run((st, sh) => {
      const result = recordDeathSave(st, sh, { natural, total: natural + entry.modifier })
      if (!record || result.state === st) return result
      return { state: recordRoll(result.state, record).state, notices: result.notices }
    })
    setText('')
    setRolled(null)
    setLuckUsed(false)
  }

  if (state.lifeState === 'dead') {
    return (
      <div className="rounded-xl border border-red-900 bg-red-950/30 p-4">
        <p className="font-fantasy font-bold text-red-300">Morto</p>
        <p className="mt-1 text-xs text-parchment-400 leading-snug">
          Cura comum não traz de volta. Se uma magia ou o Mestre trouxer o personagem de volta, toque abaixo.
        </p>
        <button
          onClick={() => run((st, sh) => revive(st, sh))}
          className="mt-3 min-h-10 rounded-lg border border-parchment-700 px-4 text-sm text-parchment-200 hover:border-gold-600"
        >
          Fui revivido
        </button>
      </div>
    )
  }

  if (state.lifeState === 'stable') return <StablePanel view={view} />

  return (
    <div ref={rootRef} className="rounded-xl border border-red-900 bg-red-950/20 p-4">
      <p className="font-fantasy font-bold text-red-300">Morrendo: testes contra a morte</p>
      <p className="mt-1 text-xs text-parchment-400 leading-snug">
        No início de cada turno, role {describeRollGuide(entry)}. 10 ou mais é sucesso; 1 conta dois fracassos; 20 recupera 1 PV e acorda.
      </p>
      {/* A 1ª nota do guia é a regra que a linha acima já explica; as demais (Inspiração) seguem. */}
      {entry.notes.slice(1).map((n, i) => (
        <p key={i} className="mt-1 text-xs text-parchment-500 leading-snug">• {n}</p>
      ))}

      <div className="mt-3 space-y-1.5">
        <Marks label="Sucessos" count={state.deathSaves.successes} filled="border-emerald-400 bg-emerald-500" />
        <Marks label="Fracassos" count={state.deathSaves.failures} filled="border-red-400 bg-red-600" />
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="mt-3 flex flex-wrap gap-2">
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={1}
          max={20}
          value={text}
          onChange={e => { setText(e.target.value); setRolled(null); setLuckUsed(false) }}
          aria-label="d20 que você tirou (1 a 20)"
          placeholder="d20"
          className="min-h-10 w-24 rounded-lg border border-parchment-800 bg-surface-base px-3 text-lg text-parchment-100 outline-none focus:border-gold-600"
        />
        {appDice && (
          <button
            type="button"
            onClick={handleRoll}
            className="min-h-10 rounded-lg border border-parchment-800 px-3 text-sm text-parchment-400 hover:text-parchment-200"
          >
            rolar
          </button>
        )}
        {offerLuck && (
          <button
            type="button"
            onClick={handleLuck}
            className="min-h-10 rounded-lg border border-gold-700 px-3 text-sm text-gold-300 hover:border-gold-500"
          >
            Rolar de novo ({luckSource})
          </button>
        )}
        <button
          type="submit"
          disabled={!valid}
          className="min-h-10 rounded-lg bg-gold-500 px-4 font-fantasy font-bold text-sm text-on-accent disabled:opacity-40 hover:bg-gold-400 transition-colors"
        >
          Registrar
        </button>
      </form>
      {/* A região viva existe antes do aviso: inserida já com o texto, pode não ser anunciada. */}
      <div aria-live="polite">
        {text.trim() !== '' && !valid && (
          <p className="mt-1 text-[11px] text-red-300 leading-snug">
            Digite o d20 que saiu (1 a 20); o app soma o resto.
          </p>
        )}
      </div>

      <button
        onClick={() => run(st => stabilize(st))}
        className="mt-3 min-h-10 rounded-lg border border-parchment-700 px-3 text-sm text-parchment-300 hover:border-gold-600"
      >
        Estabilizar
      </button>
      <p className="mt-1 text-[11px] text-parchment-600 leading-snug">
        Use quando alguém te estabilizar: um aliado com teste de Sabedoria (Medicina) CD 10, um Kit de Primeiros Socorros ou uma magia (pág. 200).
      </p>
    </div>
  )
}

/**
 * Estável com 0 PV (pág. 200): sem testes contra a morte, inconsciente até recuperar PV. Se ninguém
 * curar, recupera 1 PV depois de 1d4 horas — o app não conta o tempo, o jogador confirma. Com os
 * dados do app, o 1d4 de horas pode ser rolado (vai para o histórico).
 */
function StablePanel({ view }: { view: PlayView }) {
  const { appDice, run } = view
  const logRoll = usePlayStore(s => s.logRoll)
  const [hours, setHours] = useState<number | null>(null)

  function rollHours() {
    const record = roll('1d4', { label: 'Estável: horas até recuperar 1 PV' })
    logRoll(record)
    setHours(record.total)
  }

  return (
    <div className="rounded-xl border border-parchment-800 bg-surface-raised p-4">
      <p className="font-fantasy font-bold text-parchment-200">Estável, com 0 PV</p>
      <p className="mt-1 text-xs text-parchment-400 leading-snug">
        Não rola mais testes contra a morte, mas continua inconsciente até recuperar PV. Se sofrer dano, volta a morrer.
      </p>
      <p className="mt-2 text-sm text-parchment-300 leading-snug">
        Se ninguém te curar, recupera 1 PV depois de 1d4 horas (pág. 200).
      </p>
      {appDice && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={rollHours}
            className="min-h-10 rounded-lg border border-parchment-800 px-3 text-sm text-parchment-400 hover:text-parchment-200"
          >
            rolar 1d4
          </button>
          <span className="text-sm text-parchment-200" aria-live="polite">
            {hours === null ? null : hours === 1 ? 'Recupera 1 PV em 1 hora.' : `Recupera 1 PV em ${hours} horas.`}
          </span>
        </div>
      )}
      <button
        onClick={() => run((st, sh) => regainHpWhileStable(st, sh))}
        className="mt-3 min-h-10 rounded-lg border border-parchment-700 px-3 text-sm text-parchment-200 hover:border-gold-600"
      >
        Passou o tempo: recuperei 1 PV
      </button>
    </div>
  )
}