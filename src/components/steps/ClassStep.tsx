import { useState, useEffect } from 'react'
import type { GameClass } from '../../types/class'
import { useCharacterStore } from '../../stores/characterStore'
import {
  CLASSES,
  CLASS_PRESENTATION,
  getClass,
  getSubclass,
  isActiveCaster,
  isClassStepComplete,
  getHpFormula,
} from '../../utils/classUtils'
import { ABILITY_LABELS } from '../../utils/abilityScoreUtils'
import { getExcludedSkills, getExcludedTools } from '../../utils/proficiencyUtils'
import { ClassCard } from '../class/ClassCard'
import { ClassChoicePanel } from '../class/ClassChoicePanel'

export function ClassStep() {
  const draft = useCharacterStore(state => state.draft)
  const setClass = useCharacterStore(state => state.setClass)
  const updateClassChoices = useCharacterStore(state => state.updateClassChoices)
  const nextStep = useCharacterStore(state => state.nextStep)
  const prevStep = useCharacterStore(state => state.prevStep)

  const [panelOpen, setPanelOpen] = useState(false)

  const selectedClass: GameClass | undefined = draft.class ? getClass(draft.class) : undefined
  const selectedSubclass = selectedClass && draft.classChoices.subclass
    ? getSubclass(selectedClass, draft.classChoices.subclass)
    : undefined

  const accent = selectedClass
    ? (CLASS_PRESENTATION[selectedClass.id]?.accent ?? '#d4900a')
    : '#d4900a'

  const activeCaster = selectedClass ? isActiveCaster(selectedClass, draft.level) : false

  const canAdvance = isClassStepComplete(selectedClass ?? null, draft.classChoices, draft.level)

  // Perícias/ferramentas já obtidas de raça ou antecedente não podem ser re-escolhidas
  const excludedSkills = getExcludedSkills(draft, 'class')
  const excludedTools = getExcludedTools(draft, 'class')

  useEffect(() => {
    const skills = draft.classChoices.skills
    const filtered = skills.filter(id => !excludedSkills.includes(id))
    if (filtered.length !== skills.length) {
      updateClassChoices({
        skills: filtered,
        expertiseItems: draft.classChoices.expertiseItems.filter(id => !excludedSkills.includes(id)),
      })
    }
  }, [excludedSkills.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tools = draft.classChoices.tools
    const filtered = tools.filter(id => !excludedTools.includes(id))
    if (filtered.length !== tools.length) updateClassChoices({ tools: filtered })
  }, [excludedTools.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClassSelect(classId: string) {
    setClass(classId)
    setPanelOpen(true)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* ── Grade de classes ── */}
      <div className="lg:w-1/2 xl:w-3/5">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1">
          Qual é o teu chamado?
        </h2>
        <p className="text-parchment-500 text-sm mb-5">
          Sua classe define seu papel no grupo, seus poderes e a forma como enfrenta os perigos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CLASSES.map(cls => (
            <ClassCard
              key={cls.id}
              cls={cls}
              selected={draft.class === cls.id}
              onSelect={() => handleClassSelect(cls.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Painel de detalhes ── */}
      <div className="lg:w-1/2 xl:w-2/5">
        {selectedClass ? (
          <div className="sticky top-4 space-y-4">

            {/* Cabeçalho da classe */}
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
                    {CLASS_PRESENTATION[selectedClass.id]?.emoji ?? '⚔️'}
                  </span>
                  <div>
                    <h3 className="font-fantasy text-xl font-bold" style={{ color: accent }}>
                      {selectedClass.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-mono font-bold"
                        style={{ backgroundColor: `${accent}20`, color: accent }}
                      >
                        {getHpFormula(selectedClass)}
                      </span>
                      {activeCaster && (
                        <span className="text-xs text-parchment-500 font-fantasy">✦ conjurador</span>
                      )}
                    </div>
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
                {selectedClass.description}
              </p>
            </div>

            <div className={(panelOpen ? 'flex' : 'hidden') + ' lg:flex flex-col gap-4'}>

              {/* Stats */}
              <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                <SectionTitle>Estatísticas</SectionTitle>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat
                    label="⚔️ Atributo Principal"
                    value={selectedClass.primaryAbility.map(a => ABILITY_LABELS[a].long).join(' ou ')}
                  />
                  <Stat
                    label="🛡️ Resistências"
                    value={selectedClass.savingThrows.map(a => ABILITY_LABELS[a].short).join(', ')}
                  />
                  <Stat
                    label="🎯 Perícias"
                    value={`Escolha ${selectedClass.skillChoices.count}`}
                  />
                  {selectedClass.toolProficiencies.granted.length > 0 && (
                    <Stat
                      label="🔧 Ferramentas"
                      value={selectedClass.toolProficiencies.granted.join(', ')}
                    />
                  )}
                  {activeCaster && selectedClass.spellcasting && (
                    <>
                      <Stat
                        label="📖 Magia"
                        value={ABILITY_LABELS[selectedClass.spellcasting.ability].long}
                      />
                      {selectedClass.spellcasting.cantripsKnown > 0 && (
                        <Stat
                          label="✨ Truques"
                          value={`${selectedClass.spellcasting.cantripsKnown}`}
                        />
                      )}
                    </>
                  )}
                  {selectedClass.subclassLevel > 1 && (
                    <Stat
                      label="⚜️ Subclasse"
                      value={`Escolhida no nível ${selectedClass.subclassLevel}`}
                    />
                  )}
                </div>
              </div>

              {/* Features de nível 1 */}
              <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                <SectionTitle>Features de Nível 1</SectionTitle>
                <div className="space-y-2.5">
                  {[
                    ...selectedClass.features,
                    ...(selectedSubclass?.features ?? []),
                  ].map(feature => (
                    <div key={feature.name}>
                      <span className="text-sm font-semibold text-parchment-200 font-fantasy">
                        {feature.name}.{' '}
                      </span>
                      <span className="text-sm text-parchment-500">{feature.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subclasses ainda não disponíveis (nível de escolha não atingido) */}
              {selectedClass.subclassLevel > draft.level && (
                <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                  <SectionTitle>Subclasses (Nível {selectedClass.subclassLevel})</SectionTitle>
                  <p className="text-parchment-600 text-xs mb-2">
                    Sua subclasse é escolhida no nível {selectedClass.subclassLevel}. Como seu personagem é nível {draft.level}, você poderá escolher ao subir de nível. Opções:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedClass.subclasses.map(sub => (
                      <span
                        key={sub.id}
                        className="px-2 py-0.5 rounded-md text-xs text-parchment-500 border border-parchment-800"
                      >
                        {sub.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Painel de escolhas */}
              <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                <SectionTitle>Escolhas do Personagem</SectionTitle>
                <ClassChoicePanel
                  cls={selectedClass}
                  choices={draft.classChoices}
                  accent={accent}
                  level={draft.level}
                  onChange={updateClassChoices}
                  excludedSkills={excludedSkills}
                  excludedTools={excludedTools}
                />
              </div>

            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-parchment-900">
            <div className="text-4xl mb-3">👈</div>
            <p className="text-parchment-600 font-fantasy text-sm">
              Selecione uma classe para ver os detalhes
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-parchment-700">{label}</p>
      <p className="text-parchment-300 font-medium text-sm">{value}</p>
    </div>
  )
}
