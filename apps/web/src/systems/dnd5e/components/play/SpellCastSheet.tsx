import { useRef, useState } from 'react'
import type { PlayNotice } from '@rpg/rules/systems/dnd5e/types/playState'
import {
  castSpell, getSpellCastOptions, getSpellSelfToggle, suggestTempHpChoice, type SelfSpellResult, type SpellCast, type SpellCastOption,
} from '@rpg/rules/systems/dnd5e/utils/playState'
import { findSpellbookEntry } from '@rpg/rules/systems/dnd5e/utils/spellbook'
import { getSpellGuide, spellGuideRolls } from '@rpg/rules/systems/dnd5e/utils/spellGuide'
import { getHigherLevelsText, getSpell } from '@rpg/rules/systems/dnd5e/utils/spellUtils'
import { normalizeMinus } from './hpEntry'
import { PlayDialog } from './PlayDialog'
import { ordinal } from './playFormat'
import { describeSpellDuration, describeSpellKind } from './ruleReference'
import { SpellRecipe } from './SpellRecipe'
import type { PlayTabProps } from './usePlayView'

/** A magia a conjurar: a conjuração do grimório (a chave da lista) e a magia. */
export type SpellCastTarget = { casterKey: string; spellId: string }

const optionKey = (o: SpellCastOption) => `${o.pay}:${o.castLevel}`

/** "— restam 3", "— nenhum restante"; nada no que não se conta. */
function remaining(available: SpellCastOption['available']): string {
  if (available === null) return ''
  if (available === 'unlimited') return ' — usos ilimitados'
  if (available === 0) return ' — nenhum restante'
  return available === 1 ? ' — resta 1' : ` — restam ${available}`
}

/** Como a folha escreve cada jeito de pagar. */
function optionLabel(option: SpellCastOption, spellLevel: number, listLabel: string): string {
  switch (option.pay) {
    case 'free': return spellLevel === 0 ? 'Truque: sem gastar espaço' : `No ${ordinal(option.castLevel)} nível, sem gastar espaço`
    case 'slot': return `Espaço de ${ordinal(option.castLevel)} nível${remaining(option.available)}`
    case 'pact': return `Espaço de Pacto (${ordinal(option.castLevel)} nível)${remaining(option.available)}`
    case 'resource': return `O uso de ${listLabel}${remaining(option.available)}`
    case 'ritual': return 'Como ritual (+10 min, sem gastar espaço)'
  }
}

/** O jeito que a folha propõe: o primeiro que ainda tem o que gastar, o ritual só por último. */
function defaultOption(options: SpellCastOption[]): SpellCastOption | undefined {
  return options.find(o => o.pay !== 'ritual' && o.available !== 0) ?? options.find(o => o.pay === 'ritual') ?? options[0]
}

/** O número que a mesa rolou: inteiro positivo, ou null. */
function parseAmount(text: string): number | null {
  const t = normalizeMinus(text).trim()
  return /^\d+$/.test(t) && Number(t) > 0 ? Number(t) : null
}

/** Os avisos que a conjuração daria agora, sem o do gasto (que o jeito escolhido já diz), ou a recusa. */
function previewNotices(notices: PlayNotice[]): { lines: string[]; refused: boolean } {
  const refused = notices.find(n => n.kind === 'refused' || n.kind === 'unresolvedRule')
  return refused ? { lines: [refused.text], refused: true } : { lines: notices.slice(1).map(n => n.text), refused: false }
}

/**
 * O que o toque no Conjurar respondeu (a recusa, o número que falta), com um id novo a cada toque:
 * o parágrafo troca, e a região viva anuncia de novo o mesmo texto.
 */
type TapResponse = { text: string; id: number }

/** O texto da prévia, ligado ao Conjurar (`aria-describedby`): o leitor o lê ao focar o botão. */
const PREVIEW_ID = 'spell-cast-preview'

