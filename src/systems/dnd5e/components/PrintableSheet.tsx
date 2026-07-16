import { useCharacterStore } from '../stores/characterStore'
import type { AbilityScore } from '../types/race'
import {
  getRace, getSubrace, getEffectiveSpeed, getEffectiveDarkvision, LANGUAGES, SKILLS,
  getAvailableInnateSpells, TOOL_NAMES,
} from '../utils/raceUtils'
import {
  getClass, getSubclass, isActiveCaster, getClassFeaturesUpToLevel,
} from '../utils/classUtils'
import {
  allClassEntries, getTotalHpAverage, getTotalHpRolled, getHitDicePool, getAllAsiChoices,
} from '../utils/multiclassUtils'
import { getBackground, getToolName } from '../utils/backgroundUtils'
import {
  calculateModifier, formatModifier, getProficiencyBonus, getPassivePerception,
  ALL_ABILITY_SCORES, ABILITY_LABELS,
} from '../utils/abilityScoreUtils'
import { getFinalAbilityScores } from '../utils/asiUtils'
import { getAllGrantedSkills, getAllGrantedTools } from '../utils/proficiencyUtils'
import { calculateArmorClass, getUnarmoredDefense } from '../utils/armorClassUtils'
import { getEquippedArmor, getItemName, getWeaponById } from '../utils/equipmentUtils'
import { getClassResources } from '../utils/classResourceUtils'
import { getSpell, getSpellSaveDC, formatSpellAttackBonus, getCombinedSpellSlots, getPactSlots } from '../utils/spellUtils'
import { getFeat } from '../utils/featUtils'
import { getWeaponAttack } from '../utils/weaponFormat'
import type { CharacterDraft } from '../types/character'
import type { EquipmentChoiceItem, Weapon } from '../types/equipment'

const SKILL_ABILITY: Record<string, AbilityScore> = {
  acrobatics: 'DEX', 'animal-handling': 'WIS', arcana: 'INT', athletics: 'STR',
  deception: 'CHA', history: 'INT', insight: 'WIS', intimidation: 'CHA',
  investigation: 'INT', medicine: 'WIS', nature: 'INT', perception: 'WIS',
  performance: 'CHA', persuasion: 'CHA', religion: 'INT', 'sleight-of-hand': 'DEX',
  stealth: 'DEX', survival: 'WIS',
}
const LANG_NAME = Object.fromEntries(LANGUAGES.map(l => [l.id, l.name]))

function metersLabel(feet: number): string {
  const m = feet * 0.3
  return Number.isInteger(m) ? `${m} m` : `${m.toFixed(1).replace('.', ',')} m`
}

function resolveOptionItems(option: EquipmentChoiceItem[], pickedIds: string[]): string[] {
  const result: string[] = []
  let pickIdx = 0
  for (const item of option) {
    if (item.kind === 'specific') {
      const name = getItemName(item.id)
      result.push(item.quantity > 1 ? `${item.quantity}× ${name}` : name)
    } else {
      const picks = item.picks
      result.push(...pickedIds.slice(pickIdx, pickIdx + picks).map(id => getItemName(id)))
      pickIdx += picks
    }
  }
  return result
}

/** Armas efetivamente equipadas (do equipamento inicial / compradas / antecedente), sem repetir. */
function gatherEquippedWeapons(draft: CharacterDraft): Weapon[] {
  const ids: string[] = []
  const cls = draft.class ? getClass(draft.class) : undefined
  const bg = draft.background ? getBackground(draft.background) : undefined
  const eq = draft.equipment

  if (eq.method === 'standard' && cls) {
    for (const item of cls.startingEquipment.fixed) ids.push(item.id)
    cls.startingEquipment.choices.forEach((choice, i) => {
      const res = eq.classResolutions[i]
      if (res && res.optionIndex >= 0) {
        const option = choice.options[res.optionIndex]
        if (!option) return
        let pickIdx = 0
        for (const item of option) {
          if (item.kind === 'specific') {
            ids.push(item.id)
          } else if (item.kind === 'weapon-filter' || item.kind === 'tool-filter' || item.kind === 'focus-group') {
            ids.push(...res.pickedIds.slice(pickIdx, pickIdx + item.picks))
            pickIdx += item.picks
          }
        }
      }
    })
  }
  if (eq.method === 'wealth') for (const p of eq.purchasedItems) ids.push(p.itemId)
  if (bg) for (const item of bg.equipment.items) if (item.kind === 'specific') ids.push(item.id)

  const seen = new Set<string>()
  const weapons: Weapon[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const w = getWeaponById(id)
    if (w) weapons.push(w)
  }
  return weapons
}

