import { useState } from 'react'
import { useCharacterStore } from '../../stores/characterStore'
import { getClass } from '../../utils/classUtils'
import { getPrimaryLevel } from '../../utils/multiclassUtils'
import { isStepComplete } from '../../utils/draftValidation'
import { InfoTooltip } from '../common/InfoTooltip'
import { StepNav } from '../../../../components/wizard/StepNav'
import { RuleText } from '../common/RuleText'
import {
  getSpell,
  getCantrips,
  getSpellsByLevel,
  getMaxSpellLevel,
  getCantripsNeeded,
  getRequiredCantrips,
  getCantripColumn,
  getSpellColumn,
  describeSecretsInColumn,
  getSchoolRestrictionStatus,
  isAllowedBySchoolRestriction,
  getCasterEntries,
  getCombinedSpellSlots,
  getPactSlots,
  getSpellChoiceOverflows,
  SCHOOL_COLORS,
  SCHOOL_EMOJI,
  type CasterEntry,
} from '../../utils/spellUtils'
import { calculateModifier } from '../../utils/abilityScoreUtils'
import { getFinalAbilityScores } from '../../utils/asiUtils'
import type { Spell } from '../../types/spell'
import type { SpellChoices } from '../../types/character'
import type { AbilityScore } from '../../types/race'

type Tab = 'cantrips' | number // number = spell level

const ORDINALS = ['', '1°', '2°', '3°', '4°', '5°', '6°', '7°', '8°', '9°']
const ACCENT = '#9b59b6'

