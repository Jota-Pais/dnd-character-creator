import { useState } from 'react'
import { useCharacterStore } from '../../stores/characterStore'
import { getClass, isActiveCaster } from '../../utils/classUtils'
import {
  getCantrips,
  getSpellsByLevel,
  getMaxPreparedSpells,
  getLevel1SlotCount,
  isSpellStepComplete,
  SCHOOL_COLORS,
  SCHOOL_EMOJI,
} from '../../utils/spellUtils'
import { calculateModifier } from '../../utils/abilityScoreUtils'
import type { Spell } from '../../types/spell'
import type { SpellChoices } from '../../types/character'

type Tab = 'cantrips' | 'spells'

export function SpellStep() {
  const draft = useCharacterStore(state => state.draft)
  const updateSpellChoices = useCharacterStore(state => state.updateSpellChoices)
  const nextStep = useCharacterStore(state => state.nextStep)
  const prevStep = useCharacterStore(state => state.prevStep)

  const [tab, setTab] = useState<Tab>('cantrips')
  const [detail, setDetail] = useState<Spell | null>(null)

  const cls = draft.class ? getClass(draft.class) : undefined
  const sc = cls?.spellcasting ?? null
  const isCaster = !!cls && isActiveCaster(cls, 1)

  const choices: SpellChoices = draft.spellChoices ?? { cantrips: [], spells: [] }

  const canAdvance = isSpellStepComplete(cls ?? null, choices)

  // ── non-caster or half-caster at level 1 ──────────────────────────────────
  if (!cls || !isCaster || !sc) {
    return (
      <NonCasterScreen
        hasClass={!!cls}
        className={cls?.name ?? ''}
        onNext={nextStep}
        onPrev={prevStep}
      />
    )
  }

  const cantrips = sc.cantripsKnown > 0 ? getCantrips(draft.class!) : []
  const level1Spells = getSpellsByLevel(draft.class!, 1)

  const abilityScore = draft.abilityScores[sc.ability] ?? 10
  const abilityMod = calculateModifier(typeof abilityScore === 'number' ? abilityScore : 10)
  const maxPrepared = sc.type === 'prepared'
    ? getMaxPreparedSpells(sc, draft.abilityScores)
    : sc.spellsAtLevel1

  const slots = getLevel1SlotCount(cls)

  const accent = '#9b59b6'

  function toggleCantrip(id: string) {
    const cur = choices.cantrips
    if (cur.includes(id)) {
      updateSpellChoices({ cantrips: cur.filter(c => c !== id) })
    } else {
      if (cur.length >= sc.cantripsKnown) return
      updateSpellChoices({ cantrips: [...cur, id] })
    }
    if (detail?.id === id) setDetail(null)
  }

  function toggleSpell(id: string) {
    const cur = choices.spells
    if (cur.includes(id)) {
      updateSpellChoices({ spells: cur.filter(s => s !== id) })
    } else {
      if (sc.type !== 'prepared' && maxPrepared > 0 && cur.length >= maxPrepared) return
      updateSpellChoices({ spells: [...cur, id] })
    }
    if (detail?.id === id) setDetail(null)
  }

  const typeLabel = sc.type === 'prepared' ? 'Preparar' : 'Conhecer'
  const spellsLabel = sc.type === 'prepared'
    ? `${choices.spells.length}/${maxPrepared} preparadas`
    : `${choices.spells.length}/${maxPrepared} conhecidas`

  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* ── Lista ── */}
      <div className="lg:w-3/5">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1">
          Magias de {cls.name}
        </h2>
        <p className="text-parchment-500 text-sm mb-4">
          Atributo de conjuração: <strong className="text-parchment-300">{ABILITY_LABELS[sc.ability]}</strong>
          {' '} (modificador {abilityMod >= 0 ? '+' : ''}{abilityMod})
          {' · '} {slots} espaço{slots !== 1 ? 's' : ''} de 1° nível
        </p>

        {/* Abas */}
        {sc.cantripsKnown > 0 && (
          <div className="flex gap-2 mb-4">
            <TabButton active={tab === 'cantrips'} onClick={() => setTab('cantrips')} accent={accent}>
              ✦ Truques
              <Counter current={choices.cantrips.length} max={sc.cantripsKnown} />
            </TabButton>
            <TabButton active={tab === 'spells'} onClick={() => setTab('spells')} accent={accent}>
              📖 1° Nível
              <Counter current={choices.spells.length} max={maxPrepared} />
            </TabButton>
          </div>
        )}

        {/* Grade de cards */}
        {tab === 'cantrips' && (
          <>
            <SectionHint>
              Escolha {sc.cantripsKnown} truque{sc.cantripsKnown !== 1 ? 's' : ''} —
              disponíveis a qualquer momento, sem custo de espaço.
            </SectionHint>
            <SpellGrid
              spells={cantrips}
              selected={choices.cantrips}
              max={sc.cantripsKnown}
              onToggle={toggleCantrip}
              onDetail={setDetail}
              detailId={detail?.id}
            />
          </>
        )}

        {tab === 'spells' && (
          <>
            <SectionHint>
              {sc.type === 'prepared'
                ? `${typeLabel} até ${maxPrepared} magia${maxPrepared !== 1 ? 's' : ''} de 1° nível (modificador de ${ABILITY_LABELS[sc.ability]} + nível 1). Pode alterar após descanso longo.`
                : `${typeLabel} ${maxPrepared} magia${maxPrepared !== 1 ? 's' : ''} de 1° nível.`
              }
            </SectionHint>
            <SpellGrid
              spells={level1Spells}
              selected={choices.spells}
              max={sc.type === 'prepared' ? Infinity : maxPrepared}
              onToggle={toggleSpell}
              onDetail={setDetail}
              detailId={detail?.id}
            />
          </>
        )}
      </div>

      {/* ── Painel de detalhe ── */}
      <div className="lg:w-2/5">
        <div className="sticky top-4">
          {detail ? (
            <SpellDetail spell={detail} accent={accent} />
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-parchment-900">
              <div className="text-4xl mb-3">✨</div>
              <p className="text-parchment-600 font-fantasy text-sm">
                Clique em uma magia para ver os detalhes
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Nav mobile ── */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-parchment-900 px-4 py-3 flex justify-between items-center lg:hidden"
        style={{ backgroundColor: '#0a0704ee', backdropFilter: 'blur(8px)' }}
      >
        <button onClick={prevStep} className="px-4 py-2 text-parchment-500 hover:text-parchment-300 text-sm font-fantasy">
          ← Voltar
        </button>
        <div className="text-xs text-parchment-600 font-fantasy text-center">
          {sc.cantripsKnown > 0 && <div>{choices.cantrips.length}/{sc.cantripsKnown} truques</div>}
          <div>{spellsLabel}</div>
        </div>
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

      {/* ── Nav desktop ── */}
      <div className="hidden lg:flex lg:absolute lg:bottom-8 lg:right-8 gap-3">
        <button onClick={prevStep} className="px-4 py-2 text-parchment-500 hover:text-parchment-300 font-fantasy text-sm">
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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const ABILITY_LABELS: Record<string, string> = {
  STR: 'Força', DEX: 'Destreza', CON: 'Constituição',
  INT: 'Inteligência', WIS: 'Sabedoria', CHA: 'Carisma',
}

function NonCasterScreen({
  hasClass, className, onNext, onPrev,
}: {
  hasClass: boolean
  className: string
  onNext: () => void
  onPrev: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-6">
      <div className="text-5xl">⚔️</div>
      <div>
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-2">
          {hasClass ? `${className} não usa magia no nível 1` : 'Nenhuma classe selecionada'}
        </h2>
        <p className="text-parchment-500 text-sm max-w-md">
          {hasClass
            ? 'Esta classe não possui conjuração no nível 1. Continue para o próximo passo.'
            : 'Volte e selecione uma classe antes de continuar.'}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onPrev}
          className="px-4 py-2 text-parchment-500 hover:text-parchment-300 font-fantasy text-sm"
        >
          ← Voltar
        </button>
        <button
          onClick={onNext}
          disabled={!hasClass}
          className="px-6 py-2 rounded-xl font-fantasy font-bold text-sm tracking-wide transition-all"
          style={{
            backgroundColor: hasClass ? '#6b3fa0' : '#3a2614',
            color: hasClass ? '#f5e6c8' : '#5a3e24',
          }}
        >
          Continuar ✦
        </button>
      </div>
    </div>
  )
}

function TabButton({
  active, onClick, accent, children,
}: {
  active: boolean
  onClick: () => void
  accent: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl font-fantasy text-sm font-semibold transition-all"
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
    <span
      className="text-xs px-1.5 py-0.5 rounded font-mono font-bold"
      style={{
        backgroundColor: full ? '#1e5c2e40' : '#3a2e1e',
        color: full ? '#2ecc71' : '#7a6a52',
      }}
    >
      {current}/{max === Infinity ? '∞' : max}
    </span>
  )
}

function SectionHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-parchment-600 text-xs mb-3 italic">{children}</p>
  )
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] lg:max-h-[65vh] overflow-y-auto pr-1">
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
          <p className="font-fantasy text-sm font-bold text-parchment-200 leading-tight truncate">
            {spell.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color }}>{emoji} {spell.school}</span>
            {spell.concentration && (
              <span className="text-xs text-parchment-700">· conc.</span>
            )}
            {spell.ritual && (
              <span className="text-xs text-parchment-700">· ritual</span>
            )}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); if (!disabled || selected) onToggle() }}
          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all text-sm"
          style={{
            backgroundColor: selected ? `${color}30` : '#1a1208',
            border: `1.5px solid ${selected ? color : '#3a2e1e'}`,
            color: selected ? color : '#4a3e2e',
          }}
        >
          {selected ? '✓' : '+'}
        </button>
      </div>
      <p className="text-xs text-parchment-700 mt-1.5">
        {spell.castingTime} · {spell.range}
      </p>
    </div>
  )
}

