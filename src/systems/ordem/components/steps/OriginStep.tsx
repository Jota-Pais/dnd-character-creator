import { useOrdemStore } from '../../stores/characterStore'
import { ORIGINS, getOrigin } from '../../utils/originUtils'
import { SKILLS, getSkillName } from '../../utils/skillUtils'
import { isStepComplete } from '../../utils/draftValidation'
import { StepNav } from '../common/StepNav'
import type { Origin } from '../../types/origin'

export function OriginStep() {
  const draft = useOrdemStore(state => state.draft)
  const setOrigin = useOrdemStore(state => state.setOrigin)
  const setOriginGmSkillChoices = useOrdemStore(state => state.setOriginGmSkillChoices)
  const nextStep = useOrdemStore(state => state.nextStep)
  const prevStep = useOrdemStore(state => state.prevStep)

  const selected: Origin | undefined = draft.origin ? getOrigin(draft.origin) : undefined
  const canAdvance = isStepComplete(draft, 'origin')

  function toggleGmSkill(skillId: string) {
    const current = draft.originGmSkillChoices
    if (current.includes(skillId)) {
      setOriginGmSkillChoices(current.filter(id => id !== skillId))
    } else if (current.length < 2) {
      setOriginGmSkillChoices([...current, skillId])
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-1/2 xl:w-3/5">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1">
          O que você fazia antes da Ordem?
        </h2>
        <p className="text-parchment-500 text-sm mb-5">
          Sua origem representa sua vida pregressa. Ela dá 2 perícias treinadas e um poder exclusivo.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {ORIGINS.map(origin => (
            <button
              key={origin.id}
              onClick={() => setOrigin(origin.id)}
              className="text-left px-3 py-2.5 rounded-lg border transition-all"
              style={{
                borderColor: draft.origin === origin.id ? '#dc2626' : '#2a2213',
                backgroundColor: draft.origin === origin.id ? '#dc262615' : '#0a070499',
              }}
            >
              <p className="font-fantasy font-semibold text-sm text-parchment-200">{origin.name}</p>
              <p className="text-parchment-600 text-xs mt-0.5">{origin.power.name}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:w-1/2 xl:w-2/5">
        {selected ? (
          <div className="sticky top-4 space-y-4">
            <div className="rounded-2xl border-2 border-gold-800/50 bg-gold-900/5 p-5">
              <h3 className="font-fantasy text-xl font-bold text-gold-400">{selected.name}</h3>
              <p className="text-parchment-400 text-sm mt-2 leading-relaxed">{selected.description}</p>
            </div>

            <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
              <SectionTitle>Perícias Treinadas</SectionTitle>
              {selected.skillProficiencies.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selected.skillProficiencies.map(sid => (
                    <span key={sid} className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-gold-900/30 text-gold-400">
                      {getSkillName(sid)}
                    </span>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="text-parchment-500 text-xs mb-2">
                    Escolha 2 perícias (no livro, seriam escolhidas pelo mestre).
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SKILLS.map(skill => {
                      const isSelected = draft.originGmSkillChoices.includes(skill.id)
                      const disabled = !isSelected && draft.originGmSkillChoices.length >= 2
                      return (
                        <button
                          key={skill.id}
                          onClick={() => toggleGmSkill(skill.id)}
                          disabled={disabled}
                          className="px-2 py-0.5 rounded-md text-xs font-mono font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            backgroundColor: isSelected ? '#dc262630' : '#1a140a',
                            color: isSelected ? '#dc2626' : '#8a7a5a',
                          }}
                        >
                          {skill.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
              <SectionTitle>Poder de Origem</SectionTitle>
              <p className="text-sm">
                <span className="font-semibold text-parchment-200 font-fantasy">{selected.power.name}. </span>
                <span className="text-parchment-500">{selected.power.description}</span>
              </p>
              {selected.power.effects?.grantsParanormalPower && (
                <div className="mt-3 pt-3 border-t border-parchment-900/50 space-y-1.5">
                  <p className="text-xs text-gold-400">
                    ✦ Você escolherá seu poder paranormal na etapa <strong className="font-fantasy">Poderes Paranormais</strong>.
                  </p>
                  {selected.power.effects.halvesStartingSanity && (
                    <p className="text-xs text-amber-500/90">
                      ⚠️ Começa com <strong>metade da Sanidade inicial</strong> da classe — a ficha aplica isso automaticamente.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-parchment-900">
            <div className="text-4xl mb-3">👈</div>
            <p className="text-parchment-600 font-fantasy text-sm">Selecione uma origem para ver os detalhes</p>
          </div>
        )}
      </div>

      <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={canAdvance} disabledReason={!draft.origin ? "Escolha uma Origem" : "Preencha as opções da Origem"} />
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
