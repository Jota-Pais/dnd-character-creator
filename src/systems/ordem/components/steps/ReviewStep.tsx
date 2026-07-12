import { useOrdemStore } from '../../stores/characterStore'
import { getOrigin } from '../../utils/originUtils'
import { getOrdemClass } from '../../utils/classUtils'
import { getSkillName } from '../../utils/skillUtils'
import { getTrilha } from '../../utils/trilhaUtils'
import { getPower } from '../../utils/powerUtils'
import {
  getTrainedSkills, getSkillGrade, hasFavoredRitualPower, hasLaminaMaldita, getRitualCost, hasClassPower,
} from '../../utils/characterUtils'
import { getRitualById, formatRitualElementLabel, getRitualSlotsCount, ELEMENT_NAMES } from '../../utils/ritualUtils'
import {
  getEquipmentByInstance, getInstanceLabel, getTotalCarryCapacity, getModifiedSpaces, getModifiedDefenseBonus, getDraftInstanceCategory,
  getMissingRitualComponentElements,
} from '../../utils/equipmentUtils'
import { getModification } from '../../utils/modificationUtils'
import { getCurse, getCursedDerivedStats, getSheetAttributes, formatCurseElement, formatCurseChoiceDetail } from '../../utils/curseUtils'
import type { OrdemEquipment } from '../../types/equipment'
import { getOrdemWeaponAttack } from '../../utils/ordemWeaponUtils'
import { getPatente } from '../../utils/patenteUtils'
import type { OrdemWeapon } from '../../types/equipment'

const CAT_ROMAN = ['0', 'I', 'II', 'III', 'IV']
import { getReachedTrilhaSlots, getPeLimit } from '../../utils/progressionUtils'
import { exportCharacter } from '../../utils/storage'
import { StepNav } from '../common/StepNav'

