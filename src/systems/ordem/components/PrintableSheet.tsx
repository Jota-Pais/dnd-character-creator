import { useOrdemStore } from '../stores/characterStore'
import { getOrigin } from '../utils/originUtils'
import { getOrdemClass } from '../utils/classUtils'
import { SKILLS } from '../utils/skillUtils'
import { getTrilha } from '../utils/trilhaUtils'
import { getPower } from '../utils/powerUtils'
import { getTrainedSkills, getSkillGrade, getRitualCost } from '../utils/characterUtils'
import { getReachedTrilhaSlots, getPeLimit } from '../utils/progressionUtils'
import { getRitualById, formatRitualElementLabel, getRitualSlotsCount } from '../utils/ritualUtils'
import {
  getEquipmentByInstance, getInstanceLabel, getTotalCarryCapacity, getModifiedSpaces, getModifiedDefenseBonus,
  getDraftInstanceCategory,
} from '../utils/equipmentUtils'
import { getModification } from '../utils/modificationUtils'
import { getCurse, getCursedDerivedStats, getSheetAttributes, formatCurseElement, formatCurseChoiceDetail } from '../utils/curseUtils'
import { getOrdemWeaponAttack, GRADE_BONUS } from '../utils/ordemWeaponUtils'
import { getPatente, getCategoryLimit } from '../utils/patenteUtils'
import type { OrdemEquipment, OrdemWeapon } from '../types/equipment'
import type { OrdemAttributes } from '../types/character'

const CAT_ROMAN = ['0', 'I', 'II', 'III', 'IV']
const ATTR_ABBREV: Record<keyof OrdemAttributes, string> = {
  agility: 'AGI',
  strength: 'FOR',
  intellect: 'INT',
  presence: 'PRE',
  vigor: 'VIG',
}

/**
 * Ficha imprimível no formato da Ficha de Agente oficial (sem a arte), em DUAS páginas:
 * 1) atributos, origem/classe, NEX, PV/PE/Defesa/Sanidade, tabela completa de perícias e ataques;
 * 2) habilidades & rituais (com DT), inventário (Patente, limites, crédito, carga) e descrição.
 */
