import { useOrdemStore } from '../../stores/characterStore'
import { STEP_LABELS } from '../../types/character'
import type { OrdemEquipment } from '../../types/equipment'
import {
  EQUIPMENTS, getTotalCarryCapacity, getModifiedSpaces, getDraftInstanceCategory, getCatalogCategory,
  hasItemProficiency, instanceItemId, newInstanceUid, getInstanceLabel,
  fitsWithAdjustedCounts, getCategorySlotAllocation, getMissingRitualComponentElements,
  getAccessorySkillSlots, getAccessorySkillOptions, getNonCumulativeSkillConflicts, getWornVestimentas,
  getEquipmentByInstance, getKitSlots, getKitSkillOptions,
  getLoadState, OVERLOAD_DEFENSE_PENALTY, OVERLOAD_SKILL_PENALTY, OVERLOAD_SPEED_PENALTY_METERS,
  getElementChoiceSlots, getEquipmentElementOptions,
} from '../../utils/equipmentUtils'
import type { ParanormalElement } from '../../types/ritual'
import { getSkillName, getSkillKitName } from '../../utils/skillUtils'
import { getAvailableModifications, canApplyModification, isModifiable, countApplied } from '../../utils/modificationUtils'
import {
  getAvailableCurses, canApplyCurse, isCursable, getCurseCategoryDelta, curseChoiceKey, formatCurseElement, getSheetAttributes,
  canPatenteUseCursedItems, getCursePriceNote, getCursesBlockedByPatente,
} from '../../utils/curseUtils'
import type { OrdemElement } from '../../types/ritual'
import { getAvailableRituals, ELEMENT_NAMES, ELEMENT_COLORS } from '../../utils/ritualUtils'
import { hasClassPower, getFavoriteWeaponReduction, getFavoriteEquipmentReduction, getWorkToolBonus } from '../../utils/characterUtils'
import { addsStrengthToDamage, formatWeaponSummary } from '../../utils/ordemWeaponUtils'
import { getPatente, PATENTES } from '../../utils/patenteUtils'
import { getEffectiveCreditLimit, getUnproficientProtections } from '../../utils/sheetEffects'
import { isStepComplete } from '../../utils/draftValidation'
import { StepNav } from '../../../../components/wizard/StepNav'

const CAT_ROMAN = ['0', 'I', 'II', 'III', 'IV']

/** Elementos escolhíveis por maldição: Antielemento rola 1d4 (sem Medo); Proteção Elemental aceita qualquer. */
const CURSE_ELEMENT_OPTIONS: Record<string, OrdemElement[]> = {
  antielemento: ['knowledge', 'energy', 'death', 'blood'],
  'protecao-elemental': ['knowledge', 'energy', 'death', 'blood', 'fear'],
}

