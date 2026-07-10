import { useOrdemStore } from '../../stores/characterStore'
import { STEP_LABELS } from '../../types/character'
import type { OrdemEquipment } from '../../types/equipment'
import {
  EQUIPMENTS, getTotalCarryCapacity, getCurrentSpaces, getCategoryCount, hasWeaponProficiency,
} from '../../utils/equipmentUtils'
import { getEffectiveAttributes } from '../../utils/characterUtils'
import { getPatente, getCategoryLimit, PATENTES } from '../../utils/patenteUtils'
import { isStepComplete } from '../../utils/draftValidation'
import { StepNav } from '../common/StepNav'

const CAT_ROMAN = ['0', 'I', 'II', 'III', 'IV']

export function EquipmentStep() {
  const { draft, updateDraft, nextStep, prevStep } = useOrdemStore()

  const strength = getEffectiveAttributes(draft).strength
  const capacity = getTotalCarryCapacity(draft)
  const currentSpaces = getCurrentSpaces(draft.equipmentChoices)
  const isOverCapacity = currentSpaces > capacity

  const patente = getPatente(draft.patente)
  // Categorias com acesso pela patente atual (limite > 0), pra montar os contadores.
  const accessibleCategories = [1, 2, 3, 4].filter(c => getCategoryLimit(patente, c) > 0)

  const weapons = EQUIPMENTS.filter(i => i.type === 'weapon')
  const protections = EQUIPMENTS.filter(i => i.type === 'protection')
  const general = EQUIPMENTS.filter(i => i.type !== 'weapon' && i.type !== 'protection')

  const toggleItem = (itemId: string) => {
    const choices = [...draft.equipmentChoices]
    const idx = choices.indexOf(itemId)
    if (idx > -1) choices.splice(idx, 1)
    else choices.push(itemId)
    updateDraft({ equipmentChoices: choices })
  }

  const renderItem = (item: OrdemEquipment) => {
    const isSelected = draft.equipmentChoices.includes(item.id)

    // Bloqueio por limite de categoria da Patente (Categoria 0 é ilimitada).
    const catLimit = getCategoryLimit(patente, item.category)
    const catCount = getCategoryCount(draft.equipmentChoices, item.category)
    const wouldExceedCategory = !isSelected && catCount >= catLimit
    // Proficiência de arma NÃO bloqueia — apenas sinaliza (você pode requisitar, mas com penalidade).
    const noProficiency = !hasWeaponProficiency(draft, item)

    const isDisabled = wouldExceedCategory

    return (
      <div
        key={item.id}
        onClick={() => { if (!isDisabled || isSelected) toggleItem(item.id) }}
        className={`
          relative flex items-center justify-between p-3 rounded-lg border transition-all duration-200
          ${isSelected
            ? 'bg-red-950/40 border-red-900/60 shadow-[0_0_10px_rgba(220,38,38,0.1)]'
            : isDisabled
              ? 'bg-parchment-950/20 border-parchment-900/30 opacity-50 cursor-not-allowed'
              : 'bg-parchment-950/30 border-parchment-900/50 hover:border-red-900/40 hover:bg-parchment-900/40 cursor-pointer'}
        `}
      >
        <div className="flex flex-col min-w-0">
          <span className={`font-fantasy text-lg ${isSelected ? 'text-red-400' : 'text-parchment-300'}`}>
            {item.name}
          </span>
          <div className="flex flex-wrap gap-2 text-xs text-parchment-500 mt-1">
            <span className="bg-parchment-900/50 px-2 py-0.5 rounded border border-parchment-800/50">
              Cat {CAT_ROMAN[item.category]}
            </span>
            <span className="bg-parchment-900/50 px-2 py-0.5 rounded border border-parchment-800/50">
              Espaço: {item.spaces}
            </span>
            {item.type === 'weapon' && (
              <>
                <span className="bg-parchment-900/50 px-2 py-0.5 rounded border border-parchment-800/50">
                  {item.damage} {item.damageType}
                </span>
                <span className="bg-parchment-900/50 px-2 py-0.5 rounded border border-parchment-800/50">
                  Crítico: {item.critical}
                </span>
              </>
            )}
            {item.type === 'protection' && (
              <span className="bg-parchment-900/50 px-2 py-0.5 rounded border border-parchment-800/50">
                Defesa: +{item.defenseBonus}
              </span>
            )}
            {noProficiency && (
              <span className="text-amber-400/80 px-2 py-0.5" title="Você pode requisitá-la, mas sofre penalidade ao usá-la sem proficiência">
                Sem Proficiência
              </span>
            )}
            {isDisabled && !isSelected && (
              <span className="text-red-400/70 px-2 py-0.5">Patente insuficiente</span>
            )}
          </div>
          {item.description && (
            <p className="text-parchment-600 text-xs mt-1.5 leading-snug">{item.description}</p>
          )}
        </div>

        <div className={`
          w-6 h-6 rounded border flex items-center justify-center transition-colors shrink-0 ml-2
          ${isSelected
            ? 'bg-red-900/50 border-red-500/50 text-red-400'
            : 'border-parchment-800/50 text-transparent'}
        `}>
          {isSelected && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-fantasy text-red-400 flex items-center gap-2">
          {STEP_LABELS.equipment}
        </h2>
      </div>

      <div className="bg-parchment-950/40 p-4 rounded-xl border border-parchment-900 mb-8 sticky top-0 z-10 backdrop-blur-sm shadow-lg">
        {/* Seletor de Patente */}
        <p className="text-xs font-fantasy text-parchment-600 uppercase tracking-widest mb-2">Patente na Ordem</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PATENTES.map(p => {
            const active = draft.patente === p.id
            return (
              <button
                key={p.id}
                onClick={() => updateDraft({ patente: p.id })}
                className={`px-3 py-1.5 rounded-lg border text-sm font-fantasy transition-all ${active
                  ? 'bg-red-950/50 border-red-500/50 text-red-300'
                  : 'bg-parchment-950/40 border-parchment-800/50 text-parchment-400 hover:border-red-900/40'}`}
              >
                {p.name}
              </button>
            )
          })}
        </div>
        <p className="text-parchment-500 text-sm mb-1">
          A <strong className="text-red-400">Patente</strong> é sua posição na Ordem (diferente do NEX, que é seu poder):
          define quantos itens de cada categoria você pode requisitar. Categoria 0 é ilimitada (só pela carga);
          <strong className="text-parchment-300"> {patente.name}</strong> libera {accessibleCategories.length > 0
            ? accessibleCategories.map(c => `${getCategoryLimit(patente, c)}× Cat ${CAT_ROMAN[c]}`).join(' · ')
            : 'nenhuma categoria acima de 0'}.
        </p>
        <p className="text-parchment-700 text-xs mb-4">
          Crédito para compras de missão: <strong className="text-parchment-500">{patente.credit}</strong> (uso na mesa, não afeta a criação).
          Seu limite de peso depende da Força ({strength}).
        </p>

        <div className="flex flex-wrap gap-3">
          <div className={`flex flex-col px-4 py-2 rounded-lg border ${isOverCapacity ? 'bg-red-950/50 border-red-500/50 text-red-300' : 'bg-parchment-900/30 border-parchment-800/50 text-parchment-300'}`}>
            <span className="text-xs uppercase tracking-wider opacity-70">Carga</span>
            <span className="font-fantasy text-xl">{currentSpaces} / {capacity}</span>
          </div>
          {accessibleCategories.map(c => {
            const count = getCategoryCount(draft.equipmentChoices, c)
            const limit = getCategoryLimit(patente, c)
            const over = count > limit
            return (
              <div key={c} className={`flex flex-col px-4 py-2 rounded-lg border ${over ? 'bg-red-950/50 border-red-500/50 text-red-300' : 'bg-parchment-900/30 border-parchment-800/50 text-parchment-300'}`}>
                <span className="text-xs uppercase tracking-wider opacity-70">Categoria {CAT_ROMAN[c]}</span>
                <span className="font-fantasy text-xl">{count} / {limit}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="font-fantasy text-xl text-parchment-300 border-b border-parchment-900/50 pb-2 mb-4">Armas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {weapons.map(renderItem)}
          </div>
        </div>

        <div>
          <h3 className="font-fantasy text-xl text-parchment-300 border-b border-parchment-900/50 pb-2 mb-4">Proteções</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {protections.map(renderItem)}
          </div>
        </div>

        <div>
          <h3 className="font-fantasy text-xl text-parchment-300 border-b border-parchment-900/50 pb-2 mb-4">Equipamento Geral</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {general.map(renderItem)}
          </div>
        </div>
      </div>

      <StepNav onPrev={prevStep} onNext={nextStep} canAdvance={isStepComplete(draft, 'equipment')} />
    </div>
  )
}
