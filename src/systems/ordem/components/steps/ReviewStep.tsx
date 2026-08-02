import { useOrdemStore } from '../../stores/characterStore'
import { getOrigin } from '../../utils/originUtils'
import { getOrdemClass } from '../../utils/classUtils'
import { formatSkillWithAttribute, getSkillName, getSkillKitName } from '../../utils/skillUtils'
import { getTrilha } from '../../utils/trilhaUtils'
import { getPower } from '../../utils/powerUtils'
import {
  getTrainedSkills, getSkillGrade, hasFavoredRitualPower, hasLaminaMaldita, getRitualCost, hasClassPower, getGrantedRituals, getEffectivePeLimit,
  getParanormalResistanceBonus, getMentalParanormalDamageResistance, getOriginMentalDamageResistance, getConditionalDamageResistances,
  getExpertSkills, getExpertDie,
} from '../../utils/characterUtils'
import {
  getSkillBonusTotal, getSkillsWithUnconditionalBonus, getConditionalSkillBonuses,
  getConditionalDefenseBonuses, getExtraDamageDiceNotes, getSheetExplosives,
  getResolvedAbilityNotes, splitResolvedNotes, resolveDtInText,
  getDefenseReactions, isDodgeCondition, isBlockCondition, type DefenseReaction,
} from '../../utils/sheetEffects'
import { formatDicePool, ATTRIBUTE_ABBREV as ATTR_ABBREV } from '../../utils/attributeUtils'
import { getRitualById, formatRitualElementLabel, getRitualSlotsCount, ritualNeedsElementChoice, getSlotRitualElement, getGrantedRitualElement, grantedRitualElementKey, ELEMENT_NAMES, ELEMENT_COLORS } from '../../utils/ritualUtils'
import {
  getAffinityState, getParanormalEffects, getParanormalInstances, getSanityBreakdown, getSourceLabel,
  isParanormalElement, OPPRESSOR_OF,
} from '../../utils/paranormalPowerUtils'
import {
  getEquipmentByInstance, getInstanceLabel, getModifiedDefenseBonus, getDraftInstanceCategory,
  getMissingRitualComponentElements, getEquipmentDamageResistances, formatAccessorySkills,
  getKitSkills, formatKitSkill,
  getLoadState, OVERLOAD_DEFENSE_PENALTY, OVERLOAD_SKILL_PENALTY, OVERLOAD_SPEED_PENALTY_METERS,
} from '../../utils/equipmentUtils'
import { getModification } from '../../utils/modificationUtils'
import {
  getCurse, getCursedDerivedStats, getSheetAttributes, formatCurseElement, formatCurseChoiceDetail,
  getRitualDt, getRitualPeLimit, getCurseResistances, formatUnitCursePrice,
} from '../../utils/curseUtils'
import type { OrdemEquipment } from '../../types/equipment'
import type { OrdemRitual } from '../../types/ritual'
import { getSheetWeaponAttacks } from '../../utils/ordemWeaponUtils'
import { getPatente } from '../../utils/patenteUtils'
import type { OrdemWeapon } from '../../types/equipment'

const CAT_ROMAN = ['0', 'I', 'II', 'III', 'IV']
import { getReachedTrilhaSlots } from '../../utils/progressionUtils'
import { exportCharacter } from '../../utils/storage'
import { StepNav } from '../../../../components/wizard/StepNav'
import { PendingStepsPanel } from '../common/PendingStepsPanel'
import { formatMissingCount } from '../../../../components/wizard/pendingSteps'
import { getMissingSteps } from '../../utils/draftValidation'

/** Sufixo com os bônus condicionais já somados no número da reação (ex.: ", já com +5 de Campo Protetor"). */
function formatReactionSources(reaction: DefenseReaction): string {
  if (reaction.included.length === 0) return ''
  return `, já com ${reaction.included.map(i => `+${i.value} de ${i.source}`).join(' e ')}`
}

