import { useState } from 'react'
import { useCharacterStore } from '../../stores/characterStore'
import { getClass, isActiveCaster } from '../../utils/classUtils'
import { allClassEntries, getPrimaryLevel } from '../../utils/multiclassUtils'
import { isStepComplete } from '../../utils/draftValidation'
import { InfoTooltip } from '../common/InfoTooltip'
import { StepNav } from '../../../../components/wizard/StepNav'
import {
  getCantrips,
  getSpellsByLevel,
  getMaxPreparedSpells,
  getMaxSpellLevel,
  getCantripsKnownCount,
  getSpellsKnownCount,
  getWizardSpellbookSize,
  getCombinedSpellSlots,
  getPactSlots,
  SCHOOL_COLORS,
  SCHOOL_EMOJI,
} from '../../utils/spellUtils'
import { calculateModifier } from '../../utils/abilityScoreUtils'
import type { Spell } from '../../types/spell'
import type { GameClass } from '../../types/class'
import type { SpellChoices, BaseAbilityScores, ClassEntry } from '../../types/character'

type Tab = 'cantrips' | number // number = spell level

const ORDINALS = ['', '1°', '2°', '3°', '4°', '5°', '6°', '7°', '8°', '9°']
const ACCENT = '#9b59b6'

export function SpellStep() {
  const draft = useCharacterStore(state => state.draft)
  const updateSpellChoices = useCharacterStore(state => state.updateSpellChoices)
  const updateAdditionalSpellChoices = useCharacterStore(state => state.updateAdditionalSpellChoices)
  const nextStep = useCharacterStore(state => state.nextStep)
  const prevStep = useCharacterStore(state => state.prevStep)

  const [detail, setDetail] = useState<Spell | null>(null)

  // Classes conjuradoras (com magias selecionáveis) ativas no nível que têm: primária + adicionais.
  const casters = allClassEntries(draft)
    .map(e => ({ entry: e, cls: getClass(e.classId) }))
    .filter((x): x is { entry: ClassEntry; cls: GameClass } =>
      !!x.cls && !!x.cls.spellcasting && isActiveCaster(x.cls, x.entry.level))

  const canAdvance = isStepComplete(draft, 'spells')

  if (casters.length === 0) {
    return (
      <NonCasterScreen
        hasClass={!!draft.class}
        className={draft.class ? getClass(draft.class)?.name ?? '' : ''}
        level={getPrimaryLevel(draft)}
        onNext={nextStep}
        onPrev={prevStep}
      />
    )
  }

  const combinedSlots = getCombinedSpellSlots(draft)
  const pact = getPactSlots(draft)
  const multi = casters.length > 1

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-24">

      {/* ── Lista (seções por classe) ── */}
      <div className="lg:w-3/5">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1">
          {multi ? 'Magias' : `Magias de ${casters[0].cls.name}`}
        </h2>
        <p className="text-parchment-500 text-sm mb-4">
          {multi
            ? 'Cada classe conjuradora escolhe as próprias magias; os espaços são um pool único.'
            : 'Escolha seus truques e magias.'}
        </p>

        <CombinedSlotSummary slots={combinedSlots} pact={pact} />

        {casters.map(({ entry, cls }) => (
          <ClassSpellSection
            key={cls.id}
            cls={cls}
            level={entry.level}
            choices={entry.spellChoices}
            abilityScores={draft.abilityScores}
            multi={multi}
            onDetail={setDetail}
            detailId={detail?.id}
            onChange={patch =>
              cls.id === draft.class
                ? updateSpellChoices(patch)
                : updateAdditionalSpellChoices(cls.id, patch)}
          />
        ))}
      </div>

      {/* ── Painel de detalhe (compartilhado) ── */}
      <div className="lg:w-2/5">
        <div className="sticky top-4">
          {detail ? (
            <SpellDetail spell={detail} accent={ACCENT} />
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-parchment-900">
              <div className="text-4xl mb-3">✨</div>
              <p className="text-parchment-600 font-fantasy text-sm">Clique em uma magia para ver os detalhes</p>
            </div>
          )}
        </div>
      </div>

      <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={canAdvance} accent={ACCENT} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Seção de uma classe conjuradora (tabs + grid; escreve nas escolhas dela)
// ─────────────────────────────────────────────────────────────────────────────

function ClassSpellSection({
  cls, level, choices, abilityScores, multi, onDetail, detailId, onChange,
}: {
  cls: GameClass
  level: number
  choices: SpellChoices
  abilityScores: BaseAbilityScores
  multi: boolean
  onDetail: (s: Spell) => void
  detailId?: string
  onChange: (patch: Partial<SpellChoices>) => void
}) {
  const sc = cls.spellcasting!
  const [tab, setTab] = useState<Tab>('cantrips')

  const cantripsNeeded = getCantripsKnownCount(cls.id, level) || sc.cantripsKnown
  const maxSpellLevel = getMaxSpellLevel(cls.id, level)
  const maxSpells =
    sc.type === 'prepared' ? getMaxPreparedSpells(sc, abilityScores, level)
    : sc.type === 'hybrid' ? getWizardSpellbookSize(level)
    : getSpellsKnownCount(cls.id, level) || sc.spellsAtLevel1

  const score = abilityScores[sc.ability]
  const abilityMod = calculateModifier(typeof score === 'number' ? score : 10)

  const cantrips = cantripsNeeded > 0 ? getCantrips(cls.id) : []
  const hasTabs = cantripsNeeded > 0 || maxSpellLevel > 0
  const spellLevelTabs = Array.from({ length: maxSpellLevel }, (_, i) => i + 1)
  const activeTab: Tab = tab === 'cantrips'
    ? (cantripsNeeded > 0 ? 'cantrips' : (spellLevelTabs[0] ?? 'cantrips'))
    : tab

  function toggleCantrip(id: string) {
    const cur = choices.cantrips
    if (cur.includes(id)) onChange({ cantrips: cur.filter(c => c !== id) })
    else if (cur.length < cantripsNeeded) onChange({ cantrips: [...cur, id] })
  }
  function toggleSpell(id: string) {
    const cur = choices.spells
    if (cur.includes(id)) onChange({ spells: cur.filter(s => s !== id) })
    else if (maxSpells === Infinity || cur.length < maxSpells) onChange({ spells: [...cur, id] })
  }

  const spellsLabel =
    sc.type === 'prepared' ? `${choices.spells.length} preparadas (máx. ${maxSpells})`
    : sc.type === 'hybrid' ? `${choices.spells.length}/${maxSpells} no grimório`
    : `${choices.spells.length}/${maxSpells} conhecidas`

  return (
    <div className="mb-6 rounded-xl border border-parchment-900 bg-parchment-950/40 p-4">
      <h3 className="font-fantasy text-lg font-bold text-parchment-200">
        {multi && <span className="text-parchment-500">{cls.name} · </span>}
        <span className="text-parchment-400 text-sm font-normal">
          {ABILITY_LABELS[sc.ability]} ({abilityMod >= 0 ? '+' : ''}{abilityMod}) · nível {level}
        </span>
      </h3>

      {hasTabs && (
        <div className="flex flex-wrap gap-2 mb-3 mt-3">
          {cantripsNeeded > 0 && (
            <TabButton active={activeTab === 'cantrips'} onClick={() => setTab('cantrips')} accent={ACCENT}>
              ✦ Truques <Counter current={choices.cantrips.length} max={cantripsNeeded} />
            </TabButton>
          )}
          {spellLevelTabs.map(lvl => (
            <TabButton key={lvl} active={activeTab === lvl} onClick={() => setTab(lvl)} accent={ACCENT}>
              {ORDINALS[lvl]} nível
              {lvl === 1 && sc.type !== 'prepared' && <Counter current={choices.spells.length} max={maxSpells} />}
            </TabButton>
          ))}
        </div>
      )}

      <p className="text-parchment-600 text-xs mb-3 font-fantasy">{spellsLabel}</p>

      {activeTab === 'cantrips' && (
        <>
          <SectionHint>
            Escolha {cantripsNeeded} truque{cantripsNeeded !== 1 ? 's' : ''} <InfoTooltip term="truque" />.
          </SectionHint>
          <SpellGrid spells={cantrips} selected={choices.cantrips} max={cantripsNeeded} onToggle={toggleCantrip} onDetail={onDetail} detailId={detailId} />
        </>
      )}
      {typeof activeTab === 'number' && (
        <>
          <SectionHint>
            {sc.type === 'prepared'
              ? `Prepare magias de ${ORDINALS[activeTab]} nível (pode trocar após descanso longo).`
              : sc.type === 'hybrid'
                ? `Adicione magias de ${ORDINALS[activeTab]} nível ao grimório.`
                : `Escolha magias de ${ORDINALS[activeTab]} nível.`}
          </SectionHint>
          <SpellGrid spells={getSpellsByLevel(cls.id, activeTab)} selected={choices.spells} max={maxSpells} onToggle={toggleSpell} onDetail={onDetail} detailId={detailId} />
        </>
      )}
    </div>
  )
}

function CombinedSlotSummary({ slots, pact }: { slots: number[]; pact: { slots: number; slotLevel: number } | null }) {
  const nonZero = slots.map((count, i) => ({ spellLevel: i + 1, count })).filter(s => s.count > 0)
  if (nonZero.length === 0 && !pact) return null
  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 px-3 py-2 mb-4 space-y-1.5">
      {nonZero.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <p className="text-xs font-fantasy text-parchment-600 uppercase tracking-widest">Espaços de Magia</p>
          {nonZero.map(({ spellLevel, count }) => (
            <span key={spellLevel} className="text-center">
              <span className="text-xs font-fantasy font-bold" style={{ color: ACCENT }}>{count}×</span>
              <span className="text-xs text-parchment-700 ml-1">{ORDINALS[spellLevel]}</span>
            </span>
          ))}
        </div>
      )}
      {pact && (
        <div className="flex flex-wrap gap-3 items-center">
          <p className="text-xs font-fantasy text-parchment-600 uppercase tracking-widest">Magia de Pacto</p>
          <span>
            <span className="text-xs font-fantasy font-bold" style={{ color: ACCENT }}>{pact.slots}×</span>
            <span className="text-xs text-parchment-700 ml-1">{ORDINALS[pact.slotLevel]}</span>
          </span>
          <span className="text-xs text-parchment-700 ml-auto italic">recupera em descanso curto</span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes (inalterados)
// ─────────────────────────────────────────────────────────────────────────────

const ABILITY_LABELS: Record<string, string> = {
  STR: 'Força', DEX: 'Destreza', CON: 'Constituição',
  INT: 'Inteligência', WIS: 'Sabedoria', CHA: 'Carisma',
}

function NonCasterScreen({
  hasClass, className, level, onNext, onPrev,
}: {
  hasClass: boolean
  className: string
  level: number
  onNext: () => void
  onPrev: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-6">
      <div className="text-5xl">⚔️</div>
      <div>
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-2">
          {hasClass ? `${className} não usa magia no nível ${level}` : 'Nenhuma classe selecionada'}
        </h2>
        <p className="text-parchment-500 text-sm max-w-md">
          {hasClass
            ? 'Nenhuma das suas classes conjura neste nível. Continue para o próximo passo.'
            : 'Volte e selecione uma classe antes de continuar.'}
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={onPrev} className="px-4 py-2 text-parchment-500 hover:text-parchment-300 font-fantasy text-sm">← Voltar</button>
        <button
          onClick={onNext}
          disabled={!hasClass}
          className="px-6 py-2 rounded-xl font-fantasy font-bold text-sm tracking-wide transition-all"
          style={{ backgroundColor: hasClass ? '#6b3fa0' : '#3a2614', color: hasClass ? '#f5e6c8' : '#5a3e24' }}
        >
          Continuar ✦
        </button>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, accent, children }: { active: boolean; onClick: () => void; accent: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-fantasy text-sm font-semibold transition-all"
      style={{
        backgroundColor: active ? `${accent}20` : 'transparent',
        color: active ? accent : '#7a6a52',
        border: `1.5px solid ${active ? `${accent}60` : '#3a2e1e'}`,
      }}
    >
      {children}
    </button>
  )
}

function Counter({ current, max }: { current: number; max: number }) {
  const full = max !== Infinity && current >= max
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-mono font-bold" style={{ backgroundColor: full ? '#1e5c2e40' : '#3a2e1e', color: full ? '#2ecc71' : '#7a6a52' }}>
      {current}/{max === Infinity ? '∞' : max}
    </span>
  )
}

function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className="text-parchment-600 text-xs mb-3 italic">{children}</p>
}

function SpellGrid({
  spells, selected, max, onToggle, onDetail, detailId,
}: {
  spells: Spell[]
  selected: string[]
  max: number
  onToggle: (id: string) => void
  onDetail: (spell: Spell) => void
  detailId?: string
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
      {spells.map(spell => (
        <SpellCard
          key={spell.id}
          spell={spell}
          selected={selected.includes(spell.id)}
          disabled={!selected.includes(spell.id) && max !== Infinity && selected.length >= max}
          active={detailId === spell.id}
          onToggle={() => onToggle(spell.id)}
          onDetail={() => onDetail(spell)}
        />
      ))}
    </div>
  )
}

function SpellCard({
  spell, selected, disabled, active, onToggle, onDetail,
}: {
  spell: Spell
  selected: boolean
  disabled: boolean
  active: boolean
  onToggle: () => void
  onDetail: () => void
}) {
  const color = SCHOOL_COLORS[spell.school] ?? '#7a6a52'
  const emoji = SCHOOL_EMOJI[spell.school] ?? '✨'
  return (
    <div
      className="rounded-xl border p-3 cursor-pointer transition-all select-none"
      style={{
        borderColor: selected ? `${color}80` : active ? `${color}40` : '#2a1f14',
        backgroundColor: selected ? `${color}12` : active ? `${color}08` : '#0d0a06',
        opacity: disabled ? 0.45 : 1,
      }}
      onClick={onDetail}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-fantasy text-sm font-bold text-parchment-200 leading-tight truncate">{spell.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color }}>{emoji} {spell.school}</span>
            {spell.concentration && <span className="text-xs text-parchment-700">· conc.</span>}
            {spell.ritual && <span className="text-xs text-parchment-700">· ritual</span>}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); if (!disabled || selected) onToggle() }}
          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all text-sm"
          style={{ backgroundColor: selected ? `${color}30` : '#1a1208', border: `1.5px solid ${selected ? color : '#3a2e1e'}`, color: selected ? color : '#4a3e2e' }}
        >
          {selected ? '✓' : '+'}
        </button>
      </div>
      <p className="text-xs text-parchment-700 mt-1.5">{spell.castingTime} · {spell.range}</p>
    </div>
  )
}