function AmountField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-parchment-200">
      <span className="flex-1">{label}</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="min-h-10 w-20 rounded-lg border border-parchment-800 bg-surface-base px-3 text-right text-parchment-100 outline-none focus:border-gold-600"
      />
    </label>
  )
}

/**
 * A folha de conjurar uma magia do grimório (Fase 2, onda `grimorio`), aberta pelo "Conjurar" da aba
 * Magia e das magias de ação bônus e de reação da aba Ações. Mostra:
 * - os jeitos de pagar (`getSpellCastOptions`): o espaço de cada nível com o que resta, o de Pacto, o
 *   uso do talento e "Como ritual (+10 min)" — só para quem pode —, com o ganho do nível escolhido
 *   pelo guia da magia, ou, sem o dano estruturado dela ainda, pelo texto de "Em níveis superiores";
 * - a receita do nível escolhido (`SpellRecipe`);
 * - "Em você?", quando ela marca um efeito em quem a recebe (o catálogo) ou cura, dá PV temporários
 *   ou sobe o PV máximo: o que a mesa rolou se aplica no mesmo toque. A de alcance pessoal é sempre
 *   em você;
 * - os avisos que a conjuração daria (a magia de ação bônus, a ação já usada, a concentração que
 *   termina, a recusa): a prévia, em texto comum ligado ao "Conjurar" por `aria-describedby`. Ela já
 *   existe ao abrir (a Palavra Curativa conjurada antes, a fúria), e uma região viva inserida já com
 *   o texto pode não ser anunciada; o leitor a lê ao focar o botão.
 *
 * "Conjurar" passa por `castSpell`, num passo só do desfazer, e fecha a folha: o foco volta ao
 * "Conjurar" de onde ela abriu, e o aviso do pé diz o que foi gasto. Recusada, a recusa sai na região
 * viva da folha (o aviso do pé fica atrás dela), montada vazia e só com a resposta do toque — a cada
 * toque, de novo, mesmo igual à da prévia —, e o foco fica.
 */
