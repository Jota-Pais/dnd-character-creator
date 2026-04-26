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

  const [detailsOpen, setDetailsOpen] = useState(false)

  const selectedRace: Race | undefined = draft.race ? getRace(draft.race) : undefined
  const selectedSubrace: Subrace | undefined =
    selectedRace && draft.subrace ? getSubrace(selectedRace, draft.subrace) : undefined

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
    setDetailsOpen(true)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Grade de raças */}
      <div className="lg:w-1/2 xl:w-3/5">
        <h2 className="text-2xl font-bold text-stone-100 mb-1">Escolha sua Raça</h2>
        <p className="text-stone-400 text-sm mb-4">
          A raça define traços inatos, idiomas e proficiências do seu personagem.
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

      {/* Painel de detalhes */}
      <div className="lg:w-1/2 xl:w-2/5">
        {selectedRace ? (
          <div className="sticky top-4 space-y-5">
            {/* Cabeçalho da raça selecionada */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xl font-bold text-amber-500">{selectedRace.name}</h3>
                <button
                  className="text-stone-500 hover:text-stone-300 text-sm lg:hidden"
                  onClick={() => setDetailsOpen(!detailsOpen)}
                >
                  {detailsOpen ? 'Recolher ▲' : 'Ver detalhes ▼'}
                </button>
              </div>
              <p className="text-stone-400 text-sm">{selectedRace.description}</p>
            </div>

            <div className={(detailsOpen ? 'block' : 'hidden') + ' lg:block space-y-5'}>
              {/* Stats efetivos */}
              <div className="bg-stone-900 rounded-xl p-4 border border-stone-700">
                <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
                  Estatísticas
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Velocidade" value={`${getEffectiveSpeed(selectedRace, selectedSubrace ?? null)} pés`} />
                  <Stat
                    label="Visão no Escuro"
                    value={
                      getEffectiveDarkvision(selectedRace, selectedSubrace ?? null) > 0
                        ? `${getEffectiveDarkvision(selectedRace, selectedSubrace ?? null)} pés`
                        : 'Não possui'
                    }
                  />
                  <Stat label="Tamanho" value={selectedRace.size === 'Small' ? 'Pequeno' : 'Médio'} />
                  <Stat label="Idiomas" value={selectedRace.grantedLanguages.join(', ')} />
                </div>

                {effectiveBonuses.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-stone-700">
                    <p className="text-xs text-stone-400 mb-2">Bônus de Atributo</p>
                    <div className="flex flex-wrap gap-1.5">
                      {effectiveBonuses.map((b, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-amber-900/40 text-amber-400 text-xs font-mono rounded"
                        >
                          {ABILITY_LABELS[b.ability].long} {formatBonus(b.value)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Traços raciais */}
              <div className="bg-stone-900 rounded-xl p-4 border border-stone-700">
                <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
                  Traços Raciais
                </h4>
                <div className="space-y-2">
                  {[...selectedRace.traits, ...(selectedSubrace?.traits ?? [])].map(trait => (
                    <div key={trait.name}>
                      <span className="text-sm font-semibold text-stone-200">{trait.name}. </span>
                      <span className="text-sm text-stone-400">{trait.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seleção de subraça */}
              {selectedRace.subraces.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-stone-300 mb-2">
                    Subraça <span className="text-red-400">*</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedRace.subraces.map(sub => (
                      <SubraceCard
                        key={sub.id}
                        subrace={sub}
                        selected={draft.subrace === sub.id}
                        onSelect={() => setSubrace(sub.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Choices a resolver */}
              {allChoices.length > 0 && (
                <div className="bg-stone-900 rounded-xl p-4 border border-stone-700">
                  <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
                    Escolhas
                  </h4>
                  <ChoicePanel
                    choices={allChoices}
                    selections={draft.raceChoices}
                    onChange={updateRaceChoices}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex items-center justify-center h-64 rounded-xl border-2 border-dashed border-stone-700">
            <p className="text-stone-500 text-sm">Selecione uma raça para ver os detalhes</p>
          </div>
        )}
      </div>

      {/* Navegação */}
      <div className="fixed bottom-0 left-0 right-0 bg-stone-950/90 backdrop-blur border-t border-stone-800 px-4 py-3 flex justify-between lg:static lg:bg-transparent lg:border-0 lg:p-0 lg:block">
        <button
          onClick={prevStep}
          className="px-4 py-2 text-stone-400 hover:text-stone-200 transition-colors text-sm"
        >
          ← Voltar
        </button>
        <button
          onClick={nextStep}
          disabled={!canAdvance}
          className="px-6 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-700 disabled:text-stone-500 disabled:cursor-not-allowed text-stone-950 font-bold rounded-lg transition-colors text-sm"
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500">{label}</p>
      <p className="text-stone-200 font-medium">{value}</p>
    </div>
  )
}
