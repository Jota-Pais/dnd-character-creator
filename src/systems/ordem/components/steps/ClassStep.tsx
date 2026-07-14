import { useOrdemStore } from '../../stores/characterStore'
import { ORDEM_CLASSES, getOrdemClass } from '../../utils/classUtils'
import { getSkillName } from '../../utils/skillUtils'
import { getCursedDerivedStats, getSheetAttributes } from '../../utils/curseUtils'
import { getRequiredFreeSkillCount } from '../../utils/characterUtils'
import { getNexIndex } from '../../utils/progressionUtils'

/** Cálculo por extenso de PV/PE: "12 + 1 VIG + 1×(2 + 1 VIG)". */
function statBreakdown(initial: number, perNex: number, attr: number, abbrev: string, tiers: number): string {
  const base = `${initial} + ${attr} ${abbrev}`
  return tiers > 0 ? `${base} + ${tiers}×(${perNex} + ${attr} ${abbrev})` : base
}
import { isStepComplete } from '../../utils/draftValidation'
import { StepNav } from '../common/StepNav'
import type { OrdemClass } from '../../types/class'

const CLASS_EMOJI: Record<string, string> = {
  combatant: '⚔️',
  specialist: '🧠',
  occultist: '🔮',
}

const WEAPON_LABELS: Record<string, string> = { simple: 'simples', tactical: 'táticas', heavy: 'pesadas' }
const ARMOR_LABELS: Record<string, string> = { light: 'leves', heavy: 'pesadas' }

export function ClassStep() {
  const draft = useOrdemStore(state => state.draft)
  const setClass = useOrdemStore(state => state.setClass)
  const nextStep = useOrdemStore(state => state.nextStep)
  const prevStep = useOrdemStore(state => state.prevStep)

  const selected: OrdemClass | undefined = draft.class ? getOrdemClass(draft.class) : undefined
  const canAdvance = isStepComplete(draft, 'class')
  // Cálculo completo (Aumentos de Atributo + maldições), senão o preview diverge da Revisão ao voltar aqui.
  const stats = selected ? getCursedDerivedStats(draft, selected) : null
  const attrs = getSheetAttributes(draft)
  const tiers = Math.max(0, getNexIndex(draft.nex))

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-1/2 xl:w-2/5">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1">
          Qual treinamento você recebeu na Ordem?
        </h2>
        <p className="text-parchment-500 text-sm mb-5">
          Sua classe define suas habilidades de combate, especialização e conexão com o paranormal.
        </p>

        <div className="space-y-2.5">
          {ORDEM_CLASSES.map(cls => (
            <button
              key={cls.id}
              onClick={() => setClass(cls.id)}
              className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-start gap-3"
              style={{
                borderColor: draft.class === cls.id ? '#dc2626' : '#2a2213',
                backgroundColor: draft.class === cls.id ? '#dc262615' : '#0a070499',
              }}
            >
              <span className="text-2xl shrink-0">{CLASS_EMOJI[cls.id]}</span>
              <div className="min-w-0">
                <p className="font-fantasy font-bold text-parchment-200">{cls.name}</p>
                <p className="text-parchment-500 text-xs mt-0.5 leading-relaxed">{cls.description}</p>
                {/* Fórmulas mecânicas da classe (livro): iniciais no NEX 0% + ganho por nível de exposição. */}
                <p className="text-xs mt-1.5 font-mono leading-relaxed" style={{ color: '#c96a6a' }}>
                  PV {cls.hp.initialFlat}+VIG <span className="text-parchment-600">(+{cls.hp.perNexFlat}+VIG por NEX)</span>{' · '}
                  PE {cls.pe.initialFlat}+PRE <span className="text-parchment-600">(+{cls.pe.perNexFlat}+PRE por NEX)</span>{' · '}
                  SAN {cls.sanity.initialFlat} <span className="text-parchment-600">(+{cls.sanity.perNex} por NEX)</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:w-1/2 xl:w-3/5">
        {selected && stats ? (
          <div className="sticky top-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label={`PV (NEX ${draft.nex}%)`} value={String(stats.hp)} detail={statBreakdown(selected.hp.initialFlat, selected.hp.perNexFlat, attrs.vigor, 'VIG', tiers)} />
              <Stat label={`PE (NEX ${draft.nex}%)`} value={String(stats.pe)} detail={statBreakdown(selected.pe.initialFlat, selected.pe.perNexFlat, attrs.presence, 'PRE', tiers)} />
              <Stat label="Sanidade" value={String(stats.sanity)} detail={tiers > 0 ? `${selected.sanity.initialFlat} + ${tiers}×${selected.sanity.perNex}` : `${selected.sanity.initialFlat}`} />
            </div>
            <p className="text-parchment-600 text-xs -mt-2">
              Cálculo com seus atributos atuais e {tiers} {tiers === 1 ? 'nível' : 'níveis'} de exposição (NEX {draft.nex}%);
              valores iniciais valem no NEX 0%.
            </p>

            <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
              <SectionTitle>Perícias Treinadas</SectionTitle>
              <ul className="text-parchment-400 text-sm space-y-1">
                {selected.skills.fixed.length > 0 && (
                  <li>Fixas: {selected.skills.fixed.map(getSkillName).join(', ')}</li>
                )}
                {selected.skills.choiceGroups.map((g, i) => (
                  <li key={i}>Escolha {g.count} de: {g.from.map(getSkillName).join(' ou ')}</li>
                ))}
                <li>+ {getRequiredFreeSkillCount(draft, selected)} à escolha livre ({selected.skills.freeChoiceBase} + Intelecto{getRequiredFreeSkillCount(draft, selected) > selected.skills.freeChoiceBase + draft.attributes.intellect ? ' + repetida da origem' : ''})</li>
              </ul>
            </div>

            <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
              <SectionTitle>Proficiências</SectionTitle>
              <p className="text-parchment-400 text-sm">
                Armas {selected.weaponProficiencies.map(w => WEAPON_LABELS[w]).join(', ')}
                {selected.armorProficiencies.length > 0 && `; proteções ${selected.armorProficiencies.map(a => ARMOR_LABELS[a]).join(', ')}`}
              </p>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-parchment-900">
            <div className="text-4xl mb-3">👈</div>
            <p className="text-parchment-600 font-fantasy text-sm">Selecione uma classe para ver os detalhes</p>
          </div>
        )}
      </div>

      <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={canAdvance} disabledReason="Escolha uma Classe" />
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

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-3 text-center">
      <p className="text-parchment-700 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-gold-400 font-fantasy font-bold text-xl">{value}</p>
      {detail && <p className="text-parchment-500 text-[11px] font-mono mt-1 leading-snug">= {detail}</p>}
    </div>
  )
}
