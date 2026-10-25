import { useCharacterStore } from '../../stores/characterStore'
import {
  getRace, getSubrace,
  getEffectiveDarkvision, RACE_PRESENTATION, getAvailableInnateSpells, getEffectiveTraitsWithChoices,
  describeInnateSpellUsage,
} from '../../utils/raceUtils'
import { getFinalAbilityScores, getCharacterFeats, getSheetClassFeatures } from '../../utils/asiUtils'
import { RuleText } from '../common/RuleText'
import {
  getClass, CLASS_PRESENTATION,
} from '../../utils/classUtils'
import {
  allClassEntries, formatClassLevelLabel,
} from '../../utils/multiclassUtils'
import {
  describeResource, groupResourcesBySource, resourceGroupsNeedLabels, resourceSourceLabel,
} from '../../utils/classResourceUtils'
import {
  getBackground, BACKGROUND_PRESENTATION, getToolName, SKILLS, resolveBackgroundItems,
  getBackgroundDetailPrompt, ROLEPLAY_FIELDS,
} from '../../utils/backgroundUtils'
import {
  calculateModifier, formatModifier, ALL_ABILITY_SCORES, ABILITY_LABELS,
  getProficiencyBonus, formatXpProgress, formatMeters,
} from '../../utils/abilityScoreUtils'
import {
  formatInventoryItem, describeResolvedOption, getActivePurchases,
  getStartingMoney, describeStartingMoneySource, formatCoins,
} from '../../utils/equipmentUtils'
import { formatArmorClassBreakdown } from '../../utils/armorClassUtils'
import {
  getAllGrantedTools, getLanguageLabels, EXOTIC_LANGUAGE_NOTE, getExpertiseTools, getSkillChecks,
  getSavingThrowChecks,
  getPassiveScore, getArmorProficiencyLabels, getWeaponProficiencyLabels, getUnproficientArmor,
  getUnproficientTools, formatUnproficientTool, describeHalfProficiencyOnChecks,
} from '../../utils/proficiencyUtils'
import {
  getTotalHp, getInitiativeBonusTotal, getSheetSpeed, describeSpeedBonuses,
  getConditionalAcBonuses, getSheetResources, getSheetArmorClass,
  describeAttacksPerAction, getSheetFightingStyles, describeConditionalSaveBonuses,
} from '../../utils/sheetEffects'
import { getSheetAttacks } from '../../utils/attackUtils'
import { formatAttackDamage } from '../../utils/weaponFormat'
import { formatUnmetPick, getProgressionChoiceBlocks } from '../../utils/progressionOptions'
import {
  getSpell,
  getSpellSaveDC,
  formatSpellAttackBonus,
  getCombinedSpellSlots,
  getPactSlots,
  getCasterEntries,
  SCHOOL_EMOJI,
  describeCastingAids,
  getSpellChoiceOverflows,
  getSecretSpellGroups,
  formatSecretSpellName,
  getCasterColumnHeadings,
  getRepeatedSpells,
  formatRepeatedSpell,
} from '../../utils/spellUtils'
import { exportCharacter } from '../../utils/storage'
import { getPendingSteps, getStepPendingReasons } from '../../utils/pendingReasons'
import { InfoTooltip } from '../common/InfoTooltip'
import { PendingStepsPanel } from '../common/PendingStepsPanel'
import { formatMissingCount } from '../../../../components/wizard/pendingSteps'
import { StepNav } from '../../../../components/wizard/StepNav'
import type { TermId } from '../../utils/glossary'
import type { AbilityScore } from '../../types/race'
import type { Background, BackgroundChoiceSelections } from '../../types/background'
import type { HpMethod } from '../../types/character'

