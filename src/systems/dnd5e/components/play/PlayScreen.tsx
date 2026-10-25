import { useState } from 'react'
import { useCharacterStore } from '../../stores/characterStore'
import { PLAY_TABS, type PlayTabId } from './playTabs'
import { PlaySettings } from './PlaySettings'
import { formatPlaySubtitle, usePlayView, type PlayTabProps } from './usePlayView'
import { findRollGuideEntry, type RollGuideEntry } from '../../utils/rollGuide'
import { DeathSaves } from './DeathSaves'
import { HpPanel } from './HpPanel'
import { RollRecipeSheet } from './RollRecipeSheet'
import { VitalsBar } from './VitalsBar'

/**
 * Modo de jogo do D&D 5e: a ficha de UM personagem durante a sessão. Pensada para o celular
 * (360–430 px), numa coluna central no desktop. A ficha nunca muda aqui; tudo que a tela altera
 * passa pelo `run(op)` do playStore, que grava só o estado de jogo.
 *
 * Estrutura: cabeçalho → vitais fixos no topo → abas (`PLAY_TABS`, plugadas por componente).
 */
export function PlayScreen() {
  const view = usePlayView()
  const exitPlay = useCharacterStore(s => s.exitPlay)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState<PlayTabId>(PLAY_TABS[0].id)
  // A receita aberta. Guarda a entrada, mas mostra a versão atual do guia: se uma condição muda
  // com a folha aberta, o modo e as notas acompanham.
  const [recipe, setRecipe] = useState<RollGuideEntry | null>(null)

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

  const tabProps: PlayTabProps = { ...view, openRecipe: setRecipe }
  const current = PLAY_TABS.find(t => t.id === tab) ?? PLAY_TABS[0]
  const TabComponent = current.component
  const liveRecipe = recipe ? findRollGuideEntry(view.guide, recipe.id) ?? recipe : null

  return (
    <div className="min-h-screen bg-surface-base text-parchment-200">
      <div className="max-w-2xl mx-auto px-4 pb-32">
        <header className="pt-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={exitPlay}
              className="min-h-10 -ml-2 px-2 text-sm text-parchment-500 hover:text-parchment-200 transition-colors"
            >
              ← Personagens
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
          <h1 className="font-fantasy font-bold text-xl text-parchment-100 leading-tight truncate">
            {view.characterName || 'Personagem sem nome'}
          </h1>
          <p className="text-xs text-parchment-500 truncate">{formatPlaySubtitle(view.draft)}</p>
          {settingsOpen && <div className="mt-3"><PlaySettings /></div>}
        </header>

        <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-surface-base/95 backdrop-blur-sm border-b border-parchment-900">
          <VitalsBar view={view} onOpenRecipe={setRecipe} />
        </div>

        {/* A 0 PV os testes contra a morte tomam a frente; dano e cura continuam valendo
            (dano a 0 PV conta fracasso, cura acorda). Morto, só o "Fui revivido". */}
        <div className="mt-3 space-y-2">
          {view.state.lifeState !== 'conscious' && <DeathSaves view={view} />}
          {view.state.lifeState !== 'dead' && <HpPanel view={view} />}
        </div>

        <nav role="tablist" aria-label="Seções da ficha" className="mt-4 flex gap-1 overflow-x-auto border-b border-parchment-900">
          {PLAY_TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              id={`play-tab-${t.id}`}
              aria-selected={t.id === current.id}
              aria-controls="play-tab-panel"
              onClick={() => setTab(t.id)}
              className={[
                'min-h-10 px-3 shrink-0 whitespace-nowrap text-sm font-fantasy border-b-2 -mb-px transition-colors',
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
              <p className="mt-2 text-xs text-parchment-700">Em breve.</p>
            </div>
          )}
        </section>
      </div>

      {liveRecipe && (
        <RollRecipeSheet key={liveRecipe.id} entry={liveRecipe} appDice={view.appDice} onClose={() => setRecipe(null)} />
      )}
    </div>
  )
}
