import { useState } from 'react'
import type { AbilityScore } from '../../types/race'
import { useCharacterStore } from '../../stores/characterStore'
import { CLASSES, getClass, CLASS_PRESENTATION } from '../../utils/classUtils'
import {
  getPrimaryLevel,
  getAdditionalLevelsUsed,
  canAddAnotherClass,
  meetsMulticlassPrereq,
} from '../../utils/multiclassUtils'
import { getFinalAbilityScores } from '../../utils/asiUtils'
import { getExcludedSkills, getExcludedTools } from '../../utils/proficiencyUtils'
import { ABILITY_LABELS } from '../../utils/abilityScoreUtils'
import type { GameClass } from '../../types/class'
import { ClassChoicePanel } from './ClassChoicePanel'

/** "FOR 13 ou DES 13", "DES 13 e SAB 13", "INT 13" — o pré-requisito de multiclasse, legível. */
function describePrereq(cls: GameClass): string {
  const { mode, abilities } = cls.multiclassPrereq
  const sep = mode === 'any' ? ' ou ' : ' e '
  return abilities.map(a => `${ABILITY_LABELS[a].short} 13`).join(sep)
}

export function MulticlassPanel() {
  const draft = useCharacterStore(s => s.draft)
  const addClass = useCharacterStore(s => s.addClass)
  const removeClass = useCharacterStore(s => s.removeClass)
  const setAdditionalClassLevel = useCharacterStore(s => s.setAdditionalClassLevel)
  const updateAdditionalClassChoices = useCharacterStore(s => s.updateAdditionalClassChoices)

  const [adding, setAdding] = useState(false)

  const primaryClass = draft.class ? getClass(draft.class) : undefined
  if (!primaryClass) {
    return <p className="text-parchment-600 text-sm">Escolha primeiro a classe inicial na grade acima.</p>
  }

  const primaryLevel = getPrimaryLevel(draft)
  const used = getAdditionalLevelsUsed(draft)
  const canAddMore = canAddAnotherClass(draft)
  // Atributos finais só são significativos depois do passo Atributos — só aí mostramos alerta de pré-req.
  const abilitiesSet = draft.abilityMethod !== null
  const finalScores: Partial<Record<AbilityScore, number>> = getFinalAbilityScores(draft)
  const excludedSkills = getExcludedSkills(draft, 'class')
  const excludedTools = getExcludedTools(draft, 'class')

  const addable = CLASSES.filter(
    c => c.id !== draft.class && !draft.additionalClasses.some(a => a.classId === c.id),
  )

  const prereqFail = (cls: GameClass) => abilitiesSet && !meetsMulticlassPrereq(cls, finalScores)

  return (
    <div className="space-y-4">
      {/* Orçamento de níveis */}
      <div className="rounded-lg border border-parchment-800 bg-parchment-950/60 px-4 py-2.5 text-sm">
        <span className="text-parchment-400">Orçamento: </span>
        <span className="font-fantasy font-bold text-parchment-200">{draft.level} {draft.level === 1 ? 'nível' : 'níveis'}</span>
        <span className="text-parchment-500"> — {primaryLevel} na inicial + {used} em outras classes</span>
      </div>

      {/* Aviso de pré-requisito (só depois de definir atributos) */}
      {abilitiesSet && !meetsMulticlassPrereq(primaryClass, finalScores) && (
        <PrereqWarning cls={primaryClass} />
      )}

      {/* Classe primária (nível derivado, não editável aqui) */}
      <ClassRow
        accent={CLASS_PRESENTATION[primaryClass.id]?.accent ?? '#d4900a'}
        emoji={CLASS_PRESENTATION[primaryClass.id]?.emoji ?? '⚔️'}
        name={primaryClass.name}
        level={primaryLevel}
        tag="inicial"
        prereq={describePrereq(primaryClass)}
      />

      {/* Classes adicionais */}
      {draft.additionalClasses.map(entry => {
        const cls = getClass(entry.classId)
        if (!cls) return null
        const accent = CLASS_PRESENTATION[cls.id]?.accent ?? '#d4900a'
        return (
          <div key={entry.classId} className="rounded-xl border border-parchment-900 bg-parchment-950/60 overflow-hidden">
            <ClassRow
              accent={accent}
              emoji={CLASS_PRESENTATION[cls.id]?.emoji ?? '⚔️'}
              name={cls.name}
              level={entry.level}
              prereq={describePrereq(cls)}
              warn={prereqFail(cls)}
              onLevelDown={entry.level > 1 ? () => setAdditionalClassLevel(entry.classId, entry.level - 1) : undefined}
              onLevelUp={canAddMore ? () => setAdditionalClassLevel(entry.classId, entry.level + 1) : undefined}
              onRemove={() => removeClass(entry.classId)}
            />
            <div className="border-t border-parchment-900 p-4">
              <ClassChoicePanel
                cls={cls}
                choices={entry.classChoices}
                accent={accent}
                level={entry.level}
                multiclass
                excludedSkills={excludedSkills}
                excludedTools={excludedTools}
                onChange={patch => updateAdditionalClassChoices(entry.classId, patch)}
              />
            </div>
          </div>
        )
      })}

      {/* Adicionar classe */}
      {canAddMore ? (
        adding ? (
          <div className="rounded-xl border border-parchment-800 bg-parchment-950/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-fantasy text-parchment-500 uppercase tracking-widest">Adicionar classe</span>
              <button onClick={() => setAdding(false)} className="text-parchment-600 hover:text-parchment-300 text-xs">Cancelar</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {addable.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => { addClass(cls.id); setAdding(false) }}
                    className="flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-all hover:border-parchment-600"
                    style={{ borderColor: 'rgba(90,62,36,0.5)' }}
                  >
                    <span className="text-sm font-fantasy font-bold text-parchment-200">
                      {CLASS_PRESENTATION[cls.id]?.emoji ?? '⚔️'} {cls.name}
                    </span>
                    <span className={`text-[11px] ${prereqFail(cls) ? 'text-red-500' : 'text-parchment-600'}`}>
                      requer {describePrereq(cls)}
                    </span>
                  </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full rounded-xl border-2 border-dashed border-parchment-800 py-3 text-parchment-500 hover:text-parchment-300 hover:border-parchment-700 transition-all font-fantasy text-sm"
          >
            ＋ Adicionar classe
          </button>
        )
      ) : (
        <p className="text-parchment-600 text-xs text-center font-fantasy">
          Todos os {draft.level} níveis alocados — reduza uma classe para adicionar outra.
        </p>
      )}
    </div>
  )
}

