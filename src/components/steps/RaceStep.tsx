import { useState } from 'react'
import type { Race, Subrace } from '../../types/race'
import { useCharacterStore } from '../../stores/characterStore'
import {
  RACES,
  getRace,
  getSubrace,
  getEffectiveSpeed,
  getEffectiveDarkvision,
  getEffectiveAbilityBonuses,
  getAllChoices,
  isRaceStepComplete,
  RACE_PRESENTATION,
} from '../../utils/raceUtils'
import { ABILITY_LABELS, formatBonus } from '../../utils/abilityScoreUtils'
import { RaceCard } from '../race/RaceCard'
import { SubraceCard } from '../race/SubraceCard'
import { ChoicePanel } from '../race/ChoicePanel'

export function RaceStep() {
  const draft = useCharacterStore(state => state.draft)
  const setRace = useCharacterStore(state => state.setRace)
  const setSubrace = useCharacterStore(state => state.setSubrace)
  const updateRaceChoices = useCharacterStore(state => state.updateRaceChoices)
  const nextStep = useCharacterStore(state => state.nextStep)
  const prevStep = useCharacterStore(state => state.prevStep)

  const [panelOpen, setPanelOpen] = useState(false)

  const selectedRace: Race | undefined = draft.race ? getRace(draft.race) : undefined
  const selectedSubrace: Subrace | undefined =
    selectedRace && draft.subrace ? getSubrace(selectedRace, draft.subrace) : undefined

  const accent = selectedRace ? (RACE_PRESENTATION[selectedRace.id]?.accent ?? '#d4900a') : '#d4900a'
  const allChoices = selectedRace ? getAllChoices(selectedRace, selectedSubrace ?? null) : []

  const effectiveBonuses = selectedRace
    ? getEffectiveAbilityBonuses(selectedRace, selectedSubrace ?? null, draft.raceChoices)
    : []

  const canAdvance = isRaceStepComplete(
    selectedRace ?? null,
    selectedSubrace ?? null,
    draft.raceChoices,
  )

  function handleRaceSelect(raceId: string) {
    setRace(raceId)
    setPanelOpen(true)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* ── Grade de raças ── */}
      <div className="lg:w-1/2 xl:w-3/5">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1">
          De que estirpe és tu?
        </h2>
        <p className="text-parchment-500 text-sm mb-5">
          Sua raça molda sua origem, seus instintos e os dons que carrega desde o nascimento.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RACES.map(race => (
            <RaceCard
              key={race.id}
              race={race}
              selected={draft.race === race.id}
              onSelect={() => handleRaceSelect(race.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Painel de detalhes ── */}
      <div className="lg:w-1/2 xl:w-2/5">
        {selectedRace ? (
          <div className="sticky top-4 space-y-4">

            {/* Cabeçalho da raça */}
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
                    {RACE_PRESENTATION[selectedRace.id]?.emoji ?? '⚔️'}
                  </span>
                  <div>
                    <h3 className="font-fantasy text-xl font-bold" style={{ color: accent }}>
                      {selectedRace.name}
                    </h3>
                    <p className="text-xs text-parchment-600">{selectedRace.age}</p>
                  </div>
                </div>
                <button
                  className="text-parchment-600 hover:text-parchment-300 text-xs lg:hidden"
                  onClick={() => setPanelOpen(!panelOpen)}
                >
                  {panelOpen ? 'Recolher ▲' : 'Detalhes ▼'}
                </button>
              </div>
              <p className="text-parchment-400 text-sm mt-2 leading-relaxed">
                {selectedRace.description}
              </p>
            </div>

            <div className={(panelOpen ? 'flex' : 'hidden') + ' lg:flex flex-col gap-4'}>

              {/* Stats */}
              <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                <SectionTitle>Estatísticas</SectionTitle>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <Stat label="⚡ Velocidade" value={`${getEffectiveSpeed(selectedRace, selectedSubrace ?? null)} pés`} />
                  <Stat
                    label="👁️ Visão no Escuro"
                    value={
                      getEffectiveDarkvision(selectedRace, selectedSubrace ?? null) > 0
                        ? `${getEffectiveDarkvision(selectedRace, selectedSubrace ?? null)} pés`
                        : 'Não possui'
                    }
                  />
                  <Stat label="📏 Tamanho" value={selectedRace.size === 'Small' ? 'Pequeno' : 'Médio'} />
                  <Stat label="🗣️ Idiomas" value={selectedRace.grantedLanguages.join(', ')} />
                </div>

                {effectiveBonuses.length > 0 && (
                  <div className="pt-3 border-t border-parchment-900">
                    <p className="text-xs text-parchment-600 mb-2">Bônus de Atributo</p>
                    <div className="flex flex-wrap gap-1.5">
                      {effectiveBonuses.map((b, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md text-xs font-mono font-bold"
                          style={{ backgroundColor: `${accent}20`, color: accent }}
                        >
                          {ABILITY_LABELS[b.ability].long} {formatBonus(b.value)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Traços raciais */}
              <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                <SectionTitle>Traços Raciais</SectionTitle>
                <div className="space-y-2.5">
                  {[...selectedRace.traits, ...(selectedSubrace?.traits ?? [])].map(trait => (
                    <div key={trait.name}>
                      <span className="text-sm font-semibold text-parchment-200 font-fantasy">
                        {trait.name}.{' '}
                      </span>
                      <span className="text-sm text-parchment-500">{trait.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subraças */}
              {selectedRace.subraces.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <SectionTitle>Escolha sua Subraça</SectionTitle>
                    <span className="text-red-500 text-xs">obrigatório</span>
                  </div>
                  <div className="space-y-2">
                    {selectedRace.subraces.map(sub => (
                      <SubraceCard
                        key={sub.id}
                        subrace={sub}
                        accent={accent}
                        selected={draft.subrace === sub.id}
                        onSelect={() => setSubrace(sub.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Choices */}
              {allChoices.length > 0 && (
                <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                  <SectionTitle>Escolhas do Personagem</SectionTitle>
                  <ChoicePanel
                    choices={allChoices}
                    selections={draft.raceChoices}
                    accent={accent}
                    onChange={updateRaceChoices}
                  />
                </div>
              )}

            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-parchment-900">
            <div className="text-4xl mb-3">👈</div>
            <p className="text-parchment-600 font-fantasy text-sm">
              Selecione uma raça para ver os detalhes
            </p>
          </div>
        )}
      </div>

      {/* ── Navegação ── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-parchment-900 px-4 py-3 flex justify-between items-center lg:hidden"
        style={{ backgroundColor: '#0a0704ee', backdropFilter: 'blur(8px)' }}>
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

      {/* Navegação desktop */}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-parchment-700">{label}</p>
      <p className="text-parchment-300 font-medium text-sm">{value}</p>
    </div>
  )
}
