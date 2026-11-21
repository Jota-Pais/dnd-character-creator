import { useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import type { DamageTypeId } from '@rpg/rules/systems/dnd5e/types/damage'
import type { DamageInput, PlayResult } from '@rpg/rules/systems/dnd5e/types/playState'
import {
  adjustMaxHp, applyDamage, applyHealing, formatDefenseConditionQuestion, formatHpAdjustment, getPlayDamageDefenses,
  grantTempHp, isAtZeroHp, suggestTempHpChoice,
} from '@rpg/rules/systems/dnd5e/utils/playState'
import { getDamageType } from '@rpg/rules/systems/dnd5e/utils/damageTypes'
import { describeDamageDefenses } from '@rpg/rules/systems/dnd5e/utils/sheetEffects'
import {
  choiceToDamageType, getDefendedDamageTypes, getDefenseQuestions, getDefensesForTypes, parseHpEntry, resolveHpAction,
  stripHpSign, type DamageTypeChoice, type HpAction,
} from './hpEntry'
import type { PlayView } from './usePlayView'

/** `sign`: o sinal que faz a mesma coisa no campo ("−7", "+5"), mostrado no botão para ensinar o atalho. */
const ACTIONS: { id: HpAction; label: string; sign?: string; field: string; help: string }[] = [
  {
    id: 'damage', label: 'Dano', sign: '−', field: 'Quanto de dano',
    help: 'O dano total que você sofreu (quem atacou diz o valor). Os PV temporários são gastos primeiro.',
  },
  {
    id: 'heal', label: 'Cura', sign: '+', field: 'Quanto de cura',
    help: 'Quanto você recuperou. Não passa do seu máximo; o que sobrar se perde.',
  },
  {
    id: 'temp', label: 'PV temporários', field: 'Quantos PV temporários',
    help: 'Uma reserva que some antes dos seus PV. Não se soma a outra: se já tiver, você escolhe com qual ficar.',
  },
]

/**
 * O que o campo ensina sem ação escolhida. No computador, o atalho com sinal ("−7", "+5"); no
 * celular e no tablet (ponteiro grosso) o teclado numérico do iPhone não tem sinal, e o texto leva
 * aos botões. O atalho com sinal vale nos dois.
 */
const ENTRY_TEXT = {
  fine: {
    label: 'Dano ou cura (−7 é dano, +5 é cura)',
    placeholder: '−7 ou +5',
    hint: 'Escolha Dano ou Cura, ou digite com o sinal: −7 é dano, +5 é cura.',
    invalid: 'Digite só o número, com − na frente para dano ou + para cura.',
  },
  coarse: {
    label: 'Dano ou cura',
    placeholder: '0',
    hint: 'Escolha Dano, Cura ou PV temporários e digite o valor.',
    invalid: 'Digite só o número.',
  },
}

const COARSE_POINTER = '(pointer: coarse)'
const isCoarsePointer = () => window.matchMedia?.(COARSE_POINTER).matches ?? false
function subscribeCoarsePointer(onChange: () => void) {
  const query = window.matchMedia?.(COARSE_POINTER)
  query?.addEventListener?.('change', onChange)
  return () => query?.removeEventListener?.('change', onChange)
}

const wasRefused = (result: PlayResult | null) => !result || result.notices.some(n => n.kind === 'refused')

/** O painel de PV: os testes contra a morte que saem da tela passam o foco ao primeiro botão dele. */
export const HP_PANEL_ID = 'play-hp'

/** Lê o número digitado: inteiro de 0 para cima, ou null. */
function parseAmount(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  return Number(text.trim())
}

/** A 2ª parcela do dano: o valor digitado e o tipo escolhido. */
type SecondPart = { text: string; type: DamageTypeChoice | null }

const firstUpper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Os chips de tipo de uma parcela: os tipos com defesa, depois o "Outro tipo". Tocar no escolhido o
 * desmarca (o dano fica sem tipo, como na Fase 1). Os chips não somem com o toque: o foco fica neles.
 */
function DamageTypeChips({ label, types, value, onChange }: {
  label: string
  types: DamageTypeId[]
  value: DamageTypeChoice | null
  onChange: (next: DamageTypeChoice | null) => void
}) {
  const choices: { id: DamageTypeChoice; name: string }[] = [
    ...types.map(id => ({ id, name: getDamageType(id).name })),
    { id: 'other', name: 'Outro tipo' },
  ]
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {choices.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(value === c.id ? null : c.id)}
          aria-pressed={value === c.id}
          className={[
            'min-h-10 rounded-lg border px-3 text-sm transition-colors',
            value === c.id
              ? 'border-gold-500 bg-gold-900 text-gold-300'
              : 'border-parchment-800 text-parchment-300 hover:border-parchment-600',
          ].join(' ')}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}

/**
 * Ações de PV: dano, cura e PV temporários, com o número digitado pelo jogador (o dano vem do
 * inimigo: nada de rolar aqui, mesmo com os dados do app). O campo fica sempre à mão e aceita o
 * atalho "−7" / "+5" sem escolher o botão antes (`hpEntry.ts`); o teclado do celular é o numérico,
 * que no iPhone não tem sinal, e por isso os botões Dano e Cura levam o "−" e o "+" e, com ponteiro
 * grosso, o campo ensina os botões em vez do sinal (`ENTRY_TEXT`).
 *
 * No Dano, quem tem defesa por tipo (da ficha ou de condição: Resistência Infernal, Petrificado) vê
 * os chips do tipo, e a defesa se aplica sozinha; "+ outra parcela" separa um dano de dois tipos.
 * A defesa condicional vira caixa desligada ("Dano de magia?"), e a exceção, caixa que a cancela
 * ("Arma mágica ou de prata?"). Sem defesa nenhuma, o painel fica como na Fase 1.
 *
 * As regras ficam nas funções puras de `utils/playState.ts`; os avisos (resistência,
 * concentração, queda a 0 PV) saem pelo playStore.
 */
export function HpPanel({ view }: { view: PlayView }) {
  const { state, sheet, run } = view
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const addPartRef = useRef<HTMLButtonElement>(null)
  const removePartRef = useRef<HTMLButtonElement>(null)
  const texts = useSyncExternalStore(subscribeCoarsePointer, isCoarsePointer) ? ENTRY_TEXT.coarse : ENTRY_TEXT.fine
  const hintId = useId()
  const problemId = useId()
  // O botão escolhido; o que vale é `action`, em que o sinal digitado manda.
  const [selected, setSelected] = useState<HpAction | null>(null)
  const [text, setText] = useState('')
  const [resisted, setResisted] = useState(false)
  const [critical, setCritical] = useState(false)
  const [knockout, setKnockout] = useState(false)
  const [damageType, setDamageType] = useState<DamageTypeChoice | null>(null)
  const [second, setSecond] = useState<SecondPart | null>(null)
  const [confirmed, setConfirmed] = useState<string[]>([])
  const [excepted, setExcepted] = useState<string[]>([])
  const atZero = isAtZeroHp(state)
  // Nocaute (pág. 200): só faz sentido para quem ainda está de pé — é o golpe que levaria a 0 PV.
  const canBeKnockedOut = state.lifeState === 'conscious'
  const entry = parseHpEntry(text)
  const action = resolveHpAction(entry, selected)
  const amount = entry?.amount ?? null
  const current = ACTIONS.find(a => a.id === action)
  // PV temporários já presentes: o jogador escolhe manter ou trocar (pág. 200).
  const askTempChoice = action === 'temp' && state.tempHp > 0 && amount !== null && amount > 0

  // As defesas em vigor (da ficha e das condições): os chips e as caixas do dano saem delas.
  const defenses = getPlayDamageDefenses(state, sheet)
  const defendedTypes = getDefendedDamageTypes(defenses)
  const askType = action === 'damage' && defendedTypes.length > 0
  // Sem chips não há tipo nem 2ª parcela: o dano é um só, sem tipo, como na Fase 1.
  const secondPart = askType ? second : null
  const secondAmount = secondPart ? parseAmount(secondPart.text) : null
  const partTypes = askType
    ? [choiceToDamageType(damageType), ...(secondPart ? [choiceToDamageType(secondPart.type)] : [])]
    : [undefined]
  const questions = action === 'damage'
    ? getDefenseQuestions(defenses, partTypes)
    : { conditions: [], exceptions: [] }
  // Só as caixas à vista: a de um tipo desmarcado depois não vale.
  const conditionalDefenses = questions.conditions.map(q => q.text).filter(q => confirmed.includes(q))
  const exceptions = questions.exceptions.map(q => q.text).filter(q => excepted.includes(q))
  const chosenTypes = partTypes.filter((t): t is DamageTypeId => t !== undefined)
  // A linha diz o que o tipo vai fazer com as caixas como estão, pelo mesmo critério do pipeline.
  const typeLines = describeDamageDefenses(getDefensesForTypes(defenses, chosenTypes, { conditionalDefenses, exceptions }))

  // O que impede o "Aplicar", numa região viva só: no campo principal, texto que não é número, ou
  // número sem sinal e sem botão escolhido (no iPhone, o teclado numérico não tem sinal, e o caminho
  // são os botões); na 2ª parcela, texto que não é número, ou ela vazia com o valor principal já
  // digitado (quem a abriu por engano não sabe que precisa tirá-la). Cada impedimento descreve o
  // campo dele, e o principal, sem impedimento seu, fica com a ajuda.
  const mainProblem = !entry
    ? texts.invalid
    : amount !== null && action === null
      ? `Para aplicar o ${amount}, escolha Dano, Cura ou PV temporários.`
      : null
  const secondInvalid = !!secondPart && secondPart.text.trim() !== '' && secondAmount === null
  const secondProblem = secondInvalid
    ? 'Na 2ª parcela, digite só o número.'
    : secondPart && secondAmount === null && amount !== null
      ? 'Digite a 2ª parcela ou toque em "Tirar a 2ª parcela".'
      : null
  const problem = mainProblem ?? secondProblem
  const canApply = amount !== null && action !== null && (!secondPart || secondAmount !== null)
  // A ajuda da ação, lida ao focar o campo: fora da região viva, não fala a cada toque nos botões.
  const hint = current?.help ?? texts.hint

  function clearOptions() {
    setResisted(false)
    setCritical(false)
    setKnockout(false)
    setDamageType(null)
    setSecond(null)
    setConfirmed([])
    setExcepted([])
  }

  function reset() {
    setSelected(null)
    setText('')
    clearOptions()
  }

  function choose(next: HpAction) {
    // Tocar de novo no botão que já vale (sem sinal digitado) desliga a escolha e limpa o campo.
    if (next === selected && next === action && !entry?.sign) return reset()
    if (next !== action) clearOptions()
    setSelected(next)
    // O botão vence o sinal digitado: o número fica e segue o botão.
    setText(t => stripHpSign(t))
    inputRef.current?.focus()
  }

  function damageInput(value: number): DamageInput {
    const firstType = askType ? choiceToDamageType(damageType) : undefined
    const secondType = secondPart ? choiceToDamageType(secondPart.type) : undefined
    const parts = secondPart && secondAmount !== null
      ? [
        { amount: value, ...(firstType ? { damageType: firstType } : {}) },
        { amount: secondAmount, ...(secondType ? { damageType: secondType } : {}) },
      ]
      : null
    return {
      amount: value + (secondAmount ?? 0),
      resisted,
      critical: atZero && critical,
      ...(parts ? { parts } : firstType ? { damageType: firstType } : {}),
      ...(conditionalDefenses.length > 0 ? { conditionalDefenses } : {}),
      ...(exceptions.length > 0 ? { exceptions } : {}),
      ...(canBeKnockedOut && knockout ? { knockout: true } : {}),
    }
  }

  // Aplicar tira do painel o que valia só para este dano (chips, 2ª parcela, caixas) e os botões dos
  // PV temporários: síncrono (flushSync), e o foco que estava num deles vai ao "Aplicar", que fica.
  // Recusado, nada some, e o foco também fica.
  function apply(choice?: 'keep' | 'replace') {
    if (!canApply || amount === null) return
    const result = flushSync(() => {
      let r: PlayResult | null
      if (action === 'damage') {
        const input = damageInput(amount)
        r = run((st, sh) => applyDamage(st, sh, input))
      } else if (action === 'heal') {
        r = run((st, sh) => applyHealing(st, sh, amount))
      } else {
        r = run(st => grantTempHp(st, amount, choice))
      }
      if (!wasRefused(r)) reset()
      return r
    })
    if (!wasRefused(result) && !rootRef.current?.contains(document.activeElement)) submitRef.current?.focus()
  }

  // "+ outra parcela" e "Tirar a 2ª parcela" trocam de lugar: o foco passa de um ao outro, nunca ao
  // campo da parcela (abriria o teclado do celular).
  function addPart() {
    flushSync(() => setSecond({ text: '', type: null }))
    removePartRef.current?.focus()
  }

  function removePart() {
    flushSync(() => setSecond(null))
    addPartRef.current?.focus()
  }

  const toggleIn = (list: string[], item: string, on: boolean) =>
    on ? [...list.filter(x => x !== item), item] : list.filter(x => x !== item)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!askTempChoice) apply()
  }

  const suggested = askTempChoice ? suggestTempHpChoice(state, amount) : null

  return (
    <div id={HP_PANEL_ID} ref={rootRef} className="rounded-xl border border-parchment-900 bg-surface-raised p-3">
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Pontos de vida">
        {ACTIONS.map(a => (
          <button
            key={a.id}
            onClick={() => choose(a.id)}
            aria-pressed={action === a.id}
            className={[
              'min-h-10 min-w-0 break-words rounded-lg border px-1.5 py-1 text-xs sm:text-sm leading-tight transition-colors',
              action === a.id
                ? 'border-gold-500 bg-gold-900 text-gold-300'
                : 'border-parchment-800 text-parchment-300 hover:border-parchment-600',
            ].join(' ')}
          >
            {a.sign && <span aria-hidden="true" className="mr-1 font-bold">{a.sign}</span>}
            {a.label}
          </button>
        ))}
      </div>

      {/* O campo fica sempre à mão: "−7" e "+5" valem sem tocar no botão antes. Texto, não
          number: o type number recusa o sinal digitado; o inputMode mantém o teclado numérico. */}
      <form onSubmit={handleSubmit} className="mt-2 space-y-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={text}
            onChange={e => setText(e.target.value)}
            aria-label={current?.field ?? texts.label}
            aria-describedby={mainProblem ? problemId : hintId}
            placeholder={current ? '0' : texts.placeholder}
            className="min-h-10 w-full min-w-0 rounded-lg border border-parchment-800 bg-surface-base px-3 text-lg text-parchment-100 outline-none focus:border-gold-600"
          />
          {/* aria-disabled, não disabled: aplicar esvazia o campo, e o botão desabilitado largaria o
              foco de quem o acionou no body. Sem o que aplicar, o envio não faz nada (`apply`). */}
          {!askTempChoice && (
            <button
              ref={submitRef}
              type="submit"
              aria-disabled={!canApply}
              className="min-h-10 shrink-0 rounded-lg bg-gold-500 px-4 font-fantasy font-bold text-sm text-on-accent aria-disabled:opacity-40 hover:bg-gold-400 transition-colors"
            >
              Aplicar
            </button>
          )}
        </div>
        {/* O impedimento do campo principal fica no lugar da ajuda; o da 2ª parcela, acima dela, que
            continua descrevendo o principal. A região viva existe antes dele: inserida já com o
            texto, pode não ser anunciada. */}
        <div>
          <div aria-live="polite">
            {problem && <p id={problemId} className="text-xs leading-snug text-amber-300">{problem}</p>}
          </div>
          {!mainProblem && <p id={hintId} className="text-xs leading-snug text-parchment-500">{hint}</p>}
        </div>

        {action === 'damage' && (
          <div className="space-y-1">
            {askType && (
              <div className="space-y-1.5">
                <p className="text-xs text-parchment-500">{secondPart ? 'Tipo da 1ª parcela' : 'Tipo do dano'}</p>
                <DamageTypeChips
                  label={secondPart ? 'Tipo da 1ª parcela' : 'Tipo do dano'}
                  types={defendedTypes}
                  value={damageType}
                  onChange={setDamageType}
                />
                {secondPart && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs text-parchment-500">2ª parcela</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={secondPart.text}
                      onChange={e => {
                        const value = e.target.value
                        setSecond(s => (s ? { ...s, text: value } : s))
                      }}
                      aria-label="Quanto de dano da 2ª parcela"
                      aria-describedby={!mainProblem && secondProblem ? problemId : undefined}
                      aria-invalid={secondInvalid || undefined}
                      placeholder="0"
                      className="min-h-10 w-full min-w-0 rounded-lg border border-parchment-800 bg-surface-base px-3 text-lg text-parchment-100 outline-none focus:border-gold-600"
                    />
                    <DamageTypeChips
                      label="Tipo da 2ª parcela"
                      types={defendedTypes}
                      value={secondPart.type}
                      onChange={type => setSecond(s => (s ? { ...s, type } : s))}
                    />
                  </div>
                )}
                {secondPart ? (
                  <button
                    ref={removePartRef}
                    type="button"
                    onClick={removePart}
                    className="min-h-10 text-xs text-parchment-400 underline hover:text-parchment-200"
                  >
                    Tirar a 2ª parcela
                  </button>
                ) : (
                  <button
                    ref={addPartRef}
                    type="button"
                    onClick={addPart}
                    className="min-h-10 text-xs text-parchment-400 underline hover:text-parchment-200"
                  >
                    + outra parcela
                  </button>
                )}
                {typeLines.map(line => (
                  <p key={line} className="text-xs leading-snug text-emerald-300">{line}</p>
                ))}
              </div>
            )}
            {questions.conditions.map(q => (
              <label key={`condition:${q.text}`} className="flex items-center gap-2 min-h-10 text-sm text-parchment-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed.includes(q.text)}
                  onChange={e => {
                    const on = e.target.checked
                    setConfirmed(list => toggleIn(list, q.text, on))
                  }}
                  className="w-5 h-5 shrink-0 accent-gold-500"
                />
                {formatDefenseConditionQuestion(q.text)} ({q.sources.join(', ')})
              </label>
            ))}
            {questions.exceptions.map(q => (
              <label key={`exception:${q.text}`} className="flex items-center gap-2 min-h-10 text-sm text-parchment-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excepted.includes(q.text)}
                  onChange={e => {
                    const on = e.target.checked
                    setExcepted(list => toggleIn(list, q.text, on))
                  }}
                  className="w-5 h-5 shrink-0 accent-gold-500"
                />
                {firstUpper(q.text)}? (anula {q.sources.join(', ')})
              </label>
            ))}
            <label className="flex items-center gap-2 min-h-10 text-sm text-parchment-300 cursor-pointer">
              <input type="checkbox" checked={resisted} onChange={e => setResisted(e.target.checked)} className="w-5 h-5 shrink-0 accent-gold-500" />
              Tenho resistência a esse dano (sofro a metade)
            </label>
            {atZero && (
              <label className="flex items-center gap-2 min-h-10 text-sm text-parchment-300 cursor-pointer">
                <input type="checkbox" checked={critical} onChange={e => setCritical(e.target.checked)} className="w-5 h-5 shrink-0 accent-gold-500" />
                Foi acerto crítico (conta 2 fracassos)
              </label>
            )}
            {canBeKnockedOut && (
              <label className="flex items-center gap-2 min-h-10 text-xs text-parchment-400 cursor-pointer">
                <input type="checkbox" checked={knockout} onChange={e => setKnockout(e.target.checked)} className="w-5 h-5 shrink-0 accent-gold-500" />
                Fui nocauteado (o atacante escolheu, corpo a corpo, pág. 200)
              </label>
            )}
          </div>
        )}

        {askTempChoice && suggested && (
          <div className="space-y-1.5">
            <p className="text-sm text-parchment-300">
              Você já tem {state.tempHp} PV temporários. Eles não se somam: com quais fica?
            </p>
            {/* A sugestão (o maior) ganha a borda dourada; a escolha é do jogador. */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => apply('keep')}
                className={`min-h-10 rounded-lg border px-3 text-sm text-parchment-200 hover:border-gold-600 ${suggested === 'keep' ? 'border-gold-700' : 'border-parchment-700'}`}
              >
                Manter {state.tempHp}{state.tempHp > amount ? ' (maior)' : ''}
              </button>
              <button
                type="button"
                onClick={() => apply('replace')}
                className={`min-h-10 rounded-lg border px-3 text-sm text-parchment-200 hover:border-gold-600 ${suggested === 'replace' ? 'border-gold-700' : 'border-parchment-700'}`}
              >
                Ficar com {amount}{amount > state.tempHp ? ' (maior)' : ''}
              </button>
            </div>
          </div>
        )}
      </form>

      <MaxHpAdjustment view={view} />
    </div>
  )
}