function SpellDetail({ spell, accent }: { spell: Spell; accent: string }) {
  const color = SCHOOL_COLORS[spell.school] ?? accent
  const emoji = SCHOOL_EMOJI[spell.school] ?? '✨'
  function renderDescription(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <p key={i} className="text-xs font-semibold font-fantasy text-parchment-400 uppercase tracking-wider mt-3 mb-1">{line.slice(3)}</p>
      if (line.startsWith('- ')) return <p key={i} className="text-sm text-parchment-500 pl-3 before:content-['•'] before:mr-2 before:text-parchment-700">{line.slice(2)}</p>
      if (line.trim() === '') return <div key={i} className="h-2" />
      return <p key={i} className="text-sm text-parchment-500 leading-relaxed">{line}</p>
    })
  }
  return (
    <div className="rounded-2xl border-2 p-5 max-h-[80vh] overflow-y-auto" style={{ borderColor: `${color}50`, backgroundColor: `${color}08` }}>
      <div className="mb-4">
        <h3 className="font-fantasy text-xl font-bold" style={{ color }}>{emoji} {spell.name}</h3>
        <p className="text-xs text-parchment-600 mt-0.5">
          {spell.level === 0 ? 'Truque' : `Magia de ${spell.level}° nível`} de {spell.school}{spell.ritual ? ' (ritual)' : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <Meta label="Tempo de Conjuração" value={spell.castingTime} />
        <Meta label="Alcance" value={spell.range} />
        <Meta label="Componentes" value={spell.components} />
        <Meta label="Duração" value={spell.duration} />
        {spell.concentration && <Meta label="" value="⚡ Concentração" />}
      </div>
      <div className="border-t border-parchment-900 pt-3">{renderDescription(spell.description)}</div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      {label && <p className="text-xs text-parchment-700">{label}</p>}
      <p className="text-parchment-400 text-xs font-medium">{value}</p>
    </div>
  )
}
