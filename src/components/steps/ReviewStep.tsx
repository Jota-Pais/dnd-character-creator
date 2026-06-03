import { useState } from 'react'
import { useCharacterStore } from '../../stores/characterStore'
import {
  getRace, getSubrace, getEffectiveAbilityBonuses, getEffectiveSpeed,
  getEffectiveDarkvision, RACE_PRESENTATION, LANGUAGES,
} from '../../utils/raceUtils'
import {
  getClass, getSubclass, CLASS_PRESENTATION,
  getHpAtLevel1, getAverageHpAtLevel, getRolledHpAtLevel, isActiveCaster,
} from '../../utils/classUtils'
import { getBackground, BACKGROUND_PRESENTATION, getToolName, SKILLS } from '../../utils/backgroundUtils'
import {
  calculateModifier, formatModifier, ALL_ABILITY_SCORES, ABILITY_LABELS,
  getProficiencyBonus,
} from '../../utils/abilityScoreUtils'
import { getItemName, getArmor } from '../../utils/equipmentUtils'
import {
  getSpell,
  getSpellSaveDC,
  formatSpellAttackBonus,
  getSpellSlots,
  SCHOOL_EMOJI,
} from '../../utils/spellUtils'
import { exportCharacter } from '../../utils/storage'
import type { AbilityScore } from '../../types/race'
import type { Armor, EquipmentDraft, ClassStartingEquipment, EquipmentOption } from '../../types/equipment'
import type { Background } from '../../types/background'
import type { HpMethod } from '../../types/character'

const SKILL_ABILITY: Record<string, AbilityScore> = {
  acrobatics: 'DEX', 'animal-handling': 'WIS', arcana: 'INT', athletics: 'STR',
  deception: 'CHA', history: 'INT', insight: 'WIS', intimidation: 'CHA',
  investigation: 'INT', medicine: 'WIS', nature: 'INT', perception: 'WIS',
  performance: 'CHA', persuasion: 'CHA', religion: 'INT', 'sleight-of-hand': 'DEX',
  stealth: 'DEX', survival: 'WIS',
}

const LANG_NAME = Object.fromEntries(LANGUAGES.map(l => [l.id, l.name]))

function findArmorInEquipment(
  equipment: EquipmentDraft,
  classEquipment: ClassStartingEquipment | undefined,
): Armor | undefined {
  if (!classEquipment || equipment.method !== 'standard') return undefined

  for (const item of classEquipment.fixed) {
    if (item.itemType === 'armor') {
      const armor = getArmor(item.id)
      if (armor) return armor
    }
  }

  for (let i = 0; i < classEquipment.choices.length; i++) {
    const res = equipment.classResolutions[i]
    if (!res || res.optionIndex < 0) continue
    const option = classEquipment.choices[i]?.options[res.optionIndex]
    if (!option) continue
    for (const choiceItem of option) {
      if (choiceItem.kind === 'specific' && choiceItem.itemType === 'armor') {
        const armor = getArmor(choiceItem.id)
        if (armor) return armor
      }
    }
  }

  return undefined
}

function resolveOptionItems(option: EquipmentOption, pickedIds: string[]): string[] {
  const result: string[] = []
  let pickIdx = 0
  for (const item of option) {
    if (item.kind === 'specific') {
      const name = getItemName(item.id)
      result.push(item.quantity > 1 ? `${item.quantity}× ${name}` : name)
    } else {
      const picks = item.picks
      const slice = pickedIds.slice(pickIdx, pickIdx + picks)
      pickIdx += picks
      result.push(...slice.map(id => getItemName(id)))
    }
  }
  return result
}

