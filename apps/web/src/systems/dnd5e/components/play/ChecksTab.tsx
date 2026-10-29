import { useMemo } from 'react'
import { ABILITY_LABELS, ALL_ABILITY_SCORES, formatModifier } from '@rpg/rules/systems/dnd5e/utils/abilityScoreUtils'
import { getFinalAbilityScores } from '@rpg/rules/systems/dnd5e/utils/asiUtils'
import { SKILLS } from '@rpg/rules/systems/dnd5e/utils/backgroundUtils'
import { getPlayConditionEffects } from '@rpg/rules/systems/dnd5e/utils/playState'
import { getSkillChecks } from '@rpg/rules/systems/dnd5e/utils/proficiencyUtils'
import type { CheckProficiency } from '@rpg/rules/systems/dnd5e/utils/sheetEffects'
import type { RollGuideEntry } from '@rpg/rules/systems/dnd5e/utils/rollGuide'
import { rollButtonLabel } from './playFormat'
import { RollMarks } from './RollMarks'
import type { PlayTabProps } from './usePlayView'

const PROFICIENCY_MARK: Record<CheckProficiency | 'half', { mark: string; title: string; className: string }> = {
  none: { mark: '○', title: 'Sem proficiência', className: 'text-parchment-600' },
  half: { mark: '½', title: 'Meia proficiência', className: 'text-parchment-400' },
  proficient: { mark: '●', title: 'Proficiente', className: 'text-gold-400' },
  expertise: { mark: '◆', title: 'Especialização (proficiência dobrada)', className: 'text-gold-300' },
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-[11px] uppercase tracking-wider text-parchment-600 font-fantasy mb-1.5">{children}</h2>
}

/** Uma linha tocável: marcador de proficiência, nome, e o número com o modo ao lado. */
function RollRow({ entry, mark, sub, onOpen }: {
  entry: RollGuideEntry
  mark: keyof typeof PROFICIENCY_MARK
  sub?: string
  onOpen: (entry: RollGuideEntry) => void
}) {
  const m = PROFICIENCY_MARK[mark]
  return (
    <button
      onClick={() => onOpen(entry)}
      aria-label={rollButtonLabel(entry)}
      className="w-full min-h-10 flex items-center gap-2 px-2 rounded-lg hover:bg-surface-raised transition-colors text-left"
    >
      <span className={`w-4 text-center text-sm ${m.className}`} title={m.title} aria-hidden="true">{m.mark}</span>
      <span className="flex-1 min-w-0 truncate text-sm text-parchment-200">
        {entry.label.replace(/^TR de /, '')}
        {sub && <span className="ml-1 text-[11px] text-parchment-600">{sub}</span>}
      </span>
      <span className="flex items-center gap-1 font-fantasy font-bold text-base text-parchment-100" aria-hidden="true">
        {formatModifier(entry.modifier)} <RollMarks entry={entry} />
      </span>
    </button>
  )
}

/**
 * Aba "Testes": os seis atributos (tocar abre o teste de atributo), os testes de resistência e as
 * 18 perícias, cada número já com o modo das condições e da ficha resolvido. As linhas
 * condicionais das condições ativas ficam num bloco "Lembretes" no topo: elas nunca mudam o número.
 */
export function ChecksTab({ draft, state, sheet, guide, openRecipe }: PlayTabProps) {
  const lines = getPlayConditionEffects(state).lines
  // Proficiência e Especialização de cada perícia: a mesma fonte da Revisão e do PDF.
  const skillChecks = useMemo(() => getSkillChecks(draft, getFinalAbilityScores(draft)), [draft])

  return (
    <div className="space-y-5">
      {lines.length > 0 && (
        <section className="rounded-xl border border-amber-900 bg-amber-950/20 p-3" aria-labelledby="checks-reminders">
          <h2 id="checks-reminders" className="font-fantasy text-sm text-amber-200">Lembretes</h2>
          <p className="text-[11px] text-parchment-500 leading-snug">Valem só quando a situação acontece na mesa: o app não muda os números por elas.</p>
          <ul className="mt-2 space-y-1.5">
            {lines.map((l, i) => (
              <li key={i} className="text-xs text-parchment-300 leading-snug">
                <span className="font-bold text-amber-300">{l.source.label}:</span> {l.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>Atributos</SectionTitle>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {ALL_ABILITY_SCORES.map(ab => {
            const entry = guide.checks[ab]
            return (
              <button
                key={ab}
                onClick={() => openRecipe(entry)}
                aria-label={rollButtonLabel(entry)}
                className="flex flex-col items-center justify-center min-h-16 rounded-lg border border-parchment-800 bg-surface-raised px-1 py-1.5 hover:border-gold-700 transition-colors"
              >
                <span className="text-[10px] uppercase tracking-wider text-gold-500 leading-none">{ABILITY_LABELS[ab].short}</span>
                <span className="flex items-center gap-1 font-fantasy font-bold text-xl text-parchment-100 leading-tight" aria-hidden="true">
                  {formatModifier(entry.modifier)} <RollMarks entry={entry} />
                </span>
                <span className="text-[10px] text-parchment-500 leading-none" aria-hidden="true">valor {sheet.abilityScores[ab]}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <SectionTitle>Testes de resistência</SectionTitle>
        {/* Do md para cima, três colunas: os físicos numa linha, os mentais na outra. */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-3">
          {ALL_ABILITY_SCORES.map(ab => (
            <RollRow
              key={ab}
              entry={guide.saves[ab]}
              mark={sheet.savingThrows[ab].proficient ? 'proficient' : 'none'}
              onOpen={openRecipe}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Perícias</SectionTitle>
        {/* Do md para cima, três colunas de seis lidas de cima para baixo, como a lista da ficha. */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 md:grid-rows-6 md:grid-flow-col gap-x-3">
          {SKILLS.map(skill => {
            const entry = guide.skills[skill.id]
            const check = skillChecks[skill.id]
            if (!entry || !check) return null
            // Sem proficiência, uma parcela além do atributo é a meia proficiência (Versatilidade).
            const mark = check.proficiency === 'none' && entry.breakdown.length > 1 ? 'half' : check.proficiency
            return (
              <RollRow
                key={skill.id}
                entry={entry}
                mark={mark}
                sub={ABILITY_LABELS[check.ability].short}
                onOpen={openRecipe}
              />
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-parchment-600">
          ● proficiente · ◆ especialização · ½ meia proficiência · ▲ vantagem · ▼ desvantagem · ✕ falha automática
        </p>
      </section>
    </div>
  )
}
