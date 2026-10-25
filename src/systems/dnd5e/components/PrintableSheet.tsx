import { Fragment } from 'react'
import { useCharacterStore } from '../stores/characterStore'
import type { AbilityScore } from '../types/race'
import {
  getRace, getSubrace, getEffectiveDarkvision, SKILLS,
  getAvailableInnateSpells, getEffectiveTraitsWithChoices, TOOL_NAMES, describeInnateSpellUsage,
} from '../utils/raceUtils'
import {
  getClass,
} from '../utils/classUtils'
import {
  allClassEntries, getHitDicePool, formatClassLevelLabel,
} from '../utils/multiclassUtils'
import {
  getBackground, getToolName, resolveBackgroundItems, getBackgroundDetailPrompt, ROLEPLAY_FIELDS,
} from '../utils/backgroundUtils'
import {
  calculateModifier, formatModifier, getProficiencyBonus, formatXpProgress, formatMeters,
  ALL_ABILITY_SCORES, ABILITY_LABELS,
} from '../utils/abilityScoreUtils'
import { getFinalAbilityScores, getCharacterFeats, getSheetClassFeatures } from '../utils/asiUtils'
import {
  getAllGrantedTools, getLanguageLabels, EXOTIC_LANGUAGE_NOTE, getExpertiseTools, getSkillChecks,
  getSavingThrowChecks, getPassiveScore, getArmorProficiencyLabels, getWeaponProficiencyLabels, getUnproficientArmor,
  getUnproficientTools, formatUnproficientTool, describeHalfProficiencyOnChecks,
} from '../utils/proficiencyUtils'
import { formatArmorClassBreakdown } from '../utils/armorClassUtils'
import {
  formatInventoryItem, describeResolvedOption, getActivePurchases,
  getStartingMoney, describeStartingMoneySource, formatCoins,
} from '../utils/equipmentUtils'
import {
  formatResourceLine, formatTrackCircles, groupResourcesBySource, resourceGroupsNeedLabels,
  resourceSourceLabel,
} from '../utils/classResourceUtils'
import { getProgressionChoiceBlocks } from '../utils/progressionOptions'
import {
  getSpell, getSpellSaveDC, formatSpellAttackBonus, getCombinedSpellSlots, getPactSlots,
  getMaxPreparedSpells, describeCastingAids, getCasterEntries, getSpellChoiceOverflows,
  getSecretSpellGroups, formatSecretSpellName, getCasterColumnHeadings,
} from '../utils/spellUtils'
import { RuleText } from './common/RuleText'
import { formatAttackDamage } from '../utils/weaponFormat'
import { getSheetAttacks } from '../utils/attackUtils'
import {
  getTotalHp, getInitiativeBonusTotal, getSheetSpeed, describeSpeedBonuses,
  getConditionalAcBonuses, getSheetResources, getSheetArmorClass,
  describeAttacksPerAction, getSheetFightingStyles, describeConditionalSaveBonuses,
} from '../utils/sheetEffects'
import type { CharacterDraft } from '../types/character'
import type { ClassSpellcasting } from '../types/class'

function gatherInventory(draft: CharacterDraft): string[] {
  const items: string[] = []
  const cls = draft.class ? getClass(draft.class) : undefined
  const bg = draft.background ? getBackground(draft.background) : undefined
  const eq = draft.equipment

  if (eq.method === 'standard' && cls) {
    for (const item of cls.startingEquipment.fixed) {
      items.push(formatInventoryItem(item.id, item.quantity))
    }
    cls.startingEquipment.choices.forEach((choice, i) => {
      const res = eq.classResolutions[i]
      if (res && res.optionIndex >= 0) {
        const option = choice.options[res.optionIndex]
        if (option) items.push(...describeResolvedOption(option, res.pickedIds))
      }
    })
  }
  for (const p of getActivePurchases(eq)) {
    items.push(formatInventoryItem(p.itemId, p.quantity))
  }
  if (bg) items.push(...resolveBackgroundItems(bg, draft.backgroundChoices).map(item => item.label))
  return items
}