function SpellDetail({ spell, accent }: { spell: Spell; accent: string }) {
  const color = SCHOOL_COLORS[spell.school] ?? accent
  const emoji = SCHOOL_EMOJI[spell.school] ?? '✨'

  // Render markdown-like description: convert ## headers and bullet points
  function renderDescription(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <p key={i} className="text-xs font-semibold font-fantasy text-parchment-400 uppercase tracking-wider mt-3 mb-1">
            {line.slice(3)}
          </p>
        )
      }
      if (line.startsWith('- ')) {
        return (
          <p key={i} className="text-sm text-parchment-500 pl-3 before:content-['•'] before:mr-2 before:text-parchment-700">
            {line.slice(2)}
          </p>
        )
      }
      if (line.trim() === '') return <div key={i} className="h-2" />
      // Skip the opening `## Descrição` label itself - already shown as section header
      return (
        <p key={i} className="text-sm text-parchment-500 leading-relaxed">{line}</p>
      )
    })
  }

  return (
    <div className="rounded-2xl border-2 p-5 max-h-[80vh] overflow-y-auto"
      style={{ borderColor: `${color}50`, backgroundColor: `${color}08` }}
    >
      <div className="mb-4">
        <h3 className="font-fantasy text-xl font-bold" style={{ color }}>
          {emoji} {spell.name}
        </h3>
        <p className="text-xs text-parchment-600 mt-0.5">
          {spell.level === 0 ? 'Truque' : `Magia de ${spell.level}° nível`} de {spell.school}
          {spell.ritual ? ' (ritual)' : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <Meta label="Tempo de Conjuração" value={spell.castingTime} />
        <Meta label="Alcance" value={spell.range} />
        <Meta label="Componentes" value={spell.components} />
        <Meta label="Duração" value={spell.duration} />
        {spell.concentration && <Meta label="" value="⚡ Concentração" />}
      </div>

      <div className="border-t border-parchment-900 pt-3">
        {renderDescription(spell.description)}
      </div>
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
