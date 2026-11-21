import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { CoinId, PlayResult } from '@rpg/rules/systems/dnd5e/types/playState'
import {
  COINS, describeCarryingCapacity, describeOverload, formatBagQuantity, formatCoinPurse, formatKg, getBagCatalog,
  getBagItems, getCarriedWeight, getCoins, getItemUseGuide, isBagAdjustable, type BagEntry,
} from '@rpg/rules/systems/dnd5e/utils/inventoryPlay'
import {
  addCustomItem, adjustCoins, adjustCustomItem, adjustItem, recoverAmmo, spendAmmo,
  // "use…" no nome engana a regra dos hooks: é a operação pura da bolsa.
  useItem as applyItemUse,
} from '@rpg/rules/systems/dnd5e/utils/playState'
import { ChangeAnnouncer } from './ChangeAnnouncer'
import { rollButtonLabel } from './playFormat'
import type { PlayTabProps } from './usePlayView'

/** A seção da bolsa, na aba Estado (decisão de 2026-10-30: seis abas); o Usar um Objeto leva a ela. */
export const BAG_SECTION_ID = 'play-bag'

const refused = (result: PlayResult | null) => !result || result.notices.some(n => n.kind === 'refused')

const SMALL_BUTTON = 'min-h-10 min-w-10 rounded-lg border border-parchment-700 px-3 text-sm text-parchment-200 hover:border-gold-600'

/** O que a região viva fala: as moedas e as quantidades, que mudam só no número. */
function describeBag(items: BagEntry[], purse: string, custom: { name: string; quantity: number }[]): string {
  return [
    `Moedas: ${purse}.`,
    ...items.map(i => `${i.name}: ${formatBagQuantity(i, i.quantity)}.`),
    ...custom.map(i => `${i.name}: ×${i.quantity}.`),
  ].join(' ')
}

/** Ganhar ou gastar moedas de um tipo, numa conta só (15 po de uma vez, e não 15 toques). */
function CoinsForm({ view }: { view: PlayTabProps }) {
  const [amount, setAmount] = useState('')
  const [coin, setCoin] = useState<CoinId>('gp')
  const value = Number(amount)
  const valid = Number.isInteger(value) && value > 0
  function submit(sign: 1 | -1) {
    if (!valid) return
    const result = view.run((st, sh) => adjustCoins(st, sh, coin, sign * value))
    if (!refused(result)) setAmount('')
  }
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    submit(-1)
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2" aria-label="Moedas">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={amount}
        onChange={e => setAmount(e.target.value)}
        aria-label="Quantas moedas"
        className="min-h-10 w-20 rounded-lg border border-parchment-700 bg-transparent px-2 text-sm text-parchment-100"
      />
      <select
        value={coin}
        onChange={e => setCoin(e.target.value as CoinId)}
        aria-label="Tipo de moeda"
        className="min-h-10 rounded-lg border border-parchment-700 bg-surface-raised px-2 text-sm text-parchment-100"
      >
        {COINS.map(c => <option key={c.id} value={c.id}>{c.abbr} ({c.name})</option>)}
      </select>
      <button type="submit" disabled={!valid} className={`${SMALL_BUTTON} disabled:opacity-40`}>Gastar</button>
      <button type="button" disabled={!valid} onClick={() => submit(1)} className={`${SMALL_BUTTON} disabled:opacity-40`}>Receber</button>
    </form>
  )
}

/**
 * O "Usar" de um item, aberto embaixo dele: a receita (a cura da poção, o dano do ácido), o texto do
 * livro e o toque que gasta. A cura em você pede o número que a mesa rolou (decisão da Fase 2, como
 * no Dado de Vida); em outra criatura, a cura e o efeito são dela, e só a peça sai da bolsa.
 */
