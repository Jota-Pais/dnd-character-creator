import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { SheetToggle } from '@rpg/rules/systems/dnd5e/types/session'
import { describeToggleEffects, resolveActiveEffects } from '@rpg/rules/systems/dnd5e/utils/activeEffects'
import { activateToggle, getPlaySpeed } from '@rpg/rules/systems/dnd5e/utils/playState'
import { describeSpellBrief, getReceivableToggles } from './effectToggles'
import { PlayDialog } from './PlayDialog'
import type { PlayTabProps } from './usePlayView'

/** O nome para a busca: sem acento e sem diferença de maiúscula ("bencao" acha a Bênção). */
const searchable = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * O que a magia faz em quem a recebe, nas mesmas linhas da seção Efeitos ativos
 * (`describeToggleEffects`), como se estivesse ligada agora.
 */
function previewLines(view: PlayTabProps, toggle: SheetToggle): string[] {
  const [resolved] = resolveActiveEffects([{ id: toggle.id, startedAt: 0 }], [toggle])
  return resolved ? describeToggleEffects(view.draft, resolved, getPlaySpeed(view.state, view.sheet), view.session) : []
}

/**
 * Só a de concentração que a ficha conhece pergunta quem conjurou: quem não a conhece não a conjurou
 * em si, e a de alcance Pessoal (o Auxílio Divino) é sempre sua.
 */
const asksCaster = (toggle: SheetToggle) => Boolean(toggle.concentration && !toggle.selfOnly && toggle.known)

/**
 * "Recebeu uma magia?": o catálogo das magias que se marcam em você (a Bênção de um aliado, a sua
 * Armadura Arcana), com busca pelo nome. As de alcance Pessoal só aparecem para quem as conhece
 * (`getCatalogToggles`). O toque na magia já a marca — o aviso do aliado ("você está abençoado")
 * vira o número em dois toques (o aceite do desenho), e o cartão da seção diz o que ela faz e quando
 * acaba. Só a que pede escolha abre o detalhe: na de concentração que a ficha conhece, a folha diz o
 * que muda e pergunta quem conjurou, porque quem conjura é quem mantém a concentração — a do aliado
 * só sai à mão ("Já acabou"), a sua começa a sua concentração nela e acaba junto com ela
 * (`sustainedByConcentration`).
 *
 * Foco (as regras do CLAUDE.md): marcar fecha a folha, e o foco volta ao "Recebeu uma magia?"; a
 * magia que pede escolha troca a lista pelo detalhe, e o foco vai ao título dele; "Outra magia"
 * volta à lista, com o foco na magia de antes; recusado (em fúria não se concentra), o aviso diz por
 * quê numa região viva da folha e o foco fica. Nunca num campo de texto, que abriria o teclado do
 * celular.
 */