/**
 * Quantas magias a classe tem a cada descanso, na linguagem da mesa. As três formas do livro:
 *
 * - `known` (bardo, feiticeiro, bruxo, patrulheiro): a lista é fixa, não se remonta;
 * - `prepared` (clérigo, druida, paladino): prepara N magias a cada descanso longo, e N vem da
 *   fórmula da classe (mod. do atributo + nível, ou metade dele no paladino);
 * - `hybrid` (mago): o grimório é fixo, mas prepara N dele a cada descanso longo.
 */
function describeSpellRefresh(
  sc: ClassSpellcasting,
  classLevel: number,
  scores: Record<AbilityScore, number>,
): string {
  const abilityLabel = ABILITY_LABELS[sc.ability].short
  const abilityMod = calculateModifier(scores[sc.ability])
  const prepared = getMaxPreparedSpells(sc, scores, classLevel)
  const formula = sc.preparedFormula
    ? ` (${abilityLabel} ${formatModifier(abilityMod)} + ${sc.preparedFormula.includes('metade') ? `metade do nível ${classLevel}` : `nível ${classLevel}`})`
    : ''

  if (sc.type === 'prepared') {
    return `Prepara ${prepared} magias a cada descanso longo${formula}.`
  }
  if (sc.type === 'hybrid') {
    return `Grimório fixo; prepara ${prepared} magias dele a cada descanso longo${formula}.`
  }
  return 'Magias conhecidas fixas — não se troca em descanso (só ao subir de nível).'
}

/** Círculos vazios (○) pra marcar usos a lápis na mesa. Acima de 12, vazio (o número já indica). */
function trackCircles(count: number): string {
  if (count <= 0 || count > 12) return ''
  return Array(count).fill('○').join(' ')
}

