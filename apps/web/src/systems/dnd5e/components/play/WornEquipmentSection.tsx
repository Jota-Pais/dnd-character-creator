import { type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { ArmorCategory } from '@rpg/rules/systems/dnd5e/types/equipment'
import type { CarriedArmor } from '@rpg/rules/systems/dnd5e/types/session'
import { formatArmorClassBreakdown } from '@rpg/rules/systems/dnd5e/utils/armorClassUtils'
import { getFinalAbilityScores } from '@rpg/rules/systems/dnd5e/utils/asiUtils'
import { getArmorById } from '@rpg/rules/systems/dnd5e/utils/equipmentUtils'
import {
  ARMOR_TIME, describeArmorSetup, doffArmor, doffShield, donArmor, donShield, getWornArmor, resetWornArmor,
} from '@rpg/rules/systems/dnd5e/utils/playState'
import { describeUnproficientArmorRules } from '@rpg/rules/systems/dnd5e/utils/proficiencyUtils'
import { describeSpeedBonuses } from '@rpg/rules/systems/dnd5e/utils/sheetEffects'
import { formatArmorSummary } from '@rpg/rules/systems/dnd5e/utils/weaponFormat'
import { ChangeAnnouncer } from './ChangeAnnouncer'
import type { PlayTabProps } from './usePlayView'

/** A seção do equipamento vestido, na aba Estado (decisão de 2026-10-30: seis abas). */
export const WORN_EQUIPMENT_SECTION_ID = 'play-worn-equipment'

const CATEGORY_LABEL: Record<ArmorCategory, string> = {
  light: 'Armadura leve',
  medium: 'Armadura média',
  heavy: 'Armadura pesada',
  shield: 'Escudo',
}

/** Uma armadura ou o escudo que o personagem carrega: o que é, se está vestido e o toque que troca. */
function ArmorRow({ armor, worn, view }: { armor: CarriedArmor; worn: boolean; view: PlayTabProps }) {
  const shield = armor.category === 'shield'
  const item = getArmorById(armor.id)
  const label = shield
    ? (worn ? 'Tirar o escudo' : 'Vestir o escudo')
    : `${worn ? 'Tirar' : 'Vestir'} ${armor.name}`
  const time = worn ? ARMOR_TIME[armor.category].doff : ARMOR_TIME[armor.category].don
  // O mesmo botão troca o rótulo ("Vestir" ↔ "Tirar"): o foco fica nele, e recusado também.
  function toggle() {
    view.run((st, sh) => (shield
      ? (worn ? doffShield(st, sh) : donShield(st, sh))
      : (worn ? doffArmor(st, sh) : donArmor(st, sh, armor.id))))
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1" data-testid={`worn-${armor.id}`}>
      <span className="min-w-0">
        <span className="block text-sm text-parchment-100">
          {armor.name}
          {worn && <span className="text-emerald-300"> · vestid{shield ? 'o' : 'a'}</span>}
        </span>
        <span className="block text-[11px] text-parchment-500 leading-snug">
          {CATEGORY_LABEL[armor.category]}{item ? ` · ${formatArmorSummary(item)}` : ''}
          {!armor.proficient && <span className="text-amber-300"> · sem proficiência</span>}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-[11px] text-parchment-500">{time}</span>
        <button
          onClick={toggle}
          className="min-h-10 rounded-lg border border-parchment-700 px-3 text-sm text-parchment-200 hover:border-gold-600"
        >
          {label}
        </button>
      </span>
    </li>
  )
}

/**
 * Equipamento vestido (Fase 2, onda `armadura`): as armaduras e o escudo que o personagem carrega
 * (`sheet.carriedArmor`), cada um com o "Vestir" ou o "Tirar" (`donArmor`, `doffArmor`, `donShield`,
 * `doffShield`: um passo do desfazer cada, com o tempo da tabela no aviso), a CA de agora com a conta
 * e o que a armadura vestida muda — a proficiência, a Furtividade e o deslocamento, com os textos da
 * Revisão. Trocada no jogo, o "Voltar ao da ficha" (`resetWornArmor`) desfaz a troca. O draft nunca
 * muda: o criador e o PDF mostram a ficha.
 *
 * Foco (as regras do CLAUDE.md): o "Vestir" e o "Tirar" são o mesmo botão, que troca o rótulo, e o
 * foco fica nele; o "Voltar ao da ficha" some com o toque e leva o foco ao título da seção; recusado,
 * o aviso do pé diz por quê e o foco fica.
 */
export function WornEquipmentSection({ titleRef, ...view }: PlayTabProps & { titleRef: RefObject<HTMLHeadingElement | null> }) {
  const { draft, state, sheet, session, armorClass, baseArmorClass, run } = view
  const worn = getWornArmor(state, sheet)
  const bodies = sheet.carriedArmor.filter(a => a.category !== 'shield')
  const shield = sheet.carriedArmor.find(a => a.category === 'shield')
  const speedLines = describeSpeedBonuses(draft, getFinalAbilityScores(draft), session)
  const changed = state.wornArmor !== undefined

  function reset() {
    const result = flushSync(() => run((st, sh) => resetWornArmor(st, sh)))
    if (result && !result.state.wornArmor) titleRef.current?.focus()
  }

  return (
    <div className="space-y-2">
      {/* Primeiro filho: no fim, o space-y daria margem a ele. A CA nova sai no número, sem aviso. */}
      <ChangeAnnouncer text={`Vestido: ${describeArmorSetup(worn)}. CA ${armorClass.value}.`} />
      <p className="text-sm text-parchment-200 leading-snug" data-testid="worn-ac">
        <span className="font-fantasy text-parchment-100">CA {armorClass.value}</span>
        {armorClass.value !== baseArmorClass.value && <span className="text-amber-300"> (era {baseArmorClass.value})</span>}
        <span className="text-parchment-500"> = {formatArmorClassBreakdown(armorClass)}</span>
      </p>
      <ul className="space-y-2">
        {bodies.map(a => <ArmorRow key={a.id} armor={a} worn={worn.bodyArmorId === a.id} view={view} />)}
        {shield && <ArmorRow key={shield.id} armor={shield} worn={worn.shield} view={view} />}
      </ul>
      {sheet.unproficientArmor.length > 0 && (
        <p className="text-xs text-red-200 leading-snug">{describeUnproficientArmorRules(sheet.unproficientArmor)}</p>
      )}
      {armorClass.stealthDisadvantage && (
        <p className="text-xs text-amber-200 leading-snug">{armorClass.components[0]?.label}: desvantagem em Furtividade.</p>
      )}
      {speedLines.map(line => <p key={line} className="text-xs text-parchment-300 leading-snug">{line}</p>)}
      {changed && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            onClick={reset}
            className="min-h-10 rounded-lg border border-parchment-700 px-3 text-sm text-parchment-300 hover:border-parchment-500"
          >
            Voltar ao da ficha
          </button>
          <span className="text-[11px] text-parchment-500 leading-snug">Na ficha: {describeArmorSetup(sheet.equippedArmor)}.</span>
        </div>
      )}
      <p className="text-[11px] text-parchment-600 leading-snug">
        O app não conta o tempo de vestir. Armadura nova entra pelo criador.
      </p>
    </div>
  )
}