export function SpellCastSheet({ view, target, onClose }: { view: PlayTabProps; target: SpellCastTarget; onClose: () => void }) {
  const { draft, state, sheet, guide: rollGuide, run, openRecipe } = view
  const found = findSpellbookEntry(sheet.spellbook, target.casterKey, target.spellId)
  const spell = getSpell(target.spellId)
  const options = getSpellCastOptions(state, sheet, target.casterKey, target.spellId)
  const [chosenKey, setChosenKey] = useState(() => {
    const o = defaultOption(options)
    return o ? optionKey(o) : ''
  })
  const chosen = options.find(o => optionKey(o) === chosenKey) ?? defaultOption(options)
  const toggle = getSpellSelfToggle(sheet, target.spellId)
  const [onSelf, setOnSelf] = useState(Boolean(toggle?.selfOnly))
  const [heal, setHeal] = useState('')
  const [tempHp, setTempHp] = useState('')
  const [tempHpChoice, setTempHpChoice] = useState<'keep' | 'replace' | null>(null)
  const [maxHp, setMaxHp] = useState('')
  const [response, setResponse] = useState<TapResponse | null>(null)
  const taps = useRef(0)

  if (!found || !spell || !chosen) return null
  const { list, entry } = found
  const castLevel = chosen.castLevel
  // O guia da magia no nível escolhido: a receita, o ganho do nível e o que pede um número da mesa.
  const guide = getSpellGuide(draft, state, { casterKey: list.kind === 'other' ? null : list.key, spellId: spell.id, castLevel }, rollGuide)

  // O que pede um número da mesa, com o alvo em você: a cura, os PV temporários e o PV máximo (a
  // Ajuda soma um valor fixo: sem campo).
  const fixedMaxHp = guide?.maxHpIncrease && !guide.maxHpIncrease.dice ? guide.maxHpIncrease.modifier : null
  const asks = { heal: Boolean(guide?.heal), tempHp: Boolean(guide?.tempHp), maxHp: Boolean(guide?.maxHpIncrease) && fixedMaxHp === null }
  const canTarget = Boolean(toggle || guide?.heal || guide?.tempHp || guide?.maxHpIncrease)
  const amounts = { heal: parseAmount(heal), tempHp: parseAmount(tempHp), maxHp: parseAmount(maxHp) }
  const missing = onSelf && ((asks.heal && amounts.heal === null) || (asks.tempHp && amounts.tempHp === null) || (asks.maxHp && amounts.maxHp === null))
  const choice = state.tempHp > 0 && amounts.tempHp !== null ? tempHpChoice ?? suggestTempHpChoice(state, amounts.tempHp) : undefined
  const self: SelfSpellResult | undefined = onSelf
    ? {
      ...(amounts.heal !== null && asks.heal ? { heal: amounts.heal } : {}),
      ...(amounts.tempHp !== null && asks.tempHp ? { tempHp: amounts.tempHp, ...(choice ? { tempHpChoice: choice } : {}) } : {}),
      ...(fixedMaxHp !== null ? { maxHpIncrease: fixedMaxHp } : amounts.maxHp !== null && asks.maxHp ? { maxHpIncrease: amounts.maxHp } : {}),
    }
    : undefined
  // O momento só conta ao conjurar (o começo da concentração): a prévia dos avisos não o usa.
  const input: SpellCast = { casterKey: list.key, spellId: spell.id, castLevel, pay: chosen.pay, now: 0, ...(self ? { self } : {}) }
  const preview = previewNotices(castSpell(state, sheet, input).notices)
  // A linha da prévia que o toque repetiu sai dela: fica só na região viva, sem o texto duas vezes.
  const previewLines = preview.lines.filter(line => line !== response?.text)
  const upcast = chosen.pay !== 'ritual' && castLevel > spell.level
    ? guide ? guide.upcastGain ?? null : (() => {
      const text = getHigherLevelsText(spell)
      return text ? `Em níveis superiores: ${text}` : null
    })()
    : null

  /** Escreve a resposta do toque na região viva (null a limpa); a cada toque, um parágrafo novo. */
  function respond(text: string | null) {
    taps.current += 1
    setResponse(text === null ? null : { text, id: taps.current })
  }

  function choose(option: SpellCastOption) {
    setChosenKey(optionKey(option))
    respond(null)
  }

  function confirm() {
    if (missing) {
      respond('Digite o que rolou, ou desmarque “Em você?”.')
      return
    }
    const result = run((st, sh) => castSpell(st, sh, { ...input, now: Date.now() }))
    const refused = result?.notices.find(n => n.kind === 'refused' || n.kind === 'unresolvedRule')
    if (!result || refused) {
      respond(refused?.text ?? null)
      return
    }
    onClose()
  }

  return (
    <PlayDialog title={spell.name} titleId="spell-cast-title" onClose={onClose}>
      <div className="mt-1 space-y-3">
        <div>
          <p className="text-xs text-parchment-500">
            {describeSpellKind(spell)} · {list.label}{entry.origin ? ` · ${entry.origin}` : ''}
          </p>
          <p className="text-xs text-parchment-400 leading-snug">
            {[spell.castingTime, spell.range, spell.components, describeSpellDuration(spell)].join(' · ')}
          </p>
        </div>

        {options.length > 1 ? (
          <fieldset className="space-y-0.5">
            <legend className="text-sm text-parchment-300">Como conjurar</legend>
            {options.map(o => (
              <label key={optionKey(o)} className="flex items-center gap-2 min-h-10 text-sm text-parchment-200 cursor-pointer">
                <input
                  type="radio"
                  name="spell-cast-pay"
                  checked={optionKey(o) === optionKey(chosen)}
                  onChange={() => choose(o)}
                  className="w-5 h-5 shrink-0 accent-gold-500"
                />
                {optionLabel(o, spell.level, list.label)}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="text-sm text-parchment-200">{optionLabel(chosen, spell.level, list.label)}</p>
        )}
        {upcast && <p className="text-xs text-parchment-300 leading-snug">{upcast}</p>}

        {guide && spellGuideRolls(guide).length > 0 && (
          <section aria-labelledby="spell-cast-recipe" className="rounded-lg border border-parchment-900 px-3 py-2">
            <h3 id="spell-cast-recipe" className="font-fantasy uppercase tracking-wider text-[11px] text-gold-500">O que rolar</h3>
            <SpellRecipe guide={guide} openRecipe={openRecipe} />
          </section>
        )}

        {canTarget && (
          <div className="space-y-1.5">
            {toggle?.selfOnly ? (
              <p className="text-sm text-parchment-200">Em você: o alcance é pessoal.</p>
            ) : (
              <label className="flex items-center gap-2 min-h-10 text-sm text-parchment-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onSelf}
                  onChange={e => {
                    setOnSelf(e.target.checked)
                    respond(null)
                  }}
                  className="w-5 h-5 shrink-0 accent-gold-500"
                />
                Em você?
              </label>
            )}
            {onSelf && toggle && (
              <p className="text-xs text-parchment-300 leading-snug">
                Fica em você: {toggle.label}, na seção Efeitos ativos{spell.concentration ? ', e acaba junto com a sua concentração' : ''}.
              </p>
            )}
            {onSelf && asks.heal && <AmountField id="spell-cast-heal" label="Cura que você rolou" value={heal} onChange={v => { setHeal(v); respond(null) }} />}
            {onSelf && asks.tempHp && (
              <AmountField id="spell-cast-temp-hp" label="PV temporários que você rolou" value={tempHp} onChange={v => { setTempHp(v); respond(null) }} />
            )}
            {onSelf && choice && amounts.tempHp !== null && (
              <fieldset className="space-y-0.5">
                <legend className="text-xs text-parchment-400">Já tem {state.tempHp} PV temporários, e eles não se somam (pág. 200):</legend>
                {([['keep', `Manter ${state.tempHp}`], ['replace', `Ficar com ${amounts.tempHp}`]] as const).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 min-h-10 text-sm text-parchment-200 cursor-pointer">
                    <input
                      type="radio"
                      name="spell-cast-temp-choice"
                      checked={choice === value}
                      onChange={() => setTempHpChoice(value)}
                      className="w-5 h-5 shrink-0 accent-gold-500"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
            {onSelf && asks.maxHp && <AmountField id="spell-cast-max-hp" label="Aumento do PV máximo" value={maxHp} onChange={v => { setMaxHp(v); respond(null) }} />}
            {onSelf && fixedMaxHp !== null && (
              <p className="text-xs text-parchment-300 leading-snug">O seu PV máximo e o atual sobem {fixedMaxHp}.</p>
            )}
          </div>
        )}

        {list.note && <p className="text-xs text-amber-200 leading-snug">{list.note}</p>}
        {entry.note && <p className="text-xs text-amber-200 leading-snug">{entry.note}</p>}
        <div className="space-y-1">
          {/* A prévia: texto comum, que o Conjurar descreve. Numa região viva, já viria com a folha. */}
          {previewLines.length > 0 && (
            <div id={PREVIEW_ID} className="space-y-1">
              {previewLines.map(line => (
                <p key={line} className={`text-xs leading-snug ${preview.refused ? 'text-red-300' : 'text-amber-200'}`}>{line}</p>
              ))}
            </div>
          )}
          {/* Montada vazia, só com a resposta do toque: o que entra nela é anunciado. */}
          <div aria-live="polite">
            {response && <p key={response.id} className="text-xs text-red-300 leading-snug">{response.text}</p>}
          </div>
        </div>
        <button
          onClick={confirm}
          aria-disabled={missing}
          aria-describedby={previewLines.length > 0 ? PREVIEW_ID : undefined}
          className="min-h-10 rounded-lg bg-gold-500 px-4 font-fantasy font-bold text-sm text-on-accent aria-disabled:opacity-40 hover:bg-gold-400 transition-colors"
        >
          Conjurar
        </button>
      </div>
    </PlayDialog>
  )
}
