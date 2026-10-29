import { useState } from 'react'
import type { GameClass } from '@rpg/rules/systems/dnd5e/types/class'
import { useCharacterStore } from '../../stores/characterStore'
import {
  CLASSES,
  CLASS_PRESENTATION,
  getClass,
  getSubclass,
  isActiveCaster,
  getHpFormula,
  getBaseClassFeaturesUpToLevel,
  getSubclassFeaturesUpToLevel,
} from '@rpg/rules/systems/dnd5e/utils/classUtils'
import { getPrimaryLevel } from '@rpg/rules/systems/dnd5e/utils/multiclassUtils'
import { getEntrySpellcasting, getCantripsNeeded } from '@rpg/rules/systems/dnd5e/utils/spellUtils'
import { ABILITY_LABELS } from '@rpg/rules/systems/dnd5e/utils/abilityScoreUtils'
import { getClassSlotProficiencies } from '@rpg/rules/systems/dnd5e/utils/proficiencyUtils'
import { getToolName } from '@rpg/rules/systems/dnd5e/utils/backgroundUtils'
import { getFeatManeuvers, getTakenFightingStyles } from '@rpg/rules/systems/dnd5e/utils/sheetEffects'
import { ClassCard } from '../class/ClassCard'
import { ClassChoicePanel } from '../class/ClassChoicePanel'
import { MulticlassPanel } from '../class/MulticlassPanel'
import { StepNav } from '../../../../components/wizard/StepNav'
import { formatPendingHint, getStepPendingReasons } from '@rpg/rules/systems/dnd5e/utils/pendingReasons'

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

  // Em multiclasse, a classe primária ocupa só parte do nível total (o resto vai pras adicionais).
  const primaryLevel = draft.multiclass ? getPrimaryLevel(draft) : draft.level
  // A subclasse pode dar conjuração (Cavaleiro Arcano, Trapaceiro Arcano).
  const subclassId = draft.classChoices.subclass
  const activeCaster = selectedClass ? isActiveCaster(selectedClass, primaryLevel, subclassId) : false
  const casting = getEntrySpellcasting(selectedClass, subclassId)

  // Valida o passo inteiro (primária + adicionais + orçamento), não só a primária.

  // Perícias/ferramentas já obtidas de outra fonte não podem ser re-escolhidas. A exclusão é por
  // slot: a lista da classe e os extras da subclasse são concessões distintas (ver proficiencyUtils).
  // A que chegou repetida depois (antecedente ou raça trocados, ficha antiga) NÃO é apagada: fica
  // marcada com o aviso, e a etapa reprova até o jogador trocar (p. 125, getRepeatedProficiencies).
  const proficiencies = getClassSlotProficiencies(draft, draft.class ?? '')

  function handleClassSelect(classId: string) {
    setClass(classId)
    setPanelOpen(true)
  }

  return (
    <div>
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
                      value={selectedClass.toolProficiencies.granted.map(getToolName).join(', ')}
                    />
                  )}
                  {activeCaster && casting && (
                    <>
                      <Stat
                        label="📖 Magia"
                        value={ABILITY_LABELS[casting.spellcasting.ability].long}
                      />
                      {getCantripsNeeded(casting, primaryLevel) > 0 && (
                        <Stat
                          label="✨ Truques"
                          value={`${getCantripsNeeded(casting, primaryLevel)}`}
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

              {/* Características de nível 1 */}
              <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                <SectionTitle>Características de nível 1</SectionTitle>
                <div className="space-y-2.5">
                  {/* Mesmo texto da ficha impressa: a tabela por nível é a única fonte. */}
                  {[
                    ...getBaseClassFeaturesUpToLevel(selectedClass.id, 1),
                    ...(selectedSubclass
                      ? getSubclassFeaturesUpToLevel(selectedSubclass.id, selectedClass.subclassLevel)
                      : []),
                  ].map(feature => (
                    <div key={`${feature.level}-${feature.name}`}>
                      <span className="text-sm font-semibold text-parchment-200 font-fantasy">
                        {feature.name}.{' '}
                      </span>
                      <span className="text-sm text-parchment-500">{feature.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subclasses ainda não disponíveis (nível de escolha não atingido) */}
              {selectedClass.subclassLevel > primaryLevel && (
                <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
                  <SectionTitle>Subclasses (Nível {selectedClass.subclassLevel})</SectionTitle>
                  <p className="text-parchment-600 text-xs mb-2">
                    Sua subclasse é escolhida no nível {selectedClass.subclassLevel}. Como esta classe está no nível {primaryLevel}, você poderá escolher ao subir de nível. Opções:
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
      </div>

      {/* As escolhas saem das duas colunas e ocupam a largura toda: subclasses e opções de
          progressão agora são cards com o texto à mostra, e não cabem numa coluna de 2/5.
          Também não entram no recolher do mobile — é a parte acionável da etapa. */}
      {selectedClass && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
            <SectionTitle>Escolhas do Personagem</SectionTitle>
            <ClassChoicePanel
              cls={selectedClass}
              choices={draft.classChoices}
              accent={accent}
              level={primaryLevel}
              onChange={updateClassChoices}
              proficiencies={proficiencies}
              takenFightingStyles={getTakenFightingStyles(draft, draft.class ?? '')}
              takenManeuvers={getFeatManeuvers(draft)}
            />
          </div>

          {draft.multiclass && (
            <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
              <SectionTitle>Multiclasse</SectionTitle>
              <MulticlassPanel />
            </div>
          )}
        </div>
      )}

      <StepNav
        onPrev={prevStep}
        onNext={nextStep}
        accent={accent}
        pendingReason={formatPendingHint(getStepPendingReasons(draft, 'class'))}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-parchment-700">{label}</p>
      <p className="text-parchment-300 font-medium text-sm">{value}</p>
    </div>
  )
}