/**
 * O ajuste temporário do PV máximo, discreto: um link abre o campo. Aumentar sobe o máximo e o
 * atual juntos (a magia Ajuda); diminuir só corta o que passar do máximo. O descanso longo zera, e
 * "encerrar" desfaz o ajuste quando o efeito acaba antes. Cada mudança é um passo do desfazer.
 */
function MaxHpAdjustment({ view }: { view: PlayView }) {
  const { state, run } = view
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const toggleRef = useRef<HTMLButtonElement>(null)
  const amount = parseAmount(text)
  const adjustment = state.maxHpAdjustment

  // Aplicar fecha o campo, e "encerrar" some com o ajuste: o foco, que estava num deles, vai ao
  // "± PV máximo", que fica (flushSync: a tela já sem eles).
  function apply(sign: 1 | -1) {
    if (amount === null || amount === 0) return
    const result = flushSync(() => run((st, sh) => adjustMaxHp(st, sh, sign * amount)))
    // Recusado (o aviso diz por quê): o campo fica aberto com o valor, e o foco onde estava.
    if (!result || result.state === state) return
    flushSync(() => {
      setText('')
      setOpen(false)
    })
    toggleRef.current?.focus()
  }

  function end() {
    const result = flushSync(() => run((st, sh) => adjustMaxHp(st, sh, -st.maxHpAdjustment)))
    if (result && result.state !== state) toggleRef.current?.focus()
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-3">
        {adjustment !== 0 && (
          <span className="text-xs text-sky-300">
            Máximo {formatHpAdjustment(adjustment)} até o descanso longo
            <button
              onClick={end}
              className="min-h-10 px-2 text-xs text-parchment-400 underline hover:text-parchment-200"
            >
              encerrar
            </button>
          </span>
        )}
        <button
          ref={toggleRef}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="min-h-10 text-xs text-parchment-500 underline hover:text-parchment-300"
        >
          ± PV máximo
        </button>
      </div>
      {open && (
        <div className="mt-1 space-y-2">
          <p className="text-xs text-parchment-500 leading-snug">
            Efeito que muda o seu PV máximo por um tempo, como a magia Ajuda (+5 no máximo e no atual, pág. 215).
            Aumentar sobe os dois; diminuir só corta o que passar do máximo. O descanso longo zera.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              step={1}
              value={text}
              onChange={e => setText(e.target.value)}
              aria-label="Quanto muda o PV máximo"
              placeholder="0"
              className="min-h-10 w-full min-w-0 rounded-lg border border-parchment-800 bg-surface-base px-3 text-lg text-parchment-100 outline-none focus:border-gold-600"
            />
            <button
              onClick={() => apply(1)}
              disabled={!amount}
              className="min-h-10 min-w-0 whitespace-nowrap rounded-lg border border-parchment-700 px-1 text-xs sm:text-sm text-parchment-200 disabled:opacity-40 hover:border-gold-600"
            >
              + Aumentar
            </button>
            <button
              onClick={() => apply(-1)}
              disabled={!amount}
              className="min-h-10 min-w-0 whitespace-nowrap rounded-lg border border-parchment-700 px-1 text-xs sm:text-sm text-parchment-200 disabled:opacity-40 hover:border-gold-600"
            >
              − Diminuir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}