export function ReceivedEffectSheet({ view, onClose }: { view: PlayTabProps; onClose: () => void }) {
  const { state, sheet, run } = view
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [castBySelf, setCastBySelf] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const detailTitleRef = useRef<HTMLHeadingElement>(null)
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const all = getReceivableToggles(sheet)
  const found = all.filter(t => searchable(t.source).includes(searchable(query.trim())))
  const toggle = selected ? all.find(t => t.id === selected) : undefined

  function choose(chosen: SheetToggle) {
    if (!asksCaster(chosen)) {
      mark(chosen, false)
      return
    }
    flushSync(() => {
      setSelected(chosen.id)
      setCastBySelf(false)
      setRefusal(null)
    })
    detailTitleRef.current?.focus()
  }

  function backToList() {
    const id = selected
    flushSync(() => {
      setSelected(null)
      setRefusal(null)
    })
    if (id) itemRefs.current[id]?.focus()
  }

  function chooseCaster(self: boolean) {
    setCastBySelf(self)
    setRefusal(null)
  }

  function mark(marked: SheetToggle, self: boolean) {
    const result = flushSync(() => run((st, sh) => activateToggle(st, sh, marked.id, {
      now: Date.now(), ...(self && marked.concentration ? { sustainedByConcentration: true as const } : {}),
    })))
    if (result?.state.activeEffects.some(a => a.id === marked.id)) onClose()
    // O aviso do pé fica atrás da folha: a recusa se lê aqui.
    else setRefusal(result?.notices.find(n => n.kind === 'refused')?.text ?? null)
  }

  return (
    <PlayDialog title="Recebeu uma magia?" titleId="received-effect-title" onClose={onClose}>
      {toggle ? (
        <div className="mt-2 space-y-3">
          <div>
            <h3 ref={detailTitleRef} tabIndex={-1} className="font-fantasy text-lg text-parchment-100">{toggle.source}</h3>
            <p className="text-xs text-parchment-500">{describeSpellBrief(toggle)} · pág. {toggle.page}</p>
          </div>
          <ul className="space-y-0.5">
            {previewLines(view, toggle).map(line => (
              <li key={line} className="text-sm text-parchment-200 leading-snug">{line}</li>
            ))}
          </ul>
          {toggle.benefits.find(b => b.blockedBy) && (
            <p className="text-xs text-red-200 leading-snug">
              Sem os benefícios: você está de {toggle.benefits.find(b => b.blockedBy)?.blockedBy}.
            </p>
          )}
          {/* O detalhe só abre para a de concentração que a ficha conhece (`asksCaster`): a pergunta é dela. */}
          <fieldset className="space-y-1">
            <legend className="text-sm text-parchment-300">Quem conjurou?</legend>
            {[
              { self: false, label: 'Outra pessoa conjurou em mim' },
              { self: true, label: 'Eu conjurei em mim' },
            ].map(o => (
              <label key={String(o.self)} className="flex items-center gap-2 min-h-10 text-sm text-parchment-200 cursor-pointer">
                <input
                  type="radio"
                  name="received-caster"
                  checked={castBySelf === o.self}
                  onChange={() => chooseCaster(o.self)}
                  className="w-5 h-5 shrink-0 accent-gold-500"
                />
                {o.label}
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-amber-200 leading-snug">
            {castBySelf
              ? `Começa a sua concentração em ${toggle.source}, e a magia acaba junto com ela. O espaço de magia se marca na aba Magia.`
              : 'Quem conjurou é quem mantém a concentração: quando ela acabar, toque em “Já acabou” na seção Efeitos ativos.'}
          </p>
          {/* Montada vazia: a recusa que entra nela é anunciada. */}
          <div aria-live="polite">
            {refusal && <p className="text-xs text-red-300 leading-snug">{refusal}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => mark(toggle, castBySelf)}
              className="min-h-10 rounded-lg bg-gold-500 px-4 font-fantasy font-bold text-sm text-on-accent hover:bg-gold-400 transition-colors"
            >
              Marcar em mim
            </button>
            <button
              onClick={backToList}
              className="min-h-10 rounded-lg border border-parchment-800 px-3 text-sm text-parchment-300 hover:border-parchment-600"
            >
              ← Outra magia
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-parchment-400 leading-snug">
            Toque na magia que está em você, e os números da ficha já mudam. Quem conjurou mantém a concentração: se você conhece a magia, a folha pergunta antes quem foi. As de alcance Pessoal só aparecem para quem as conhece.
          </p>
          <input
            type="search"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setRefusal(null)
            }}
            aria-label="Buscar a magia pelo nome"
            placeholder="Buscar pelo nome"
            className="min-h-10 w-full rounded-lg border border-parchment-800 bg-surface-base px-3 text-sm text-parchment-100 outline-none focus:border-gold-600"
          />
          {/* A região viva existe antes do aviso: inserida já com o texto, pode não ser anunciada. A
              recusa do toque que marca (o Auxílio Divino de quem está Atordoado) também sai aqui, e o
              foco fica na magia. */}
          <div aria-live="polite">
            {found.length === 0 && <p className="text-xs text-parchment-400">Nenhuma magia do catálogo com esse nome.</p>}
            {refusal && <p className="text-xs text-red-300 leading-snug">{refusal}</p>}
          </div>
          <ul className="space-y-1.5">
            {found.map(t => {
              const on = state.activeEffects.some(a => a.id === t.id)
              return (
                <li key={t.id}>
                  {on ? (
                    <p className="min-h-10 flex flex-col justify-center rounded-lg border border-parchment-900 px-3 py-1.5">
                      <span className="text-sm text-parchment-400">{t.source} · já está em você</span>
                    </p>
                  ) : (
                    <button
                      ref={el => { itemRefs.current[t.id] = el }}
                      onClick={() => choose(t)}
                      className="w-full min-h-10 flex flex-col items-start justify-center rounded-lg border border-parchment-800 px-3 py-1.5 text-left hover:border-gold-700"
                    >
                      <span className="text-sm text-parchment-100">{t.source}</span>
                      <span className="text-[11px] text-parchment-500">{describeSpellBrief(t)}</span>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </PlayDialog>
  )
}