type ClassRowProps = {
  accent: string
  emoji: string
  name: string
  level: number
  tag?: string
  prereq: string
  warn?: boolean
  onLevelDown?: () => void
  onLevelUp?: () => void
  onRemove?: () => void
}

function ClassRow({ accent, emoji, name, level, tag, prereq, warn, onLevelDown, onLevelUp, onRemove }: ClassRowProps) {
  return (
    <div className="flex items-center gap-3 p-3">
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-fantasy font-bold text-sm" style={{ color: accent }}>{name}</span>
          {tag && <span className="text-[10px] px-1.5 py-0.5 rounded bg-parchment-900 text-parchment-500 uppercase tracking-wide">{tag}</span>}
        </div>
        <span className={`text-[11px] ${warn ? 'text-red-500' : 'text-parchment-600'}`}>
          {warn ? '⚠ atributos não cumprem: ' : 'requer '}{prereq}
        </span>
      </div>
      {(onLevelDown || onLevelUp) ? (
        <div className="flex items-center gap-1.5">
          <StepBtn onClick={onLevelDown} disabled={!onLevelDown}>−</StepBtn>
          <span className="w-10 text-center font-fantasy font-bold text-parchment-200">nº {level}</span>
          <StepBtn onClick={onLevelUp} disabled={!onLevelUp}>＋</StepBtn>
        </div>
      ) : (
        <span className="font-fantasy font-bold text-parchment-300 px-2">nível {level}</span>
      )}
      {onRemove && (
        <button onClick={onRemove} title="Remover classe" className="text-parchment-600 hover:text-red-500 transition-colors px-1 text-lg">✕</button>
      )}
    </div>
  )
}

function StepBtn({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded-lg border border-parchment-800 font-bold text-parchment-300 disabled:text-parchment-800 disabled:cursor-not-allowed hover:border-parchment-600 transition-all"
    >
      {children}
    </button>
  )
}

function PrereqWarning({ cls }: { cls: GameClass }) {
  return (
    <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-2.5 text-xs text-red-400">
      ⚠ A classe inicial <strong>{cls.name}</strong> exige {describePrereq(cls)} para multiclassar. Ajuste os atributos.
    </div>
  )
}