export function PrintableSheet() {
  const draft = useCharacterStore(state => state.draft)

  const level = draft.level ?? 1
  const race = draft.race ? getRace(draft.race) : undefined
  const subrace = (race && draft.subrace ? getSubrace(race, draft.subrace) : null) ?? null
  const cls = draft.class ? getClass(draft.class) : undefined
  const bg = draft.background ? getBackground(draft.background) : undefined
  const entries = allClassEntries(draft)
  const isMc = entries.length > 1

  const prof = getProficiencyBonus(level)
  const finalScores = getFinalAbilityScores(draft)
  const mod = (ab: AbilityScore) => calculateModifier(finalScores[ab])
  const dexMod = mod('DEX')
  const conMod = mod('CON')

  // Combate
  const acResult = getSheetArmorClass(draft, finalScores)
  const ac = acResult.value
  const acBreakdown = formatArmorClassBreakdown(acResult)
  const hp: number | null = cls ? getTotalHp(draft, conMod) : null
  const speed = getSheetSpeed(draft, finalScores)
  const speedLines = describeSpeedBonuses(draft, finalScores)
  const initiative = dexMod + getInitiativeBonusTotal(draft)
  const conditionalAc = getConditionalAcBonuses(draft)
  const darkvision = race ? getEffectiveDarkvision(race, subrace) : 0

  const skillChecks = getSkillChecks(draft, finalScores)
  const passivePerception = getPassiveScore(draft, 'perception', skillChecks)
  // Versatilidade / Atletismo Extraordinário: onde a meia proficiência já entrou e onde mais vale.
  const halfProficiencyLines = describeHalfProficiencyOnChecks(draft)
  const saveChecks = getSavingThrowChecks(draft, finalScores)
  // Aura de Proteção: fora do número das resistências, numa linha com a condição.
  const conditionalSaveLines = describeConditionalSaveBonuses(draft, finalScores)
  const allTools = getAllGrantedTools(draft)
  const expertiseTools = getExpertiseTools(draft)

  // Exótico escolhido sai com "*" e a nota da p. 125 — o mesmo texto da Revisão.
  const { labels: languages, hasExoticNote } = getLanguageLabels(draft)
  const armorProficiencies = getArmorProficiencyLabels(draft)
  const weaponProficiencies = getWeaponProficiencyLabels(draft)
  const unproficientArmor = getUnproficientArmor(draft)
  const unproficientTools = getUnproficientTools(draft)

  const identity = [
    subrace ? subrace.name : race?.name,
    formatClassLevelLabel(draft) ?? `Nível ${level}`,
    bg?.name,
  ].filter(Boolean).join(' · ')

  // Features por classe (multiclasse): cada classe no nível que tem nela, com os Incrementos.
  const featureBlocks = entries.map(e => ({ e, ec: getClass(e.classId), features: getSheetClassFeatures(e) }))
  const feats = getCharacterFeats(draft)
  const resourceBlocks = groupResourcesBySource(getSheetResources(draft, finalScores))
  const labelResourceBlocks = resourceGroupsNeedLabels(resourceBlocks)
  const inventory = gatherInventory(draft)
  const money = getStartingMoney(draft.equipment, bg?.equipment.goldPo ?? 0)
  const moneySource = describeStartingMoneySource(money)
  const bgDetail = getBackgroundDetailPrompt(bg)

  // Ataques por arma carregada e o golpe desarmado, com Estilo de Luta e Artes Marciais já
  // aplicados (attackUtils). O número de ataques por ação vem do motor de efeitos.
  const attacks = getSheetAttacks(draft, finalScores)
  const attackLines = describeAttacksPerAction(draft)
  const innateSpells = race ? getAvailableInnateSpells(race, subrace, level) : []
  const racialCantrip = draft.raceChoices.cantrip ? getSpell(draft.raceChoices.cantrip) : undefined

  const casters = getCasterEntries(draft)
  const isCaster = casters.length > 0

  const fightingStyles = getSheetFightingStyles(draft)

  // Manobras, invocações, metamagia, totem, terreno, presa — o mesmo helper da Revisão. Os
  // Segredos Mágicos saem com as magias do bardo (bonusSpells), não aqui.
  const progressionBlocks = getProgressionChoiceBlocks(entries)

  /**
   * Toda magia que o personagem conhece, por QUALQUER via:
   * - truques e magias das classes conjuradoras, com as de Segredos Mágicos (bonusSpells);
   * - o truque racial, o da subclasse e as magias inatas da raça.
   *
   * Sem repetir e na ordem da mesa: truques primeiro, depois por nível, alfabético dentro de cada.
   */
  const knownSpells = (() => {
    const ids = [
      ...casters.flatMap(c => [...c.cantrips, ...c.spells, ...c.bonusSpells]),
      ...(draft.raceChoices.cantrip ? [draft.raceChoices.cantrip] : []),
      ...entries.flatMap(e => e.classChoices.subclassExtras.cantrip ? [e.classChoices.subclassExtras.cantrip] : []),
      ...innateSpells.map(s => s.spellId),
    ]
    return [...new Set(ids)]
      .map(getSpell)
      .filter((s): s is NonNullable<typeof s> => s !== undefined)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'))
  })()

  return (
    <div className="print-sheet mx-auto w-[794px] shrink-0 bg-white text-gray-900 p-8 rounded-lg shadow-lg" style={{ fontFamily: 'Georgia, serif' }}>
      {/* Cabeçalho */}
      <header className="border-b-2 border-gray-800 pb-3 mb-4">
        <h1 className="text-2xl font-bold">{draft.name.trim() || 'Personagem sem nome'}</h1>
        <p className="text-sm text-gray-700">{identity}</p>
        <p className="text-xs text-gray-500 mt-1">Bônus de Proficiência {formatModifier(prof)}</p>
      </header>

      {/* Atributos */}
      <Grid cols={6} className="mb-4">
        {ALL_ABILITY_SCORES.map(ab => (
          <div key={ab} className="border border-gray-400 rounded text-center py-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-600">{ABILITY_LABELS[ab].long}</div>
            <div className="text-xl font-bold">{finalScores[ab]}</div>
            <div className="text-sm">{formatModifier(mod(ab))}</div>
          </div>
        ))}
      </Grid>

      {/* Combate */}
      <Grid cols={4} className="mb-4">
        <Stat label="Classe de Armadura" value={String(ac)} />
        <Stat label="Iniciativa" value={formatModifier(initiative)} />
        <Stat label="Pontos de Vida" value={hp !== null ? String(hp) : '—'} />
        <Stat label="Dados de Vida" value={cls ? getHitDicePool(draft).map(p => `${p.count}d${p.die}`).join(' + ') : '—'} />
        <Stat label="Deslocamento" value={speed !== null ? formatMeters(speed) : '—'} />
        <Stat label="Percepção Passiva" value={String(passivePerception)} />
        <Stat label="Visão no Escuro" value={darkvision > 0 ? formatMeters(darkvision) : '—'} />
        <Stat label="Nível" value={String(level)} />
      </Grid>

      <p className="text-xs mb-1">
        <span className="text-gray-600">CA {ac} = </span>{acBreakdown}
        {acResult.stealthDisadvantage && (
          <span className="text-gray-600"> · armadura impõe desvantagem em Furtividade</span>
        )}
      </p>

      {/* Bônus de deslocamento com condição de equipamento: somado ou não, com o motivo. */}
      {speedLines.length > 0 && (
        <p className="text-xs mb-1">{speedLines.join(' · ')}</p>
      )}

      {/* CA condicional: fora do número, com a condição, pra valer na mesa sem inflar a ficha. */}
      {conditionalAc.length > 0 && (
        <p className="text-xs mb-4">
          {conditionalAc.map(b => `+${b.value} de CA ${b.condition} (${b.source})`).join(' · ')}
        </p>
      )}

      {/* Controle de sessão — espaços em branco pra preencher a lápis na mesa */}
      <Box title="Controle de Sessão (preencha a lápis)" className="mb-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-700 items-baseline">
          <span>PV Atual: <span className="inline-block border-b border-gray-500 w-14" />{hp !== null ? ` / ${hp}` : ''}</span>
          <span>PV Temporário: <span className="inline-block border-b border-gray-500 w-14" /></span>
          <span>Testes contra a Morte — Sucessos: ○ ○ ○ · Falhas: ○ ○ ○</span>
          {/* XP pela tabela da p. 15; Inspiração (p. 127): ou você tem, ou não tem — um só ○. */}
          <span>
            XP: <span className="inline-block border-b border-gray-500 w-16" />
            <span className="text-gray-600"> ({formatXpProgress(level)})</span>
          </span>
          <span>Inspiração: ○</span>
        </div>
      </Box>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Resistências */}
        <Box title="Testes de Resistência">
          {ALL_ABILITY_SCORES.map(ab => {
            const { proficient, bonus } = saveChecks[ab]
            return (
              <Row key={ab} mark={proficient} label={ABILITY_LABELS[ab].long} value={formatModifier(bonus)} />
            )
          })}
          {conditionalSaveLines.map(line => (
            <p key={line} className="text-[10px] text-gray-600 mt-1">{line}</p>
          ))}
        </Box>

        {/* Perícias */}
        <Box title="Perícias">
          {SKILLS.map(skill => {
            const check = skillChecks[skill.id]
            return (
              <Row
                key={skill.id}
                mark={check.proficiency !== 'none'}
                expertise={check.proficiency === 'expertise'}
                label={`${skill.name} (${ABILITY_LABELS[check.ability].short})`}
                value={formatModifier(check.bonus)}
              />
            )
          })}
          <p className="text-[10px] text-gray-500 mt-1">● proficiente · ◉ bônus de proficiência dobrado</p>
          {/* O número das perícias já tem a Versatilidade / o Atletismo Extraordinário; o que não
              está impresso (atributo puro, ferramenta) o jogador precisa saber que também leva. */}
          {halfProficiencyLines.map(line => (
            <p key={line.source} className="text-[10px] text-gray-500">
              {line.source}: {line.text}
            </p>
          ))}
        </Box>
      </div>

      {/* Ataques & Magia */}
      <Box title="Ataques & Conjuração" className="mb-4">
        {/* Uma linha por arma e o golpe desarmado; o que depende da situação vai na nota de baixo. */}
        <table className="w-full text-xs mb-1">
          <thead>
            <tr className="text-gray-500 text-left">
              <th className="font-semibold pr-2">Ataque</th>
              <th className="font-semibold pr-2">Bônus</th>
              <th className="font-semibold pr-2">Dano</th>
              <th className="font-semibold pr-2">Atributo</th>
              <th className="font-semibold">Propriedades</th>
            </tr>
          </thead>
          <tbody>
            {attacks.map(atk => (
              <Fragment key={atk.key}>
                <tr className="text-gray-800 align-top">
                  <td className="pr-2 pt-0.5">
                    {atk.attacksPerAction > 1 && <span className="font-bold text-gray-500">{atk.attacksPerAction}× </span>}
                    {atk.name}
                    {!atk.proficient && <span className="text-[10px] text-gray-500"> (sem proficiência)</span>}
                  </td>
                  <td className="pr-2 pt-0.5"><strong>{atk.attackBonus}</strong></td>
                  <td className="pr-2 pt-0.5">{formatAttackDamage(atk)}</td>
                  <td className="pr-2 pt-0.5 text-gray-600">{atk.ability}</td>
                  <td className="pt-0.5 text-[10px] text-gray-600">{atk.properties || '—'}</td>
                </tr>
                {atk.notes.length > 0 && (
                  <tr>
                    <td colSpan={5} className="pb-0.5 pl-3 text-[10px] text-gray-500 leading-snug">
                      {atk.notes.join(' · ')}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {/* Ataque Extra e, em linha própria com a condição, a Lâmina Sedenta (fora do número). */}
        {attackLines.map(line => (
          <p key={line} className="text-[10px] text-gray-500 mb-1">{line}</p>
        ))}
        {casters.map(({ cls, casting }) => {
          const sc = casting.spellcasting
          const aids = describeCastingAids(sc)
          // Conjuração de subclasse (Cavaleiro/Trapaceiro Arcano) se identifica mesmo sem multiclasse.
          const showLabel = isMc || casting.casterId !== cls.id
          return (
            <div key={cls.id}>
              <p className="text-xs text-gray-700">
                {showLabel && <strong>{casting.label} — </strong>}Magia · CD: <strong>{getSpellSaveDC(sc, finalScores, level)}</strong> ·
                {' '}Ataque: <strong>{formatSpellAttackBonus(sc, finalScores, level)}</strong> ·
                {' '}Atributo: {ABILITY_LABELS[sc.ability].short}
              </p>
              {aids.focus && <p className="text-[10px] text-gray-600">{aids.focus}</p>}
              {aids.ritual && <p className="text-[10px] text-gray-600">{aids.ritual}</p>}
            </div>
          )
        })}
      </Box>

      {/* Magias — pool combinado + Pacto; listas por classe conjuradora */}
      {isCaster && (() => {
        const slots = getCombinedSpellSlots(draft).map((count, i) => ({ lvl: i + 1, count })).filter(s => s.count > 0)
        const pact = getPactSlots(draft)
        return (
          <Box title="Magias" className="mb-4">
            {slots.length > 0 && (
              <p className="text-xs mb-1">
                <span className="text-gray-600">Espaços (marque os gastos, recuperam em descanso longo): </span>
                {slots.map(s => `${s.lvl}º: ${trackCircles(s.count) || s.count}`).join(' · ')}
              </p>
            )}
            {pact && (
              <p className="text-xs mb-1">
                <span className="text-gray-600">Magia de Pacto: </span>
                {pact.slotLevel}º: {trackCircles(pact.slots) || pact.slots} (recupera em descanso curto)
              </p>
            )}
            {casters.map(caster => {
              const { entry, cls, casting, cantrips: cantripIds, spells: spellIds } = caster
              const overflows = getSpellChoiceOverflows(caster, finalScores)
              const cantrips = cantripIds.map(id => getSpell(id)?.name).filter(Boolean)
              const spells = spellIds.map(id => getSpell(id)).filter(Boolean)
              const secretGroups = getSecretSpellGroups(caster)
              const headings = getCasterColumnHeadings(caster, finalScores)
              const byLevel = new Map<number, string[]>()
              for (const s of spells) { const a = byLevel.get(s!.level) ?? []; a.push(s!.name); byLevel.set(s!.level, a) }
              if (cantrips.length === 0 && spells.length === 0 && secretGroups.length === 0) return null
              return (
                <div key={cls.id} className="mb-1">
                  {isMc && <p className="text-xs font-bold text-gray-700 mt-1">{casting.label}</p>}
                  {/* Quantas magias esta classe tem a cada descanso — o número que se refaz na mesa. */}
                  <p className="text-xs mb-0.5">
                    <span className="text-gray-600">{isMc ? '' : `${casting.label}: `}</span>
                    {describeSpellRefresh(casting.spellcasting, entry.level, finalScores)}
                  </p>
                  {overflows.map(o => (
                    <p key={o.text} className="text-xs mb-0.5 border border-gray-400 px-1.5 py-1"><strong>⚠ {o.text}</strong></p>
                  ))}
                  {/* Títulos com o total da coluna, como na Revisão: os Segredos que ocupam vaga já estão dentro. */}
                  {headings.hasCantrips && (
                    <p className="text-xs mb-0.5"><span className="text-gray-600">{headings.cantrips}, sempre disponíveis: </span>{cantrips.join(', ') || '—'}</p>
                  )}
                  {headings.hasSpells && <p className="text-xs mb-0.5 text-gray-600">{headings.spells}:</p>}
                  {[...byLevel.keys()].sort((a, b) => a - b).map(lvl => (
                    <p key={lvl} className="text-xs mb-0.5"><span className="text-gray-600">{lvl}º nível: </span>{byLevel.get(lvl)!.join(', ')}</p>
                  ))}
                  {/* Contam como magias desta classe (p. 54-55); os que ocupam vaga e os Adicionais, separados. */}
                  {secretGroups.map(group => (
                    <p key={group.kind} className="text-xs mb-0.5">
                      <span className="text-gray-600">{group.title}: </span>
                      {group.spells.map(formatSecretSpellName).join(', ')}
                    </p>
                  ))}
                </div>
              )
            })}
          </Box>
        )
      })()}

      {/* Recursos — de cada classe, da raça e dos talentos, com a origem */}
      {resourceBlocks.length > 0 && (
        <Box title="Recursos" className="mb-4">
          {/* Um recurso por linha: dado, usos com círculos (ou "___ restantes") e quando voltam. */}
          {resourceBlocks.map(({ source, resources }) => (
            <div key={`${source.kind}-${source.id}`} className="mb-0.5">
              {labelResourceBlocks && <p className="text-xs font-bold text-gray-700">{resourceSourceLabel(source)}</p>}
              {resources.map(r => (
                <p key={r.id} className="text-xs">{formatResourceLine(r)}</p>
              ))}
            </div>
          ))}
        </Box>
      )}

      {/* Proficiências & Idiomas */}
      <Box title="Proficiências & Idiomas" className="mb-4">
        {armorProficiencies.length > 0 && <p className="text-xs mb-0.5"><span className="text-gray-600">Armaduras: </span>{armorProficiencies.join(', ')}</p>}
        {weaponProficiencies.length > 0 && <p className="text-xs mb-0.5"><span className="text-gray-600">Armas: </span>{weaponProficiencies.join(', ')}</p>}
        {allTools.length > 0 && <p className="text-xs mb-0.5"><span className="text-gray-600">Ferramentas: </span>{allTools.map(t => `${TOOL_NAMES[t] ?? getToolName(t)}${expertiseTools.includes(t) ? ' (bônus dobrado)' : ''}`).join(', ')}</p>}
        <p className="text-xs"><span className="text-gray-600">Idiomas: </span>{languages.join(', ') || '—'}</p>
        {hasExoticNote && <p className="text-[10px] text-gray-600">{EXOTIC_LANGUAGE_NOTE}</p>}
        {/* p. 144 — a ficha vai pra mesa, então o custo de usar armadura sem proficiência vai junto. */}
        {unproficientArmor.length > 0 && (
          <p className="text-xs mt-1 border border-gray-400 px-1.5 py-1">
            <strong>Sem proficiência: {unproficientArmor.map(a => a.name).join(', ')}.</strong>{' '}
            Desvantagem em testes, resistências e ataques de Força ou Destreza; não conjura magias.
          </p>
        )}
        {/* p. 156 (e p. 53 pro foco do bardo): carregar ferramenta sem proficiência é permitido. */}
        {unproficientTools.map(u => (
          <p key={u.tool.id} className="text-xs mt-0.5 text-gray-700">{formatUnproficientTool(u)}</p>
        ))}
      </Box>

      {/* Magias raciais */}
      {(innateSpells.length > 0 || racialCantrip) && (
        <Box title="Magias Raciais" className="mb-4">
          {racialCantrip && <p className="text-xs">{racialCantrip.name} (truque)</p>}
          {innateSpells.map(s => {
            const spell = getSpell(s.spellId)
            if (!spell) return null
            const usage = describeInnateSpellUsage(s, spell.level)
            return (
              <p key={s.spellId} className="text-xs">
                {spell.name} — {usage.text}{usage.limited && ` ${formatTrackCircles(1)}`} ({ABILITY_LABELS[s.ability].short})
              </p>
            )
          })}
        </Box>
      )}

      {/* Traços & Features */}
      <Box title="Traços Raciais" className="mb-4">
        {(race ? getEffectiveTraitsWithChoices(race, subrace ?? null, draft.raceChoices) : []).map(({ trait: t, chosen }, i) => (
          <p key={`${i}-${t.name}`} className="text-xs mb-1">
            <strong>{t.name}.</strong> {t.description}
            {chosen && <> <span className="text-gray-600">Escolha:</span> <strong>{chosen}</strong></>}
          </p>
        ))}
      </Box>

      {/* Característica de antecedente — regra de mesa que o jogador aciona (Contatos, Refúgio...) */}
      {bg && (
        <Box title="Característica de Antecedente" className="mb-4">
          <p className="text-xs"><strong>{bg.feature.name}.</strong> {bg.feature.description}</p>
        </Box>
      )}

      {/* Interpretação (cap. 4): o app não escolhe nada disso — linhas pra preencher a lápis,
          com a tabela de detalhe do antecedente (Tramoia, Especialidade…) quando ele tem uma. */}
      <Box title="Personagem (preencha a lápis)" className="mb-4">
        <div className="text-xs text-gray-700 space-y-2">
          {ROLEPLAY_FIELDS.flatMap(field => Array.from({ length: field.lines }, (_, i) => (
            <div key={`${field.label}-${i}`} className="flex items-baseline gap-1">
              <span className="shrink-0">{i === 0 ? `${field.label}:` : ''}</span>
              <span className="flex-1 border-b border-gray-500 h-4" />
            </div>
          )))}
          {bgDetail && (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="shrink-0">{bgDetail.label}:</span>
                <span className="flex-1 border-b border-gray-500 h-4" />
              </div>
              <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">
                ({bgDetail.instruction}) {bgDetail.optionsLine}
              </p>
            </div>
          )}
        </div>
      </Box>

      {/* Estilo de Luta: só o accent da CA usava; o texto (ex.: Arquearia +2) nunca saía na ficha. */}
      {fightingStyles.length > 0 && (
        <Box title="Estilo de Luta" className="mb-4">
          {fightingStyles.map(({ classId, style }) => (
            <p key={classId} className="text-xs mb-1 last:mb-0">
              {isMc && <span className="text-gray-600">{getClass(classId)?.name}: </span>}
              <strong>{style.name}.</strong> {style.description}
            </p>
          ))}
        </Box>
      )}

      {/* Manobras, Invocações, Metamágica, Totem, Terreno, Presa — escolhas que se usam na mesa. */}
      {progressionBlocks.length > 0 && (
        <Box title="Escolhas de Progressão" className="mb-4">
          {progressionBlocks.map(({ entry: e, slots }) => (
            <div key={e.classId} className="mb-2 last:mb-0">
              {isMc && <p className="text-xs font-bold text-gray-700">{getClass(e.classId)?.name}</p>}
              {slots.map(({ slot, picks }) => (
                <div key={slot.id} className="mb-1.5 last:mb-0">
                  <p className="text-[10px] uppercase tracking-wide text-gray-600">
                    {slot.label}{slot.cumulative ? ` (nv ${slot.level})` : ''}
                  </p>
                  {picks.map(opt => (
                    <p key={opt.id} className="text-xs mb-0.5">
                      <strong>{opt.name}.</strong> {opt.text}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </Box>
      )}

      {featureBlocks.some(b => b.features.length > 0) && (
        <Box title="Habilidades de Classe" className="mb-4">
          {featureBlocks.map(({ e, ec, features }) => features.length > 0 && (
            <div key={e.classId} className="mb-1">
              {isMc && <p className="text-xs font-bold text-gray-700">{ec?.name} {e.level}°</p>}
              {features.map((f, i) => (
                <p key={`${f.name}-${i}`} className="text-xs mb-1">
                  <strong>{f.name}</strong> (nv {f.level}). {f.description}
                  {f.chosen && <> <span className="text-gray-600">Escolha:</span> <strong>{f.chosen}</strong></>}
                </p>
              ))}
            </div>
          ))}
        </Box>
      )}

      {feats.length > 0 && (
        <Box title="Talentos" className="mb-4">
          {feats.map(({ feat: f, origin }) => (
            <div key={f.id} className="mb-1">
              <p className="text-xs">
                <strong>{f.name}.</strong>
                <span className="text-gray-600"> {origin}</span>
              </p>
              <RuleText text={f.description} className="text-xs" />
            </div>
          ))}
        </Box>
      )}

      {/* Inventário */}
      <Box title="Equipamento & Inventário" className="mb-2">
        <p className="text-xs mb-1">
          <span className="text-gray-600">Dinheiro: </span><strong>{formatCoins(money.totalCopper)}</strong>
          {moneySource && <span className="text-gray-600"> ({moneySource})</span>}
        </p>
        <p className="text-xs">{inventory.length > 0 ? inventory.join(' · ') : '—'}</p>
      </Box>

      {/*
        Grimório: o texto de cada magia que o personagem conhece.
        Vem no fim e numa página própria porque é a parte que mais cresce — um bardo de nível
        alto tem dezenas de magias, e elas empurrariam o resto da ficha. Cada magia é um bloco
        `breakInside: avoid`, então nenhuma é cortada no meio ao imprimir.
      */}
      {knownSpells.length > 0 && (
        // `breakBefore`, e não a classe .page-break (que reserva uma folha inteira via
        // min-height): aqui a intenção é começar numa página nova, não ocupar uma.
        <div style={{ breakBefore: 'page' }}>
          <Box title={`Magias — descrições (${knownSpells.length})`}>
            {knownSpells.map(spell => (
              <article key={spell.id} className="mb-3 last:mb-0" style={{ breakInside: 'avoid' }}>
                <p className="text-xs font-bold">
                  {spell.name}
                  <span className="font-normal text-gray-600">
                    {' — '}{spell.level === 0 ? 'truque' : `${spell.level}º nível`} de {spell.school}
                    {spell.ritual && ' (ritual)'}
                    {spell.concentration && ' · concentração'}
                  </span>
                </p>
                <p className="text-[10px] text-gray-600 mb-0.5">
                  {spell.castingTime} · {spell.range} · {spell.components} · {spell.duration}
                </p>
                <RuleText
                  text={spell.description}
                  className="text-xs"
                  headingClassName="text-[10px] font-bold uppercase tracking-wide text-gray-600 mt-1.5 first:mt-0"
                />
              </article>
            ))}
          </Box>
        </div>
      )}
    </div>
  )
}

function Grid({ cols, className, children }: { cols: number; className?: string; children: React.ReactNode }) {
  return <div className={`grid gap-2 ${className ?? ''}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{children}</div>
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-400 rounded text-center py-1.5">
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-600 leading-tight">{label}</div>
    </div>
  )
}

function Box({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`border border-gray-300 rounded p-3 ${className ?? ''}`} style={{ breakInside: 'avoid' }}>
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 border-b border-gray-300 pb-1 mb-2">{title}</h2>
      {children}
    </section>
  )
}

function Row({ mark, expertise, label, value }: { mark: boolean; expertise?: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span>
        <span className="inline-block w-3 text-center">{expertise ? '◉' : mark ? '●' : '○'}</span>{' '}
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}