function gatherInventory(draft: CharacterDraft): string[] {
  const items: string[] = []
  const cls = draft.class ? getClass(draft.class) : undefined
  const bg = draft.background ? getBackground(draft.background) : undefined
  const eq = draft.equipment

  if (eq.method === 'standard' && cls) {
    for (const item of cls.startingEquipment.fixed) {
      items.push(item.quantity > 1 ? `${item.quantity}× ${getItemName(item.id)}` : getItemName(item.id))
    }
    cls.startingEquipment.choices.forEach((choice, i) => {
      const res = eq.classResolutions[i]
      if (res && res.optionIndex >= 0) {
        const option = choice.options[res.optionIndex]
        if (option) items.push(...resolveOptionItems(option, res.pickedIds))
      }
    })
  }
  if (eq.method === 'wealth') {
    for (const p of eq.purchasedItems) {
      items.push(p.quantity > 1 ? `${p.quantity}× ${getItemName(p.itemId)}` : getItemName(p.itemId))
    }
  }
  if (bg) {
    for (const item of bg.equipment.items) {
      if (item.kind === 'specific') {
        items.push(item.quantity > 1 ? `${item.quantity}× ${getItemName(item.id)}` : getItemName(item.id))
      }
    }
  }
  return items
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
  const wisMod = mod('WIS')

  // Combate
  const { bodyArmor, hasShield } = getEquippedArmor(draft.equipment, cls?.startingEquipment)
  const ac = calculateArmorClass({
    dexMod, conMod, wisMod, bodyArmor, hasShield,
    unarmoredDefense: getUnarmoredDefense(entries.find(e => e.classId === 'barbarian' || e.classId === 'monk')?.classId ?? cls?.id),
    hasDefenseFightingStyle: entries.some(e => e.classChoices.fightingStyle === 'defense'),
  }).value
  const hp: number | null = cls
    ? (draft.hpMethod === 'roll' ? getTotalHpRolled(draft, conMod) : getTotalHpAverage(draft, conMod))
    : null
  const speed = race ? getEffectiveSpeed(race, subrace) : 0
  const darkvision = race ? getEffectiveDarkvision(race, subrace) : 0

  const allSkills = getAllGrantedSkills(draft)
  const expertise = new Set(draft.classChoices.expertiseItems.filter(id => SKILL_ABILITY[id]))
  const passivePerception = getPassivePerception(
    wisMod, allSkills.includes('perception'),
    expertise.has('perception') ? prof * 2 : prof,
  )
  const saves = cls?.savingThrows ?? []
  const allTools = getAllGrantedTools(draft)

  const languages = [...new Set([
    ...(race?.grantedLanguages ?? []),
    ...(draft.raceChoices.languages ?? []),
    ...(draft.backgroundChoices.languages ?? []),
  ])]

  const classLabel = entries.map(e => {
    const ec = getClass(e.classId)
    const sub = ec && e.classChoices.subclass ? getSubclass(ec, e.classChoices.subclass) : null
    return `${ec?.name ?? e.classId} ${e.level}°${sub ? ` (${sub.name})` : ''}`
  }).join(' / ')
  const identity = [
    subrace ? subrace.name : race?.name,
    cls ? `${classLabel}${isMc ? ` — nível ${level}` : ` nível ${level}`}` : `Nível ${level}`,
    bg?.name,
  ].filter(Boolean).join(' · ')

  // Features por classe (multiclasse): cada classe no nível que tem nela.
  const featureBlocks = entries.map(e => {
    const ec = getClass(e.classId)
    const sub = ec && e.classChoices.subclass ? getSubclass(ec, e.classChoices.subclass) : null
    return { e, ec, features: ec ? getClassFeaturesUpToLevel(ec, sub ?? null, e.level) : [] }
  })
  const featsFromAsi = getAllAsiChoices(draft).filter(c => c.kind === 'feat' && c.featId).map(c => (c as { featId: string }).featId)
  const featIds = [...new Set([...(draft.raceChoices.feat ? [draft.raceChoices.feat] : []), ...featsFromAsi])]
  const feats = featIds.map(id => getFeat(id)).filter(Boolean)
  const resourceBlocks = entries
    .map(e => ({ e, resources: getClassResources(e.classId, e.level) }))
    .filter(b => b.resources.length > 0)
  const inventory = gatherInventory(draft)

  // Ataques por arma equipada (F5). Ataque Extra NÃO empilha entre classes (PHB): usa o máximo.
  const weapons = gatherEquippedWeapons(draft)
  const strMod = mod('STR')
  const attacksPerAction = 1 + Math.max(0, ...featureBlocks.map(b => b.features.filter(f => f.name === 'Ataque Extra').length))
  const innateSpells = race ? getAvailableInnateSpells(race, subrace, level) : []
  const racialCantrip = draft.raceChoices.cantrip ? getSpell(draft.raceChoices.cantrip) : undefined

  const casters = entries.flatMap(e => {
    const ec = getClass(e.classId)
    return ec && ec.spellcasting && isActiveCaster(ec, e.level) ? [{ e, ec }] : []
  })
  const isCaster = casters.length > 0

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
        <Stat label="Iniciativa" value={formatModifier(dexMod)} />
        <Stat label="Pontos de Vida" value={hp !== null ? String(hp) : '—'} />
        <Stat label="Dados de Vida" value={cls ? getHitDicePool(draft).map(p => `${p.count}d${p.die}`).join(' + ') : '—'} />
        <Stat label="Deslocamento" value={metersLabel(speed)} />
        <Stat label="Percepção Passiva" value={String(passivePerception)} />
        <Stat label="Visão no Escuro" value={darkvision > 0 ? metersLabel(darkvision) : '—'} />
        <Stat label="Nível" value={String(level)} />
      </Grid>

      {/* Controle de sessão — espaços em branco pra preencher a lápis na mesa */}
      <Box title="Controle de Sessão (preencha a lápis)" className="mb-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-700 items-baseline">
          <span>PV Atual: <span className="inline-block border-b border-gray-500 w-14" />{hp !== null ? ` / ${hp}` : ''}</span>
          <span>PV Temporário: <span className="inline-block border-b border-gray-500 w-14" /></span>
          <span>Testes contra a Morte — Sucessos: ○ ○ ○ · Falhas: ○ ○ ○</span>
        </div>
      </Box>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Resistências */}
        <Box title="Testes de Resistência">
          {ALL_ABILITY_SCORES.map(ab => {
            const proficient = saves.includes(ab)
            const val = mod(ab) + (proficient ? prof : 0)
            return (
              <Row key={ab} mark={proficient} label={ABILITY_LABELS[ab].long} value={formatModifier(val)} />
            )
          })}
        </Box>

        {/* Perícias */}
        <Box title="Perícias">
          {SKILLS.map(skill => {
            const ability = SKILL_ABILITY[skill.id]
            const proficient = allSkills.includes(skill.id)
            const exp = expertise.has(skill.id)
            const val = mod(ability) + (proficient ? prof : 0) + (exp ? prof : 0)
            return (
              <Row
                key={skill.id}
                mark={proficient}
                expertise={exp}
                label={`${skill.name} (${ABILITY_LABELS[ability].short})`}
                value={formatModifier(val)}
              />
            )
          })}
        </Box>
      </div>

      {/* Ataques & Magia */}
      <Box title="Ataques & Conjuração" className="mb-4">
        {weapons.length > 0 ? (
          <table className="w-full text-xs mb-1">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="font-semibold pr-2">Arma</th>
                <th className="font-semibold pr-2">Ataque</th>
                <th className="font-semibold pr-2">Dano</th>
                <th className="font-semibold">Atributo</th>
              </tr>
            </thead>
            <tbody>
              {weapons.map(w => {
                const atk = getWeaponAttack(w, strMod, dexMod, prof)
                return (
                  <tr key={w.id} className="text-gray-800">
                    <td className="pr-2 py-0.5">
                      {attacksPerAction > 1 && <span className="font-bold text-gray-500">{attacksPerAction}× </span>}
                      {atk.name}
                    </td>
                    <td className="pr-2 py-0.5"><strong>{atk.attackBonus}</strong></td>
                    <td className="pr-2 py-0.5">{atk.damage}</td>
                    <td className="py-0.5 text-gray-600">{atk.ability}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-gray-700 mb-1">
            Ataque corpo-a-corpo (Força): <strong>{formatModifier(prof + strMod)}</strong> ·
            {' '}À distância / com acuidade (Destreza): <strong>{formatModifier(prof + dexMod)}</strong>
            {' '}(+ o dano da arma)
          </p>
        )}
        {attacksPerAction > 1 && weapons.length > 0 && (
          <p className="text-[10px] text-gray-500 mb-1">
            Ataque Extra: você faz {attacksPerAction} ataques ao usar a ação de Atacar.
          </p>
        )}
        {casters.map(({ e, ec }) => (
          <p key={e.classId} className="text-xs text-gray-700">
            {isMc && <strong>{ec.name} — </strong>}Magia · CD: <strong>{getSpellSaveDC(ec.spellcasting!, finalScores, level)}</strong> ·
            {' '}Ataque: <strong>{formatSpellAttackBonus(ec.spellcasting!, finalScores, level)}</strong> ·
            {' '}Atributo: {ABILITY_LABELS[ec.spellcasting!.ability].short}
          </p>
        ))}
      </Box>

      {/* Magias — pool combinado + Pacto; listas por classe conjuradora */}
      {isCaster && (() => {
        const slots = getCombinedSpellSlots(draft).map((count, i) => ({ lvl: i + 1, count })).filter(s => s.count > 0)
        const pact = getPactSlots(draft)
        return (
          <Box title="Magias" className="mb-4">
            {slots.length > 0 && (
              <p className="text-xs mb-1">
                <span className="text-gray-600">Espaços (marque os gastos): </span>
                {slots.map(s => `${s.lvl}º: ${trackCircles(s.count) || s.count}`).join(' · ')}
              </p>
            )}
            {pact && (
              <p className="text-xs mb-1">
                <span className="text-gray-600">Magia de Pacto: </span>
                {pact.slotLevel}º: {trackCircles(pact.slots) || pact.slots} (recupera em descanso curto)
              </p>
            )}
            {casters.map(({ e, ec }) => {
              const cantrips = e.spellChoices.cantrips.map(id => getSpell(id)?.name).filter(Boolean)
              const spells = e.spellChoices.spells.map(id => getSpell(id)).filter(Boolean)
              const byLevel = new Map<number, string[]>()
              for (const s of spells) { const a = byLevel.get(s!.level) ?? []; a.push(s!.name); byLevel.set(s!.level, a) }
              if (cantrips.length === 0 && spells.length === 0) return null
              return (
                <div key={e.classId} className="mb-1">
                  {isMc && <p className="text-xs font-bold text-gray-700 mt-1">{ec.name}</p>}
                  {cantrips.length > 0 && <p className="text-xs mb-0.5"><span className="text-gray-600">Truques: </span>{cantrips.join(', ')}</p>}
                  {[...byLevel.keys()].sort((a, b) => a - b).map(lvl => (
                    <p key={lvl} className="text-xs mb-0.5"><span className="text-gray-600">{lvl}º nível: </span>{byLevel.get(lvl)!.join(', ')}</p>
                  ))}
                </div>
              )
            })}
          </Box>
        )
      })()}

      {/* Recursos de classe (por classe) */}
      {resourceBlocks.length > 0 && (
        <Box title="Recursos de Classe" className="mb-4">
          {resourceBlocks.map(({ e, resources }) => (
            <p key={e.classId} className="text-xs mb-0.5">
              {isMc && <span className="font-bold text-gray-700">{getClass(e.classId)?.name}: </span>}
              {resources.map(r => {
                // Recursos que são um número de usos (Fúrias, Ki...) ganham círculos pra marcar;
                // os que são dado (Ataque Furtivo 2d6, Artes Marciais d6) ficam só com o valor.
                const isPool = /^\d+$/.test(String(r.value))
                const circles = isPool ? trackCircles(Number(r.value)) : ''
                return `${r.label}: ${r.value}${circles ? ` ${circles}` : ''}`
              }).join(' · ')}
            </p>
          ))}
        </Box>
      )}

      {/* Proficiências & Idiomas */}
      <Box title="Proficiências & Idiomas" className="mb-4">
        {allTools.length > 0 && <p className="text-xs mb-0.5"><span className="text-gray-600">Ferramentas: </span>{allTools.map(t => TOOL_NAMES[t] ?? getToolName(t)).join(', ')}</p>}
        <p className="text-xs"><span className="text-gray-600">Idiomas: </span>{languages.map(l => LANG_NAME[l] ?? l).join(', ') || '—'}</p>
      </Box>

      {/* Magias raciais */}
      {(innateSpells.length > 0 || racialCantrip) && (
        <Box title="Magias Raciais" className="mb-4">
          {racialCantrip && <p className="text-xs">{racialCantrip.name} (truque)</p>}
          {innateSpells.map(s => {
            const spell = getSpell(s.spellId)
            return spell ? <p key={s.spellId} className="text-xs">{spell.name} — {spell.level === 0 ? 'truque' : '1×/descanso longo'} ({ABILITY_LABELS[s.ability].short})</p> : null
          })}
        </Box>
      )}

      {/* Traços & Features */}
      <Box title="Traços Raciais" className="mb-4">
        {[...(race?.traits ?? []), ...(subrace?.traits ?? [])].map(t => (
          <p key={t.name} className="text-xs mb-1"><strong>{t.name}.</strong> {t.description}</p>
        ))}
      </Box>

      {featureBlocks.some(b => b.features.length > 0) && (
        <Box title="Habilidades de Classe" className="mb-4">
          {featureBlocks.map(({ e, ec, features }) => features.length > 0 && (
            <div key={e.classId} className="mb-1">
              {isMc && <p className="text-xs font-bold text-gray-700">{ec?.name} {e.level}°</p>}
              {features.map((f, i) => (
                <p key={`${f.name}-${i}`} className="text-xs mb-1"><strong>{f.name}</strong> (nv {f.level}). {f.description}</p>
              ))}
            </div>
          ))}
        </Box>
      )}

      {feats.length > 0 && (
        <Box title="Talentos" className="mb-4">
          {feats.map(f => (
            <p key={f!.id} className="text-xs mb-1"><strong>{f!.name}.</strong> {f!.description}</p>
          ))}
        </Box>
      )}

      {/* Inventário */}
      <Box title="Equipamento & Inventário" className="mb-2">
        {draft.equipment.method === 'wealth' && draft.equipment.rolledGold !== null && (
          <p className="text-xs mb-1"><span className="text-gray-600">Riqueza inicial: </span>{draft.equipment.rolledGold} po</p>
        )}
        <p className="text-xs">{inventory.length > 0 ? inventory.join(' · ') : '—'}</p>
      </Box>
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
