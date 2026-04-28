import { useState } from 'react'
import { useCharacterStore } from '../../stores/characterStore'
import {
  BACKGROUNDS,
  BACKGROUND_PRESENTATION,
  getBackground,
  getSkillName,
  getToolName,
  isBackgroundStepComplete,
} from '../../utils/backgroundUtils'
import { BackgroundCard } from '../background/BackgroundCard'
import { BackgroundChoicePanel } from '../background/BackgroundChoicePanel'

export function BackgroundStep() {
  const draft = useCharacterStore(state => state.draft)
  const setBackground = useCharacterStore(state => state.setBackground)
  const updateBackgroundChoices = useCharacterStore(state => state.updateBackgroundChoices)
  const nextStep = useCharacterStore(state => state.nextStep)
  const prevStep = useCharacterStore(state => state.prevStep)

  const [panelOpen, setPanelOpen] = useState(false)

  const selectedBg = draft.background ? getBackground(draft.background) : undefined
  const accent = selectedBg
    ? (BACKGROUND_PRESENTATION[selectedBg.id]?.accent ?? '#d4900a')
    : '#d4900a'

  const canAdvance = isBackgroundStepComplete(selectedBg ?? null, draft.backgroundChoices)

  function handleSelect(id: string) {
    setBackground(id)
    setPanelOpen(true)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* ── Grade de antecedentes ── */}
      <div className="lg:w-1/2 xl:w-3/5">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1">
          De onde você vem?
        </h2>
        <p className="text-parchment-500 text-sm mb-5">
          Seu antecedente descreve de onde você veio, o que fez antes de se tornar aventureiro e seu lugar no mundo.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BACKGROUNDS.map(bg => (
            <BackgroundCard
              key={bg.id}
              background={bg}
              selected={draft.background === bg.id}
              onSelect={() => handleSelect(bg.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Painel de detalhes ── */}
      <div className="lg:w-1/2 xl:w-2/5">
        {selectedBg ? (
          <div className="sticky top-4 space-y-4">

            {/* Cabeçalho */}
            <div
              className="rounded-2xl border-2 p-5"
              style={{
                borderColor: `${accent}50`,
                backgroundColor: `${accent}08`,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">
                    {BACKGROUND_PRESENTATION[selectedBg.id]?.emoji ?? '📜'}
                  </span>
                  <h3 className="font-fantasy text-xl font-bold" style={{ color: accent }}>
                    {selectedBg.name}
                  </h3>
                </div>
                <button
                  className="text-parchment-600 hover:text-parchment-300 text-xs lg:hidden"
                  onClick={() => setPanelOpen(!panelOpen)}
                >
                  {panelOpen ? 'Recolher ▲' : 'Detalhes ▼'}
                </button>
              </div>
              <p className="text-parchment-400 text-sm mt-2 leading-relaxed">
                {selectedBg.description}
              </p>
            </div>

            <div className={(panelOpen ? 'flex' : 'hidden') + ' lg:flex flex-col gap-4'}>

              {/* Proficiências */}
              <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                <SectionTitle>Proficiências</SectionTitle>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-parchment-700">Perícias</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedBg.skillProficiencies.map(skill => (
                        <span
                          key={skill}
                          className="text-xs px-2 py-0.5 rounded-md font-fantasy"
                          style={{ backgroundColor: `${accent}18`, color: accent }}
                        >
                          {getSkillName(skill)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {selectedBg.toolProficiencies.length > 0 && (
                    <div>
                      <span className="text-xs text-parchment-700">Ferramentas concedidas</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {selectedBg.toolProficiencies.map(tool => (
                          <span
                            key={tool}
                            className="text-xs px-2 py-0.5 rounded-md text-parchment-400 border border-parchment-800"
                          >
                            {getToolName(tool)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Feature */}
              <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                <SectionTitle>Feature de Antecedente</SectionTitle>
                <p className="text-sm font-semibold text-parchment-200 font-fantasy mb-1">
                  {selectedBg.feature.name}
                </p>
                <p className="text-sm text-parchment-500 leading-relaxed">
                  {selectedBg.feature.description}
                </p>
              </div>

              {/* Escolhas */}
              {selectedBg.choices.length > 0 && (
                <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                  <SectionTitle>Escolhas do Personagem</SectionTitle>
                  <BackgroundChoicePanel
                    choices={selectedBg.choices}
                    selections={draft.backgroundChoices}
                    accent={accent}
                    onChange={updateBackgroundChoices}
                  />
                </div>
              )}

              {/* Variante */}
              {selectedBg.variant && (
                <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                  <SectionTitle>Variante</SectionTitle>
                  <p className="text-sm text-parchment-600 leading-relaxed">{selectedBg.variant}</p>
                </div>
              )}

            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-parchment-900">
            <div className="text-4xl mb-3">👈</div>
            <p className="text-parchment-600 font-fantasy text-sm">
              Selecione um antecedente para ver os detalhes
            </p>
          </div>
        )}
      </div>

      {/* ── Navegação mobile ── */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-parchment-900 px-4 py-3 flex justify-between items-center lg:hidden"
        style={{ backgroundColor: '#0a0704ee', backdropFilter: 'blur(8px)' }}
      >
        <button
          onClick={prevStep}
          className="px-4 py-2 text-parchment-500 hover:text-parchment-300 transition-colors text-sm font-fantasy"
        >
          ← Voltar
        </button>
        <button
          onClick={nextStep}
          disabled={!canAdvance}
          className="px-6 py-2 rounded-xl font-fantasy font-bold text-sm tracking-wide transition-all"
          style={{
            backgroundColor: canAdvance ? accent : '#3a2614',
            color: canAdvance ? '#0a0704' : '#5a3e24',
            cursor: canAdvance ? 'pointer' : 'not-allowed',
          }}
        >
          Continuar ✦
        </button>
      </div>

      {/* ── Navegação desktop ── */}
      <div className="hidden lg:flex lg:absolute lg:bottom-8 lg:right-8 gap-3">
        <button
          onClick={prevStep}
          className="px-4 py-2 text-parchment-500 hover:text-parchment-300 transition-colors font-fantasy text-sm"
        >
          ← Voltar
        </button>
        <button
          onClick={nextStep}
          disabled={!canAdvance}
          className="px-6 py-2 rounded-xl font-fantasy font-bold text-sm tracking-wide transition-all"
          style={{
            backgroundColor: canAdvance ? accent : '#3a2614',
            color: canAdvance ? '#0a0704' : '#5a3e24',
            cursor: canAdvance ? 'pointer' : 'not-allowed',
          }}
        >
          Continuar ✦
        </button>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold font-fantasy text-parchment-600 uppercase tracking-widest mb-3">
      {children}
    </h4>
  )
}
