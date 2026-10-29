import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { useCharacterStore } from '../../stores/characterStore'
import { adjacentPlayTab, keyboardPlayTab, PLAY_TABS, type PlayTabId } from './playTabs'
import { useTabSwipe } from './tabSwipe'
import { PlaySettings } from './PlaySettings'
import { formatPlaySubtitle, usePlayView, type PlayTabProps } from './usePlayView'
import { findRollGuideEntry, type RollGuideEntry } from '../../utils/rollGuide'
import { DeathSaves } from './DeathSaves'
import { HP_PANEL_ID, HpPanel } from './HpPanel'
import { NoticeToast, type NoticeToastHandle } from './NoticeToast'
import { usePlayStore } from '../../stores/playStore'
import { RollRecipeSheet, type RecipeLink } from './RollRecipeSheet'
import { VitalsBar } from './VitalsBar'
import { NumberSourceSheet } from './NumberSourceSheet'
import type { NumberSource } from './numberSources'
import { REST_SECTION_ID } from './StatusTab'
import { useWakeLock } from './wakeLock'

/** Folga de fundo sem aviso aberto (px): o fim da página não encosta na borda. */
const MIN_BOTTOM_GAP = 128

/** Folga (px) entre os vitais fixos e o título da seção para a qual a tela rola. */
const STICKY_GAP = 8

/** A classe (Tailwind) que o `<html>` leva enquanto o jogo está aberto: sem overscroll de lado. */
const NO_OVERSCROLL_X = 'overscroll-x-none'

/**
 * Modo de jogo do D&D 5e: a ficha de UM personagem durante a sessão. Pensada para o celular
 * (360–430 px), numa coluna central; do tablet (md) para cima a coluna alarga e as abas Testes,
 * Ataques, Magia e Regras abrem em mais colunas — abaixo do md, nada muda. A ficha nunca muda
 * aqui; tudo que a tela altera passa pelo `run(op)` do playStore, que grava só o estado de jogo.
 *
 * Estrutura: cabeçalho → vitais fixos no topo → abas (`PLAY_TABS`, plugadas por componente).
 */