export function ReviewStep() {
  const draft = useOrdemStore(state => state.draft)
  const updateDraft = useOrdemStore(state => state.updateDraft)
  const prevStep = useOrdemStore(state => state.prevStep)
  const goToPrint = useOrdemStore(state => state.goToPrint)
  const reset = useOrdemStore(state => state.reset)

  const origin = draft.origin ? getOrigin(draft.origin) : undefined
  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  if (!cls) return null

  const attributes = getSheetAttributes(draft)
  const stats = getCursedDerivedStats(draft, cls, getModifiedDefenseBonus(draft))
  const trainedSkills = getTrainedSkills(draft)
  const trilha = draft.trilha ? getTrilha(draft.trilha) : undefined
  const reachedTrilhaFeatures = trilha
    ? getReachedTrilhaSlots(draft.nex).map(nex => trilha.features.find(f => f.nex === nex)).filter(Boolean)
    : []
  const powers = draft.powerChoices.filter((p): p is string => Boolean(p)).map(getPower).filter(Boolean)
  // Só o Ocultista conhece rituais; limita aos slots realmente abertos pelo NEX (baixar o NEX
  // depois de escolher não deve deixar rituais obsoletos de círculos inacessíveis na ficha).
  const ritualSlots = draft.class === 'occultist' ? getRitualSlotsCount(draft.nex) : 0
  const rituals = draft.ritualChoices.slice(0, ritualSlots).filter((r): r is string => Boolean(r)).map(getRitualById).filter(Boolean)
  // Cada entrada de `equipmentChoices` é uma UNIDADE ("revolver", "revolver#2"...), com mods/maldições próprias.
  const equipmentUnits = draft.equipmentChoices
    .map(uid => ({ uid, item: getEquipmentByInstance(uid) }))
    .filter((u): u is { uid: string; item: OrdemEquipment } => Boolean(u.item))
  const weaponUnits = equipmentUnits.filter((u): u is { uid: string; item: OrdemWeapon } => u.item.type === 'weapon')
  const weaponAttacks = weaponUnits.map(({ uid, item }) => ({
    ...getOrdemWeaponAttack(item, draft, draft.equipmentModifications[uid] ?? [], draft.equipmentCurses[uid] ?? [], draft.weaponSkillChoices[uid]),
    name: getInstanceLabel(draft, uid),
  }))
  const cursedUnits = equipmentUnits.filter(u => (draft.equipmentCurses[u.uid]?.length ?? 0) > 0)
  const missingComponents = getMissingRitualComponentElements(draft)
  const showFavoriteRitualPicker = hasFavoredRitualPower(draft) && rituals.length > 0
  const showPersonalization = showFavoriteRitualPicker || weaponUnits.length > 0

  const setWeaponSkill = (uid: string, value: string) => {
    const choices = { ...draft.weaponSkillChoices }
    if (value === 'auto') delete choices[uid]
    else choices[uid] = value as 'fighting' | 'aim' | 'occultism'
    updateDraft({ weaponSkillChoices: choices })
  }
  const upgradedSkills = trainedSkills.filter(sid => getSkillGrade(draft, sid) !== 'treinado')

  function handleExport() {
    exportCharacter(draft)
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-16">
      <div className="text-center mb-2">
        <h2 className="font-fantasy text-2xl font-bold text-gold-400">{draft.name}</h2>
        {draft.concept && <p className="text-parchment-500 text-sm italic mt-1">"{draft.concept}"</p>}
        <p className="text-parchment-600 text-xs mt-1">
          {origin?.name} · {cls.name}{trilha ? ` (${trilha.name})` : ''} · NEX {draft.nex}% · {getPatente(draft.patente).name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Pontos de Vida" value={String(stats.hp)} />
        <Stat label="Pontos de Esforço" value={String(stats.pe)} />
        <Stat label="Sanidade" value={String(stats.sanity)} />
        <Stat label="Defesa" value={String(stats.defense)} />
      </div>
      <p className="text-center text-parchment-600 text-xs">
        Limite de PE por turno: <span className="text-parchment-400 font-semibold">{getPeLimit(draft.nex)}</span>
        {' · '}Deslocamento: <span className="text-parchment-400 font-semibold">9m</span>
      </p>

      <Section title="Atributos">
        <div className="grid grid-cols-5 gap-2 text-center">
          <AttrStat label="AGI" value={attributes.agility} />
          <AttrStat label="FOR" value={attributes.strength} />
          <AttrStat label="INT" value={attributes.intellect} />
          <AttrStat label="PRE" value={attributes.presence} />
          <AttrStat label="VIG" value={attributes.vigor} />
        </div>
      </Section>

      {origin && (
        <Section title="Origem">
          <p className="text-parchment-200 font-fantasy font-semibold text-sm">{origin.name}</p>
          <p className="text-parchment-500 text-xs mt-1">
            <span className="font-semibold">{origin.power.name}.</span> {origin.power.description}
          </p>
        </Section>
      )}

      <Section title="Classe">
        <p className="text-parchment-200 font-fantasy font-semibold text-sm">{cls.name}</p>
        <p className="text-parchment-500 text-xs mt-1">{cls.description}</p>
        <p className="text-parchment-500 text-xs mt-2">
          <span className="font-semibold text-parchment-300">{cls.classAbility.name}.</span> {cls.classAbility.description}
        </p>
      </Section>

      {trilha && reachedTrilhaFeatures.length > 0 && (
        <Section title={`Trilha — ${trilha.name}`}>
          <div className="space-y-2">
            {reachedTrilhaFeatures.map(f => f && (
              <p key={f.name} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">NEX {f.nex}% – {f.name}.</span> {f.description}
              </p>
            ))}
          </div>
        </Section>
      )}

      {powers.length > 0 && (
        <Section title={`Poderes de ${cls.name}`}>
          <div className="space-y-2">
            {powers.map(p => p && (
              <p key={p.id} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">{p.name}.</span> {p.description}
              </p>
            ))}
          </div>
        </Section>
      )}

      {rituals.length > 0 && (
        <Section title={`Rituais Conhecidos (${rituals.length})`}>
          <div className="space-y-2">
            {rituals.map((r, i) => {
              if (!r) return null
              const { cost, notes } = getRitualCost(draft, r)
              return (
                <p key={`${r.id}-${i}`} className="text-parchment-500 text-xs">
                  <span className="font-semibold text-parchment-300">{r.name}</span>{' '}
                  <span className="text-parchment-700">
                    ({formatRitualElementLabel(r, draft.ritualElementChoices)}, {r.circle}º Círculo — custo {cost} PE{notes.length > 0 ? ` (${notes.join(', ')})` : ''})
                  </span>
                </p>
              )
            })}
          </div>
          {hasClassPower(draft, 'potent-ritual') && (
            <p className="text-gold-500/90 text-xs mt-3">
              ✨ <strong>Ritual Potente:</strong> some +{attributes.intellect} (Intelecto) nas rolagens de dano
              ou nos efeitos de cura dos seus rituais.
            </p>
          )}
          {missingComponents.length > 0 && (
            <p className="text-amber-400/90 text-xs mt-3">
              ⚠️ Faltam <strong>Componentes Ritualísticos</strong> de {missingComponents.map(el => ELEMENT_NAMES[el]).join(' e ')} no
              equipamento — sem eles (e uma mão livre), esses rituais não podem ser conjurados.
            </p>
          )}
        </Section>
      )}

      {showPersonalization && (
        <Section title="Personalização ⚙️">
          <div className="space-y-3">
            {showFavoriteRitualPicker && (
              <div>
                <p className="text-parchment-400 text-xs font-semibold mb-1">Qual é o seu ritual predileto? <span className="text-parchment-600 font-normal">(poder Ritual Predileto: custo −1 PE)</span></p>
                <select
                  value={draft.favoriteRitual ?? ''}
                  onChange={e => updateDraft({ favoriteRitual: e.target.value || null })}
                  className="w-full bg-parchment-950 border border-parchment-800 rounded px-2 py-1 text-parchment-300 text-xs"
                >
                  <option value="">Escolha o ritual…</option>
                  {rituals.map((r, i) => r && (
                    <option key={`${r.id}-${i}`} value={r.id}>{r.name} ({r.circle}º Círculo)</option>
                  ))}
                </select>
              </div>
            )}

            {weaponUnits.length > 0 && (
              <div>
                <p className="text-parchment-400 text-xs font-semibold mb-1">
                  Com qual perícia você realiza os ataques?
                  {hasLaminaMaldita(draft) && (
                    <span className="text-parchment-600 font-normal"> (Lâmina Maldita: com a arma amaldiçoada, você pode usar Ocultismo)</span>
                  )}
                </p>
                <div className="space-y-1">
                  {weaponUnits.map(({ uid }) => (
                    <div key={uid} className="flex items-center gap-2">
                      <span className="text-parchment-500 text-xs w-36 shrink-0 truncate">{getInstanceLabel(draft, uid)}</span>
                      <select
                        value={draft.weaponSkillChoices[uid] ?? 'auto'}
                        onChange={e => setWeaponSkill(uid, e.target.value)}
                        className="flex-1 bg-parchment-950 border border-parchment-800 rounded px-2 py-1 text-parchment-300 text-xs"
                      >
                        <option value="auto">Automática (Luta corpo a corpo / Pontaria à distância)</option>
                        <option value="fighting">Luta</option>
                        <option value="aim">Pontaria</option>
                        <option value="occultism">Ocultismo (Lâmina Maldita, com a arma amaldiçoada)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {weaponAttacks.length > 0 && (
        <Section title="Ataques">
          <p className="text-parchment-700 text-[11px] mb-2">Role a quantidade de d20 indicada e use o melhor + o bônus.</p>
          <div className="space-y-1">
            {weaponAttacks.map((a, i) => (
              <p key={`${a.name}-${i}`} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">{a.name}</span>{' '}
                <span className="text-parchment-700">
                  {a.skill} {a.rollDice}d20 <span className="text-gold-500">{a.attackBonus >= 0 ? `+${a.attackBonus}` : a.attackBonus}</span>
                  {' · '}{a.damage} · Crít. {a.critical}{a.range && a.range !== '-' ? ` · ${a.range}` : ''}
                </span>
              </p>
            ))}
          </div>
        </Section>
      )}

      {equipmentUnits.length > 0 && (
        <Section title={`Equipamento (${getModifiedSpaces(draft)}/${getTotalCarryCapacity(draft)} espaços)`}>
          <div className="space-y-2">
            {equipmentUnits.map(({ uid, item }) => {
              const mods = draft.equipmentModifications[uid] ?? []
              const curses = draft.equipmentCurses[uid] ?? []
              const effCat = getDraftInstanceCategory(draft, uid)
              return (
                <p key={uid} className="text-parchment-500 text-xs">
                  <span className="font-semibold text-parchment-300">{getInstanceLabel(draft, uid)}</span> <span className="text-parchment-700">(Cat {CAT_ROMAN[effCat]}, {item.spaces} esp.)</span>
                  {item.type === 'weapon' && ` — ${item.damage} ${item.damageType} (Crítico: ${item.critical})`}
                  {item.type === 'protection' && ` — Defesa +${item.defenseBonus}`}
                  {mods.length > 0 && (
                    <span className="text-gold-600"> · Mods: {mods.map(m => getModification(m)?.name).filter(Boolean).join(', ')}</span>
                  )}
                  {curses.length > 0 && (
                    <span className="text-purple-400"> · Maldições: {curses.map(c => getCurse(c)?.name).filter(Boolean).join(', ')}</span>
                  )}
                </p>
              )
            })}
          </div>
        </Section>
      )}

      {cursedUnits.length > 0 && (
        <Section title="Itens Amaldiçoados">
          <p className="text-parchment-700 text-[11px] mb-2">
            Bônus de maldições iguais em itens diferentes não se acumulam. Os bônus fixos (Defesa, atributos, PV/PE) já estão somados na ficha.
          </p>
          <div className="space-y-3">
            {cursedUnits.map(({ uid }) => (
              <div key={uid}>
                <p className="text-purple-300 font-fantasy font-semibold text-sm">{getInstanceLabel(draft, uid)}</p>
                {(draft.equipmentCurses[uid] ?? []).map(cid => {
                  const curse = getCurse(cid)
                  if (!curse) return null
                  const detail = formatCurseChoiceDetail(curse, uid, draft.equipmentCurseChoices)
                  return (
                    <p key={cid} className="text-parchment-500 text-xs mt-1">
                      <span className="font-semibold text-purple-400">
                        {curse.name} ({formatCurseElement(curse, uid, draft.equipmentCurseChoices)}{detail ? ` — ${detail}` : ''}).
                      </span>{' '}
                      {curse.effect}
                    </p>
                  )
                })}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={`Perícias Treinadas (${trainedSkills.length})`}>
        <div className="flex flex-wrap gap-1.5">
          {trainedSkills.map(sid => {
            const grade = getSkillGrade(draft, sid)
            return (
              <span key={sid} className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-gold-900/30 text-gold-400">
                {getSkillName(sid)}{grade !== 'treinado' && ` (${grade})`}
              </span>
            )
          })}
        </div>
        {upgradedSkills.length === 0 && trainedSkills.length > 0 && (
          <p className="text-parchment-700 text-[11px] mt-2">Todas treinadas — nenhuma subiu de grau ainda.</p>
        )}
      </Section>

      <div className="space-y-2 pt-2">
        <button
          onClick={goToPrint}
          className="w-full py-3 rounded-xl font-fantasy font-bold text-base tracking-wide transition-all hover:brightness-110 active:scale-[0.99] bg-gold-500 text-parchment-950"
        >
          🖨 Imprimir / Salvar como PDF
        </button>
        <button
          onClick={handleExport}
          className="w-full py-2.5 rounded-xl font-fantasy font-semibold text-sm border border-parchment-800 text-parchment-400 hover:text-parchment-200 transition-colors"
        >
          Exportar Ficha como JSON ↓
        </button>
      </div>

      <StepNav onPrev={prevStep} onNext={reset} canAdvance nextLabel="Concluir ✓" />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
      <h4 className="text-xs font-semibold font-fantasy text-parchment-600 uppercase tracking-widest mb-3">{title}</h4>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-3 text-center">
      <p className="text-parchment-700 text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-gold-400 font-fantasy font-bold text-xl">{value}</p>
    </div>
  )
}

function AttrStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-parchment-700 text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-parchment-200 font-fantasy font-bold text-lg">{value}</p>
    </div>
  )
}