export function ReviewStep() {
  const draft = useCharacterStore(state => state.draft)
  const prevStep = useCharacterStore(state => state.prevStep)
  const goToStep = useCharacterStore(state => state.goToStep)
  const reset = useCharacterStore(state => state.reset)
  const setHpMethod = useCharacterStore(state => state.setHpMethod)
  const rollHpForLevel = useCharacterStore(state => state.rollHpForLevel)
  const goToPrint = useCharacterStore(state => state.goToPrint)

  const level = draft.level ?? 1
  const hpMethod: HpMethod = draft.hpMethod ?? 'average'

  const race = draft.race ? getRace(draft.race) : undefined
  const subrace = race && draft.subrace ? getSubrace(race, draft.subrace) : null
  const cls = draft.class ? getClass(draft.class) : undefined
  const bg = draft.background ? getBackground(draft.background) : undefined
  const bgDetail = getBackgroundDetailPrompt(bg)

  // Todas as classes (primária + adicionais), com o nível derivado da primária.
  const entries = allClassEntries(draft)
  const isMc = entries.length > 1

  const classP = cls ? (CLASS_PRESENTATION[cls.id] ?? { emoji: '?', accent: '#c0961a' }) : null
  const accent = classP?.accent ?? '#c0961a'

  const profBonus = getProficiencyBonus(level)

  // Atributos finais = base + bônus racial + ASIs (teto de 20 aplicado aos ASIs)
  const finalScores = getFinalAbilityScores(draft)
  // Bônus total por atributo (racial + ASI), para exibição na grade
  const totalBonuses = {} as Record<AbilityScore, number>
  for (const ab of ALL_ABILITY_SCORES) {
    totalBonuses[ab] = finalScores[ab] - (draft.abilityScores[ab] ?? 10)
  }
  const dexMod = calculateModifier(finalScores.DEX)
  const conMod = calculateModifier(finalScores.CON)

  // PV total: soma o poço de dados de vida de todas as classes (só o 1º nível da classe
  // inicial usa o dado máximo). Para classe única equivale ao cálculo anterior.
  const hp: number | null = cls ? getTotalHp(draft, conMod) : null

  // Deslocamento e iniciativa já com os efeitos somados (Mobilidade, Movimento sem Armadura com o
  // equipamento atual, Alerta); as condições de equipamento viram linha, o mesmo texto do PDF.
  const speed = getSheetSpeed(draft, finalScores)
  const speedLines = describeSpeedBonuses(draft, finalScores)
  const initiative = dexMod + getInitiativeBonusTotal(draft)
  const conditionalAc = getConditionalAcBonuses(draft)
  // Ataque Extra (e a Lâmina Sedenta, com a condição): o mesmo texto da ficha imprimível.
  const attackLines = describeAttacksPerAction(draft)
  const sheetAttacks = getSheetAttacks(draft, finalScores)
  const darkvision = race ? getEffectiveDarkvision(race, subrace ?? null) : 0
  const classEquipment = cls?.startingEquipment
  const acResult = getSheetArmorClass(draft, finalScores)
  const ac = acResult.value
  const acNote = acResult.stealthDisadvantage ? '*' : ''
  const acBreakdown = formatArmorClassBreakdown(acResult)

  // Proficiencies
  const skillChecks = getSkillChecks(draft, finalScores)
  const saveChecks = getSavingThrowChecks(draft, finalScores)
  // Aura de Proteção: fora do número das resistências, numa linha com a condição.
  const conditionalSaveLines = describeConditionalSaveBonuses(draft, finalScores)
  const passivePerception = getPassiveScore(draft, 'perception', skillChecks)
  // Versatilidade / Atletismo Extraordinário: onde a meia proficiência já entrou e onde mais vale.
  const halfProficiencyLines = describeHalfProficiencyOnChecks(draft)

  // Languages & tools
  // Exótico escolhido sai com "*" e a nota da p. 125 — o mesmo texto do PDF.
  const { labels: allLanguages, hasExoticNote } = getLanguageLabels(draft)
  const armorProficiencies = getArmorProficiencyLabels(draft)
  const weaponProficiencies = getWeaponProficiencyLabels(draft)
  const unproficientArmor = getUnproficientArmor(draft)
  const unproficientTools = getUnproficientTools(draft)

  const allTools = getAllGrantedTools(draft)
  const expertiseTools = getExpertiseTools(draft)

  const classLabel = formatClassLevelLabel(draft)

  const identityParts = [
    race ? `${RACE_PRESENTATION[race.id]?.emoji ?? ''} ${subrace ? subrace.name : race.name}` : null,
    classLabel ? `${classP?.emoji ?? ''} ${classLabel}` : null,
    bg ? `${BACKGROUND_PRESENTATION[bg.id]?.emoji ?? ''} ${bg.name}` : null,
  ].filter(Boolean).join(' · ')

  const speedStr = speed !== null ? formatMeters(speed) : '—'
  const darkvisionStr = darkvision > 0 ? formatMeters(darkvision) : null

  function handleExport() {
    exportCharacter(draft)
  }

  function handleReset() {
    reset()
  }

  // Navegação livre: dá pra chegar aqui com etapas em branco. As pendências (e o pré-requisito
  // de multiclasse) são cobradas aqui — é o único bloqueio do fluxo.
  const pending = getPendingSteps(draft)
  const prereqReasons = getStepPendingReasons(draft, 'review')
  const multiclassPrereqsOk = prereqReasons.length === 0
  const blocked = pending.length > 0 || !multiclassPrereqsOk

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

      <PendingStepsPanel pending={pending} />

      {/* Pré-requisito de multiclasse (PHB p. 163): só aqui todos os insumos dos atributos
          finais existem, então é aqui que a violação aparece — e trava o Concluir. */}
      {!multiclassPrereqsOk && (
        <div className="rounded-xl border border-red-900 bg-red-950/20 p-4">
          <p className="font-fantasy font-bold text-[15px] text-red-400">
            ⚠ Pré-requisito de multiclasse não atendido
          </p>
          <p className="text-parchment-500 text-xs mt-1 leading-relaxed">
            Para entrar (ou continuar) em cada uma das suas classes, o PHB exige um valor mínimo de
            atributo. Ajuste os atributos ou as classes antes de concluir.
          </p>
          <ul className="mt-2 space-y-0.5">
            {prereqReasons.map(reason => (
              <li key={reason} className="text-xs text-parchment-400 leading-snug">• {reason}</li>
            ))}
          </ul>
          <button
            onClick={() => goToStep('class')}
            className="mt-3 px-3 py-1.5 rounded-lg font-fantasy font-bold text-xs bg-red-900 text-parchment-100 hover:bg-red-700 transition-colors"
          >
            Rever classes →
          </button>
        </div>
      )}

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
          <p className="text-parchment-700 text-xs mt-1">XP: {formatXpProgress(level)}</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <QuickStat label="PV" value={hp !== null ? String(hp) : '—'} accent={accent} />
          <QuickStat label="CA" value={`${ac}${acNote}`} accent={accent} />
          <QuickStat label="Iniciativa" value={formatModifier(initiative)} accent={accent} />
          <QuickStat label="Percep. Passiva" value={String(passivePerception)} accent={accent} />
          <QuickStat label="Deslocamento" value={speedStr} accent={accent} />
          {darkvisionStr && (
            <QuickStat label="Visão no Escuro" value={darkvisionStr} accent={accent} />
          )}
        </div>
        <p className="text-xs text-parchment-700 mt-2 text-center">
          CA {ac} = {acBreakdown}
        </p>
        {/* Bônus de CA condicional fica FORA do número: somar o +1 do Ambidestro seria mentir,
            já que ele exige uma arma corpo-a-corpo em cada mão. */}
        {conditionalAc.map(bonus => (
          <p key={bonus.source} className="text-xs text-parchment-700 mt-1 text-center">
            +{bonus.value} de CA {bonus.condition} ({bonus.source})
          </p>
        ))}
        {acNote && (
          <p className="text-xs text-parchment-700 mt-1 text-center">
            * Armadura impõe desvantagem em Furtividade
          </p>
        )}
        {speedLines.map(line => (
          <p key={line} className="text-xs text-parchment-700 mt-1 text-center">{line}</p>
        ))}
        {attackLines.map(line => (
          <p key={line} className="text-xs text-parchment-700 mt-1 text-center">{line}</p>
        ))}

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
            const bonus = totalBonuses[ab]
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
            Bônus de Proficiência <InfoTooltip term="bonus-proficiencia" />
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
              const { proficient: isProficient, bonus } = saveChecks[ab]
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
          {conditionalSaveLines.map(line => (
            <p key={line} className="text-xs text-parchment-700 mt-2">{line}</p>
          ))}
        </Section>

        <Section title="Perícias">
          <div className="space-y-1">
            {[...SKILLS].sort((a, b) => a.name.localeCompare(b.name)).map(skill => {
              const { ability: abilityId, proficiency, bonus } = skillChecks[skill.id]
              const isProficient = proficiency !== 'none'
              const isExpert = proficiency === 'expertise'
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
          {halfProficiencyLines.map(line => (
            <p key={line.source} className="text-parchment-600 text-xs mt-2 leading-relaxed">
              <span className="text-parchment-400 font-semibold">{line.source}:</span> {line.text}
            </p>
          ))}
        </Section>
      </div>

      {/* Languages & Tools */}
      {(allTools.length > 0 || allLanguages.length > 0 || armorProficiencies.length > 0 || unproficientTools.length > 0) && (
        <Section title="Proficiências & Idiomas">
          <div className="space-y-3">
            {armorProficiencies.length > 0 && (
              <div>
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  Armaduras
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {armorProficiencies.map(label => <Chip key={label} label={label} />)}
                </div>
              </div>
            )}
            {weaponProficiencies.length > 0 && (
              <div>
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  Armas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {weaponProficiencies.map(label => <Chip key={label} label={label} />)}
                </div>
              </div>
            )}
            {/* p. 144: vestir armadura sem proficiência custa caro — a ficha avisa em vez de
                mexer no número, do mesmo jeito que o Ordem lista a penalidade de proteção. */}
            {unproficientArmor.length > 0 && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/20 px-3 py-2">
                <p className="text-xs font-semibold text-red-400 mb-1">
                  ⚠ Sem proficiência: {unproficientArmor.map(a => a.name).join(', ')}
                </p>
                <p className="text-xs text-parchment-500 leading-relaxed">
                  Desvantagem em testes de habilidade, testes de resistência e jogadas de ataque
                  que usem Força ou Destreza — e você não pode conjurar magias.
                </p>
              </div>
            )}
            {/* p. 156: ferramenta sem proficiência não é erro, só não soma o bônus — nota, não alerta. */}
            {unproficientTools.length > 0 && (
              <div className="rounded-lg border border-parchment-800 bg-parchment-950/40 px-3 py-2 space-y-0.5">
                {unproficientTools.map(u => (
                  <p key={u.itemId} className="text-xs text-parchment-500 leading-relaxed">
                    {formatUnproficientTool(u)}
                  </p>
                ))}
              </div>
            )}
            {allTools.length > 0 && (
              <div>
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  Ferramentas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allTools.map(id => (
                    <Chip key={id} label={`${getToolName(id)}${expertiseTools.includes(id) ? ' ◆' : ''}`} />
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
                  {allLanguages.map(label => (
                    <Chip key={label} label={label} />
                  ))}
                </div>
                {hasExoticNote && (
                  <p className="text-xs text-parchment-500 mt-1.5">{EXOTIC_LANGUAGE_NOTE}</p>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Ataques: a mesma tabela do PDF (getSheetAttacks), com o golpe desarmado no fim. */}
      <Section title="Ataques">
        <div className="space-y-2">
          {sheetAttacks.map(atk => (
            <div key={atk.key} className="text-sm">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-parchment-200 font-fantasy">
                  {atk.attacksPerAction > 1 && <span className="text-parchment-600">{atk.attacksPerAction}× </span>}
                  {atk.name}
                  {!atk.proficient && <span className="text-xs text-parchment-600"> (sem proficiência)</span>}
                </span>
                <span className="font-fantasy font-bold text-gold-500">{atk.attackBonus}</span>
                <span className="text-parchment-400">{formatAttackDamage(atk)}</span>
                <span className="text-xs text-parchment-600">{atk.ability}{atk.properties && ` · ${atk.properties}`}</span>
              </div>
              {atk.notes.length > 0 && (
                <p className="text-xs text-parchment-700 mt-0.5">{atk.notes.join(' · ')}</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Equipment */}
      <Section title="Equipamento Inicial">
        {(() => {
          // Mesmo número da ficha imprimível (getStartingMoney).
          const money = getStartingMoney(draft.equipment, bg?.equipment.goldPo ?? 0)
          const source = describeStartingMoneySource(money)
          return (
            <p className="text-parchment-400 text-sm mb-4">
              Dinheiro:{' '}
              <span className="font-fantasy font-bold text-gold-500">{formatCoins(money.totalCopper)}</span>
              {source && <span className="text-parchment-600"> ({source})</span>}
            </p>
          )
        })()}

        {draft.equipment.method === null && (
          <p className="text-parchment-700 text-sm italic">Equipamento não definido</p>
        )}

        {draft.equipment.method === 'wealth' && (() => {
          const purchased = getActivePurchases(draft.equipment)
          return (
            <div className="space-y-4">
              {purchased.length > 0 && (
                <div>
                  <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                    Comprado
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {purchased.map(item => (
                      <Chip
                        key={item.itemId}
                        label={formatInventoryItem(item.itemId, item.quantity)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {bg && (
                <div>
                  <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                    Do Antecedente
                  </p>
                  <BgEquipmentChips bg={bg} choices={draft.backgroundChoices} />
                </div>
              )}
            </div>
          )
        })()}

        {draft.equipment.method === 'standard' && classEquipment && (
          <div className="space-y-4">
            {bg && (
              <div>
                <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">
                  Do Antecedente
                </p>
                <BgEquipmentChips bg={bg} choices={draft.backgroundChoices} />
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
                      label={formatInventoryItem(item.id, item.quantity)}
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
                    const items = describeResolvedOption(option, res.pickedIds)
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

      {/* O mesmo que a caixa "Personagem" da ficha imprimível: nada aqui é escolhido no app. */}
      <Section title="Personagem">
        <p className="text-parchment-600 text-sm leading-relaxed">
          A ficha impressa traz linhas para preencher a lápis:{' '}
          {ROLEPLAY_FIELDS.map(f => f.label).join(', ')}
          {bgDetail ? ` e ${bgDetail.label}` : ''}. O livro dá sugestões, mas você pode inventar.
        </p>
        {bgDetail && (
          <p className="text-parchment-700 text-xs leading-relaxed mt-2">
            <span className="font-semibold text-parchment-500">{bgDetail.label}</span>{' '}
            ({bgDetail.instruction}): {bgDetail.optionsLine}
          </p>
        )}
        <p className="text-parchment-700 text-xs leading-relaxed mt-2">
          <span className="font-semibold text-parchment-500">Inspiração</span> (marcador ○ na ficha):
          o Mestre a concede quando você interpreta esses traços; você a tem ou não tem, e pode
          gastá-la para ter vantagem numa jogada de ataque, teste de resistência ou de habilidade.
        </p>
      </Section>

      {/* Racial Traits */}
      {race && (
        <Section title="Traços Raciais">
          <div className="space-y-3">
            {getEffectiveTraitsWithChoices(race, subrace ?? null, draft.raceChoices).map(({ trait, chosen }, i) => (
              <div key={`${i}-${trait.name}`}>
                <span className="text-sm font-semibold font-fantasy text-parchment-200">
                  {trait.name}.{' '}
                </span>
                <span className="text-sm text-parchment-500 leading-relaxed">
                  {trait.description}
                </span>
                {chosen && (
                  <span className="text-sm leading-relaxed">
                    {' '}<span className="text-parchment-600">Escolha:</span>{' '}
                    <span className="font-semibold" style={{ color: accent }}>{chosen}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Racial Spells */}
      {race && (() => {
        const innate = getAvailableInnateSpells(race, subrace ?? null, level)
        const racialCantrip = draft.raceChoices.cantrip ? getSpell(draft.raceChoices.cantrip) : undefined
        if (innate.length === 0 && !racialCantrip) return null
        return (
          <Section title="Magias Raciais">
            <div className="space-y-2">
              {racialCantrip && (
                <div>
                  <span className="text-sm font-semibold font-fantasy text-parchment-200">
                    {racialCantrip.name}
                  </span>
                  <span className="text-sm text-parchment-500"> — truque (escolhido da raça)</span>
                </div>
              )}
              {innate.map(entry => {
                const spell = getSpell(entry.spellId)
                if (!spell) return null
                // Mesmo texto da ficha imprimível (describeInnateSpellUsage).
                const usage = describeInnateSpellUsage(entry, spell.level)
                return (
                  <div key={entry.spellId}>
                    <span className="text-sm font-semibold font-fantasy text-parchment-200">
                      {spell.name}
                    </span>
                    <span className="text-sm text-parchment-500">
                      {' '}— {usage.text} · atributo {ABILITY_LABELS[entry.ability].short}
                    </span>
                  </div>
                )
              })}
            </div>
          </Section>
        )
      })()}

      {/* Talentos (aprimoramentos + talento racial do Humano Variante) */}
      {(() => {
        const feats = getCharacterFeats(draft)
        if (feats.length === 0) return null
        return (
          <Section title="Talentos">
            <div className="space-y-3">
              {feats.map(({ feat, origin }) => (
                <div key={feat.id}>
                  <p className="text-sm font-semibold font-fantasy text-parchment-200">
                    {feat.name}
                    <span className="font-sans font-normal text-xs text-parchment-600"> · {origin}</span>
                  </p>
                  <RuleText text={feat.description} className="text-sm text-parchment-500 leading-relaxed" />
                </div>
              ))}
            </div>
          </Section>
        )
      })()}

      {/* Habilidades de Classe (por classe, agrupadas por nível) */}
      {cls && (
        <Section title="Habilidades de Classe">
          <div className="space-y-4">
            {entries.map(e => {
              const ec = getClass(e.classId)
              if (!ec) return null
              const feats = getSheetClassFeatures(e)
              if (feats.length === 0) return null
              const byLevel = new Map<number, typeof feats>()
              for (const f of feats) {
                const arr = byLevel.get(f.level) ?? []
                arr.push(f)
                byLevel.set(f.level, arr)
              }
              const levels = [...byLevel.keys()].sort((a, b) => a - b)
              return (
                <div key={e.classId}>
                  {isMc && (
                    <p className="text-sm font-fantasy font-bold mb-2" style={{ color: accent }}>
                      {ec.name} {e.level}°
                    </p>
                  )}
                  <div className="space-y-3">
                    {levels.map(lvl => (
                      <div key={lvl}>
                        <p className="text-xs text-parchment-700 font-fantasy uppercase tracking-widest mb-1.5">Nível {lvl}</p>
                        {byLevel.get(lvl)!.map(feat => (
                          <div key={feat.name} className="mb-2 last:mb-0">
                            <span className="text-sm font-semibold font-fantasy text-parchment-200">{feat.name}. </span>
                            <span className="text-sm text-parchment-500 leading-relaxed">{feat.description}</span>
                            {feat.chosen && (
                              <span className="text-sm leading-relaxed">
                                {' '}<span className="text-parchment-600">Escolha:</span>{' '}
                                <span className="font-semibold" style={{ color: accent }}>{feat.chosen}</span>
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Estilo de Luta escolhido (o mesmo bloco da ficha imprimível) */}
      {(() => {
        const styles = getSheetFightingStyles(draft)
        if (styles.length === 0) return null
        return (
          <Section title="Estilo de Luta">
            <div className="space-y-2">
              {styles.map(({ classId, style }) => (
                <div key={classId}>
                  {isMc && <span className="text-sm text-parchment-600">{getClass(classId)?.name}: </span>}
                  <span className="text-sm font-semibold font-fantasy" style={{ color: accent }}>{style.name}. </span>
                  <span className="text-sm text-parchment-500 leading-relaxed">{style.description}</span>
                </div>
              ))}
            </div>
          </Section>
        )
      })()}

      {/* Escolhas de Progressão (por classe) */}
      {/* Os Segredos Mágicos não entram aqui: saem com as magias do bardo, como no PDF. */}
      {cls && (() => {
        const blocks = getProgressionChoiceBlocks(entries)
        if (blocks.length === 0) return null

        return (
          <Section title="Escolhas de Progressão">
            <div className="space-y-4">
              {blocks.map(({ entry: e, slots }) => (
                <div key={e.classId}>
                  {isMc && (
                    <p className="text-sm font-fantasy font-bold mb-2" style={{ color: accent }}>{getClass(e.classId)?.name}</p>
                  )}
                  <div className="space-y-3">
                    {slots.map(({ slot, picks }) => (
                      <div key={slot.id}>
                        <p className="text-xs text-parchment-700 font-fantasy uppercase tracking-widest mb-1.5">
                          {slot.label} {slot.cumulative ? `(Nível ${slot.level})` : ''}
                        </p>
                        {picks.map(opt => (
                          <div key={opt.id} className="mb-2 last:mb-0">
                            <span className="text-sm font-semibold font-fantasy text-parchment-200">{opt.name}. </span>
                            <span className="text-sm text-parchment-500 leading-relaxed">{opt.text}</span>
                            {opt.unmet && <p className="text-xs font-semibold text-red-400 mt-0.5">{formatUnmetPick(opt.unmet)}</p>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )
      })()}

      {/* Recursos — de cada classe, da raça e dos talentos, com a origem (o mesmo da ficha imprimível) */}
      {(() => {
        const blocks = groupResourcesBySource(getSheetResources(draft, finalScores))
        if (blocks.length === 0) return null
        const labeled = resourceGroupsNeedLabels(blocks)
        return (
          <Section title="Recursos">
            <div className="space-y-3">
              {blocks.map(({ source, resources }) => (
                <div key={`${source.kind}-${source.id}`}>
                  {labeled && (
                    <p className="text-xs font-fantasy mb-1.5" style={{ color: accent }}>{resourceSourceLabel(source)}</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {resources.map(r => {
                      // Mesmo texto da ficha imprimível (describeResource): dado, usos e recarga.
                      const d = describeResource(r)
                      const headline = [d.die, d.amount, d.quantity].filter(Boolean).join(' · ')
                      return (
                        <div key={r.id} className="rounded-lg border border-parchment-800/60 bg-parchment-950/60 p-2.5 text-center">
                          <p className="text-base font-bold font-fantasy leading-none" style={{ color: accent }}>{headline}</p>
                          <p className="text-xs text-parchment-600 font-fantasy mt-1 leading-tight">{d.name}</p>
                          {d.recharge && <p className="text-[11px] text-parchment-700 mt-1 leading-tight">{d.recharge}</p>}
                          {d.notes.map(n => (
                            <p key={n} className="text-[11px] text-parchment-700 italic mt-0.5 leading-tight">{n}</p>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )
      })()}

      {/* Magias — slots combinados (pool único) + seleção por classe conjuradora */}
      {(() => {
        const casters = getCasterEntries(draft)
        if (casters.length === 0) return null
        const combined = getCombinedSpellSlots(draft).map((count, i) => ({ spellLevel: i + 1, count })).filter(s => s.count > 0)
        const pact = getPactSlots(draft)
        const repeatedSpells = getRepeatedSpells(draft)
        return (
          <Section title="Magias">
            {(combined.length > 0 || pact) && (
              <div className="mb-4 space-y-2">
                {combined.length > 0 && (
                  <div>
                    <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">Espaços de Magia</p>
                    <div className="flex flex-wrap gap-1.5">
                      {combined.map(({ spellLevel, count }) => (
                        <span key={spellLevel} className="px-2 py-1 rounded-md bg-parchment-900 border border-parchment-800 text-xs text-parchment-400 font-fantasy">{count}× {spellLevel}°</span>
                      ))}
                    </div>
                  </div>
                )}
                {pact && (
                  <div>
                    <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">Magia de Pacto</p>
                    <span className="px-2 py-1 rounded-md bg-parchment-900 border border-parchment-800 text-xs text-parchment-400 font-fantasy">
                      {pact.slots}× {pact.slotLevel}° · recupera em descanso curto
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Mesma magia em duas fontes (decisão do usuário, 2026-10-25): a regra deixa, então
                é aviso — não trava a ficha nem apaga a escolha. */}
            {repeatedSpells.length > 0 && (
              <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/20 px-3 py-2 space-y-1">
                {repeatedSpells.map(r => <p key={r.spellId} className="text-xs font-semibold text-red-400">⚠ {formatRepeatedSpell(r)}</p>)}
              </div>
            )}

            <div className="space-y-4">
              {casters.map(caster => {
                const sc_ = caster.casting.spellcasting
                const dc = getSpellSaveDC(sc_, finalScores, level)
                const attackBonus = formatSpellAttackBonus(sc_, finalScores, level)
                const aids = describeCastingAids(sc_)
                const overflows = getSpellChoiceOverflows(caster, finalScores)
                const cantrips = caster.cantrips.map(id => getSpell(id)).filter(Boolean)
                const spells = caster.spells.map(id => getSpell(id)).filter(Boolean)
                const secretGroups = getSecretSpellGroups(caster)
                const headings = getCasterColumnHeadings(caster, finalScores)
                // Conjuração de subclasse (Cavaleiro/Trapaceiro Arcano) se identifica mesmo sem multiclasse.
                const showLabel = isMc || caster.casting.casterId !== caster.cls.id
                return (
                  <div key={caster.cls.id}>
                    {showLabel && (
                      <p className="text-sm font-fantasy font-bold mb-2" style={{ color: accent }}>
                        {caster.casting.label} · {ABILITY_LABELS[sc_.ability].short}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <SpellStat label="CD de Magia" value={String(dc)} accent={accent} term="cd-de-magia" />
                      <SpellStat label="Bônus de Ataque" value={attackBonus} accent={accent} term="bonus-ataque-magia" />
                    </div>
                    {(aids.focus || aids.ritual) && (
                      <div className="mb-3 space-y-0.5">
                        {aids.focus && <p className="text-xs text-parchment-500">{aids.focus}</p>}
                        {aids.ritual && <p className="text-xs text-parchment-500">{aids.ritual}</p>}
                      </div>
                    )}
                    {/* Mais truques/magias que o teto (atributos finais, Segredos Mágicos ocupando vaga): aviso, nunca escolha apagada. */}
                    {overflows.length > 0 && (
                      <div className="mb-3 rounded-lg border border-red-900/60 bg-red-950/20 px-3 py-2 space-y-1">
                        {overflows.map(o => <p key={o.text} className="text-xs font-semibold text-red-400">⚠ {o.text}</p>)}
                      </div>
                    )}
                    {/* Títulos com o total da coluna: os Segredos que ocupam vaga já estão dentro. */}
                    {headings.hasCantrips && (
                      <div className="mb-3">
                        <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">{headings.cantrips}</p>
                        <div className="flex flex-wrap gap-1.5">{cantrips.map(s => s && <SpellChip key={s.id} name={s.name} school={s.school} />)}</div>
                      </div>
                    )}
                    {headings.hasSpells && (
                      <div>
                        <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">{headings.spells}</p>
                        <div className="flex flex-wrap gap-1.5">{spells.map(s => s && <SpellChip key={s.id} name={s.name} school={s.school} concentration={s.concentration} ritual={s.ritual} />)}</div>
                      </div>
                    )}
                    {/* Contam como magias desta classe (p. 54-55); vêm das escolhas de progressão. Os que
                        ocupam vaga das conhecidas e os Adicionais (por cima) ficam em grupos separados. */}
                    {secretGroups.map(group => (
                      <div key={group.title} className="mt-3">
                        <p className="text-xs text-parchment-600 uppercase tracking-widest font-fantasy mb-2">{group.title}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.spells.map(s => (
                            <SpellChip
                              key={s.id}
                              name={formatSecretSpellName(s)}
                              school={s.school}
                              concentration={s.concentration}
                              ritual={s.ritual}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    {cantrips.length === 0 && spells.length === 0 && secretGroups.length === 0 && (
                      <p className="text-parchment-700 text-sm italic">Nenhuma magia selecionada</p>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>
        )
      })()}

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={goToPrint}
          className="w-full py-3 rounded-xl font-fantasy font-bold text-base tracking-wide transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ backgroundColor: accent, color: '#0a0704' }}
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

      <StepNav
        onPrev={prevStep}
        onNext={handleReset}
        blocked={blocked}
        pendingReason={pending.length > 0
          ? formatMissingCount(pending.length)
          : !multiclassPrereqsOk ? 'Pré-requisito de multiclasse' : undefined}
        nextLabel="Concluir ✓"
        nextTitle={blocked ? 'Resolva as pendências acima para concluir' : 'Salva a ficha e volta para a galeria'}
      />
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

function SpellStat({ label, value, accent, term }: { label: string; value: string; accent: string; term?: TermId }) {
  return (
    <div className="rounded-lg border border-parchment-800/60 bg-parchment-950/60 p-2.5 text-center">
      <p className="text-base font-bold font-fantasy leading-none" style={{ color: accent }}>{value}</p>
      <p className="text-xs text-parchment-600 font-fantasy mt-1 leading-tight">
        {label}
        {term && <> <InfoTooltip term={term} /></>}
      </p>
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

/** Itens do antecedente (o dinheiro vai na linha "Dinheiro" do topo da seção). */
function BgEquipmentChips({ bg, choices }: { bg: Background; choices: BackgroundChoiceSelections }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {resolveBackgroundItems(bg, choices).map((item, i) => <Chip key={i} label={item.label} />)}
    </div>
  )
}