export function PrintableSheet() {
  const draft = useOrdemStore(state => state.draft)
  const origin = draft.origin ? getOrigin(draft.origin) : undefined
  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  if (!cls) return null

  const attributes = getSheetAttributes(draft)
  const stats = getCursedDerivedStats(draft, cls, getModifiedDefenseBonus(draft))
  const trilha = draft.trilha ? getTrilha(draft.trilha) : undefined
  const reachedTrilhaFeatures = trilha ? getReachedTrilhaSlots(draft.nex).map(nex => trilha.features.find(f => f.nex === nex)).filter(Boolean) : []
  const powers = draft.powerChoices.filter((p): p is string => Boolean(p)).map(getPower).filter(Boolean)
  // Só o Ocultista conhece rituais; limita aos slots abertos pelo NEX (ver ReviewStep).
  const ritualSlots = draft.class === 'occultist' ? getRitualSlotsCount(draft.nex) : 0
  const rituals = draft.ritualChoices.slice(0, ritualSlots).filter((r): r is string => Boolean(r)).map(getRitualById).filter(Boolean)
  // Cada entrada de `equipmentChoices` é uma UNIDADE ("revolver", "revolver#2"...), com mods/maldições próprias.
  const equipmentUnits = draft.equipmentChoices
    .map(uid => ({ uid, item: getEquipmentByInstance(uid) }))
    .filter((u): u is { uid: string; item: OrdemEquipment } => Boolean(u.item))
  const weaponAttacks = equipmentUnits
    .filter((u): u is { uid: string; item: OrdemWeapon } => u.item.type === 'weapon')
    .map(({ uid, item }) => ({
      ...getOrdemWeaponAttack(item, draft, draft.equipmentModifications[uid] ?? [], draft.equipmentCurses[uid] ?? [], draft.weaponSkillChoices[uid]),
      name: getInstanceLabel(draft, uid),
    }))
  const cursedUnits = equipmentUnits.filter(u => (draft.equipmentCurses[u.uid]?.length ?? 0) > 0)
  const protections = equipmentUnits.filter(u => u.item.type === 'protection')
  const trainedSkills = getTrainedSkills(draft)
  const patente = getPatente(draft.patente)
  // DT de habilidades/rituais: 10 + limite de PE por rodada + Presença (exemplo do livro, pág. 121).
  const ritualDt = 10 + getPeLimit(draft.nex) + attributes.presence

  return (
    <div className="print-sheet mx-auto max-w-[820px] bg-white text-gray-900 p-8 rounded-lg shadow-lg" style={{ fontFamily: 'Georgia, serif' }}>

      {/* ═══════════════ PÁGINA 1 ═══════════════ */}
      <div className="page-break">
        <header className="flex items-end justify-between border-b-2 border-gray-900 pb-2 mb-3">
          <div className="flex gap-6">
            <LabeledLine label="Personagem" value={draft.name} width="w-56" />
            <LabeledLine label="Jogador" width="w-40" />
          </div>
          <div className="text-right leading-tight">
            <p className="font-bold text-lg tracking-wide">ORDEM PARANORMAL RPG</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-600">Ficha de Agente</p>
          </div>
        </header>

        <div className="grid grid-cols-[1fr_1.15fr] gap-4">
          {/* Coluna esquerda: atributos e características */}
          <div className="space-y-3">
            <section>
              <BlackBar>Atributos</BlackBar>
              <div className="flex justify-center mt-2">
                <AttrHex label="Agilidade" abbrev="AGI" value={attributes.agility} />
              </div>
              <div className="flex justify-between px-2 -mt-1">
                <AttrHex label="Força" abbrev="FOR" value={attributes.strength} />
                <AttrHex label="Intelecto" abbrev="INT" value={attributes.intellect} />
              </div>
              <div className="flex justify-center gap-10 -mt-1">
                <AttrHex label="Presença" abbrev="PRE" value={attributes.presence} />
                <AttrHex label="Vigor" abbrev="VIG" value={attributes.vigor} />
              </div>
            </section>

            <section className="space-y-1.5">
              <LabeledBox label="Origem" value={origin?.name ?? ''} />
              <LabeledBox label="Classe" value={`${cls.name}${trilha ? ` (${trilha.name})` : ''}`} />
            </section>

            <section className="grid grid-cols-3 gap-1.5">
              <SmallStat label="NEX" value={`${draft.nex}%`} />
              <SmallStat label="PE / Rodada" value={String(getPeLimit(draft.nex))} />
              <SmallStat label="Desl." value="9m" />
            </section>

            <section className="grid grid-cols-2 gap-1.5">
              <CurrentStat label="PV · Pontos de Vida" value={stats.hp} />
              <CurrentStat label="PE · Pontos de Esforço" value={stats.pe} />
            </section>

            <section className="grid grid-cols-2 gap-1.5">
              <div className="border-2 border-gray-900 rounded p-2">
                <p className="text-[9px] uppercase font-bold text-gray-600">Defesa</p>
                <p className="text-2xl font-bold leading-none">{stats.defense}</p>
                <p className="text-[9px] text-gray-500 mt-1">= 10 + AGI + Equip. + Outros</p>
              </div>
              <CurrentStat label="SAN · Sanidade" value={stats.sanity} />
            </section>

            <section className="text-xs space-y-1">
              <p>
                <span className="font-bold uppercase text-[10px]">Proteção:</span>{' '}
                {protections.length > 0
                  ? protections.map(u => `${getInstanceLabel(draft, u.uid)} (+${u.item.type === 'protection' ? u.item.defenseBonus : 0})`).join(', ')
                  : '—'}
              </p>
              <p className="flex items-baseline gap-1">
                <span className="font-bold uppercase text-[10px]">Resistências:</span>
                <span className="flex-1 border-b border-gray-400 min-h-[1em]" />
              </p>
            </section>
          </div>

          {/* Coluna direita: perícias completas */}
          <section>
            <BlackBar>Perícias</BlackBar>
            <table className="w-full text-[11px] mt-1">
              <thead>
                <tr className="text-gray-500 text-left text-[9px] uppercase">
                  <th className="font-semibold">Perícia</th>
                  <th className="font-semibold text-center">Dados (d20)</th>
                  <th className="font-semibold text-center">Treino</th>
                  <th className="font-semibold text-center">Outros</th>
                </tr>
              </thead>
              <tbody>
                {SKILLS.map(skill => {
                  const grade = getSkillGrade(draft, skill.id)
                  const trained = trainedSkills.includes(skill.id)
                  const bonus = GRADE_BONUS[grade]
                  return (
                    <tr key={skill.id} className={trained ? 'font-bold' : 'text-gray-700'}>
                      <td className="py-[1px]">
                        {skill.name}
                        {skill.trainedOnly ? '*' : ''}
                        {skill.loadPenalty ? '+' : ''}
                        {grade !== 'destreinado' && grade !== 'treinado' && (
                          <span className="text-[9px] text-gray-500 font-normal"> ({grade})</span>
                        )}
                      </td>
                      <td className="text-center">{attributes[skill.attribute as keyof OrdemAttributes]} <span className="text-[9px] text-gray-500">{ATTR_ABBREV[skill.attribute as keyof OrdemAttributes]}</span></td>
                      <td className="text-center">{bonus > 0 ? `+${bonus}` : '0'}</td>
                      <td className="text-center"><span className="inline-block border-b border-gray-400 w-8" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-[9px] text-gray-500 mt-1">
              + Penalidade de carga. * Somente treinada. Role os d20 indicados e use o melhor + bônus.
            </p>
          </section>
        </div>

        {/* Ataques (largura total) */}
        <section className="mt-3">
          <BlackBar>Ataques</BlackBar>
          <table className="w-full text-xs mt-1">
            <thead>
              <tr className="text-gray-500 text-left text-[9px] uppercase">
                <th className="font-semibold pr-2">Arma</th>
                <th className="font-semibold pr-2">Teste</th>
                <th className="font-semibold pr-2">Dano</th>
                <th className="font-semibold pr-2">Crítico</th>
                <th className="font-semibold">Alcance</th>
              </tr>
            </thead>
            <tbody>
              {weaponAttacks.map((a, i) => (
                <tr key={`${a.name}-${i}`} className="border-b border-gray-300">
                  <td className="pr-2 py-0.5 font-semibold">{a.name}</td>
                  <td className="pr-2 py-0.5">{a.skill} {a.rollDice}d20 <strong>{a.attackBonus >= 0 ? `+${a.attackBonus}` : a.attackBonus}</strong></td>
                  <td className="pr-2 py-0.5">{a.damage}</td>
                  <td className="pr-2 py-0.5">{a.critical}</td>
                  <td className="py-0.5">{a.range}</td>
                </tr>
              ))}
              {/* Linhas em branco pra anotar na mesa */}
              {Array.from({ length: Math.max(0, 3 - weaponAttacks.length) }).map((_, i) => (
                <tr key={`blank-${i}`} className="border-b border-gray-300">
                  <td className="py-2.5" colSpan={5} />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* ═══════════════ PÁGINA 2 ═══════════════ */}
      <div className="pt-6">
        <section className="mb-4">
          <BlackBar>Habilidades</BlackBar>
          <div className="space-y-1.5 mt-2 text-sm">
            {origin && (
              <p><span className="font-semibold">{origin.power.name} (origem).</span> {origin.power.description}</p>
            )}
            <p><span className="font-semibold">{cls.classAbility.name} ({cls.name}).</span> {cls.classAbility.description}</p>
            {reachedTrilhaFeatures.map(f => f && (
              <p key={f.name}><span className="font-semibold">{f.name} (trilha {trilha?.name}, NEX {f.nex}%).</span> {f.description}</p>
            ))}
            {powers.map(p => p && (
              <p key={p.id}><span className="font-semibold">{p.name} (poder).</span> {p.description}</p>
            ))}
          </div>
        </section>

        {rituals.length > 0 && (
          <section className="mb-4">
            <div className="flex items-center justify-between">
              <BlackBar className="flex-1">Rituais</BlackBar>
              <div className="ml-2 border-2 border-gray-900 rounded px-2 py-0.5 text-xs font-bold whitespace-nowrap">
                DT de Rituais: {ritualDt}
              </div>
            </div>
            <div className="space-y-1.5 mt-2 text-sm">
              {rituals.map((r, i) => {
                if (!r) return null
                const { cost, notes } = getRitualCost(draft, r)
                return (
                  <div key={`${r.id}-${i}`}>
                    <p>
                      <span className="font-semibold">{r.name}{draft.favoriteRitual === r.id ? ' ★' : ''}</span>
                      <span className="text-gray-600"> ({formatRitualElementLabel(r, draft.ritualElementChoices)}, {r.circle}º Círculo — custo {cost} PE{notes.length > 0 ? ` (${notes.join(', ')})` : ''})</span>
                      <span className="text-gray-500 text-xs"> — {r.execution}, {r.range}, {r.target}, {r.duration}{r.resistance ? `, ${r.resistance}` : ''}</span>
                    </p>
                    <p className="text-gray-700 text-xs">{r.description}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section className="mb-4">
          <BlackBar>Inventário</BlackBar>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
            <span><span className="font-bold uppercase text-[10px]">Pontos de Prestígio:</span> {patente.pp}</span>
            <span><span className="font-bold uppercase text-[10px]">Patente:</span> {patente.name}</span>
            <span>
              <span className="font-bold uppercase text-[10px]">Limite de Itens:</span>{' '}
              {[1, 2, 3, 4].map(c => `${CAT_ROMAN[c]}: ${getCategoryLimit(patente, c) || '—'}`).join(' · ')}
            </span>
            <span><span className="font-bold uppercase text-[10px]">Limite de Crédito:</span> {patente.credit}</span>
            <span><span className="font-bold uppercase text-[10px]">Carga Máx.:</span> {getModifiedSpaces(draft)}/{getTotalCarryCapacity(draft)}</span>
          </div>
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="text-gray-500 text-left text-[9px] uppercase">
                <th className="font-semibold pr-2">Item</th>
                <th className="font-semibold text-center w-16">Categoria</th>
                <th className="font-semibold text-center w-14">Espaços</th>
              </tr>
            </thead>
            <tbody>
              {equipmentUnits.map(({ uid, item }) => {
                const mods = draft.equipmentModifications[uid] ?? []
                const curses = draft.equipmentCurses[uid] ?? []
                return (
                  <tr key={uid} className="border-b border-gray-300 align-top">
                    <td className="pr-2 py-0.5">
                      <span className="font-semibold">{getInstanceLabel(draft, uid)}</span>
                      {mods.length > 0 && <span className="text-gray-600"> · Mods: {mods.map(m => getModification(m)?.name).filter(Boolean).join(', ')}</span>}
                      {curses.length > 0 && <span className="text-gray-600"> · Maldições: {curses.map(c => getCurse(c)?.name).filter(Boolean).join(', ')}</span>}
                      {item.description && <p className="text-[10px] text-gray-500">{item.description}</p>}
                    </td>
                    <td className="text-center py-0.5">{CAT_ROMAN[getDraftInstanceCategory(draft, uid)]}</td>
                    <td className="text-center py-0.5">{item.spaces}</td>
                  </tr>
                )
              })}
              {Array.from({ length: Math.max(0, 3 - equipmentUnits.length) }).map((_, i) => (
                <tr key={`blank-${i}`} className="border-b border-gray-300">
                  <td className="py-2.5" colSpan={3} />
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {cursedUnits.length > 0 && (
          <section className="mb-4">
            <BlackBar>Itens Amaldiçoados</BlackBar>
            <p className="text-[10px] text-gray-500 mt-1 mb-1">
              Bônus de maldições iguais em itens diferentes não se acumulam. Os bônus fixos (Defesa, atributos, PV/PE) já estão somados na ficha.
            </p>
            <div className="space-y-2">
              {cursedUnits.map(({ uid }) => (
                <div key={uid}>
                  <p className="text-sm font-semibold">{getInstanceLabel(draft, uid)}</p>
                  {(draft.equipmentCurses[uid] ?? []).map(cid => {
                    const curse = getCurse(cid)
                    if (!curse) return null
                    const detail = formatCurseChoiceDetail(curse, uid, draft.equipmentCurseChoices)
                    return (
                      <p key={cid} className="text-sm text-gray-700">
                        <span className="font-semibold">
                          {curse.name} ({formatCurseElement(curse, uid, draft.equipmentCurseChoices)}{detail ? ` — ${detail}` : ''}).
                        </span>{' '}
                        {curse.effect}
                      </p>
                    )
                  })}
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <BlackBar>Descrição</BlackBar>
          {draft.concept && <p className="text-xs italic text-gray-600 mt-1">"{draft.concept}"</p>}
          <div className="grid grid-cols-4 gap-3 mt-2">
            {['Aparência', 'Personalidade', 'Histórico', 'Objetivo'].map(label => (
              <div key={label}>
                <p className="text-[10px] uppercase font-bold text-center mb-1">{label}</p>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="border-b border-gray-400 h-4" />
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function BlackBar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`bg-gray-900 text-white uppercase text-xs font-bold tracking-widest px-2 py-1 rounded-sm ${className}`}>
      {children}
    </h2>
  )
}

function AttrHex({ label, abbrev, value }: { label: string; abbrev: string; value: number }) {
  return (
    <div className="w-20 text-center border-2 border-gray-900 rounded-lg py-1.5 bg-white">
      <p className="text-[8px] uppercase tracking-wide text-gray-600 leading-none">{label}</p>
      <p className="text-[10px] font-bold leading-none mt-0.5">{abbrev}</p>
      <p className="text-2xl font-bold leading-tight">{value}</p>
    </div>
  )
}

function LabeledLine({ label, value, width }: { label: string; value?: string; width: string }) {
  return (
    <div className="flex flex-col">
      <span className={`border-b border-gray-500 ${width} min-h-[1.4em] font-semibold`}>{value ?? ''}</span>
      <span className="text-[9px] uppercase tracking-widest text-gray-500">{label}</span>
    </div>
  )
}

function LabeledBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="bg-gray-900 text-white uppercase text-[10px] font-bold px-2 py-1 rounded-sm w-20 text-center shrink-0">{label}</span>
      <span className="flex-1 border-2 border-gray-900 rounded px-2 py-0.5 text-sm font-semibold min-h-[1.6em]">{value}</span>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-gray-900 rounded p-1.5 text-center">
      <p className="text-[9px] uppercase font-bold text-gray-600 leading-none">{label}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
    </div>
  )
}

function CurrentStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-2 border-gray-900 rounded p-2">
      <p className="text-[9px] uppercase font-bold text-gray-600">{label}</p>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-[10px] text-gray-600 mt-1">
        Atuais: <span className="inline-block border-b border-gray-500 w-14" />
      </p>
    </div>
  )
}