export function SpellStep() {
  const draft = useCharacterStore(state => state.draft)
  const updateSpellChoices = useCharacterStore(state => state.updateSpellChoices)
  const updateAdditionalSpellChoices = useCharacterStore(state => state.updateAdditionalSpellChoices)
  const nextStep = useCharacterStore(state => state.nextStep)
  const prevStep = useCharacterStore(state => state.prevStep)
  const goToStep = useCharacterStore(state => state.goToStep)

  const [detail, setDetail] = useState<Spell | null>(null)

  // Classes conjuradoras ativas no nível que têm (primária + adicionais); a subclasse conta
  // (Cavaleiro Arcano, Trapaceiro Arcano).
  const casters = getCasterEntries(draft)
  // Magias vem depois de Atributos e Aprimoramentos justamente para usar os valores finais
  // (raça + aumentos + talentos) — os mesmos da Revisão e da ficha imprimível.
  const finalScores = getFinalAbilityScores(draft)

  const canAdvance = isStepComplete(draft, 'spells')

  if (casters.length === 0) {
    return (
      <NonCasterScreen
        hasClass={!!draft.class}
        className={draft.class ? getClass(draft.class)?.name ?? '' : ''}
        level={getPrimaryLevel(draft)}
        onNext={nextStep}
        onPrev={prevStep}
        onGoToClass={() => goToStep('class')}
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
          {multi ? 'Magias' : `Magias de ${casters[0].casting.label}`}
        </h2>
        <p className="text-parchment-500 text-sm mb-4">
          {multi
            ? 'Cada classe conjuradora escolhe as próprias magias; os espaços são um pool único.'
            : 'Escolha seus truques e magias.'}
        </p>

        <CombinedSlotSummary slots={combinedSlots} pact={pact} />

        {casters.map(caster => (
          <ClassSpellSection
            key={caster.cls.id}
            caster={caster}
            abilityScores={finalScores}
            multi={multi}
            onDetail={setDetail}
            detailId={detail?.id}
            onChange={patch =>
              caster.cls.id === draft.class
                ? updateSpellChoices(patch)
                : updateAdditionalSpellChoices(caster.cls.id, patch)}
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

      <StepNav
        onPrev={prevStep}
        onNext={nextStep}
        accent={ACCENT}
        pendingReason={canAdvance ? undefined : 'Magias pendentes'}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Seção de uma classe conjuradora (tabs + grid; escreve nas escolhas dela)
// ─────────────────────────────────────────────────────────────────────────────

function ClassSpellSection({
  caster, abilityScores, multi, onDetail, detailId, onChange,
}: {
  caster: CasterEntry
  /** Atributos finais (getFinalAbilityScores), nunca os base. */
  abilityScores: Record<AbilityScore, number>
  multi: boolean
  onDetail: (s: Spell) => void
  detailId?: string
  onChange: (patch: Partial<SpellChoices>) => void
}) {
  const { cls, casting, entry } = caster
  const { level, spellChoices: choices } = entry
  const sc = casting.spellcasting
  const subclassId = entry.classChoices.subclass
  const [tab, setTab] = useState<Tab>('cantrips')

  const cantripsNeeded = getCantripsNeeded(casting, level)
  const required = getRequiredCantrips(sc)
  const maxSpellLevel = getMaxSpellLevel(cls.id, level, subclassId)
  // Segredos Mágicos do bardo ocupam vaga das colunas (p. 54): a etapa escolhe só o que sobra.
  const secrets = caster.knownSecrets
  const cantripCol = getCantripColumn(casting, level, choices, secrets)
  const spellCol = getSpellColumn(casting, level, abilityScores, choices, secrets)
  const maxSpells = spellCol.toChoose
  const cantripsToChoose = cantripCol.toChoose
  const spellBudget = describeSecretsInColumn(spellCol)
  const cantripBudget = describeSecretsInColumn(cantripCol)
  const secretCantrips = secrets.cantrips.filter(id => !caster.cantrips.includes(id))
  const secretSpells = secrets.spells.filter(id => !choices.spells.includes(id))
  const school = getSchoolRestrictionStatus(sc, level, choices.spells)
  const overflows = getSpellChoiceOverflows(caster, abilityScores)

  const abilityMod = calculateModifier(abilityScores[sc.ability])

  const cantrips = cantripsNeeded > 0 ? getCantrips(casting.spellList) : []
  const hasTabs = cantripsNeeded > 0 || maxSpellLevel > 0
  const spellLevelTabs = Array.from({ length: maxSpellLevel }, (_, i) => i + 1)
  const activeTab: Tab = tab === 'cantrips'
    ? (cantripsNeeded > 0 ? 'cantrips' : (spellLevelTabs[0] ?? 'cantrips'))
    : tab

  // Os truques dados pela característica (mãos mágicas do Trapaceiro) aparecem marcados e
  // travados; contam no total, mas não são gravados nas escolhas.
  function toggleCantrip(id: string) {
    if (required.includes(id)) return
    const cur = choices.cantrips.filter(c => !required.includes(c))
    if (cur.includes(id)) onChange({ cantrips: cur.filter(c => c !== id) })
    else if (cur.length + required.length < cantripsToChoose) onChange({ cantrips: [...cur, id] })
  }
  function toggleSpell(id: string) {
    const cur = choices.spells
    const spell = getSpell(id)
    if (cur.includes(id)) onChange({ spells: cur.filter(s => s !== id) })
    else if (
      (maxSpells === Infinity || cur.length < maxSpells)
      && (!spell || isAllowedBySchoolRestriction(sc, level, cur, spell))
    ) onChange({ spells: [...cur, id] })
  }

  const spellsLabel =
    sc.type === 'prepared' ? `${choices.spells.length} preparadas (máx. ${maxSpells})`
    : sc.type === 'hybrid' ? `${choices.spells.length}/${maxSpells} no grimório`
    : `${choices.spells.length}/${maxSpells} conhecidas${spellBudget ? ` (${spellBudget})` : ''}`

  return (
    <div className="mb-6 rounded-xl border border-parchment-900 bg-parchment-950/40 p-4">
      <h3 className="font-fantasy text-lg font-bold text-parchment-200">
        {multi && <span className="text-parchment-500">{casting.label} · </span>}
        <span className="text-parchment-400 text-sm font-normal">
          {ABILITY_LABELS[sc.ability]} ({abilityMod >= 0 ? '+' : ''}{abilityMod}) · nível {level}
        </span>
      </h3>

      {hasTabs && (
        <div className="flex flex-wrap gap-2 mb-3 mt-3">
          {cantripsNeeded > 0 && (
            <TabButton active={activeTab === 'cantrips'} onClick={() => setTab('cantrips')} accent={ACCENT}>
              ✦ Truques <Counter current={caster.cantrips.length} max={cantripsToChoose} />
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

      {(secretSpells.length > 0 || secretCantrips.length > 0) && (
        <p className="text-xs mb-3 rounded-lg border border-parchment-900 bg-parchment-950/60 px-3 py-2 text-parchment-400">
          ✦ Seus Segredos Mágicos já estão contados aqui — o livro diz que eles fazem parte do número de
          magias conhecidas do bardo (p. 54), então ocupam vaga em vez de somar por cima.
          {secretSpells.length > 0 && <> Magias: {formatSpellNames(secretSpells)} — {spellBudget}.</>}
          {secretCantrips.length > 0 && <> Truques: {formatSpellNames(secretCantrips)} — {cantripBudget}.</>}
          {' '}Para trocar um Segredo, volte à etapa Classe.
        </p>
      )}

      {/* Atributo baixado, ou Segredos que passaram a ocupar vaga: a etapa não apaga nada, só avisa do excesso. */}
      {overflows.map(o => (
        <p key={o.text} className="text-xs mb-3 rounded-lg border border-red-900/60 bg-red-950/20 px-3 py-2 text-red-400">
          ⚠ {o.text}
        </p>
      ))}

      {activeTab === 'cantrips' && (
        <>
          <SectionHint>
            {required.length > 0
              ? <>Você conhece {cantripsNeeded} truques <InfoTooltip term="truque" />: {formatSpellNames(required)} já {required.length > 1 ? 'vêm' : 'vem'} com a característica; escolha os outros {cantripsNeeded - required.length}.</>
              : secretCantrips.length > 0
                ? <>Você conhece {cantripsNeeded} truques <InfoTooltip term="truque" />: {formatSpellNames(secretCantrips)} já {secretCantrips.length > 1 ? 'ocupam' : 'ocupa'} vaga como Segredo Mágico; escolha os outros {cantripsToChoose}.</>
                : <>Escolha {cantripsNeeded} truque{cantripsNeeded !== 1 ? 's' : ''} <InfoTooltip term="truque" />.</>}
          </SectionHint>
          <SpellGrid spells={cantrips} selected={caster.cantrips} locked={[...required, ...secrets.cantrips]} secretIds={secrets.cantrips} max={cantripsToChoose} onToggle={toggleCantrip} onDetail={onDetail} detailId={detailId} />
        </>
      )}
      {typeof activeTab === 'number' && (
        <>
          <SectionHint>
            {sc.type === 'prepared'
              ? `Prepare magias de ${ORDINALS[activeTab]} nível (pode trocar após descanso longo).`
              : sc.type === 'hybrid'
                ? `Adicione magias de ${ORDINALS[activeTab]} nível ao grimório.`
                : spellBudget
                  ? `Escolha magias de ${ORDINALS[activeTab]} nível — ${maxSpells} no total, pois ${secretSpells.length === 1 ? 'uma vaga já é' : `${secretSpells.length} vagas já são`} dos Segredos Mágicos.`
                  : `Escolha magias de ${ORDINALS[activeTab]} nível.`}
          </SectionHint>
          {school && (
            <p className="text-xs mb-3" style={{ color: school.freeUsed > school.freeSlots ? '#e74c3c' : '#a08a6a' }}>
              Escolas: {formatSchools(school.schools)}. Fora delas, só nas escolhas livres:{' '}
              <strong>{school.freeUsed}/{school.freeSlots}</strong>
              {' '}(uma a cada um destes níveis da classe: {sc.schoolRestriction!.freeChoices.map(c => `${c.level}°`).join(', ')}).
            </p>
          )}
          <SpellGrid
            spells={getSpellsByLevel(casting.spellList, activeTab)}
            selected={choices.spells}
            locked={secrets.spells}
            secretIds={secrets.spells}
            max={maxSpells}
            isAllowed={spell => isAllowedBySchoolRestriction(sc, level, choices.spells, spell)}
            onToggle={toggleSpell}
            onDetail={onDetail}
            detailId={detailId}
          />
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
  hasClass, className, level, onNext, onPrev, onGoToClass,
}: {
  hasClass: boolean
  className: string
  level: number
  onNext: () => void
  onPrev: () => void
  onGoToClass: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-6">
      <div className="text-5xl">{hasClass ? '⚔️' : '🔒'}</div>
      <div>
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-2">
          {hasClass ? `${className} não usa magia no nível ${level}` : 'Falta um passo antes'}
        </h2>
        <p className="text-parchment-500 text-sm max-w-md">
          {hasClass
            ? 'Nenhuma das suas classes conjura neste nível. Continue para o próximo passo.'
            : 'Quem conjura, e o que pode conjurar, vem da classe. Pode escolher a classe agora e voltar, ou seguir preenchendo outro passo — nada se perde.'}
        </p>
      </div>
      {!hasClass && (
        <button
          onClick={onGoToClass}
          className="px-6 py-2.5 rounded-xl font-fantasy font-bold text-sm tracking-wide transition-all"
          style={{ backgroundColor: '#6b3fa0', color: '#f5e6c8' }}
        >
          Ir para Classe →
        </button>
      )}
      <StepNav
        onPrev={onPrev}
        onNext={onNext}
        accent={ACCENT}
        pendingReason={hasClass ? undefined : 'Depende da etapa Classe'}
      />
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
  spells, selected, locked = [], secretIds = [], max, isAllowed, onToggle, onDetail, detailId,
}: {
  spells: Spell[]
  selected: string[]
  /** Já conhecidas pela característica: marcadas e sem como desmarcar. */
  locked?: string[]
  /** Das travadas, as que vêm dos Segredos Mágicos (trocam-se na etapa Classe). */
  secretIds?: string[]
  max: number
  /** Regra extra pra acrescentar (restrição de escola); sem ela, só o teto conta. */
  isAllowed?: (spell: Spell) => boolean
  onToggle: (id: string) => void
  onDetail: (spell: Spell) => void
  detailId?: string
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
      {spells.map(spell => {
        const isSelected = selected.includes(spell.id)
        const isLocked = locked.includes(spell.id)
        return (
          <SpellCard
            key={spell.id}
            spell={spell}
            selected={isSelected || isLocked}
            locked={isLocked}
            lockedTitle={secretIds.includes(spell.id) ? 'Segredo Mágico — troque na etapa Classe' : undefined}
            disabled={!isSelected && !isLocked && (
              (max !== Infinity && selected.length >= max) || (isAllowed ? !isAllowed(spell) : false)
            )}
            active={detailId === spell.id}
            onToggle={() => onToggle(spell.id)}
            onDetail={() => onDetail(spell)}
          />
        )
      })}
    </div>
  )
}

function formatSpellNames(ids: string[]): string {
  return ids.map(id => getSpell(id)?.name ?? id).join(', ')
}

function formatSchools(schools: string[]): string {
  return schools.length > 1
    ? `${schools.slice(0, -1).join(', ')} ou ${schools[schools.length - 1]}`
    : schools.join('')
}

function SpellCard({
  spell, selected, locked = false, lockedTitle = 'Vem com a característica — não sai da lista', disabled, active, onToggle, onDetail,
}: {
  spell: Spell
  selected: boolean
  locked?: boolean
  lockedTitle?: string
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
          onClick={e => { e.stopPropagation(); if (!locked && (!disabled || selected)) onToggle() }}
          disabled={locked}
          title={locked ? lockedTitle : undefined}
          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all text-sm"
          style={{ backgroundColor: selected ? `${color}30` : '#1a1208', border: `1.5px solid ${selected ? color : '#3a2e1e'}`, color: selected ? color : '#4a3e2e' }}
        >
          {locked ? '🔒' : selected ? '✓' : '+'}
        </button>
      </div>
      <p className="text-xs text-parchment-700 mt-1.5">{spell.castingTime} · {spell.range}</p>
    </div>
  )
}

function SpellDetail({ spell, accent }: { spell: Spell; accent: string }) {
  const color = SCHOOL_COLORS[spell.school] ?? accent
  const emoji = SCHOOL_EMOJI[spell.school] ?? '✨'
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
      <div className="border-t border-parchment-900 pt-3">
        <RuleText
          text={spell.description}
          className="text-sm text-parchment-500 leading-relaxed"
          headingClassName="text-xs font-semibold font-fantasy text-parchment-400 uppercase tracking-wider mt-3 first:mt-0 mb-1"
        />
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
