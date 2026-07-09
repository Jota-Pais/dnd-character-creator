import React, from 'react'
import { useOrdemStore } from '../../stores/characterStore'
import { STEP_LABELS } from '../../types/character'
import type { OrdemEquipment } from '../../types/equipment'
import { EQUIPMENTS, getMaxCapacity, getCurrentSpaces, getCategoryICount } from '../../utils/equipmentUtils'
import { getOrdemClass } from '../../utils/classUtils'

export function EquipmentStep() {
  const { draft, updateDraft } = useOrdemStore()
  
  const capacity = getMaxCapacity(draft.attributes.strength)
  const currentSpaces = getCurrentSpaces(draft.equipmentChoices)
  const cat1Count = getCategoryICount(draft.equipmentChoices)
  const isOverCapacity = currentSpaces > capacity
  
  const cls = draft.class ? getOrdemClass(draft.class) : null

  // We only show items of category 0 and 1 for Recruta
  const availableItems = EQUIPMENTS.filter(item => item.category === 0 || item.category === 1)

  const weapons = availableItems.filter(i => i.type === 'weapon')
  const protections = availableItems.filter(i => i.type === 'protection')
  const general = availableItems.filter(i => i.type !== 'weapon' && i.type !== 'protection')

  const toggleItem = (itemId: string) => {
    const choices = [...draft.equipmentChoices]
    const idx = choices.indexOf(itemId)
    if (idx > -1) {
      choices.splice(idx, 1)
    } else {
      choices.push(itemId)
    }
    updateDraft({ equipmentChoices: choices })
  }

  const renderItem = (item: OrdemEquipment) => {
    const isSelected = draft.equipmentChoices.includes(item.id)
    
    // Check if adding this would violate the category I limit
    const isCat1 = item.category === 1
    const wouldExceedCat1 = !isSelected && isCat1 && cat1Count >= 2

    // Check weapon proficiency
    let noProficiency = false
    if (item.type === 'weapon' && cls) {
      noProficiency = !cls.weaponProficiencies.includes(item.proficiency)
    }

    const isDisabled = wouldExceedCat1 || noProficiency

    return (
      <div 
        key={item.id}
        onClick={() => {
          if (!isDisabled || isSelected) {
            toggleItem(item.id)
          }
        }}
        className={`
          relative flex items-center justify-between p-3 rounded-lg border transition-all duration-200
          ${isSelected 
            ? 'bg-red-950/40 border-red-900/60 shadow-[0_0_10px_rgba(220,38,38,0.1)]' 
            : isDisabled
              ? 'bg-parchment-950/20 border-parchment-900/30 opacity-50 cursor-not-allowed'
              : 'bg-parchment-950/30 border-parchment-900/50 hover:border-red-900/40 hover:bg-parchment-900/40 cursor-pointer'}
        `}
      >
        <div className="flex flex-col">
          <span className={`font-fantasy text-lg ${isSelected ? 'text-red-400' : 'text-parchment-300'}`}>
            {item.name}
          </span>
          <div className="flex gap-2 text-xs text-parchment-500 mt-1">
            <span className="bg-parchment-900/50 px-2 py-0.5 rounded border border-parchment-800/50">
              Cat {item.category === 0 ? '0' : 'I'}
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
               <span className="text-red-400/80 px-2 py-0.5">Sem Proficiência</span>
            )}
          </div>
        </div>
        
        <div className={`
          w-6 h-6 rounded border flex items-center justify-center transition-colors
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
        <p className="text-parchment-400 text-sm mb-4">
          Como um agente da Ordem nível <strong className="text-red-400">Recruta (NEX {draft.nex}%)</strong>, 
          você tem acesso ilimitado a itens de Categoria 0, mas pode pegar apenas 
          <strong className="text-red-400"> até 2 itens de Categoria I</strong>. Seu limite de peso depende da sua Força ({draft.attributes.strength}).
        </p>
        
        <div className="flex flex-wrap gap-4">
          <div className={`flex flex-col px-4 py-2 rounded-lg border ${isOverCapacity ? 'bg-red-950/50 border-red-500/50 text-red-300' : 'bg-parchment-900/30 border-parchment-800/50 text-parchment-300'}`}>
            <span className="text-xs uppercase tracking-wider opacity-70">Carga</span>
            <span className="font-fantasy text-xl">{currentSpaces} / {capacity}</span>
          </div>
          
          <div className={`flex flex-col px-4 py-2 rounded-lg border ${cat1Count > 2 ? 'bg-red-950/50 border-red-500/50 text-red-300' : 'bg-parchment-900/30 border-parchment-800/50 text-parchment-300'}`}>
            <span className="text-xs uppercase tracking-wider opacity-70">Categoria I</span>
            <span className="font-fantasy text-xl">{cat1Count} / 2</span>
          </div>
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
    </div>
  )
}