export function ReviewStep() {
  const draft = useCharacterStore(state => state.draft)
  const prevStep = useCharacterStore(state => state.prevStep)
  const reset = useCharacterStore(state => state.reset)
  const setHpMethod = useCharacterStore(state => state.setHpMethod)
  const rollHpForLevel = useCharacterStore(state => state.rollHpForLevel)
  const [confirmReset, setConfirmReset] = useState(false)

  const level = draft.level ?? 1
  const hpMethod: HpMethod = draft.hpMethod ?? 'average'

  const race = draft.race ? getRace(draft.race) : undefined
  const subrace = race && draft.subrace ? getSubrace(race, draft.subrace) : null
  const cls = draft.class ? getClass(draft.class) : undefined
  const subclassData = cls && draft.classChoices.subclass
    ? getSubclass(cls, draft.classChoices.subclass)
    : undefined
  const bg = draft.background ? getBackground(draft.background) : undefined

  const classP = cls ? (CLASS_PRESENTATION[cls.id] ?? { emoji: '?', accent: '#c0961a' }) : null
  const accent = classP?.accent ?? '#c0961a'

  const profBonus = getProficiencyBonus(level)

  // Racial bonuses per ability
  const racialBonuses: Record<AbilityScore, number> = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
  if (race) {
    for (const b of getEffectiveAbilityBonuses(race, subrace ?? null, draft.raceChoices)) {
      racialBonuses[b.ability] += b.value
    }
  }

  // Final scores
  const finalScores = {} as Record<AbilityScore, number>
  for (const ab of ALL_ABILITY_SCORES) {
    finalScores[ab] = (draft.abilityScores[ab] ?? 10) + racialBonuses[ab]
  }
  const dexMod = calculateModifier(finalScores.DEX)
  const conMod = calculateModifier(finalScores.CON)

  // HP calculation
  let hp: number | null = null
  if (cls) {
    if (level <= 1) {
      hp = getHpAtLevel1(cls, conMod)
    } else if (hpMethod === 'average') {
      hp = getAverageHpAtLevel(cls, conMod, level)
    } else {
      hp = getRolledHpAtLevel(cls, conMod, level, draft.hpRolls)
    }
  }

  const speed = race ? getEffectiveSpeed(race, subrace ?? null) : null
  const darkvision = race ? getEffectiveDarkvision(race, subrace ?? null) : 0
  const classEquipment = cls?.startingEquipment
  const armor = findArmorInEquipment(draft.equipment, classEquipment)

  let ac: number
  let acNote = ''
  if (armor) {
    const dexBonus =
      armor.dexModifier === 'full' ? dexMod
      : armor.dexModifier === 'max-2' ? Math.min(dexMod, 2)
      : 0
    ac = armor.acBase + dexBonus
    if (armor.stealthDisadvantage) acNote = '*'
  } else {
    ac = 10 + dexMod
  }

  // Proficiencies
  const bgSkills = bg?.skillProficiencies ?? []
  const classSkills = draft.classChoices.skills
  const raceSkills = draft.raceChoices.skills ?? []
  const subclassSkills = draft.classChoices.subclassExtras.skills ?? []
  const allSkills = [...new Set([...bgSkills, ...classSkills, ...raceSkills, ...subclassSkills])]
  const expertiseSet = new Set(draft.classChoices.expertiseItems.filter(id => SKILL_ABILITY[id]))
  const savingThrows = cls?.savingThrows ?? []

  // Languages & tools
  const raceLanguages = race?.grantedLanguages ?? []
  const chosenRaceLanguages = draft.raceChoices.languages ?? []
  const chosenBgLanguages = draft.backgroundChoices.languages ?? []
  const allLanguages = [...new Set([...raceLanguages, ...chosenRaceLanguages, ...chosenBgLanguages])]

  const grantedClassTools = cls?.toolProficiencies.granted ?? []
  const chosenClassTools = draft.classChoices.tools
  const bgFixedTools = bg?.toolProficiencies ?? []
  const chosenBgTools = draft.backgroundChoices.tools ?? []
  const allTools = [...new Set([...grantedClassTools, ...chosenClassTools, ...bgFixedTools, ...chosenBgTools])]

  const identityParts = [
    race ? `${RACE_PRESENTATION[race.id]?.emoji ?? ''} ${subrace ? subrace.name : race.name}` : null,
    cls ? `${classP?.emoji ?? ''} ${cls.name} ${level}°${subclassData ? ` (${subclassData.name})` : ''}` : null,
    bg ? `${BACKGROUND_PRESENTATION[bg.id]?.emoji ?? ''} ${bg.name}` : null,
  ].filter(Boolean).join(' · ')

  const speedStr = speed !== null
    ? (() => {
        const m = speed * 0.3
        return Number.isInteger(m) ? `${m} m` : `${m.toFixed(1).replace('.', ',')} m`
      })()
    : '—'

  const darkvisionStr = darkvision > 0
    ? (() => {
        const m = darkvision * 0.3
        return Number.isInteger(m) ? `${m} m` : `${m.toFixed(1).replace('.', ',')} m`
      })()
    : null

  function handleExport() {
    exportCharacter(draft)
  }

  function handleReset() {
    reset()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1">
          Revisão do Personagem
        </h2>
        <p className="text-parchment-500 text-sm">
          Confira todos os detalhes antes de exportar sua ficha.
        </p>
      </div>

      {/* Identity + quick stats */}
      <div
        className="rounded-2xl border-2 p-5"
        style={{ borderColor: accent + '50', backgroundColor: accent + '0d' }}
      >
        <div className="text-center mb-5">
          <p className="font-fantasy text-3xl font-bold text-parchment-100 mb-1">
            {draft.name || '—'}
          </p>
          <p className="text-parchment-500 text-sm font-fantasy">{identityParts}</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <QuickStat label="PV" value={hp !== null ? String(hp) : '—'} accent={accent} />
          <QuickStat label="CA" value={`${ac}${acNote}`} accent={accent} />
          <QuickStat label="Iniciativa" value={formatModifier(dexMod)} accent={accent} />
          <QuickStat label="Deslocamento" value={speedStr} accent={accent} />
          {darkvisionStr && (
            <QuickStat label="Escuridão" value={darkvisionStr} accent={accent} />
          )}
        </div>
        {acNote && (
          <p className="text-xs text-parchment-700 mt-2 text-center">
            * Armadura impõe desvantagem em Furtividade
          </p>
        )}

        {cls && level > 1 && (
          <div className="mt-4 pt-4 border-t border-parchment-900/60">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-xs font-fantasy text-parchment-600 uppercase tracking-widest">
                Pontos de Vida
              </span>
              <div className="inline-flex rounded-lg border border-parchment-800 overflow-hidden">
                <button
                  onClick={() => setHpMethod('average')}
                  className="px-3 py-1.5 text-xs font-fantasy transition-colors"
                  style={hpMethod === 'average'
                    ? { backgroundColor: accent, color: '#0a0704' }
                    : { color: '#c4a97a' }}
                >
                  Média
                </button>
                <button
                  onClick={() => setHpMethod('roll')}
                  className="px-3 py-1.5 text-xs font-fantasy transition-colors border-l border-parchment-800"
                  style={hpMethod === 'roll'
                    ? { backgroundColor: accent, color: '#0a0704' }
                    : { color: '#c4a97a' }}
                >
                  Rolar
                </button>
              </div>
              {hpMethod === 'roll' && (
                <button
                  onClick={() => {
                    for (let lvl = 2; lvl <= level; lvl++) rollHpForLevel(lvl)
                  }}
                  className="px-3 py-1.5 text-xs font-fantasy rounded-lg border border-parchment-800 text-parchment-400 hover:text-parchment-200 hover:border-parchment-700 transition-colors"
                >
                  🎲 Rolar dados de vida
                </button>
              )}
            </div>
            {hpMethod === 'roll' && draft.hpRolls.some(r => r !== undefined) && (
              <p className="text-xs text-parchment-700 text-center mt-2 font-fantasy">
                Rolagens (níveis 2+):{' '}
                {Array.from({ length: level - 1 }, (_, i) => draft.hpRolls[i] ?? '—').join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Ability Scores */}
      <Section title="Atributos">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {ALL_ABILITY_SCORES.map(ab => {
            const base = draft.abilityScores[ab] ?? 10
            const bonus = racialBonuses[ab]
            const final = finalScores[ab]
            const mod = calculateModifier(final)
            return (
              <AbilityBox
                key={ab}
                label={ABILITY_LABELS[ab].short}
                base={base}
                bonus={bonus}
                final={final}
                mod={mod}
                accent={accent}
              />
            )
          })}
        </div>
      </Section>

      {/* Saving Throws + Skills */}
      {/* Proficiency bonus card */}
      <div
        className="rounded-xl border border-parchment-900 bg-parchment-950/60 px-4 py-3 flex items-center justify-between"
      >
        <div>
          <p className="text-xs font-fantasy text-parchment-600 uppercase tracking-widest">
            Bônus de Proficiência
          </p>
          <p className="text-xs text-parchment-700 mt-0.5">
            Adicionado a perícias, resistências e ataques treinados
          </p>
        </div>
        <span className="font-fantasy font-bold text-2xl" style={{ color: accent }}>
          +{profBonus}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="Resistências">
          <div className="space-y-1.5">
            {ALL_ABILITY_SCORES.map(ab => {
              const isProficient = savingThrows.includes(ab)
              const abilityMod = calculateModifier(finalScores[ab])
              const bonus = abilityMod + (isProficient ? profBonus : 0)
              return (
                <div key={ab} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs leading-none ${isProficient ? 'text-gold-500' : 'text-parchment-800'}`}>
                      {isProficient ? '●' : '○'}
                    </span>
                    <span className={`text-sm ${isProficient ? 'text-parchment-300' : 'text-parchment-600'}`}>
                      {ABILITY_LABELS[ab].long}
                    </span>
                  </div>
                  <span className={`text-sm font-mono font-bold ${isProficient ? 'text-gold-400' : 'text-parchment-700'}`}>
                    {formatModifier(bonus)}
                  </span>
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Perícias">
          <div className="space-y-1">
            {[...SKILLS].sort((a, b) => a.name.localeCompare(b.name)).map(skill => {
              const abilityId = SKILL_ABILITY[skill.id]
              const abilityMod = abilityId ? calculateModifier(finalScores[abilityId]) : 0
              const isProficient = allSkills.includes(skill.id)
              const isExpert = expertiseSet.has(skill.id)
              const bonus = abilityMod + (isProficient ? profBonus : 0) + (isExpert ? profBonus : 0)
              return (
                <div key={skill.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs leading-none ${isExpert ? 'text-gold-500' : isProficient ? 'text-gold-600' : 'text-parchment-800'}`}>
                      {isExpert ? '◆' : isProficient ? '●' : '○'}
                    </span>
                    <span className={`text-xs ${isProficient ? 'text-parchment-300' : 'text-parchment-600'}`}>
                      {skill.name}
                      {abilityId && (
                        <span className="text-parchment-800 ml-1">
                          ({ABILITY_LABELS[abilityId].short})
                        </span>
                      )}
                    </span>
                  </div>
                  <span className={`text-xs font-mono font-bold ${isProficient ? 'text-gold-400' : 'text-parchment-700'}`}>
                    {formatModifier(bonus)}
                  </span>
                </div>
              )
            })}
          </div>
        </Section>
      </div>

      {/* Languages & Tools */}
      {(allTools.length > 0 || allLanguages.length > 0) && (
        <Section title="Proficiências & Idiomas">
          <div className="space-y-3">
            {allTools.length > 0 && (
              <div>
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  Ferramentas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allTools.map(id => (
                    <Chip key={id} label={getToolName(id)} />
                  ))}
                </div>
              </div>
            )}
            {allLanguages.length > 0 && (
              <div>
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  Idiomas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allLanguages.map(id => (
                    <Chip key={id} label={LANG_NAME[id] ?? id} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Equipment */}
      <Section title="Equipamento Inicial">
        {draft.equipment.method === null && (
          <p className="text-parchment-700 text-sm italic">Equipamento não definido</p>
        )}

        {draft.equipment.method === 'wealth' && (
          <div className="space-y-4">
            <p className="text-parchment-400 text-sm">
              Riqueza inicial:{' '}
              <span className="font-fantasy font-bold text-gold-500">
                {draft.equipment.rolledGold ?? 0} po
              </span>
            </p>
            {bg && (
              <div>
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  Do Antecedente
                </p>
                <BgEquipmentChips bg={bg} chosenToolId={draft.backgroundChoices.tools?.[0]} />
              </div>
            )}
          </div>
        )}

        {draft.equipment.method === 'standard' && classEquipment && (
          <div className="space-y-4">
            {bg && (
              <div>
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  Do Antecedente
                </p>
                <BgEquipmentChips bg={bg} chosenToolId={draft.backgroundChoices.tools?.[0]} />
              </div>
            )}

            {classEquipment.fixed.length > 0 && (
              <div>
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  Itens Fixos da Classe
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {classEquipment.fixed.map((item, i) => (
                    <Chip
                      key={i}
                      label={`${item.quantity > 1 ? `${item.quantity}× ` : ''}${getItemName(item.id)}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {classEquipment.choices.length > 0 && (
              <div>
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  Escolhas de Equipamento
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {classEquipment.choices.map((choice, idx) => {
                    const res = draft.equipment.classResolutions[idx]
                    if (!res || res.optionIndex < 0) return null
                    const option = choice.options[res.optionIndex]
                    if (!option) return null
                    const items = resolveOptionItems(option, res.pickedIds)
                    return items.map((label, i) => <Chip key={`${idx}-${i}`} label={label} />)
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Background Feature */}
      {bg && (
        <Section title="Característica de Antecedente">
          <p className="font-fantasy font-semibold text-parchment-300 text-sm mb-1">
            {bg.feature.name}
          </p>
          <p className="text-parchment-600 text-sm leading-relaxed">
            {bg.feature.description}
          </p>
        </Section>
      )}

      {/* Racial Traits */}
      {race && (
        <Section title="Traços Raciais">
          <div className="space-y-3">
            {[...race.traits, ...(subrace?.traits ?? [])].map(trait => (
              <div key={trait.name}>
                <span className="text-sm font-semibold font-fantasy text-parchment-200">
                  {trait.name}.{' '}
                </span>
                <span className="text-sm text-parchment-500 leading-relaxed">
                  {trait.description}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Class Features */}
      {cls && (
        <Section title="Habilidades de Classe">
          <div className="space-y-3">
            {cls.features.map(feat => (
              <div key={feat.name}>
                <span className="text-sm font-semibold font-fantasy text-parchment-200">
                  {feat.name}.{' '}
                </span>
                <span className="text-sm text-parchment-500 leading-relaxed">
                  {feat.description}
                </span>
              </div>
            ))}
            {subclassData && cls.subclassLevel <= 1 && subclassData.features.length > 0 && (
              <>
                <div className="pt-1 border-t border-parchment-900">
                  <p className="text-xs text-parchment-700 font-fantasy uppercase tracking-widest mb-2">
                    {subclassData.name}
                  </p>
                  {subclassData.features.map(feat => (
                    <div key={feat.name} className="mb-3 last:mb-0">
                      <span className="text-sm font-semibold font-fantasy text-parchment-200">
                        {feat.name}.{' '}
                      </span>
                      <span className="text-sm text-parchment-500 leading-relaxed">
                        {feat.description}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Section>
      )}

      {/* Spells */}
      {cls && isActiveCaster(cls, level) && cls.spellcasting && (() => {
        const sc_ = cls.spellcasting!
        const dc = getSpellSaveDC(sc_, finalScores, level)
        const attackBonus = formatSpellAttackBonus(sc_, finalScores, level)
        const isWarlock = cls.id === 'warlock'
        const slotEntries = getSpellSlots(cls.id, level)
          .map((count, i) => ({ spellLevel: i + 1, count }))
          .filter(s => s.count > 0)
        const cantrips = (draft.spellChoices?.cantrips ?? []).map(id => getSpell(id)).filter(Boolean)
        const spells = (draft.spellChoices?.spells ?? []).map(id => getSpell(id)).filter(Boolean)
        return (
          <Section title="Magias">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <SpellStat label="CD de Magia" value={String(dc)} accent={accent} />
              <SpellStat label="Bônus de Ataque" value={attackBonus} accent={accent} />
            </div>

            {slotEntries.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  {isWarlock ? 'Magia de Pacto' : 'Espaços de Magia'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {slotEntries.map(({ spellLevel, count }) => (
                    <span
                      key={spellLevel}
                      className="px-2 py-1 rounded-md bg-parchment-900 border border-parchment-800 text-xs text-parchment-400 font-fantasy"
                    >
                      {count}× {spellLevel}°
                    </span>
                  ))}
                </div>
              </div>
            )}

            {cantrips.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  Truques ({cantrips.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {cantrips.map(s => s && (
                    <SpellChip key={s.id} name={s.name} school={s.school} />
                  ))}
                </div>
              </div>
            )}

            {spells.length > 0 && (
              <div>
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  {sc_.type === 'prepared' ? 'Preparadas' : 'Conhecidas'} ({spells.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {spells.map(s => s && (
                    <SpellChip key={s.id} name={s.name} school={s.school} concentration={s.concentration} ritual={s.ritual} />
                  ))}
                </div>
              </div>
            )}

            {cantrips.length === 0 && spells.length === 0 && (
              <p className="text-parchment-700 text-sm italic">Nenhuma magia selecionada</p>
            )}
          </Section>
        )
      })()}

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={handleExport}
          className="w-full py-3 rounded-xl font-fantasy font-bold text-base tracking-wide transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ backgroundColor: accent, color: '#0a0704' }}
        >
          Exportar Ficha como JSON ↓
        </button>
      </div>

      {/* Mobile nav */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-parchment-900 px-4 py-3 flex justify-between items-center lg:hidden"
        style={{ backgroundColor: '#0a0704ee', backdropFilter: 'blur(8px)' }}
      >
        <button
          onClick={prevStep}
          className="px-4 py-2 text-parchment-500 hover:text-parchment-300 transition-colors text-sm font-fantasy"
        >
          ← Voltar
        </button>
        {confirmReset ? (
          <div className="flex items-center gap-2">
            <span className="text-parchment-600 text-xs">Tem certeza?</span>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-xs font-fantasy text-red-400 border border-red-900 hover:bg-red-950 transition-colors"
            >
              Sim
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-fantasy text-parchment-500 border border-parchment-800 hover:bg-parchment-900 transition-colors"
            >
              Não
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="px-4 py-2 text-parchment-700 hover:text-parchment-500 transition-colors text-sm font-fantasy"
          >
            Recomeçar
          </button>
        )}
      </div>

      {/* Desktop nav */}
      <div className="hidden lg:flex justify-between items-center pt-2 border-t border-parchment-900">
        <button
          onClick={prevStep}
          className="px-4 py-2 text-parchment-500 hover:text-parchment-300 transition-colors font-fantasy text-sm"
        >
          ← Voltar
        </button>
        {confirmReset ? (
          <div className="flex items-center gap-3">
            <span className="text-parchment-600 text-sm">
              Todos os dados serão perdidos.
            </span>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm font-fantasy text-red-400 border border-red-900 hover:bg-red-950 transition-colors"
            >
              Sim, recomeçar
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-4 py-2 rounded-lg text-sm font-fantasy text-parchment-500 border border-parchment-800 hover:bg-parchment-900 transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="px-4 py-2 text-parchment-700 hover:text-parchment-500 transition-colors font-fantasy text-sm"
          >
            Recomeçar
          </button>
        )}
      </div>

      {/* Bottom padding for mobile nav */}
      <div className="h-16 lg:hidden" />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-4">
      <h3 className="text-xs font-semibold font-fantasy text-parchment-600 uppercase tracking-widest mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}

function QuickStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-parchment-800/60 bg-parchment-950/60 p-2.5 text-center">
      <p className="text-base font-bold font-fantasy leading-none" style={{ color: accent }}>
        {value}
      </p>
      <p className="text-xs text-parchment-600 font-fantasy mt-1 leading-tight">{label}</p>
    </div>
  )
}

function AbilityBox({
  label, base, bonus, final, mod, accent,
}: {
  label: string; base: number; bonus: number; final: number; mod: number; accent: string
}) {
  return (
    <div className="rounded-lg border border-parchment-800 bg-parchment-950 p-2.5 text-center">
      <p className="text-xs font-fantasy text-parchment-600 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold font-fantasy leading-none" style={{ color: accent }}>
        {formatModifier(mod)}
      </p>
      <p className="text-base text-parchment-200 font-bold font-fantasy mt-0.5">{final}</p>
      {bonus !== 0 && (
        <p className="text-xs text-parchment-800 mt-0.5">
          {base}{bonus > 0 ? `+${bonus}` : bonus}
        </p>
      )}
    </div>
  )
}

function Chip({ label }: { label: string }) {
  return (
    <span className="text-xs px-2 py-1 rounded-md border border-parchment-800 text-parchment-400 font-fantasy">
      {label}
    </span>
  )
}

function SpellStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-parchment-800/60 bg-parchment-950/60 p-2.5 text-center">
      <p className="text-base font-bold font-fantasy leading-none" style={{ color: accent }}>{value}</p>
      <p className="text-xs text-parchment-600 font-fantasy mt-1 leading-tight">{label}</p>
    </div>
  )
}

function SpellChip({
  name, school, concentration, ritual,
}: {
  name: string
  school: string
  concentration?: boolean
  ritual?: boolean
}) {
  const emoji = SCHOOL_EMOJI[school] ?? '✨'
  const badges = [
    concentration ? '⚡' : null,
    ritual ? '📿' : null,
  ].filter(Boolean).join(' ')
  return (
    <span className="text-xs px-2 py-1 rounded-md border border-parchment-800 text-parchment-400 font-fantasy">
      {emoji} {name}{badges ? ` ${badges}` : ''}
    </span>
  )
}

function BgEquipmentChips({ bg, chosenToolId }: { bg: Background; chosenToolId?: string }) {
  const FOCUS_LABEL: Record<string, string> = {
    arcane: 'Foco Arcano',
    druidic: 'Foco Druídico',
    holy: 'Símbolo Sagrado',
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {bg.equipment.items.map((item, i) => {
        let label: string
        if (item.kind === 'specific') {
          const name = getItemName(item.id)
          label = item.quantity > 1 ? `${item.quantity}× ${name}` : name
        } else if (item.kind === 'chosen-tool') {
          label = chosenToolId ? getToolName(chosenToolId) : 'Ferramenta do Antecedente'
        } else {
          label = FOCUS_LABEL[item.group] ?? item.group
        }
        return <Chip key={i} label={label} />
      })}
      <Chip label={`💰 ${bg.equipment.goldPo} po`} />
    </div>
  )
}