function UseItemPanel({ item, view, onDone }: { item: BagEntry; view: PlayTabProps; onDone: (usedLast: boolean) => void }) {
  const guide = getItemUseGuide(item.id)
  const [heal, setHeal] = useState('')
  const outcomes = item.use?.outcomes ?? []
  const healing = outcomes.some(o => o.kind === 'heal')
  const onSelf = healing || outcomes.some(o => o.kind === 'toggleOn')
  const healValue = Number(heal)
  function use(self: boolean) {
    const result = view.run((st, sh) => applyItemUse(st, sh, item.id, {
      now: Date.now(),
      self,
      ...(self && healing ? { heal: healValue } : {}),
    }))
    if (!refused(result)) onDone(item.quantity === 1)
  }
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-parchment-800 p-2">
      {item.use && <p className="text-xs text-parchment-300 leading-snug">{item.use.summary} (pág. {item.use.page})</p>}
      {guide && (guide.heal || guide.damage.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {[guide.heal, ...guide.damage].filter(e => e !== null).map(entry => (
            <button
              key={entry.id}
              onClick={() => view.openRecipe(entry)}
              aria-label={rollButtonLabel(entry)}
              className="min-h-10 rounded-lg border border-parchment-800 px-3 text-sm text-parchment-100 hover:border-gold-700"
            >
              {entry.label}: {entry.formula}
            </button>
          ))}
        </div>
      )}
      {guide?.lines.map(line => <p key={line} className="text-xs text-parchment-400 leading-snug">{line}</p>)}
      {healing && (
        <label className="flex items-center gap-2 text-xs text-parchment-300">
          Quanto curou
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={heal}
            onChange={e => setHeal(e.target.value)}
            className="min-h-10 w-20 rounded-lg border border-parchment-700 bg-transparent px-2 text-sm text-parchment-100"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {onSelf ? (
          <>
            <button
              onClick={() => use(true)}
              disabled={healing && !(Number.isInteger(healValue) && healValue > 0)}
              className={`${SMALL_BUTTON} disabled:opacity-40`}
            >
              Usar em mim
            </button>
            <button onClick={() => use(false)} className={SMALL_BUTTON}>Usar em outra criatura</button>
          </>
        ) : (
          <button onClick={() => use(false)} className={SMALL_BUTTON}>Usar {item.name}</button>
        )}
        <button onClick={() => onDone(false)} className="min-h-10 px-3 text-sm text-parchment-500">Cancelar</button>
      </div>
    </div>
  )
}

/** Um item da bolsa: o nome, quantos há e os toques dele (−/+, a munição, o Usar). */
function BagItemRow({ item, view }: { item: BagEntry; view: PlayTabProps }) {
  const [open, setOpen] = useState(false)
  const useButton = useRef<HTMLButtonElement>(null)
  const minusRef = useRef<HTMLButtonElement>(null)
  const plusRef = useRef<HTMLButtonElement>(null)
  const ammo = item.category === 'ammunition'
  const adjustable = isBagAdjustable(view.sheet, item.id)
  const recoverable = Math.floor(item.spent / 2)

  function closeUse(usedLast: boolean) {
    flushSync(() => setOpen(false))
    // Gasta a última peça, o Usar some: o foco vai ao +1, que fica.
    ;(usedLast ? plusRef.current : useButton.current)?.focus()
  }
  function recover() {
    flushSync(() => view.run((st, sh) => recoverAmmo(st, sh, item.id)))
    minusRef.current?.focus()
  }

  return (
    <li data-testid={`bag-${item.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 text-sm text-parchment-100">
          {item.name} <span className="text-parchment-400">{formatBagQuantity(item, item.quantity)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {item.use && item.quantity > 0 && (
            <button
              ref={useButton}
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              className={SMALL_BUTTON}
            >
              Usar
            </button>
          )}
          {(adjustable || ammo) && (
            <button
              ref={minusRef}
              onClick={() => view.run((st, sh) => (ammo ? spendAmmo(st, sh, item.id) : adjustItem(st, sh, item.id, -1)))}
              aria-label={`Tirar 1 de ${item.name}`}
              className={`${SMALL_BUTTON} disabled:opacity-40`}
            >
              −1
            </button>
          )}
          {adjustable && (
            <button
              ref={plusRef}
              onClick={() => view.run((st, sh) => adjustItem(st, sh, item.id, 1))}
              aria-label={`Pôr 1 de ${item.name}`}
              className={SMALL_BUTTON}
            >
              +1
            </button>
          )}
          {ammo && recoverable > 0 && (
            <button onClick={recover} className={SMALL_BUTTON}>Recuperar metade ({recoverable})</button>
          )}
        </span>
      </div>
      {open && <UseItemPanel item={item} view={view} onDone={closeUse} />}
    </li>
  )
}

/** Pôr na bolsa: um item do catálogo (consumível, munição, item geral) ou um de texto livre. */
function AddItemForm({ view }: { view: PlayTabProps }) {
  const catalog = getBagCatalog()
  const [itemId, setItemId] = useState('')
  const [name, setName] = useState('')
  function addCatalog(e: FormEvent) {
    e.preventDefault()
    if (!itemId) return
    if (!refused(view.run((st, sh) => adjustItem(st, sh, itemId, 1)))) setItemId('')
  }
  function addCustom(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (!refused(view.run(st => addCustomItem(st, name)))) setName('')
  }
  return (
    <div className="space-y-2">
      <form onSubmit={addCatalog} className="flex flex-wrap items-center gap-2">
        <select
          value={itemId}
          onChange={e => setItemId(e.target.value)}
          aria-label="Item do livro"
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-parchment-700 bg-surface-raised px-2 text-sm text-parchment-100"
        >
          <option value="">Item do livro…</option>
          {catalog.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <button type="submit" disabled={!itemId} className={`${SMALL_BUTTON} disabled:opacity-40`}>Pôr na bolsa</button>
      </form>
      <form onSubmit={addCustom} className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Outro item (sem regra)"
          aria-label="Outro item, sem regra"
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-parchment-700 bg-transparent px-2 text-sm text-parchment-100"
        />
        <button type="submit" disabled={!name.trim()} className={`${SMALL_BUTTON} disabled:opacity-40`}>Pôr na bolsa</button>
      </form>
    </div>
  )
}

/**
 * Bolsa (Fase 2, onda `inventario`; `docs/regras-equipamentos.md`, seção 6): as moedas, os itens da
 * ficha com o que mudou no jogo (`getBagItems`: deltas sobre o inventário da ficha, nunca a ficha), a
 * munição com o "Recuperar metade", os consumíveis com o Usar e o peso contra a capacidade de carga,
 * só com aviso. Cada toque é uma operação do playStore, um passo do desfazer.
 *
 * Foco (as regras do CLAUDE.md): o −1 e o +1 ficam; o "Recuperar metade" some com o toque e leva o
 * foco ao −1; o Usar que acaba com a última peça leva o foco ao +1 do item. O −1 a 0 continua ativo: o motor recusa
 * e diz por quê (apagado, o botão perderia o foco).
 */
export function BagSection({ titleRef, ...view }: PlayTabProps & { titleRef: RefObject<HTMLHeadingElement | null> }) {
  const { state, sheet, run } = view
  const items = getBagItems(state, sheet)
  const purse = formatCoinPurse(getCoins(state, sheet))
  const custom = state.inventory.customItems
  const overload = describeOverload(state, sheet)

  function adjustCustom(name: string, change: number, last: boolean) {
    flushSync(() => run(st => adjustCustomItem(st, name, change)))
    if (last) titleRef.current?.focus()
  }

  return (
    <div className="space-y-3">
      <ChangeAnnouncer text={describeBag(items, purse, custom)} />
      <div className="space-y-2">
        <p className="text-sm text-parchment-200" data-testid="bag-coins">Moedas: {purse}</p>
        <CoinsForm view={view} />
      </div>
      {(items.length > 0 || custom.length > 0) && (
        <ul className="space-y-2">
          {items.map(item => <BagItemRow key={item.id} item={item} view={view} />)}
          {custom.map(item => (
            <li key={item.name} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="text-sm text-parchment-100">{item.name} <span className="text-parchment-400">×{item.quantity}</span></span>
              <span className="flex gap-1.5">
                <button onClick={() => adjustCustom(item.name, -1, item.quantity === 1)} aria-label={`Tirar 1 de ${item.name}`} className={SMALL_BUTTON}>−1</button>
                <button onClick={() => adjustCustom(item.name, 1, false)} aria-label={`Pôr 1 de ${item.name}`} className={SMALL_BUTTON}>+1</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <AddItemForm view={view} />
      <p className="text-xs text-parchment-400 leading-snug" data-testid="bag-weight">
        Peso: {formatKg(getCarriedWeight(state, sheet))} de {describeCarryingCapacity(sheet.carryingCapacity)}.
      </p>
      {overload && <p className="text-xs text-amber-200 leading-snug">{overload}</p>}
      <p className="text-[11px] text-parchment-600 leading-snug">Arma e armadura novas entram pelo criador.</p>
    </div>
  )
}
