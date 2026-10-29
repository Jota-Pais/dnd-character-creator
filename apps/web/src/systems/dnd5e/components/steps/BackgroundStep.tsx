import { useState } from 'react'
import { useCharacterStore } from '../../stores/characterStore'
import {
  BACKGROUNDS,
  BACKGROUND_PRESENTATION,
  getBackground,
  getSkillName,
  getToolName,
  getBackgroundItemChoices,
} from '@rpg/rules/systems/dnd5e/utils/backgroundUtils'
import {
  getExcludedTools,
  getExcludedLanguages,
  getBackgroundUnproficientTools,
  formatUnproficientTool,
  getRepeatedProficiencyNotes,
  getBackgroundFixedOverlaps,
  getAllGrantedSkills,
  getAllGrantedTools,
} from '@rpg/rules/systems/dnd5e/utils/proficiencyUtils'
import { BackgroundCard } from '../background/BackgroundCard'
import { BackgroundChoicePanel } from '../background/BackgroundChoicePanel'
import { SubstituteProficiencyPicker } from '../background/SubstituteProficiencyPicker'
import { RepetitionsCausedNotes } from '../common/RepetitionsCausedNotes'
import { StepNav } from '../../../../components/wizard/StepNav'
import { formatPendingHint, getStepPendingReasons } from '@rpg/rules/systems/dnd5e/utils/pendingReasons'

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

  const itemChoices = selectedBg ? getBackgroundItemChoices(selectedBg) : []

  // Idiomas/ferramentas já obtidos de raça ou classe (inclusive da subclasse) não se repetem. O
  // que ficou repetido depois (raça trocada, ficha antiga) NÃO é apagado: fica marcado com o aviso,
  // e a etapa reprova até o jogador trocar (p. 125, getRepeatedProficiencies).
  const langExcluded = getExcludedLanguages(draft, 'background')
  const toolExcluded = getExcludedTools(draft, 'background')
  const repeated = getRepeatedProficiencyNotes(draft, { kind: 'background' })
  // Fixo × fixo com a raça ou a classe (Meio-Orc e Soldado com Intimidação): a substituta opcional
  // da p. 125. O picker não oferece o que o personagem já tem, menos a que ele mesmo marcou.
  const overlaps = getBackgroundFixedOverlaps(draft)
  const substituteSkills = draft.backgroundChoices.substituteSkills ?? []
  const substituteTools = draft.backgroundChoices.substituteTools ?? []
  // Item do antecedente sem a proficiência (Dados de Osso com proficiência em Baralho): só avisa,
  // como na Revisão e na ficha — a regra deixa usar, sem o bônus (p. 156).
  const unproficientTools = getBackgroundUnproficientTools(draft)

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

              {/* O que o antecedente repetiu em escolha de outra etapa (a pendência fica lá) */}
              <RepetitionsCausedNotes source={{ kind: 'background' }} />

              {/* Fixo × fixo: a substituta opcional (p. 125) */}
              {(overlaps.skills.length > 0 || overlaps.tools.length > 0) && (
                <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4 space-y-4">
                  <SectionTitle>Proficiência repetida</SectionTitle>
                  {overlaps.skills.length > 0 && (
                    <SubstituteProficiencyPicker
                      kind="skill"
                      overlaps={overlaps.skills}
                      selected={substituteSkills}
                      excluded={getAllGrantedSkills(draft).filter(id => !substituteSkills.includes(id))}
                      repeated={repeated}
                      accent={accent}
                      onChange={ids => updateBackgroundChoices({ substituteSkills: ids })}
                    />
                  )}
                  {overlaps.tools.length > 0 && (
                    <SubstituteProficiencyPicker
                      kind="tool"
                      overlaps={overlaps.tools}
                      selected={substituteTools}
                      excluded={getAllGrantedTools(draft).filter(id => !substituteTools.includes(id))}
                      repeated={repeated}
                      accent={accent}
                      onChange={ids => updateBackgroundChoices({ substituteTools: ids })}
                    />
                  )}
                </div>
              )}

              {/* Característica de antecedente */}
              <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                <SectionTitle>Característica de Antecedente</SectionTitle>
                <p className="text-sm font-semibold text-parchment-200 font-fantasy mb-1">
                  {selectedBg.feature.name}
                </p>
                <p className="text-sm text-parchment-500 leading-relaxed">
                  {selectedBg.feature.description}
                </p>
              </div>

              {/* Escolhas */}
              {(selectedBg.choices.length > 0 || itemChoices.length > 0) && (
                <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                  <SectionTitle>Escolhas do Personagem</SectionTitle>
                  <BackgroundChoicePanel
                    choices={selectedBg.choices}
                    itemChoices={itemChoices}
                    selections={draft.backgroundChoices}
                    accent={accent}
                    onChange={updateBackgroundChoices}
                    excludedLanguages={langExcluded}
                    excludedTools={toolExcluded}
                    repeated={repeated}
                  />
                  {unproficientTools.length > 0 && (
                    <div className="mt-3 rounded-lg border border-parchment-800 bg-parchment-950/40 px-3 py-2 space-y-0.5">
                      {unproficientTools.map(u => (
                        <p key={u.itemId} className="text-xs text-parchment-500 leading-relaxed">
                          ⚠ {formatUnproficientTool(u)}
                        </p>
                      ))}
                    </div>
                  )}
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

      <StepNav
        onPrev={prevStep}
        onNext={nextStep}
        accent={accent}
        pendingReason={formatPendingHint(getStepPendingReasons(draft, 'background'))}
      />
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
