import { useCharacterStore } from '../../stores/characterStore'
import { STEP_LABELS } from '../../types/character'
import {
  formatRepetitionCaused, getOwnerStep, getRepetitionsCausedBy, type ProficiencyOwner,
} from '../../utils/proficiencyUtils'

/**
 * Na etapa de uma fonte (raça, antecedente), o aviso das repetições que ela causou na escolha de
 * OUTRA etapa — o antecedente trocado para o Marinheiro com Atletismo escolhido na classe —, com o
 * atalho para ir trocar lá. A pendência continua na etapa da escolha (getRepeatedProficiencies).
 */
export function RepetitionsCausedNotes({ source }: { source: ProficiencyOwner }) {
  const draft = useCharacterStore(s => s.draft)
  const goToStep = useCharacterStore(s => s.goToStep)
  const caused = getRepetitionsCausedBy(draft, source)
  if (caused.length === 0) return null

  return (
    <div className="rounded-lg border border-parchment-800 bg-parchment-950/40 px-3 py-2 space-y-1.5">
      {caused.map((r, i) => {
        const step = getOwnerStep(draft, r.owner)
        return (
          <div key={`${i}:${r.kind}:${r.id}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-xs text-red-400 font-semibold leading-relaxed">⚠ {formatRepetitionCaused(draft, r)}</p>
            <button
              type="button"
              onClick={() => goToStep(step)}
              className="text-xs font-semibold text-parchment-300 hover:text-parchment-100 underline underline-offset-2"
            >
              Trocar em {STEP_LABELS[step]} →
            </button>
          </div>
        )
      })}
    </div>
  )
}