export function ReviewStep() {
  const draft = useOrdemStore(state => state.draft)
  const updateDraft = useOrdemStore(state => state.updateDraft)
  const prevStep = useOrdemStore(state => state.prevStep)
  const goToPrint = useOrdemStore(state => state.goToPrint)
  const reset = useOrdemStore(state => state.reset)

  const origin = draft.origin ? getOrigin(draft.origin) : undefined
  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  // Navegação livre: dá pra chegar aqui com etapas em branco. As pendências são cobradas aqui
  // (o único bloqueio do fluxo) e a classe é a única sem a qual não existe ficha pra montar.
  const missing = getMissingSteps(draft)

  if (!cls) {
    return (
      <div className="max-w-lg mx-auto space-y-4 pb-16">
        <div className="text-center mb-2">
          <div className="text-5xl mb-3">📋</div>
          <h2 className="font-fantasy text-2xl font-bold text-gold-400">
            {draft.name.trim() || 'Agente sem nome'}
          </h2>
          <p className="text-parchment-600 text-xs mt-1 leading-relaxed">
            A ficha só se monta depois da classe — é ela que define PV, PE, Sanidade e as perícias treinadas.
          </p>
        </div>
        <PendingStepsPanel missing={missing} />
        <StepNav
          onPrev={prevStep}
          onNext={reset}
          blocked
          pendingReason={formatMissingCount(missing.length)}
          nextLabel="Concluir ✓"
        />
      </div>
    )
  }

  const attributes = getSheetAttributes(draft)
  const stats = getCursedDerivedStats(draft, cls, getModifiedDefenseBonus(draft))
  // Esquiva e bloqueio (p. 88): os números prontos das reações de defesa, se o treino permite.
  const defenseReactions = getDefenseReactions(draft, stats.defense)
  const trainedSkills = getTrainedSkills(draft)
  const trilha = draft.trilha ? getTrilha(draft.trilha) : undefined
  const reachedTrilhaFeatures = trilha
    ? getReachedTrilhaSlots(draft.nex).map(nex => trilha.features.find(f => f.nex === nex)).filter(Boolean)
    : []
  // O Transcender fica fora da lista de poderes de classe: a seção "Poderes Paranormais" mostra
  // cada instância resolvida (a linha crua "Escolha um poder paranormal…" seria ruído).
  const powers = draft.powerChoices.filter((p): p is string => Boolean(p) && p !== 'transcend').map(getPower).filter(Boolean)
  const paranormalInstances = getParanormalInstances(draft).filter(i => i.power)
  const paranormalEffects = getParanormalEffects(draft)
  const affinity = getAffinityState(draft)
  const sanityBreakdown = getSanityBreakdown(draft, cls)
  // Resistências automáticas (Mente Sã/Inabalável da trilha; Eu Já Sabia da origem; Resistir a
  // Elemento/Precognição dos poderes paranormais) — ver Section "Resistências".
  const paranormalResistanceBonus = getParanormalResistanceBonus(draft)
  const mentalParanormalDr = getMentalParanormalDamageResistance(draft)
  const originMentalDr = getOriginMentalDamageResistance(draft, attributes.intellect)
  const elementResistances = Object.entries(paranormalEffects.elementResistances) as [keyof typeof ELEMENT_NAMES, number][]
  const equipmentResistances = getEquipmentDamageResistances(draft)
  // A RD condicional do bloqueio (Casca Grossa) já está somada na linha "Bloqueando" da Defesa.
  const conditionalResistances = getConditionalDamageResistances(draft)
    .filter(r => !(defenseReactions.block && isBlockCondition(r.condition)))
  // Resistências das maldições equipadas (Profética/Voltaica/Repulsiva/Regenerativa/Proteção
  // Elemental e Escudo Mental) — fonte própria, ao lado das do poder Resistir a Elemento.
  const curseResistances = getCurseResistances(draft)
  // Só o Ocultista conhece rituais; limita aos slots realmente abertos pelo NEX (baixar o NEX
  // depois de escolher não deve deixar rituais obsoletos de círculos inacessíveis na ficha).
  const ritualSlots = draft.class === 'occultist' ? getRitualSlotsCount(draft.nex) : 0
  // Preserva o índice do slot (não filtra antes de mapear): rituais multi-elemento (ex.: Amaldiçoar
  // Arma) podem ocupar mais de um slot, um por elemento, e o elemento de cada instância é lido
  // pelo índice do slot em que foi escolhido (ver `getSlotRitualElement`).
  const rituals = draft.ritualChoices
    .slice(0, ritualSlots)
    .map((id, slotIndex) => (id ? { ritual: getRitualById(id), slotIndex } : null))
    .filter((e): e is { ritual: OrdemRitual; slotIndex: number } => Boolean(e?.ritual))
  // Rituais concedidos: features de trilha e o poder Aprender Ritual — QUALQUER classe pode ter.
  const grantedRituals = getGrantedRituals(draft)
  // Tudo que o personagem "conhece" (escolhidos + concedidos): base dos pickers de Ritual Predileto / arma Ritualística.
  const allKnownRituals = [...rituals.map(e => e.ritual), ...grantedRituals.map(g => g.ritual)]
  // Ritual Predileto e "ritual armazenado" guardam só o id (a escolha é do ritual, não da
  // instância) — dedup pra não repetir a mesma opção duas vezes num ritual multi-elemento.
  const uniqueKnownRituals = Array.from(new Map(allKnownRituals.map(r => [r.id, r])).values())
  // Cada entrada de `equipmentChoices` é uma UNIDADE ("revolver", "revolver#2"...), com mods/maldições próprias.
  const equipmentUnits = draft.equipmentChoices
    .map(uid => ({ uid, item: getEquipmentByInstance(uid) }))
    .filter((u): u is { uid: string; item: OrdemEquipment } => Boolean(u.item))
  const weaponUnits = equipmentUnits.filter((u): u is { uid: string; item: OrdemWeapon } => u.item.type === 'weapon')
  // Uma linha por arma (ou por variante de munição carregada) + o ataque desarmado no fim.
  const weaponAttacks = getSheetWeaponAttacks(draft)
  const cursedUnits = equipmentUnits.filter(u => (draft.equipmentCurses[u.uid]?.length ?? 0) > 0)
  const missingComponents = getMissingRitualComponentElements(draft)
  const showFavoriteRitualPicker = hasFavoredRitualPower(draft) && allKnownRituals.length > 0
  // Armas com a maldição Ritualística podem ter um ritual conhecido pré-armazenado (opcional).
  const ritualisticUnits = weaponUnits.filter(u => (draft.equipmentCurses[u.uid] ?? []).includes('ritualistica'))
  const showStoredRitualPicker = ritualisticUnits.length > 0 && allKnownRituals.length > 0
  // Perícia de ataque só é escolhível com a Lâmina Maldita (única exceção do livro: Ocultismo).
  const showWeaponSkillPicker = hasLaminaMaldita(draft) && weaponUnits.length > 0
  const showPersonalization = showFavoriteRitualPicker || showStoredRitualPicker || showWeaponSkillPicker

  const setWeaponSkill = (uid: string, value: string) => {
    const choices = { ...draft.weaponSkillChoices }
    if (value === 'auto') delete choices[uid]
    else choices[uid] = value as 'fighting' | 'aim' | 'occultism'
    updateDraft({ weaponSkillChoices: choices })
  }
  const upgradedSkills = trainedSkills.filter(sid => getSkillGrade(draft, sid) !== 'treinado')
  // Perito (Especialista): as 2 perícias escolhidas e o dado extra já resolvido pelo NEX.
  const expertSkills = getExpertSkills(draft)
  const expertDie = getExpertDie(draft.nex)
  // Bônus de perícia que só valem numa situação (Hacker, Envolto em Mistério, Acalentar...).
  const conditionalSkillBonuses = getConditionalSkillBonuses(draft)
  // Sobrecarga: passar da capacidade é permitido e penalizado (p. 55) — a ficha precisa gritar isso.
  const load = getLoadState(draft)
  // Defesa condicional (Reflexos Defensivos, Inquebrável) e dados de dano extra já resolvidos
  // pelo NEX (Ataque Furtivo) — ficam fora dos números somados da ficha. O bônus condicional da
  // esquiva (Campo Protetor) é a exceção: já está somado na linha "Esquivando".
  const conditionalDefense = getConditionalDefenseBonuses(draft)
    .filter(d => !(defenseReactions.dodge && isDodgeCondition(d.condition)))
  const extraDamageDice = getExtraDamageDiceNotes(draft)
  // Explosivos com a DT do teste de resistência já calculada (10 + limite de PE + atributo).
  const explosives = getSheetExplosives(draft)
  // Notas que resolvem um valor por atributo (Criar Selo, Técnica Medicinal): saem junto da
  // descrição da própria habilidade, pra não mostrar a habilidade duas vezes.
  const { inline: inlineNotes, leftovers: leftoverNotes } = splitResolvedNotes(
    getResolvedAbilityNotes(draft),
    [origin?.power.name, cls.classAbility.name, ...reachedTrilhaFeatures.map(f => f?.name), ...powers.map(p => p?.name)],
  )
  // Kits: a ficha registra os que o agente tem e lista as perícias sem kit. O −5 não é aplicado —
  // o livro amarra a exigência a USOS da perícia, então quem decide no teste é o mestre.
  const kitSkills = getKitSkills(draft)

  function handleExport() {
    exportCharacter(draft)
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-16">
      <div className="text-center mb-2">
        <h2 className="font-fantasy text-2xl font-bold text-gold-400">{draft.name.trim() || 'Agente sem nome'}</h2>
        <p className="text-parchment-600 text-xs mt-1">
          {origin ? `${origin.name} · ` : ''}{cls.name}{trilha ? ` (${trilha.name})` : ''} · NEX {draft.nex}% · {getPatente(draft.patente).name}
        </p>
      </div>

      <PendingStepsPanel missing={missing} />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Pontos de Vida" value={String(stats.hp)} />
        <Stat label="Pontos de Esforço" value={String(stats.pe)} />
        <Stat label="Sanidade" value={String(stats.sanity)} />
        <Stat label="Defesa" value={String(stats.defense)} />
      </div>
      <p className="text-center text-parchment-600 text-xs">
        Limite de PE por turno: <span className="text-parchment-400 font-semibold">{getEffectivePeLimit(draft)}</span>
        {getRitualPeLimit(draft) !== getEffectivePeLimit(draft) && (
          <span className="text-gold-600/90"> ({getRitualPeLimit(draft)} ao conjurar rituais — Presença Poderosa)</span>
        )}
        {' · '}Deslocamento:{' '}
        <span className={`font-semibold ${load.overloaded ? 'text-amber-400' : 'text-parchment-400'}`}>
          {9 - (load.overloaded ? OVERLOAD_SPEED_PENALTY_METERS : 0)}m
        </span>
      </p>
      {load.overloaded && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 p-3 text-center">
          <p className="text-amber-300 text-sm font-bold">
            🎒 SOBRECARREGADO — {load.spaces}/{load.capacity} espaços
          </p>
          <p className="text-amber-300/90 text-xs mt-1">
            Já descontado na ficha: <strong>−{OVERLOAD_DEFENSE_PENALTY} na Defesa</strong>,{' '}
            <strong>−{OVERLOAD_SKILL_PENALTY} nas perícias com penalidade de carga</strong> e{' '}
            <strong>deslocamento {9 - OVERLOAD_SPEED_PENALTY_METERS}m</strong> (livro, pág. 55).
            O teto é {load.max} espaços.
          </p>
        </div>
      )}
      {(defenseReactions.dodge || defenseReactions.block) && (
        <p className="text-center text-parchment-600 text-xs">
          {defenseReactions.dodge && (
            <>
              Esquivando: <span className="text-parchment-400 font-semibold">Defesa {defenseReactions.dodge.total}</span>{' '}
              <span className="text-gold-600/90">(Reflexos{formatReactionSources(defenseReactions.dodge)})</span>
            </>
          )}
          {defenseReactions.dodge && defenseReactions.block && ' · '}
          {defenseReactions.block && (
            <>
              Bloqueando: <span className="text-parchment-400 font-semibold">RD {defenseReactions.block.total}</span> no corpo a corpo{' '}
              <span className="text-gold-600/90">(Fortitude{formatReactionSources(defenseReactions.block)})</span>
            </>
          )}
          {' — '}reação, uma por rodada, antes da rolagem do atacante
        </p>
      )}
      {conditionalDefense.length > 0 && (
        <p className="text-center text-parchment-600 text-xs">
          {conditionalDefense.map((d, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              <span className="text-parchment-400 font-semibold">
                Defesa{d.appliesToResistanceTests && ' e testes de resistência'} +{d.value}
              </span>{' '}
              <span className="text-gold-600/90">({d.source}, {d.condition})</span>
            </span>
          ))}
        </p>
      )}
      {sanityBreakdown.total > 0 && (
        <p className="text-center text-parchment-600 text-xs">
          Sanidade <span className="text-amber-500/90 font-semibold">−{sanityBreakdown.total}</span>
          {' — '}
          {sanityBreakdown.transcendPenalty > 0 && (
            <>Transcender ×{sanityBreakdown.transcendCount} (sem o ganho de SAN desses NEX)</>
          )}
          {sanityBreakdown.transcendPenalty > 0 && sanityBreakdown.cultistPenalty > 0 && ' · '}
          {sanityBreakdown.cultistPenalty > 0 && <>metade da SAN inicial (Traços do Outro Lado)</>}
        </p>
      )}

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
            {/* `resolveDtInText` resolve as DTs escritas em sigla ("DT Vig" → "DT 18 — Vig"). */}
            <span className="font-semibold">{origin.power.name}.</span> {resolveDtInText(draft, origin.power.description)}
            <ResolvedNote note={inlineNotes.get(origin.power.name)} />
          </p>
        </Section>
      )}

      <Section title="Classe">
        <p className="text-parchment-200 font-fantasy font-semibold text-sm">{cls.name}</p>
        <p className="text-parchment-500 text-xs mt-1">{cls.description}</p>
        <p className="text-parchment-500 text-xs mt-2">
          <span className="font-semibold text-parchment-300">{cls.classAbility.name}.</span> {resolveDtInText(draft, cls.classAbility.description)}
          <ResolvedNote note={inlineNotes.get(cls.classAbility.name)} />
        </p>
        {expertSkills.length > 0 && (
          <p className="text-gold-500/90 text-xs mt-2">
            ✨ <strong>Perito em {expertSkills.map(formatSkillWithAttribute).join(' e ')}</strong> — gaste{' '}
            {expertDie.pe} PE para somar +{expertDie.die} no teste (no seu NEX).
          </p>
        )}
        {leftoverNotes.map((n, i) => (
          <p key={i} className="text-gold-500/90 text-xs mt-2">
            ✨ <strong>{n.source}:</strong> {n.note}.
          </p>
        ))}
      </Section>

      {trilha && reachedTrilhaFeatures.length > 0 && (
        <Section title={`Trilha — ${trilha.name}`}>
          <div className="space-y-2">
            {reachedTrilhaFeatures.map(f => f && (
              <p key={f.name} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">NEX {f.nex}% – {f.name}.</span> {resolveDtInText(draft, f.description)}
                <ResolvedNote note={inlineNotes.get(f.name)} />
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
                <span className="font-semibold text-parchment-300">{p.name}.</span> {resolveDtInText(draft, p.description)}
                <ResolvedNote note={inlineNotes.get(p.name)} />
              </p>
            ))}
          </div>
        </Section>
      )}

      {paranormalInstances.length > 0 && (
        <Section title="Poderes Paranormais">
          <div className="space-y-3">
            {paranormalInstances.map(instance => {
              const power = instance.power!
              const expansionTarget = instance.choice?.classPowerId ? getPower(instance.choice.classPowerId) : undefined
              const learnedRitual = instance.choice?.ritualId ? getRitualById(instance.choice.ritualId) : undefined
              return (
                <div key={instance.key} className="text-xs">
                  <p className="flex items-center flex-wrap gap-1.5">
                    <span className="font-semibold text-parchment-300">{power.name}</span>
                    {isParanormalElement(instance.element) && (
                      <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold border ${ELEMENT_COLORS[instance.element]}`}>
                        {ELEMENT_NAMES[instance.element]}
                      </span>
                    )}
                    {instance.isAffinityCopy && (
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold text-gold-400 bg-gold-950/40 border border-gold-800">
                        2ª vez — Afinidade
                      </span>
                    )}
                    <span className="text-gold-600/90">— {getSourceLabel(instance.key)}</span>
                  </p>
                  <p className="text-parchment-500 mt-0.5">{resolveDtInText(draft, power.description)}</p>
                  {instance.isAffinityCopy && power.affinityDescription && (
                    <p className="text-gold-400 mt-0.5">✦ Afinidade: {power.affinityDescription}</p>
                  )}
                  {learnedRitual && (
                    <p className="text-parchment-600 mt-0.5">
                      Ritual aprendido: <span className="text-parchment-400 font-semibold">{learnedRitual.name}</span> — custo e DT na seção Rituais Conhecidos.
                    </p>
                  )}
                  {expansionTarget && (
                    <p className="text-parchment-600 mt-0.5">
                      Poder de outra classe: <span className="text-parchment-400 font-semibold">{expansionTarget.name}.</span>{' '}
                      <span className="text-parchment-500">{resolveDtInText(draft, expansionTarget.description)}</span>
                      {instance.choice?.classPowerParams?.[0] && isParanormalElement(instance.choice.classPowerParams[0]) && (
                        <span className="text-parchment-600"> (elemento: {ELEMENT_NAMES[instance.choice.classPowerParams[0] as keyof typeof ELEMENT_NAMES]})</span>
                      )}
                    </p>
                  )}
                </div>
              )
            })}
            {affinity.active && affinity.element && (
              <p className="text-parchment-600 text-xs pt-2 border-t border-parchment-900/50">
                <span className="font-semibold text-gold-400">Afinidade Elemental — {ELEMENT_NAMES[affinity.element]}.</span>{' '}
                Conjura rituais de {ELEMENT_NAMES[affinity.element]} sem componentes ritualísticos; +2d20 em testes contra
                efeitos de {ELEMENT_NAMES[affinity.element]} e −2d20 contra {ELEMENT_NAMES[OPPRESSOR_OF[affinity.element]]} (opressor);
                pode aprender rituais que exijam afinidade com o elemento.
              </p>
            )}
          </div>
        </Section>
      )}

      {(paranormalResistanceBonus > 0 || mentalParanormalDr > 0 || originMentalDr > 0 || elementResistances.length > 0
        || paranormalEffects.resistanceTestsBonus > 0 || equipmentResistances.length > 0 || conditionalResistances.length > 0
        || curseResistances.length > 0) && (
        <Section title="Resistências">
          <div className="space-y-1.5">
            {equipmentResistances.map((r, i) => (
              <p key={`eq-${i}`} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">Resistência a dano {r.label}: {r.value}</span>
                {' '}<span className="text-gold-600/90">({r.source})</span>
              </p>
            ))}
            {curseResistances.map((r, i) => (
              <p key={`curse-${i}`} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">Resistência a dano {r.label}: {r.value}</span>
                {' '}<span className="text-gold-600/90">({r.source})</span>
              </p>
            ))}
            {conditionalResistances.map((r, i) => (
              <p key={`cond-${i}`} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">
                  Resistência a dano {r.value === 'vigor' ? attributes.vigor : r.value}
                </span>
                {' '}<span className="text-gold-600/90">({r.name}, {r.condition})</span>
              </p>
            ))}
            {paranormalEffects.resistanceTestsBonus > 0 && (
              <p className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">Testes de resistência: +{paranormalEffects.resistanceTestsBonus}</span>
                {' '}<span className="text-gold-600/90">(Precognição)</span>
              </p>
            )}
            {elementResistances.map(([element, value]) => (
              <p key={element} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">Resistência a dano de {ELEMENT_NAMES[element]}: {value}</span>
                {' '}<span className="text-gold-600/90">(Resistir a Elemento{value > 10 ? ' — Afinidade' : ''})</span>
              </p>
            ))}
            {paranormalResistanceBonus > 0 && (
              <p className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">Teste de resistência paranormal: +{paranormalResistanceBonus}</span>
                {' '}<span className="text-gold-600/90">(Mente Sã)</span>
              </p>
            )}
            {mentalParanormalDr > 0 && originMentalDr > 0 ? (
              <>
                <p className="text-parchment-500 text-xs">
                  <span className="font-semibold text-parchment-300">Resistência a dano mental: {mentalParanormalDr + originMentalDr}</span>
                  {' '}<span className="text-gold-600/90">(Inabalável, Eu Já Sabia)</span>
                </p>
                <p className="text-parchment-500 text-xs">
                  <span className="font-semibold text-parchment-300">Resistência a dano paranormal: {mentalParanormalDr}</span>
                  {' '}<span className="text-gold-600/90">(Inabalável)</span>
                  <br />
                  <span className="text-parchment-600">Quando for alvo de um efeito paranormal que permite reduzir o dano à metade com um teste de Vontade, não sofre dano algum se passar.</span>
                </p>
              </>
            ) : (
              <>
                {mentalParanormalDr > 0 && (
                  <p className="text-parchment-500 text-xs">
                    <span className="font-semibold text-parchment-300">Resistência a dano mental/paranormal: {mentalParanormalDr}</span>
                    {' '}<span className="text-gold-600/90">(Inabalável)</span>
                    <br />
                    <span className="text-parchment-600">Quando for alvo de um efeito paranormal que permite reduzir o dano à metade com um teste de Vontade, não sofre dano algum se passar.</span>
                  </p>
                )}
                {originMentalDr > 0 && (
                  <p className="text-parchment-500 text-xs">
                    <span className="font-semibold text-parchment-300">Resistência a dano mental: {originMentalDr}</span>
                    {' '}<span className="text-gold-600/90">(Eu Já Sabia)</span>
                  </p>
                )}
              </>
            )}
          </div>
        </Section>
      )}

      {allKnownRituals.length > 0 && (
        <Section title={`Rituais Conhecidos (${allKnownRituals.length})`}>
          <div className="space-y-2">
            {rituals.map(({ ritual: r, slotIndex }) => {
              const element = getSlotRitualElement(r, slotIndex, draft.ritualElementChoices)
              const { cost, notes } = getRitualCost(draft, r, element)
              const { dt, notes: dtNotes } = getRitualDt(draft, r, element)
              return (
                <p key={`${r.id}-${slotIndex}`} className="text-parchment-500 text-xs">
                  <span className="font-semibold text-parchment-300">{r.name}</span>{' '}
                  <span className="text-parchment-700">
                    ({formatRitualElementLabel(r, element)}, {r.circle}º Círculo — custo {cost} PE{notes.length > 0 ? ` (${notes.join(', ')})` : ''}, DT {dt}{dtNotes.length > 0 ? ` (${dtNotes.join(', ')})` : ''})
                  </span>
                </p>
              )
            })}
            {grantedRituals.map(({ ritual: r, source, element: sourceElement }, i) => {
              // Aprender Ritual traz o elemento na própria fonte; concedidos por trilha resolvem
              // pelo ritualElementChoices (chave granted:<id>).
              const element = sourceElement ?? getGrantedRitualElement(r, draft.ritualElementChoices)
              const { cost, notes } = getRitualCost(draft, r, element)
              const { dt, notes: dtNotes } = getRitualDt(draft, r, element)
              // Rituais concedidos multi-elemento (ex.: Amaldiçoar Arma via Lâmina Maldita) ainda exigem escolher o elemento.
              const needsElement = ritualNeedsElementChoice(r) && !element
              return (
                <div key={`granted-${r.id}-${i}`}>
                  <p className="text-parchment-500 text-xs">
                    <span className="font-semibold text-parchment-300">{r.name}</span>{' '}
                    <span className="text-parchment-700">
                      ({formatRitualElementLabel(r, element)}, {r.circle}º Círculo — custo {cost} PE{notes.length > 0 ? ` (${notes.join(', ')})` : ''}, DT {dt}{dtNotes.length > 0 ? ` (${dtNotes.join(', ')})` : ''})
                    </span>{' '}
                    <span className="text-gold-600/90">— concedido pela {source}</span>
                  </p>
                  {needsElement && (
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-amber-400/90 text-xs">Escolha o elemento deste ritual:</span>
                      {r.elements.map(el => (
                        <button
                          key={el}
                          onClick={() => updateDraft({ ritualElementChoices: { ...draft.ritualElementChoices, [grantedRitualElementKey(r.id)]: el } })}
                          className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border transition-colors ${ELEMENT_COLORS[el]}`}
                        >
                          {ELEMENT_NAMES[el]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                  {uniqueKnownRituals.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.circle}º Círculo)</option>
                  ))}
                </select>
              </div>
            )}

            {showStoredRitualPicker && (
              <div>
                <p className="text-parchment-400 text-xs font-semibold mb-1">
                  Ritual armazenado na arma Ritualística <span className="text-parchment-600 font-normal">(opcional — você conjura pra dentro da arma pagando os PE; troca livre em jogo)</span>
                </p>
                <div className="space-y-1">
                  {ritualisticUnits.map(({ uid }) => (
                    <div key={uid} className="flex items-center gap-2">
                      <span className="text-parchment-500 text-xs w-36 shrink-0 truncate">{getInstanceLabel(draft, uid)}</span>
                      <select
                        value={draft.equipmentCurseChoices[`${uid}:ritualistica`] ?? ''}
                        onChange={e => {
                          const choices = { ...draft.equipmentCurseChoices }
                          if (e.target.value) choices[`${uid}:ritualistica`] = e.target.value
                          else delete choices[`${uid}:ritualistica`]
                          updateDraft({ equipmentCurseChoices: choices })
                        }}
                        className="flex-1 bg-parchment-950 border border-parchment-800 rounded px-2 py-1 text-parchment-300 text-xs"
                      >
                        <option value="">Nenhum (anotar a lápis na missão)</option>
                        {uniqueKnownRituals.map(r => (
                          <option key={r.id} value={r.id}>{r.name} ({r.circle}º Círculo — {getRitualCost(draft, r).cost} PE)</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showWeaponSkillPicker && (
              <div>
                <p className="text-parchment-400 text-xs font-semibold mb-1">
                  Perícia de ataque
                  <span className="text-parchment-600 font-normal"> (Lâmina Maldita: com a arma amaldiçoada, você pode usar Ocultismo no lugar de Luta/Pontaria)</span>
                </p>
                <div className="space-y-1">
                  {weaponUnits.map(({ uid }) => (
                    <div key={uid} className="flex items-center gap-2">
                      <span className="text-parchment-500 text-xs w-36 shrink-0 truncate">{getInstanceLabel(draft, uid)}</span>
                      <select
                        value={draft.weaponSkillChoices[uid] === 'occultism' ? 'occultism' : 'auto'}
                        onChange={e => setWeaponSkill(uid, e.target.value)}
                        className="flex-1 bg-parchment-950 border border-parchment-800 rounded px-2 py-1 text-parchment-300 text-xs"
                      >
                        <option value="auto">Automática (Luta corpo a corpo / Pontaria à distância)</option>
                        <option value="occultism">Ocultismo (com a arma amaldiçoada)</option>
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
          <p className="text-parchment-700 text-xs mb-2">
            Role a quantidade de d20 indicada e use o melhor + o bônus —{' '}
            <span className="text-amber-400/90">exceto onde estiver marcado "pior"</span>.
          </p>
          {extraDamageDice.map(d => (
            <p key={d.source} className="text-gold-500/90 text-xs mb-2">
              ✨ <strong>{d.source}:</strong> +{d.dice} de dano no seu NEX (condições na descrição da trilha).
            </p>
          ))}
          <div className="space-y-1">
            {weaponAttacks.map((a, i) => (
              <p key={`${a.name}-${i}`} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">{a.name}</span>{' '}
                <span className="text-parchment-700">
                  {a.skill} ({ATTR_ABBREV[a.attributeUsed]}){' '}
                  {formatDicePool({ dice: a.rollDice, mode: a.rollMode })}{' '}
                  <span className="text-gold-500">{a.attackBonus >= 0 ? `+${a.attackBonus}` : a.attackBonus}</span>
                  {' · '}{a.damage} · Crít. {a.critical}{a.range && a.range !== '-' ? ` · ${a.range}` : ''}
                </span>
                {a.dicePenaltyNotes.length > 0 && (
                  <span className="text-amber-400/90"> ({a.dicePenaltyNotes.join(', ')})</span>
                )}
                {a.notes.map(note => (
                  <span key={note} className="block text-parchment-600 pl-3">↳ {note}</span>
                ))}
              </p>
            ))}
          </div>
        </Section>
      )}

      {explosives.length > 0 && (
        <Section title="Explosivos">
          <p className="text-parchment-700 text-xs mb-2">
            Ação padrão para arremessar num ponto do alcance; afeta a área toda (sem teste de ataque).
          </p>
          <div className="space-y-1">
            {explosives.map(e => (
              <p key={e.uid} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">{e.name}</span>{' '}
                <span className="text-parchment-700">
                  {e.range} · {e.area}
                  {e.damage && ` · ${e.damage}`}
                  {e.resistance && (
                    <> · {e.resistance.skill} DT {e.resistance.dt}
                      {e.resistance.notes.length > 0 && ` (${e.resistance.notes.join(', ')})`}
                      {' '}— {e.resistance.effect}
                    </>
                  )}
                </span>
              </p>
            ))}
          </div>
        </Section>
      )}

      {equipmentUnits.length > 0 && (
        <Section title={`Equipamento (${load.spaces}/${load.capacity} espaços${load.overloaded ? ' — SOBRECARREGADO' : ''})`}>
          <div className="space-y-2">
            {equipmentUnits.map(({ uid, item }) => {
              const mods = draft.equipmentModifications[uid] ?? []
              const curses = draft.equipmentCurses[uid] ?? []
              const effCat = getDraftInstanceCategory(draft, uid)
              const accessorySkills = formatAccessorySkills(draft, uid)
              const kitSkill = formatKitSkill(draft, uid)
              return (
                <p key={uid} className="text-parchment-500 text-xs">
                  <span className="font-semibold text-parchment-300">{getInstanceLabel(draft, uid)}</span> <span className="text-parchment-700">(Cat {CAT_ROMAN[effCat]}, {item.spaces} esp.)</span>
                  {item.type === 'weapon' && ` — ${item.damage} ${item.damageType} (Crítico: ${item.critical})`}
                  {item.type === 'protection' && ` — Defesa +${item.defenseBonus}`}
                  {accessorySkills && ` — ${accessorySkills}`}
                  {kitSkill && ` — ${kitSkill}`}
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
          <p className="text-parchment-700 text-xs mb-2">
            Bônus de maldições iguais em itens diferentes não se acumulam. Os bônus fixos (Defesa, atributos, PV/PE) já estão somados na ficha.
          </p>
          <div className="space-y-3">
            {cursedUnits.map(({ uid }) => {
              const price = formatUnitCursePrice(draft, uid)
              return (
                <div key={uid}>
                  <p className="text-purple-300 font-fantasy font-semibold text-sm">
                    {getInstanceLabel(draft, uid)}
                    {/* O preço da maldição (pág. 145), somado por elemento neste item. */}
                    {price && <span className="text-amber-500/90 font-normal text-xs"> · Preço: {price}</span>}
                  </p>
                  {(draft.equipmentCurses[uid] ?? []).map(cid => {
                    const curse = getCurse(cid)
                    if (!curse) return null
                    const detail = formatCurseChoiceDetail(curse, uid, draft.equipmentCurseChoices)
                    return (
                      <p key={cid} className="text-parchment-500 text-xs mt-1">
                        <span className="font-semibold text-purple-400">
                          {curse.name} ({formatCurseElement(curse, uid, draft.equipmentCurseChoices)}{detail ? ` — ${detail}` : ''}).
                        </span>{' '}
                        {resolveDtInText(draft, curse.effect)}
                      </p>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      <Section title={`Perícias Treinadas (${trainedSkills.length})`}>
        <div className="flex flex-wrap gap-1.5">
          {trainedSkills.map(sid => {
            const grade = getSkillGrade(draft, sid)
            const bonus = getSkillBonusTotal(draft, sid)
            return (
              <span key={sid} className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-gold-900/30 text-gold-400">
                {formatSkillWithAttribute(sid)}{grade !== 'treinado' && ` · ${grade}`}{bonus ? ` +${bonus}` : ''}
              </span>
            )
          })}
          {/* Bônus incondicionais em perícias NÃO treinadas (ex.: +5 Fortitude do Sangue de Ferro). */}
          {getSkillsWithUnconditionalBonus(draft)
            .filter(sid => !trainedSkills.includes(sid))
            .map(sid => (
              <span key={sid} className="px-2 py-0.5 rounded-md text-xs font-mono font-bold border border-gold-900 text-gold-600">
                {formatSkillWithAttribute(sid)} +{getSkillBonusTotal(draft, sid)} (habilidade)
              </span>
            ))}
        </div>
        {upgradedSkills.length === 0 && trainedSkills.length > 0 && (
          <p className="text-parchment-700 text-xs mt-2">Todas treinadas — nenhuma subiu de grau ainda.</p>
        )}
        {kitSkills.length > 0 && (
          <div className="mt-3 pt-3 border-t border-parchment-900/50 space-y-1">
            <p className="text-parchment-500 text-xs">
              <span className="font-semibold text-parchment-300">Kits que você tem:</span>{' '}
              {kitSkills.map(k => `${getSkillKitName(k.skillId)} (${k.source})`).join(' · ')}
            </p>
          </div>
        )}
        {conditionalSkillBonuses.length > 0 && (
          <div className="mt-3 pt-3 border-t border-parchment-900/50 space-y-1">
            <p className="text-parchment-600 text-xs">Bônus que valem só em situações específicas (não somados acima):</p>
            {conditionalSkillBonuses.map((b, i) => (
              <p key={i} className="text-parchment-500 text-xs">
                <span className="font-semibold text-parchment-300">
                  {b.skillIds.map(getSkillName).join(' e ')} +{b.value}
                </span>{' '}
                <span className="text-gold-600/90">({b.source}, {b.condition})</span>
              </p>
            ))}
          </div>
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

      <StepNav
        onPrev={prevStep}
        onNext={reset}
        blocked={missing.length > 0}
        pendingReason={missing.length > 0 ? formatMissingCount(missing.length) : undefined}
        nextLabel="Concluir ✓"
      />
    </div>
  )
}

/** Valor já calculado da habilidade, no fim da descrição dela (nunca numa linha própria). */
function ResolvedNote({ note }: { note: string | undefined }) {
  if (!note) return null
  return <span className="font-semibold text-gold-500/90"> — {note}.</span>
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
      <p className="text-parchment-700 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-gold-400 font-fantasy font-bold text-xl">{value}</p>
    </div>
  )
}

function AttrStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-parchment-700 text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-parchment-200 font-fantasy font-bold text-lg">{value}</p>
    </div>
  )
}