export function EquipmentStep() {
  const { draft, updateDraft, nextStep, prevStep } = useOrdemStore()

  const strength = getSheetAttributes(draft).strength
  const capacity = getTotalCarryCapacity(draft)
  const currentSpaces = getModifiedSpaces(draft)
  const isOverCapacity = currentSpaces > capacity

  const patente = getPatente(draft.patente)
  // Patrocinador da Ordem (origem Magnata) sobe o limite de crédito um degrau.
  const credit = getEffectiveCreditLimit(draft)
  // Alocação das unidades nas vagas da Patente (item menor pode ocupar vaga maior — F21).
  const slotAllocation = getCategorySlotAllocation(draft, patente)
  const accessibleSlots = slotAllocation.filter(s => s.limit > 0)

  const weapons = EQUIPMENTS.filter(i => i.type === 'weapon')
  const protections = EQUIPMENTS.filter(i => i.type === 'protection')
  const paranormal = EQUIPMENTS.filter(i => i.paranormal)
  const general = EQUIPMENTS.filter(i => i.type !== 'weapon' && i.type !== 'protection' && !i.paranormal)
  // Rituais conhecidos cujos componentes ritualísticos não estão no loadout (aviso, não bloqueia).
  const missingComponents = getMissingRitualComponentElements(draft)
  // Acessórios: perícia a escolher por unidade, e o aviso de "bônus de itens não acumulam" (p. 63).
  const accessorySlots = getAccessorySkillSlots(draft)
  const accessorySkillOptions = getAccessorySkillOptions()
  const skillConflicts = getNonCumulativeSkillConflicts(draft)
  const pendingAccessorySkills = accessorySlots.filter(s => !s.skillId).length
  // Vestimentas além do limite de duas: carregadas, mas com o bônus inativo (p. 63).
  const inactiveVestimentas = getWornVestimentas(draft).inactive
  // Kits: um slot por Kit de Perícia e por acessório com Instrumental.
  const kitSlots = getKitSlots(draft)
  const kitSkillOptions = getKitSkillOptions()
  const pendingKits = kitSlots.filter(s => !s.skillId).length
  // Itens paranormais nomeados "de (Elemento)": Amarras e Scanner.
  const elementSlots = getElementChoiceSlots(draft)
  const elementOptions = getEquipmentElementOptions()
  const pendingElements = elementSlots.filter(s => !s.element).length
  // Proteção sem proficiência: −ØØ em Força e Agilidade (p. 62), penalidade ampla o bastante
  // pra merecer aviso próprio no passo, não só o rótulo no card do item.
  const unproficientProtections = getUnproficientProtections(draft)
  // Itens amaldiçoados exigem Patente de Agente Especial ou acima (p. 144). `blockedCurses` cobre
  // o save antigo (ou a Patente rebaixada depois de amaldiçoar), que trava a etapa até ser desfeito.
  const curseAllowed = canPatenteUseCursedItems(draft.patente)
  const blockedCurses = getCursesBlockedByPatente(draft)
  const load = getLoadState(draft)

  const addUnit = (itemId: string) => {
    const uid = newInstanceUid(draft.equipmentChoices, itemId)
    updateDraft({ equipmentChoices: [...draft.equipmentChoices, uid] })
  }

  const removeUnit = (uid: string) => {
    // Ao remover a unidade, descarta as modificações, maldições e escolhas de parâmetro dela.
    const mods = { ...draft.equipmentModifications }
    delete mods[uid]
    const curses = { ...draft.equipmentCurses }
    delete curses[uid]
    const curseChoices = Object.fromEntries(
      Object.entries(draft.equipmentCurseChoices).filter(([k]) => !k.startsWith(`${uid}:`)),
    )
    const accessorySkills = { ...draft.accessorySkillChoices }
    delete accessorySkills[uid]
    const kitSkills = { ...draft.kitSkillChoices }
    delete kitSkills[uid]
    const itemElements = { ...draft.equipmentElementChoices }
    delete itemElements[uid]
    updateDraft({
      kitSkillChoices: kitSkills,
      equipmentElementChoices: itemElements,
      equipmentChoices: draft.equipmentChoices.filter(c => c !== uid),
      equipmentModifications: mods,
      equipmentCurses: curses,
      equipmentCurseChoices: curseChoices,
      accessorySkillChoices: accessorySkills,
      ...(draft.utilityBackpackItem === uid ? { utilityBackpackItem: null } : {}),
    })
  }

  const setItemElement = (uid: string, element: string) => {
    const updated = { ...draft.equipmentElementChoices }
    if (element) updated[uid] = element as ParanormalElement
    else delete updated[uid]
    updateDraft({ equipmentElementChoices: updated })
  }

  const setKitSkill = (uid: string, skillId: string) => {
    const updated = { ...draft.kitSkillChoices }
    if (skillId) updated[uid] = skillId
    else delete updated[uid]
    updateDraft({ kitSkillChoices: updated })
  }

  const setAccessorySkill = (uid: string, index: number, skillId: string) => {
    const current = [...(draft.accessorySkillChoices[uid] ?? [])]
    if (skillId) current[index] = skillId
    else delete current[index]
    const updated = { ...draft.accessorySkillChoices }
    if (current.filter(Boolean).length === 0) delete updated[uid]
    else updated[uid] = current
    updateDraft({ accessorySkillChoices: updated })
  }

  /**
   * Aplica/remove a modificação. A maioria alterna aplicada/não aplicada; as repetíveis (só o
   * Aprimorado, com Função Adicional) ciclam 0 → 1 → 2 → 0, pra caber num clique só.
   */
  const toggleModification = (uid: string, modId: string) => {
    const item = getEquipmentByInstance(uid)
    if (!item) return
    const current = draft.equipmentModifications[uid] ?? []
    const count = countApplied(current, modId)
    const canAddMore = canApplyModification(item, current, modId)
    const nextCount = canAddMore ? count + 1 : 0
    const next = [...current.filter(m => m !== modId), ...Array<string>(nextCount).fill(modId)]
    const updated = { ...draft.equipmentModifications }
    if (next.length === 0) delete updated[uid]
    else updated[uid] = next
    updateDraft({ equipmentModifications: updated })
  }

  const toggleCurse = (uid: string, curseId: string) => {
    const current = draft.equipmentCurses[uid] ?? []
    const next = current.includes(curseId) ? current.filter(c => c !== curseId) : [...current, curseId]
    const updated = { ...draft.equipmentCurses }
    if (next.length === 0) delete updated[uid]
    else updated[uid] = next
    // Ao remover a maldição, descarta a escolha de parâmetro (elemento/ritual) dela.
    const choices = { ...draft.equipmentCurseChoices }
    if (current.includes(curseId)) delete choices[curseChoiceKey(uid, curseId)]
    updateDraft({ equipmentCurses: updated, equipmentCurseChoices: choices })
  }

  const setCurseChoice = (uid: string, curseId: string, value: string) => {
    updateDraft({ equipmentCurseChoices: { ...draft.equipmentCurseChoices, [curseChoiceKey(uid, curseId)]: value } })
  }

  const renderItem = (item: OrdemEquipment) => {
    // Unidades deste item (permite 2 revólveres, cada um com mods/maldições próprias).
    const units = draft.equipmentChoices.filter(uid => instanceItemId(uid) === item.id)
    const isSelected = units.length > 0

    // Bloqueio por vagas da Patente (Categoria 0 é ilimitada; item menor pode usar vaga maior).
    // Uma unidade nova entra na sua categoria de catálogo — já reduzida se for a Arma Favorita
    // (trilha Aniquilador), senão uma arma acima do limite nunca ficaria requisitável pra marcar.
    const catalogCategory = getCatalogCategory(draft, item)
    const canAddUnit = catalogCategory === 0 || fitsWithAdjustedCounts(draft, patente, { [catalogCategory]: 1 })
    // Proficiência (arma ou proteção) NÃO bloqueia — apenas sinaliza (o livro permite requisitar
    // sem proficiência, com penalidade ao usar).
    const noProficiency = !hasItemProficiency(draft, item)
    // Arma Favorita (trilha Aniquilador, NEX 10%+): reduz a categoria da arma escolhida.
    const favoriteReduction = getFavoriteWeaponReduction(draft)
    const canMarkFavorite = item.type === 'weapon' && favoriteReduction > 0
    const isFavorite = item.type === 'weapon' && draft.favoriteWeapon === item.id
    // Ferramentas Favoritas (origem Engenheiro): reduz a categoria de um item que não seja arma.
    const equipmentFavoriteReduction = getFavoriteEquipmentReduction(draft)
    const canMarkFavoriteEquipment = item.type !== 'weapon' && equipmentFavoriteReduction > 0
    const isFavoriteEquipment = item.type !== 'weapon' && draft.favoriteEquipment === item.id
    // Ferramenta de Trabalho (origem Operário): +1 ataque/dano/margem de ameaça numa arma simples ou tática.
    const workToolBonus = getWorkToolBonus(draft)
    const canMarkWorkTool = item.type === 'weapon' && item.proficiency !== 'heavy' && workToolBonus > 0
    const isWorkTool = item.type === 'weapon' && draft.workToolWeapon === item.id
    const displayCat = units.length === 1 ? getDraftInstanceCategory(draft, units[0]) : catalogCategory

    const isDisabled = !isSelected && !canAddUnit

    return (
      <div
        key={item.id}
        onClick={() => {
          if (isSelected) removeUnit(units[units.length - 1])
          else if (!isDisabled) addUnit(item.id)
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
        <div className="flex flex-col min-w-0">
          <span className={`font-fantasy text-lg ${isSelected ? 'text-red-400' : 'text-parchment-300'}`}>
            {item.name}
            {units.length > 1 && <span className="text-red-300/80 text-sm"> ×{units.length}</span>}
          </span>
          <div className="flex flex-wrap gap-2 text-xs text-parchment-500 mt-1">
            <span className="bg-parchment-900/50 px-2 py-0.5 rounded border border-parchment-800/50">
              Cat {CAT_ROMAN[displayCat]}
              {displayCat !== item.category && (
                <span className="text-gold-500/80"> (base {CAT_ROMAN[item.category]})</span>
              )}
            </span>
            <span className="bg-parchment-900/50 px-2 py-0.5 rounded border border-parchment-800/50">
              Espaço: {item.spaces}
            </span>
            {canMarkFavorite && (
              <button
                onClick={e => { e.stopPropagation(); updateDraft({ favoriteWeapon: isFavorite ? null : item.id }) }}
                title="Arma Favorita (trilha Aniquilador): reduz a categoria desta arma, liberando-a mesmo acima do limite normal da sua Patente"
                className={`text-xs px-2 py-0.5 rounded border transition-all ${isFavorite
                  ? 'bg-gold-900/40 border-gold-700/50 text-gold-300'
                  : 'border-parchment-800 text-parchment-500 hover:border-gold-800 hover:text-parchment-300'}`}
              >
                ⭐ Favorita{isFavorite ? ` (−${CAT_ROMAN[favoriteReduction]})` : ''}
              </button>
            )}
            {canMarkFavoriteEquipment && (
              <button
                onClick={e => { e.stopPropagation(); updateDraft({ favoriteEquipment: isFavoriteEquipment ? null : item.id }) }}
                title="Ferramentas Favoritas (origem Engenheiro): reduz a categoria deste item, liberando-o mesmo acima do limite normal da sua Patente"
                className={`text-xs px-2 py-0.5 rounded border transition-all ${isFavoriteEquipment
                  ? 'bg-gold-900/40 border-gold-700/50 text-gold-300'
                  : 'border-parchment-800 text-parchment-500 hover:border-gold-800 hover:text-parchment-300'}`}
              >
                🔧 Favorito{isFavoriteEquipment ? ` (−${CAT_ROMAN[equipmentFavoriteReduction]})` : ''}
              </button>
            )}
            {canMarkWorkTool && (
              <button
                onClick={e => { e.stopPropagation(); updateDraft({ workToolWeapon: isWorkTool ? null : item.id }) }}
                title="Ferramenta de Trabalho (origem Operário): +1 em testes de ataque, rolagens de dano e margem de ameaça com esta arma, e você ganha proficiência com ela"
                className={`text-xs px-2 py-0.5 rounded border transition-all ${isWorkTool
                  ? 'bg-gold-900/40 border-gold-700/50 text-gold-300'
                  : 'border-parchment-800 text-parchment-500 hover:border-gold-800 hover:text-parchment-300'}`}
              >
                🛠️ Ferramenta{isWorkTool ? ` (+${workToolBonus})` : ''}
              </button>
            )}
            {item.type === 'weapon' && (
              <>
                <span className="bg-parchment-900/50 px-2 py-0.5 rounded border border-parchment-800/50">
                  {item.damage} {item.damageType}
                </span>
                <span className="bg-parchment-900/50 px-2 py-0.5 rounded border border-parchment-800/50">
                  Crítico: {item.critical}
                </span>
                <span
                  className="bg-parchment-900/50 px-2 py-0.5 rounded border border-parchment-800/50"
                  title={addsStrengthToDamage(item) ? 'Soma Força no dano' : 'Não soma atributo no dano'}
                >
                  {formatWeaponSummary(item)}
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
              <span className="text-red-400/70 px-2 py-0.5">Sem vaga na Patente</span>
            )}
          </div>
          {item.description && (
            <p className="text-parchment-600 text-xs mt-1.5 leading-snug">{item.description}</p>
          )}

          {isSelected && units.map(uid => {
            const appliedMods = draft.equipmentModifications[uid] ?? []
            const appliedCurses = draft.equipmentCurses[uid] ?? []
            const unitCat = getDraftInstanceCategory(draft, uid)
            const editable = isModifiable(item) || isCursable(item)
            // Slots de perícia deste acessório (Utensílio/Vestimenta, +1 com Função Adicional).
            const unitAccessorySlots = accessorySlots.filter(s => s.uid === uid)
            // Kit desta unidade (Kit de Perícia, ou acessório com a modificação Instrumental).
            const unitKitSlot = kitSlots.find(s => s.uid === uid)
            // Itens "de (Elemento)": Amarras e Scanner de Manifestação Paranormal.
            const unitElementSlot = elementSlots.find(s => s.uid === uid)
            const canBackpack = hasClassPower(draft, 'utility-backpack') && item.type !== 'weapon'
            const isBackpacked = draft.utilityBackpackItem === uid
            return (
              <div key={uid} className="mt-2 pt-2 border-t border-parchment-900/50" onClick={e => e.stopPropagation()}>
                {canBackpack && (
                  <button
                    onClick={() => updateDraft({ utilityBackpackItem: isBackpacked ? null : uid })}
                    title="Mochila de Utilidades: este item conta como uma categoria abaixo e ocupa 1 espaço a menos (um item por vez, exceto armas)"
                    className={`text-xs px-2 py-0.5 rounded border mb-1.5 transition-all ${isBackpacked
                      ? 'bg-gold-900/40 border-gold-700/50 text-gold-300'
                      : 'border-parchment-800 text-parchment-500 hover:border-gold-800 hover:text-parchment-300'}`}
                  >
                    🎒 Mochila de Utilidades{isBackpacked ? ' (−1 categoria, −1 espaço)' : ''}
                  </button>
                )}
                {units.length > 1 && (
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-red-300/90">
                      {getInstanceLabel(draft, uid)} <span className="text-parchment-600 font-normal">· Cat {CAT_ROMAN[unitCat]}</span>
                    </p>
                    <button
                      onClick={() => removeUnit(uid)}
                      className="text-xs text-parchment-600 hover:text-red-400 px-1.5 transition-colors"
                      title="Remover esta unidade"
                    >
                      ✕ remover
                    </button>
                  </div>
                )}

                {unitElementSlot && (
                  <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-parchment-600 shrink-0">Elemento deste item:</span>
                    {elementOptions.map(el => (
                      <button
                        key={el}
                        onClick={() => setItemElement(uid, unitElementSlot.element === el ? '' : el)}
                        className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border transition-colors ${
                          unitElementSlot.element === el
                            ? ELEMENT_COLORS[el]
                            : 'border-parchment-800 text-parchment-600 hover:border-parchment-600'
                        }`}
                      >
                        {ELEMENT_NAMES[el]}
                      </button>
                    ))}
                    {!unitElementSlot.element && (
                      <span className="text-amber-400/90 text-xs">escolha pendente</span>
                    )}
                  </div>
                )}

                {unitKitSlot && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs text-parchment-600 shrink-0">
                      {unitKitSlot.kind === 'instrumental' ? 'Funciona como kit de' : 'Kit de'}
                    </span>
                    <select
                      value={unitKitSlot.skillId ?? ''}
                      onChange={e => setKitSkill(uid, e.target.value)}
                      className={`flex-1 bg-parchment-950 border rounded px-2 py-1 text-parchment-300 text-xs ${
                        unitKitSlot.skillId ? 'border-parchment-800' : 'border-amber-700/60'
                      }`}
                    >
                      <option value="">Escolha o kit…</option>
                      {kitSkillOptions.map(sid => (
                        <option key={sid} value={sid}>
                          {getSkillKitName(sid)} ({getSkillName(sid)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {unitAccessorySlots.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {unitAccessorySlots.map(slot => (
                      <div key={slot.index} className="flex items-center gap-2">
                        <span className="text-xs text-parchment-600 shrink-0">
                          {slot.index === 1 ? 'Função adicional:' : 'Concede'} +{slot.value} em
                        </span>
                        <select
                          value={slot.skillId ?? ''}
                          onChange={e => setAccessorySkill(uid, slot.index, e.target.value)}
                          className={`flex-1 bg-parchment-950 border rounded px-2 py-1 text-parchment-300 text-xs ${
                            slot.skillId ? 'border-parchment-800' : 'border-amber-700/60'
                          }`}
                        >
                          <option value="">Escolha a perícia…</option>
                          {accessorySkillOptions.map(sid => (
                            <option key={sid} value={sid}>{getSkillName(sid)}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {isModifiable(item) && (
                  <>
                    <p className="text-xs text-parchment-600 mb-1">
                      Modificações <span className="text-parchment-700">(cada uma sobe a categoria em I e consome um slot da sua Patente)</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {getAvailableModifications(item).map(mod => {
                        const count = countApplied(appliedMods, mod.id)
                        const applied = count > 0
                        // Aplicar sobe a categoria efetiva em 1 → a unidade precisa continuar cabendo nas vagas.
                        const newCat = unitCat + 1
                        const fitsPatente = newCat <= 4 && fitsWithAdjustedCounts(draft, patente, { [unitCat]: -1, [newCat]: 1 })
                        const canAddMore = canApplyModification(item, appliedMods, mod.id) && fitsPatente
                        const addable = applied || canAddMore
                        return (
                          <button
                            key={mod.id}
                            onClick={() => { if (addable) toggleModification(uid, mod.id) }}
                            disabled={!addable}
                            title={canAddMore && applied ? `${mod.effect} (clique para aplicar uma 2ª vez)` : mod.effect}
                            className={`text-xs px-2 py-0.5 rounded border transition-all ${applied
                              ? 'bg-gold-900/40 border-gold-700/50 text-gold-300'
                              : addable
                                ? 'border-parchment-800 text-parchment-500 hover:border-gold-800 hover:text-parchment-300'
                                : 'border-parchment-900/40 text-parchment-800 cursor-not-allowed'}`}
                          >
                            {mod.name}{count > 1 && ` ×${count}`}
                          </button>
                        )
                      })}
                    </div>
                    {appliedMods.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {getAvailableModifications(item).filter(m => appliedMods.includes(m.id)).map(m => (
                          <li key={m.id} className="text-xs text-gold-600/90">
                            <span className="font-semibold">
                              {m.name}{countApplied(appliedMods, m.id) > 1 && ` ×${countApplied(appliedMods, m.id)}`}:
                            </span> {m.effect}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {isCursable(item) && (
                  <>
                    <p className={`text-xs text-parchment-600 mb-1 ${isModifiable(item) ? 'mt-2' : ''}`}>
                      Maldições <span className="text-parchment-700">(itens amaldiçoados: a 1ª sobe a categoria em II, as seguintes em I; elementos opressores não se combinam no mesmo item)</span>
                    </p>
                    {!curseAllowed && (
                      <p className="text-xs text-amber-500/90 mb-1">
                        Sua Patente não requisita itens amaldiçoados: o livro (pág. 144) os libera apenas para
                        Agente Especial, Oficial de Operações e Agente de Elite — independentemente da categoria do item.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {getAvailableCurses(item).map(curse => {
                        const applied = appliedCurses.includes(curse.id)
                        // Adicionar leva a categoria (sem teto) pra: base + mods + delta das maldições com mais uma.
                        const newCat = item.category + appliedMods.length + getCurseCategoryDelta(appliedCurses.length + 1)
                        const fitsPatente = newCat <= 4 && fitsWithAdjustedCounts(draft, patente, { [unitCat]: -1, [newCat]: 1 })
                        // Remover continua permitido mesmo sem Patente (é como se corrige um save antigo).
                        const addable = applied
                          || (curseAllowed && canApplyCurse(item, appliedCurses, curse.id, draft.equipmentCurseChoices, uid) && fitsPatente)
                        return (
                          <button
                            key={curse.id}
                            onClick={() => { if (addable) toggleCurse(uid, curse.id) }}
                            disabled={!addable}
                            title={curseAllowed ? curse.effect : 'Patente insuficiente para itens amaldiçoados (pág. 144)'}
                            className={`text-xs px-2 py-0.5 rounded border transition-all ${applied
                              ? 'bg-purple-900/40 border-purple-600/50 text-purple-300'
                              : addable
                                ? 'border-parchment-800 text-parchment-500 hover:border-purple-800 hover:text-parchment-300'
                                : 'border-parchment-900/40 text-parchment-800 cursor-not-allowed'}`}
                          >
                            {curse.name}
                            <span className="opacity-60"> · {curse.element === 'varies' ? 'Varia' : ELEMENT_NAMES[curse.element]}</span>
                          </button>
                        )
                      })}
                    </div>
                    {appliedCurses.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {getAvailableCurses(item).filter(c => appliedCurses.includes(c.id)).map(c => (
                          <li key={c.id} className="text-xs text-purple-400/90">
                            <span className="font-semibold">{c.name} ({formatCurseElement(c, uid, draft.equipmentCurseChoices)}):</span> {c.effect}
                            {/* O preço da maldição (pág. 145): cumulativo, por maldição do elemento. */}
                            {getCursePriceNote(c, uid, draft.equipmentCurseChoices) && (
                              <span className="text-amber-500/80"> Preço: {getCursePriceNote(c, uid, draft.equipmentCurseChoices)}.</span>
                            )}
                            {c.choice === 'element' && (
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {(CURSE_ELEMENT_OPTIONS[c.id] ?? []).map(el => (
                                  <button
                                    key={el}
                                    onClick={() => setCurseChoice(uid, c.id, el)}
                                    className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border transition-colors ${
                                      draft.equipmentCurseChoices[curseChoiceKey(uid, c.id)] === el
                                        ? ELEMENT_COLORS[el]
                                        : 'text-parchment-600 border-parchment-800 hover:border-parchment-600 hover:text-parchment-300'
                                    }`}
                                  >
                                    {ELEMENT_NAMES[el]}
                                  </button>
                                ))}
                              </div>
                            )}
                            {c.choice === 'ritual1' && (
                              <select
                                value={draft.equipmentCurseChoices[curseChoiceKey(uid, c.id)] ?? ''}
                                onChange={e => setCurseChoice(uid, c.id, e.target.value)}
                                className="block mt-1 bg-parchment-950 border border-purple-900/50 rounded px-1.5 py-0.5 text-purple-300 text-xs"
                              >
                                <option value="" disabled>Escolha o ritual vinculado (1º círculo)…</option>
                                {getAvailableRituals(1).map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {!editable && units.length > 1 && (
                  <p className="text-xs text-parchment-700">Unidade sem opções de modificação/maldição.</p>
                )}
              </div>
            )
          })}

          {isSelected && (
            <div className="mt-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { if (canAddUnit) addUnit(item.id) }}
                disabled={!canAddUnit}
                title={canAddUnit ? `Adicionar outra unidade de ${item.name} (com modificações/maldições próprias)` : 'Limite da Patente atingido pra categoria deste item'}
                className={`text-xs px-2 py-0.5 rounded border transition-all ${canAddUnit
                  ? 'border-parchment-800 text-parchment-500 hover:border-red-800 hover:text-parchment-300'
                  : 'border-parchment-900/40 text-parchment-800 cursor-not-allowed'}`}
              >
                ＋ adicionar outra unidade
              </button>
            </div>
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
    <div className="pb-20">
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
          <strong className="text-parchment-300"> {patente.name}</strong> libera {accessibleSlots.length > 0
            ? accessibleSlots.map(s => `${s.limit}× Cat ${CAT_ROMAN[s.category]}`).join(' · ')
            : 'nenhuma categoria acima de 0'}. Um item de categoria menor pode ocupar uma vaga de categoria maior.
        </p>
        <p className="text-parchment-700 text-xs mb-4">
          Crédito para compras de missão: <strong className="text-parchment-500">{credit.level}</strong>
          {credit.source && <span className="text-gold-600/90"> (um degrau acima pelo {credit.source})</span>}
          {' '}(uso na mesa, não afeta a criação). Seu limite de peso depende da Força ({strength}).
        </p>

        <div className="flex flex-wrap gap-3">
          <div className={`flex flex-col px-4 py-2 rounded-lg border ${isOverCapacity ? 'bg-red-950/50 border-red-500/50 text-red-300' : 'bg-parchment-900/30 border-parchment-800/50 text-parchment-300'}`}>
            <span className="text-xs uppercase tracking-wider opacity-70">Carga</span>
            <span className="font-fantasy text-xl">{currentSpaces} / {capacity}</span>
          </div>
          {accessibleSlots.map(s => {
            // Mostra o maior entre "itens desta categoria" e "vagas desta categoria usadas"
            // (ex.: Operador com 4 itens Cat I → Cat I "4/3" e Cat II "1/1, inclui 1 de cat. menor").
            const shown = Math.max(s.items, s.usedSlots)
            const borrowing = s.items > s.limit && !s.overflow
            const style = s.overflow
              ? 'bg-red-950/50 border-red-500/50 text-red-300'
              : borrowing || s.spillIn > 0
                ? 'bg-gold-950/40 border-gold-600/50 text-gold-300'
                : 'bg-parchment-900/30 border-parchment-800/50 text-parchment-300'
            return (
              <div key={s.category} className={`flex flex-col px-4 py-2 rounded-lg border ${style}`}>
                <span className="text-xs uppercase tracking-wider opacity-70">Categoria {CAT_ROMAN[s.category]}</span>
                <span className="font-fantasy text-xl">{shown} / {s.limit}</span>
                {s.overflow && <span className="text-[11px] opacity-80">sem vaga — remova um item</span>}
                {!s.overflow && borrowing && <span className="text-[11px] opacity-80">+{s.items - s.limit} na vaga de cat. maior</span>}
                {!s.overflow && s.spillIn > 0 && <span className="text-[11px] opacity-80">inclui {s.spillIn} de cat. menor</span>}
                {!s.overflow && !borrowing && s.spillIn === 0 && s.usedSlots >= s.limit && <span className="text-[11px] opacity-80">máximo atingido</span>}
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
          <h3 className="font-fantasy text-xl text-parchment-300 border-b border-parchment-900/50 pb-2 mb-4">Itens Paranormais</h3>
          {pendingElements > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-amber-700/50 bg-amber-950/30 text-amber-300 text-sm">
              ⚠️ Escolha o elemento {pendingElements > 1 ? `dos ${pendingElements} itens` : 'do item'} que
              você requisitou — o livro nomeia esses itens como "de (Elemento)" porque o efeito depende
              dele: as Amarras só imobilizam criaturas vulneráveis ao elemento que as compõe, e o
              Scanner detecta apenas manifestações do elemento escolhido.
            </div>
          )}
          {missingComponents.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-amber-700/50 bg-amber-950/30 text-amber-300 text-sm">
              ⚠️ Você conhece rituais de <strong>{missingComponents.map(el => ELEMENT_NAMES[el]).join(' e ')}</strong>, mas
              não pegou os <strong>Componentes Ritualísticos</strong> desses elementos. Sem eles (e uma mão livre), o
              ritual não pode ser conjurado — eles não são gastos, mas precisam estar com você.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paranormal.map(renderItem)}
          </div>
        </div>

        <div>
          <h3 className="font-fantasy text-xl text-parchment-300 border-b border-parchment-900/50 pb-2 mb-4">Equipamento Geral</h3>
          {load.overloaded && (
            <div className="mb-4 p-3 rounded-lg border-2 border-amber-600 bg-amber-950/40 text-amber-200 text-sm">
              🎒 <strong>SOBRECARREGADO</strong> — {load.spaces} de {load.capacity} espaços.
              Você pode carregar tudo isso, mas o livro (pág. 55) cobra o preço:{' '}
              <strong>−{OVERLOAD_DEFENSE_PENALTY} na Defesa</strong>,{' '}
              <strong>−{OVERLOAD_SKILL_PENALTY} nas perícias com penalidade de carga</strong> e{' '}
              <strong>−{OVERLOAD_SPEED_PENALTY_METERS}m de deslocamento</strong>. A ficha já aplica tudo.
              O limite absoluto é <strong>{load.max} espaços</strong> ({load.max - load.spaces} a mais que agora).
            </div>
          )}
          {load.impossible && (
            <div className="mb-4 p-3 rounded-lg border-2 border-red-600 bg-red-950/40 text-red-200 text-sm">
              🚫 <strong>Carga impossível</strong> — {load.spaces} espaços, e o teto é {load.max} (o dobro da
              capacidade). Remova itens para continuar.
            </div>
          )}
          {blockedCurses.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-red-700/60 bg-red-950/30 text-red-300 text-sm">
              ⛔ <strong>Sua Patente não requisita itens amaldiçoados</strong> (livro, pág. 144): eles são liberados
              apenas para Agente Especial, Oficial de Operações e Agente de Elite, independentemente da categoria.
              Remova as maldições de <strong>{blockedCurses.map(uid => getInstanceLabel(draft, uid)).join(', ')}</strong>{' '}
              ou suba a Patente para seguir.
            </div>
          )}
          {unproficientProtections.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-amber-700/50 bg-amber-950/30 text-amber-300 text-sm">
              ⚠️ Você está usando proteção sem proficiência
              (<strong>{unproficientProtections.map(uid => getInstanceLabel(draft, uid)).join(', ')}</strong>):
              o livro (pág. 62) impõe <strong>−ØØ em todos os testes de Força e Agilidade</strong>, não só em
              ataques. A ficha já desconta esses dados — dá pra requisitar, mas o custo é alto.
            </div>
          )}
          {skillConflicts.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-amber-700/50 bg-amber-950/30 text-amber-300 text-sm">
              ⚠️ <strong>Bônus de itens não se acumulam</strong> (livro, pág. 63). Você tem mais de um item
              beneficiando a mesma perícia — pode ficar com todos, mas na mesa vale só o maior:
              <ul className="mt-1.5 space-y-0.5">
                {skillConflicts.map(c => (
                  <li key={c.skillId}>
                    <strong>{getSkillName(c.skillId)}</strong>: {c.sources.join(' + ')} —{' '}
                    a ficha usa <strong>+{c.applied}</strong>.
                  </li>
                ))}
              </ul>
            </div>
          )}
          {inactiveVestimentas.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-amber-700/50 bg-amber-950/30 text-amber-300 text-sm">
              ⚠️ Você só recebe o bônus de <strong>duas vestimentas ao mesmo tempo</strong> (livro, pág. 63).
              Pode carregar todas — vestir ou despir é uma ação completa, então a troca é na mesa —, mas a ficha
              conta as duas de maior bônus. Fora agora:{' '}
              <strong>{inactiveVestimentas.map(uid => getInstanceLabel(draft, uid)).join(', ')}</strong>.
            </div>
          )}
          {pendingAccessorySkills > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-amber-700/50 bg-amber-950/30 text-amber-300 text-sm">
              ⚠️ Escolha a perícia {pendingAccessorySkills > 1 ? `dos ${pendingAccessorySkills} acessórios` : 'do acessório'} que
              você requisitou — o bônus é definido ao adquirir o item.
            </div>
          )}
          {pendingKits > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-amber-700/50 bg-amber-950/30 text-amber-300 text-sm">
              ⚠️ Diga de qual perícia {pendingKits > 1 ? `são os ${pendingKits} kits` : 'é o kit'} que você
              requisitou — existe um kit para cada perícia que exige ferramentas.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {general.map(renderItem)}
          </div>
        </div>
      </div>

      <StepNav
        onPrev={prevStep}
        onNext={nextStep}
        pendingReason={isStepComplete(draft, 'equipment')
          ? undefined
          : load.impossible
            ? `Carga acima do teto de ${load.max} espaços`
            : 'Pendências no equipamento'}
      />
    </div>
  )
}
