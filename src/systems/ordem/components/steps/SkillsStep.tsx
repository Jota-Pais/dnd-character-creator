import { useOrdemStore } from '../../stores/characterStore'
import { getOrdemClass } from '../../utils/classUtils'
import { SKILLS, getSkillName, formatSkillWithAttribute } from '../../utils/skillUtils'
import {
  getOriginSkills,
  getAvailableChoiceGroupOptions,
  getAvailableFreeSkillOptions,
  getRequiredFreeSkillCount,
  getFixedSkillOverlapWithOrigin,
  hasExpertAbility,
  getExpertSkillOptions,
  getExpertSkills,
  getExpertDie,
  EXPERT_SKILL_COUNT,
} from '../../utils/characterUtils'
import { isStepComplete } from '../../utils/draftValidation'
import { StepNav } from '../common/StepNav'

export function SkillsStep() {
  const draft = useOrdemStore(state => state.draft)
  const setChoiceGroupPick = useOrdemStore(state => state.setChoiceGroupPick)
  const setFreeSkillChoices = useOrdemStore(state => state.setFreeSkillChoices)
  const updateDraft = useOrdemStore(state => state.updateDraft)
  const nextStep = useOrdemStore(state => state.nextStep)
  const prevStep = useOrdemStore(state => state.prevStep)

  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  const canAdvance = isStepComplete(draft, 'skills')

  if (!cls) return null

  const originSkills = getOriginSkills(draft)
  const requiredFree = getRequiredFreeSkillCount(draft, cls)
  const fixedOverlap = getFixedSkillOverlapWithOrigin(draft, cls)
  const allSkillIds = SKILLS.map(s => s.id)

  const expertOptions = getExpertSkillOptions(draft)
  const expertSkills = getExpertSkills(draft)
  const expertDie = getExpertDie(draft.nex)

  function toggleFreeSkill(skillId: string) {
    const current = draft.classFreeSkillChoices
    if (current.includes(skillId)) {
      setFreeSkillChoices(current.filter(id => id !== skillId))
    } else if (current.length < requiredFree) {
      setFreeSkillChoices([...current, skillId])
    }
  }

  function toggleExpertSkill(skillId: string) {
    if (expertSkills.includes(skillId)) {
      updateDraft({ expertSkillChoices: expertSkills.filter(id => id !== skillId) })
    } else if (expertSkills.length < EXPERT_SKILL_COUNT) {
      updateDraft({ expertSkillChoices: [...expertSkills, skillId] })
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1 text-center">
        Suas perícias
      </h2>
      <p className="text-parchment-500 text-sm mb-6 text-center leading-relaxed">
        Definidas pela sua origem, sua classe e seu Intelecto.
      </p>

      {originSkills.length > 0 && (
        <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4 mb-3">
          <SectionTitle>Já garantidas pela origem</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {originSkills.map(sid => (
              <Chip key={sid} label={formatSkillWithAttribute(sid)} active />
            ))}
          </div>
        </div>
      )}

      {cls.skills.fixed.length > 0 && (
        <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4 mb-3">
          <SectionTitle>Fixas pela classe</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {cls.skills.fixed.map(sid => (
              <Chip key={sid} label={formatSkillWithAttribute(sid)} active />
            ))}
          </div>
          {fixedOverlap.length > 0 && (
            <p className="text-parchment-500 text-xs mt-2 leading-relaxed">
              {fixedOverlap.map(getSkillName).join(' e ')} você já recebeu da origem — perícia repetida não acumula,
              então o livro manda <span className="text-gold-500">escolher outra no lugar</span>:{' '}
              você ganhou +{fixedOverlap.length} na escolha livre abaixo.
            </p>
          )}
        </div>
      )}

      {cls.skills.choiceGroups.map((_group, i) => {
        const options = getAvailableChoiceGroupOptions(draft, cls, i)
        const picked = draft.classChoiceGroupPicks[i]
        return (
          <div key={i} className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4 mb-3">
            <SectionTitle>Escolha 1 perícia</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {options.map(sid => (
                <Chip
                  key={sid}
                  label={formatSkillWithAttribute(sid)}
                  active={picked === sid}
                  onClick={() => setChoiceGroupPick(i, sid)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {requiredFree > 0 && (
        <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4 mb-3">
          <SectionTitle>
            Escolha livre ({draft.classFreeSkillChoices.length}/{requiredFree})
          </SectionTitle>
          <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto">
            {getAvailableFreeSkillOptions(draft, cls, allSkillIds).map(sid => {
              const active = draft.classFreeSkillChoices.includes(sid)
              const disabled = !active && draft.classFreeSkillChoices.length >= requiredFree
              return (
                <Chip
                  key={sid}
                  label={formatSkillWithAttribute(sid)}
                  active={active}
                  disabled={disabled}
                  onClick={() => toggleFreeSkill(sid)}
                />
              )
            })}
          </div>
        </div>
      )}

      {hasExpertAbility(draft) && (
        <div className="rounded-xl border border-gold-900/60 bg-parchment-950/60 p-4 mb-3">
          <SectionTitle>
            Perito ({expertSkills.length}/{Math.min(EXPERT_SKILL_COUNT, expertOptions.length)})
          </SectionTitle>
          <p className="text-parchment-500 text-xs mb-3 -mt-1 leading-relaxed">
            Sua habilidade de <strong className="text-gold-500">Especialista</strong>: escolha 2 perícias
            treinadas (exceto Luta e Pontaria) nas quais você pode gastar{' '}
            <strong className="text-parchment-300">{expertDie.pe} PE para somar +{expertDie.die}</strong> no teste.
            O dado cresce com o NEX.
          </p>
          {expertOptions.length === 0 ? (
            <p className="text-amber-400/90 text-xs">Escolha suas perícias treinadas acima primeiro.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {expertOptions.map(sid => {
                const active = expertSkills.includes(sid)
                const disabled = !active && expertSkills.length >= EXPERT_SKILL_COUNT
                return (
                  <Chip
                    key={sid}
                    label={formatSkillWithAttribute(sid)}
                    active={active}
                    disabled={disabled}
                    onClick={() => toggleExpertSkill(sid)}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={canAdvance} disabledReason="Preencha as perícias pendentes" />
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

function Chip({ label, active, disabled, onClick }: { label: string; active: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`px-3 py-1 rounded-full text-xs font-bold transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
        active 
          ? 'bg-red-950/40 text-red-400 border-red-900/50 shadow-[0_0_10px_rgba(220,38,38,0.15)]'
          : 'bg-parchment-950/80 text-parchment-500 border-parchment-800 hover:border-parchment-600 hover:text-parchment-300'
      }`}
    >
      {label}
    </button>
  )
}