export function PlayScreen() {
  const view = usePlayView()
  const exitPlay = useCharacterStore(s => s.exitPlay)
  const undo = usePlayStore(s => s.undo)
  const undoCount = usePlayStore(s => s.undoStack.length)
  const keepScreenOn = usePlayStore(s => s.prefs.keepScreenOn)
  // A tela não apaga sozinha enquanto a ficha está na mesa (preferência ligada por padrão).
  useWakeLock(keepScreenOn && view !== null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState<PlayTabId>(PLAY_TABS[0].id)
  // Altura do aviso preso ao pé da tela: vira folga de fundo, para ele não cobrir o fim da página.
  const [toastHeight, setToastHeight] = useState(0)
  // A receita aberta. Guarda a entrada, mas mostra a versão atual do guia: se uma condição muda
  // com a folha aberta, o modo e as notas acompanham. `crit`: dano aberto como acerto crítico.
  const [recipe, setRecipe] = useState<{ entry: RollGuideEntry; crit: boolean } | null>(null)
  const openRecipe = (entry: RollGuideEntry, options?: { crit?: boolean }) =>
    setRecipe({ entry, crit: options?.crit ?? false })
  // O "de onde vem" aberto de um número que não se rola (CA, CD de magia, Percepção passiva).
  const [source, setSource] = useState<NumberSource | null>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const toastRef = useRef<NoticeToastHandle>(null)

  /**
   * Rola até `el` ficar logo abaixo dos vitais fixos. Com `onlyIfCovered`, só se ele estiver atrás
   * dos vitais ou acima deles (quem já está à vista fica onde está).
   */
  function scrollBelowVitals(el: Element, { onlyIfCovered = false } = {}) {
    const rect = el.getBoundingClientRect()
    // Sem layout (o jsdom dos testes), nada a rolar.
    if (rect.height === 0) return
    const covered = stickyRef.current?.getBoundingClientRect().height ?? 0
    if (onlyIfCovered && rect.top >= covered) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollBy({ top: rect.top - covered - STICKY_GAP, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  // O "Descanso" dos vitais: abre a aba Estado e rola até os descansos, logo abaixo dos vitais
  // fixos, com o foco no primeiro botão (o teclado e o leitor de tela chegam junto).
  function openRests() {
    flushSync(() => setTab('status'))
    const section = document.getElementById(REST_SECTION_ID)
    if (!section) return
    section.querySelector('button')?.focus({ preventScroll: true })
    scrollBelowVitals(section)
  }

  // Os testes contra a morte saem da tela pelo próprio botão (o 20 natural, "recuperei 1 PV", "Fui
  // revivido"): o foco vai ao painel de PV, que fica no lugar deles.
  function focusHpPanel() {
    document.getElementById(HP_PANEL_ID)?.querySelector('button')?.focus()
  }

  // Deslizar o dedo de lado no conteúdo vai à aba vizinha, com o foco nela, como o toque na barra.
  // Rolado lá para baixo, a tela volta até a barra de abas: vê-se que aba abriu e o começo dela.
  const swipe = useTabSwipe(direction => {
    const next = adjacentPlayTab(tab, direction)
    if (!next) return
    flushSync(() => setTab(next))
    const tabButton = document.getElementById(`play-tab-${next}`)
    tabButton?.focus({ preventScroll: true })
    if (tabButton) scrollBelowVitals(tabButton, { onlyIfCovered: true })
  })

  // Teclado na barra (padrão de abas da WAI-ARIA, com ativação automática): só a aba aberta entra
  // no Tab, e a aba a que as setas, o Home ou o End levam já abre, com o foco nela.
  function handleTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const next = keyboardPlayTab(tab, e.key)
    if (!next) return
    e.preventDefault()
    flushSync(() => setTab(next))
    document.getElementById(`play-tab-${next}`)?.focus()
  }

  // No celular, trocar de app pode descartar a aba sem aviso: o que está sendo digitado (nota da
  // sessão, nota de duração) grava assim que a página some.
  useEffect(() => {
    const flush = () => usePlayStore.getState().flushPendingEdits()
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // O arrasto de lado nunca vira o "voltar página" do Chrome no celular, que tirava da mesa (e da
  // pilha do desfazer, que é só da sessão). O touch-action da raiz não basta: quem rola (a faixa de
  // chips, a lista do aviso, as folhas) volta a aceitar o arrasto de lado, e o excesso dele chega à
  // página. Por isso, enquanto o jogo está aberto, a página não tem overscroll horizontal.
  useEffect(() => {
    const root = document.documentElement
    root.classList.add(NO_OVERSCROLL_X)
    return () => root.classList.remove(NO_OVERSCROLL_X)
  }, [])

  // Os vitais fixos cobrem o topo da tela: o que recebe o foco (o Tab, ou o título para onde vai o
  // foco de um controle que sumiu) e está acima da vista para logo abaixo deles, nunca atrás. O
  // scroll-padding do `<html>` acompanha a altura dos vitais; o navegador o respeita ao rolar até
  // o foco.
  const hasView = view !== null
  useEffect(() => {
    const sticky = stickyRef.current
    if (!sticky) return
    const root = document.documentElement
    const update = () => { root.style.scrollPaddingTop = `${Math.ceil(sticky.getBoundingClientRect().height) + STICKY_GAP}px` }
    update()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(sticky)
    return () => {
      observer?.disconnect()
      root.style.scrollPaddingTop = ''
    }
  }, [hasView])

  if (!view) {
    return (
      <div className="min-h-screen bg-surface-base px-4 py-10 text-center">
        <p className="text-parchment-500">Nenhuma ficha aberta no modo de jogo.</p>
        <button onClick={exitPlay} className="mt-4 min-h-10 px-4 text-sm text-gold-400 hover:text-gold-300">
          ← Personagens
        </button>
      </div>
    )
  }

  const tabProps: PlayTabProps = { ...view, openRecipe, openSource: setSource }
  const current = PLAY_TABS.find(t => t.id === tab) ?? PLAY_TABS[0]
  const TabComponent = current.component
  // A aba aberta dá nome ao painel: sem rolar a tela, o Tab seguinte entra no conteúdo dela.
  const focusOpenTab = () => document.getElementById(`play-tab-${current.id}`)?.focus({ preventScroll: true })
  // A folha da receita fechou, e quem a abriu sumiu com a ação dela (o "Falhei: encerrar" troca o
  // aviso de concentração, e o "Ver o que rolar" vai junto): o foco vai ao aviso que ficou ou, sem
  // aviso, à aba aberta, como depois do botão do próprio aviso.
  const focusAfterSheet = () => {
    if (!toastRef.current?.focus()) focusOpenTab()
  }
  const liveRecipe = recipe ? findRollGuideEntry(view.guide, recipe.entry.id) ?? recipe.entry : null
  // Da folha de um ataque, o dano (e o dano a duas mãos) a um toque.
  const attackRow = liveRecipe ? view.guide.attacks.find(a => a.attack.id === liveRecipe.id) : undefined
  const recipeLinks: RecipeLink[] = attackRow
    ? [
      ...(attackRow.damage ? [{ label: 'Dano', entry: attackRow.damage }] : []),
      ...(attackRow.versatile ? [{ label: 'Dano a duas mãos', entry: attackRow.versatile }] : []),
    ]
    : []

  // A tela inteira (cabeçalho, vitais, painel de PV, aviso do pé, folhas) deixa ao navegador só a
  // rolagem vertical e a pinça, não só a área das abas. A faixa de chips, que rola de lado, continua
  // rolando: o touch-action recomeça em cada contêiner que rola.
  return (
    <div className="min-h-screen bg-surface-base text-parchment-200 touch-pan-y touch-pinch-zoom">
      <div className="max-w-2xl md:max-w-3xl lg:max-w-5xl mx-auto px-4">
        <header className="pt-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={exitPlay}
              className="min-h-10 -ml-2 px-2 text-sm text-parchment-500 hover:text-parchment-200 transition-colors"
            >
              ← Personagens
            </button>
            <div className="flex items-center gap-1">
              {/* aria-disabled, não disabled: o desfazer que esvazia a pilha apagaria o botão com o
                  foco nele, que cairia no body. Sem passo a desfazer, o `undo` não faz nada. */}
              <button
                onClick={undo}
                aria-disabled={undoCount === 0}
                aria-label="Desfazer a última mudança"
                title="Desfazer a última mudança"
                className="w-10 h-10 flex items-center justify-center rounded-lg text-parchment-500 hover:text-parchment-200 aria-disabled:opacity-30 aria-disabled:hover:text-parchment-500 transition-colors"
              >
                ↶
              </button>
              <button
                onClick={() => setSettingsOpen(o => !o)}
                aria-label="Configurações do modo de jogo"
                aria-expanded={settingsOpen}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-parchment-500 hover:text-parchment-200 transition-colors"
              >
                ⚙
              </button>
            </div>
          </div>
          <h1 className="font-fantasy font-bold text-xl text-parchment-100 leading-tight truncate">
            {view.characterName || 'Personagem sem nome'}
          </h1>
          <p className="text-xs text-parchment-500 line-clamp-2">{formatPlaySubtitle(view.draft)}</p>
          {settingsOpen && <div className="mt-3"><PlaySettings /></div>}
        </header>

        <div ref={stickyRef} className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-surface-base/95 backdrop-blur-sm border-b border-parchment-900">
          <VitalsBar view={view} onOpenRecipe={openRecipe} onOpenSource={setSource} onOpenRests={openRests} />
        </div>

        {/* A 0 PV os testes contra a morte tomam a frente; dano e cura continuam valendo
            (dano a 0 PV conta fracasso, cura acorda). Morto, só o "Fui revivido". */}
        <div className="mt-3 space-y-2">
          {view.state.lifeState !== 'conscious' && (
            <DeathSaves view={view} bottomInset={toastHeight} onLeave={focusHpPanel} />
          )}
          {view.state.lifeState !== 'dead' && <HpPanel view={view} />}
        </div>

        {/* A área do gesto de trocar de aba: a barra, o conteúdo e a folga de fundo (deslizar no
            vazio abaixo de uma aba curta também troca). O arrasto de lado aqui é da troca de aba;
            o "voltar página" do navegador já está fora da tela toda (raiz e `NO_OVERSCROLL_X`). */}
        <div {...swipe} style={{ paddingBottom: Math.max(MIN_BOTTOM_GAP, Math.ceil(toastHeight) + 16) }}>
          {/* No celular as abas dividem a largura em partes iguais, sem recuo lateral: as seis cabem
              em 360 px ("Ataques", a mais larga, ocupa ~51 dos 54 px), sem rolagem escondida. */}
          <nav
            role="tablist"
            aria-label="Seções da ficha"
            className="mt-4 grid sm:flex sm:gap-1 border-b border-parchment-900"
            style={{ gridTemplateColumns: `repeat(${PLAY_TABS.length}, minmax(0, 1fr))` }}
          >
            {PLAY_TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                id={`play-tab-${t.id}`}
                aria-selected={t.id === current.id}
                aria-controls="play-tab-panel"
                tabIndex={t.id === current.id ? 0 : -1}
                title={t.hint}
                onClick={() => setTab(t.id)}
                onKeyDown={handleTabKey}
                className={[
                  'min-h-10 min-w-0 px-0 sm:px-3 text-[0.66rem] sm:text-sm font-fantasy border-b-2 -mb-px transition-colors',
                  t.id === current.id
                    ? 'border-gold-500 text-gold-300'
                    : 'border-transparent text-parchment-500 hover:text-parchment-200',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <section id="play-tab-panel" role="tabpanel" aria-labelledby={`play-tab-${current.id}`} className="pt-4">
            {TabComponent ? <TabComponent {...tabProps} /> : (
              <div className="rounded-xl border border-dashed border-parchment-800 p-6 text-center">
                <p className="font-fantasy text-parchment-300">{current.label}</p>
                <p className="mt-1 text-xs text-parchment-600">{current.hint}</p>
                <p className="mt-2 text-xs text-parchment-600">Em breve.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* O aviso fechado pelo próprio botão ("Desfazer", "OK") devolve o foco à aba aberta. */}
      <NoticeToast
        ref={toastRef}
        view={view}
        onOpenRecipe={openRecipe}
        onHeightChange={setToastHeight}
        onFocusAway={focusOpenTab}
      />

      {liveRecipe && recipe && (
        <RollRecipeSheet
          key={`${liveRecipe.id}:${recipe.crit}`}
          entry={liveRecipe}
          appDice={view.appDice}
          onClose={() => setRecipe(null)}
          onFocusAway={focusAfterSheet}
          crit={recipe.crit}
          links={recipeLinks}
          critThreshold={attackRow?.critThreshold}
          onOpenLink={openRecipe}
        />
      )}
      {source && <NumberSourceSheet source={source} onClose={() => setSource(null)} />}
    </div>
  )
}
