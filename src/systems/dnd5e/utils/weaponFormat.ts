import type { Armor, DamageRoll, DamageType, Weapon, WeaponProperty } from '../types/equipment'
import type { AttackScope, LoadingOverride, WeaponAttackEffect } from '../types/effects'

/** Nomes em português dos tipos de dano (padrão do PHB pt-BR, como usado em classes.json). */
export const DAMAGE_TYPE_PT: Record<DamageType, string> = {
  bludgeoning: 'concussão',
  piercing: 'perfurante',
  slashing: 'cortante',
}

/** "1d8", "2d6", "1" (dano fixo) ou "—" (sem dano). */
export function formatDamageRoll(damage: DamageRoll | null): string {
  if (!damage) return '—'
  if ('dice' in damage && damage.dice) {
    const base = `${damage.dice}d${damage.sides}`
    return damage.flat ? `${base}+${damage.flat}` : base
  }
  return String(damage.flat)
}

/** "1d8 perfurante" (dano + tipo). */
export function formatWeaponDamage(weapon: Weapon): string {
  if (!weapon.damage) return '—'
  const type = weapon.damageType ? ` ${DAMAGE_TYPE_PT[weapon.damageType]}` : ''
  return `${formatDamageRoll(weapon.damage)}${type}`
}

/** Rótulo em português de uma propriedade de arma (com os detalhes: alcance, dado versátil...). */
export function formatWeaponProperty(p: WeaponProperty): string {
  switch (p.kind) {
    case 'finesse': return 'acuidade'
    case 'heavy': return 'pesada'
    case 'light': return 'leve'
    case 'loading': return 'recarga'
    case 'reach': return 'alcance'
    case 'special': return 'especial'
    case 'two-handed': return 'duas mãos'
    case 'versatile': return `versátil (${formatDamageRoll(p.alternateDamage)})`
    case 'thrown': return `arremesso (${p.normalRange}/${p.longRange} m)`
    case 'ammunition': return `munição (${p.normalRange}/${p.longRange} m)`
    case 'range': return `alcance (${p.normalRange}/${p.longRange} m)`
  }
}

/** Lista de propriedades em português, separadas por vírgula (vazia se não houver). */
export function formatWeaponProperties(properties: WeaponProperty[]): string {
  return properties.map(formatWeaponProperty).join(', ')
}

/** Resumo compacto de uma arma: "1d8 perfurante · acuidade, leve". */
export function formatWeaponSummary(weapon: Weapon): string {
  const props = formatWeaponProperties(weapon.properties)
  const damage = formatWeaponDamage(weapon)
  return props ? `${damage} · ${props}` : damage
}

/** Resumo compacto de uma armadura/escudo: "CA 14 + Des (máx. +2) · Força 13, desv. em Furtividade". */
export function formatArmorSummary(armor: Armor): string {
  let ac: string
  if (armor.category === 'shield') ac = 'CA +2 (escudo)'
  else if (armor.dexModifier === 'full') ac = `CA ${armor.acBase} + Des`
  else if (armor.dexModifier === 'max-2') ac = `CA ${armor.acBase} + Des (máx. +2)`
  else ac = `CA ${armor.acBase}`
  const props: string[] = []
  if (armor.strengthRequirement) props.push(`Força ${armor.strengthRequirement}`)
  if (armor.stealthDisadvantage) props.push('desv. em Furtividade')
  return props.length ? `${ac} · ${props.join(', ')}` : ac
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

export function hasProperty(weapon: Weapon, kind: WeaponProperty['kind']): boolean {
  return weapon.properties.some(p => p.kind === kind)
}

/**
 * Arma de monge: "as espadas curtas e quaisquer armas simples corpo-a-corpo que não tenham a
 * propriedade duas mãos ou pesada" (p. 104). O dardo é simples mas à distância — não entra.
 */
export function isMonkWeapon(weapon: Weapon): boolean {
  return weapon.id === 'shortsword' || (
    weapon.category === 'simple' && weapon.weaponType === 'melee'
    && !hasProperty(weapon, 'two-handed') && !hasProperty(weapon, 'heavy')
  )
}

/**
 * A arma está no alcance do efeito? O golpe desarmado não é arma (p. 196) e tem a pergunta dele,
 * `isUnarmedStrikeInScope`.
 */
export function isWeaponInScope(weapon: Weapon, scope: AttackScope): boolean {
  const melee = weapon.weaponType === 'melee'
  switch (scope) {
    case 'ranged': return weapon.weaponType === 'ranged'
    case 'melee-one-handed': return melee && !hasProperty(weapon, 'two-handed')
    case 'melee-two-handed': return melee && (hasProperty(weapon, 'two-handed') || hasProperty(weapon, 'versatile'))
    case 'melee-light': return melee && hasProperty(weapon, 'light')
    // Toda arma corpo a corpo pode atacar com Força; o que a linha não cumpre vai na nota.
    case 'melee-strength': return melee
    case 'weapon-attack': return true
    case 'unarmed': return false
  }
}

/**
 * O golpe desarmado está no alcance do efeito? Ele não é arma (p. 196), então os escopos de arma
 * (Arquearia, Duelismo, Armas Grandes, duas armas) não o pegam; mas é ataque corpo a corpo com
 * arma — "melee weapon attack" no inglês, que os dados seguem (decisão do dono de 2026-10-29) —,
 * e os escopos que falam do ataque, não da arma (`melee-strength`, o Dano de Fúria;
 * `weapon-attack`, a margem do Campeão), o alcançam.
 */
export function isUnarmedStrikeInScope(scope: AttackScope): boolean {
  switch (scope) {
    case 'unarmed':
    case 'melee-strength':
    case 'weapon-attack': return true
    case 'ranged':
    case 'melee-one-handed':
    case 'melee-two-handed':
    case 'melee-light': return false
  }
}

/**
 * O que a linha não cumpre do escopo `melee-strength` ("ataque com arma corpo a corpo usando
 * Força", p. 48), dito depois da condição: a linha que usa Destreza (acuidade, Artes Marciais na
 * arma de monge e no golpe desarmado) vale atacando com Força, e a arma de arremesso só sem
 * arremessar — arremessar é ataque à distância (p. 149 e 196). Vazio fora desse escopo e quando a
 * linha já cumpre.
 */
function scopeCaveat(scope: AttackScope, useDex: boolean, thrown: boolean): string {
  if (scope !== 'melee-strength') return ''
  if (!useDex && !thrown) return ''
  const how = [thrown ? 'corpo a corpo' : '', useDex ? 'com Força em vez de Destreza' : ''].filter(Boolean).join(' ')
  return `, atacando ${how}${thrown ? ', sem arremessar' : ''}`
}

/** Média de uma rolagem de dano — para comparar o dano da arma com o dado de Artes Marciais. */
function averageDamage(damage: DamageRoll): number {
  if ('dice' in damage && damage.dice) return (damage.dice * (damage.sides + 1)) / 2 + (damage.flat ?? 0)
  return damage.flat ?? 0
}

/**
 * O dano normal ou o dado de Artes Marciais, o que for maior. O livro deixa escolher ("você pode
 * rolar um d4 no lugar do dano normal", p. 104); a ficha mostra o maior, que nunca é pior.
 */
function withMartialArtsDie(damage: DamageRoll, die: number | undefined): DamageRoll {
  if (!die || averageDamage(damage) >= (die + 1) / 2) return damage
  return { dice: 1, sides: die }
}

/**
 * O dano com o modificador. Sem dado (golpe desarmado, zarabatana), a conta sai resolvida — "1+4"
 * vira 5 e "1-1" vira 0; com dado, o fixo da arma e o modificador viram um número só ("1d8+3").
 * O dano fixo tem piso 0: Força 6-7 no golpe desarmado ou Destreza baixa na zarabatana dão 0, não
 * -1 (decisão do usuário, 2026-10-25). Com dado, o modificador negativo fica na expressão
 * ("1d4-2"): a ficha não rola o dado.
 */
function formatRoll(damage: DamageRoll, mod: number): string {
  if (!('dice' in damage && damage.dice)) return String(Math.max(0, (damage.flat ?? 0) + mod))
  const bonus = (damage.flat ?? 0) + mod
  return `${damage.dice}d${damage.sides}${bonus !== 0 ? signed(bonus) : ''}`
}

/**
 * O `conditionalDamage` de um efeito já calculado para o personagem (`getWeaponAttackEffects`): o
 * valor do recurso no nível NA classe dona, o nome dele ("Dano de Fúria") e a condição;
 * `blockedBy` é o que, no equipamento, descumpre a condição agora (a armadura pesada vestida).
 */
export type ResolvedConditionalDamage = { value: number; name: string; condition: string; blockedBy?: string }

/**
 * Um efeito de ataque com o nome de quem o dá (o `SheetEffect` de `sheetEffects`) e, se ele declara
 * `conditionalDamage`, o bônus já calculado — sem este, a declaração sozinha não vira nota.
 */
export type SourcedAttackEffect = {
  source: string
  value: WeaponAttackEffect
  conditionalDamage?: ResolvedConditionalDamage
}

/** O dano fixo de uma linha sem dado (golpe desarmado, zarabatana): o valor da arma e o modificador. */
type FixedDamage = { base: number; mod: number }

/** "1 − 2 + 2": a conta escrita, com o sinal separado do número. */
const spacedSigned = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`)

/**
 * "+2 de dano em fúria, sem armadura pesada (Dano de Fúria)", com a ressalva da linha e o bloqueio.
 * No dano fixo que dá 0 ou menos, a linha mostra 0 ("não causa dano") e somar o bônus a ele pode
 * errar: o piso 0 é sobre o total (decisão 14 de `regras-dano-e-morte.md`), e o golpe desarmado com
 * Força 6-7 em fúria causa 1 − 2 + 2 = 1, não 0 + 2. Aí a nota diz a conta inteira. Com ressalva, a
 * linha usa outro modificador e não há conta a dizer (linha de dano fixo com Destreza não existe).
 */
function formatConditionalDamage(bonus: ResolvedConditionalDamage, caveat: string, fixed?: FixedDamage): string {
  let text = `${signed(bonus.value)} de dano ${bonus.condition}${caveat} (${bonus.name})`
  if (fixed && !caveat && fixed.base + fixed.mod <= 0) {
    const sum = fixed.base + fixed.mod + bonus.value
    const sumText = `${fixed.base} ${spacedSigned(fixed.mod)} ${spacedSigned(bonus.value)}${sum < 0 ? ', mínimo 0' : ''}`
    text += `: com ele, o dano é ${Math.max(0, sum)} (${sumText})`
  }
  return bonus.blockedBy ? `${text} — não vale agora: você está de ${bonus.blockedBy}` : text
}

/**
 * As notas dos efeitos que alcançam a linha, da arma ou do golpe desarmado: a `note` e o bônus de
 * dano condicional, com a ressalva do que a linha não cumpre do escopo (`scopeCaveat`). `fixed`: o
 * dano da linha sem dado, para a conta do bônus quando o piso 0 cortou.
 */
function pushEffectNotes(
  notes: string[], effects: SourcedAttackEffect[], useDex: boolean, thrown: boolean, fixed?: FixedDamage,
) {
  for (const { source, value, conditionalDamage } of effects) {
    const caveat = scopeCaveat(value.weapons, useDex, thrown)
    if (value.note) notes.push(`${value.note}${caveat} (${source})`)
    if (conditionalDamage) notes.push(formatConditionalDamage(conditionalDamage, caveat, fixed))
  }
}

/** Artes Marciais em vigor — quem chama já conferiu o equipamento. */
export type ActiveMartialArts = { source: string; die: number; condition: string }

/** Tudo o que a linha de ataque precisa do personagem, já calculado. */
export type AttackContext = {
  strMod: number
  dexMod: number
  proficiencyBonus: number
  /**
   * Se o personagem é proficiente com a arma (p. 148); sem isso, o bônus de proficiência não
   * entra. Quem decide é `hasWeaponProficiency` (proficiencyUtils); o campo é obrigatório para
   * nenhuma chamada esquecer a pergunta.
   */
  proficient: boolean
  /** Efeitos de ataque possuídos (`getWeaponAttackEffects`): Estilo de Luta, Golpes de Chi, Fúria. */
  effects?: SourcedAttackEffect[]
  /** Artes Marciais, só quando o equipamento deixa usá-la (sem armadura nem escudo). */
  martialArts?: ActiveMartialArts
  /** Ataques da ação de Atacar e quem os dá (`getAttacksPerAction`: Ataque Extra). Sem ele, 1. */
  attacksPerAction?: { value: number; source: string | null }
  /** O que ignora a propriedade recarga (`getLoadingOverrides`: Especialista em Besta). */
  loadingOverrides?: { source: string; value: LoadingOverride }[]
  /**
   * Se o personagem carrega duas armas leves corpo a corpo (`carriesTwoLightMeleeWeapons`). Sem
   * isso, a regra-base do ataque da outra mão (p. 196) fica fora da linha — só o Estilo de Luta
   * Combate com Duas Armas a mostra mesmo assim.
   */
  twoLightMeleeWeapons?: boolean
}

export type WeaponAttack = {
  name: string
  /** Atributo usado no ataque: "Força" ou "Destreza". */
  ability: string
  /** Bônus de ataque já com sinal (ex.: "+5"). Sem proficiência na arma, só o modificador. */
  attackBonus: string
  /** Se o personagem é proficiente com a arma (p. 148); sem isso, o bônus de proficiência não entra. */
  proficient: boolean
  /** Dano com o modificador e o tipo (ex.: "1d8+3 perfurante"). */
  damage: string
  /** Dano empunhando com as duas mãos, da arma versátil (ex.: "1d10+3"), sem o tipo — é o mesmo. */
  versatileDamage?: string
  /**
   * O valor fixo do dano sem dado, antes do modificador (golpe desarmado e zarabatana: 1). O `damage`
   * já sai com o piso 0, e o modo de jogo precisa da conta aberta para dizer de onde veio o 0.
   */
  fixedDamageBase?: number
  /**
   * Propriedades da arma (ex.: "acuidade, leve, arremesso (6/18 m)"), ou "" se não tiver.
   * Sem elas a ficha não diz o alcance de arremesso/munição.
   */
  properties: string
  /**
   * Quantos ataques a ação de Atacar faz com esta arma — o "2×" da linha. É o Ataque Extra, salvo
   * em arma de recarga, que dispara uma vez por ação (p. 149).
   */
  attacksPerAction: number
  /**
   * O que fica FORA do número, cada um com a condição e a fonte (Duelismo, Armas Grandes, o ataque
   * da outra mão), e o que já foi somado nele, pra o jogador saber de onde veio.
   */
  notes: string[]
}

/** "1d8+3 cortante (1d10+3 a duas mãos)": o dano da linha, com o versátil quando houver. */
export function formatAttackDamage(attack: WeaponAttack): string {
  return attack.versatileDamage
    ? `${attack.damage} (${attack.versatileDamage} a duas mãos)`
    : attack.damage
}

/**
 * Ataque de uma arma. Escolhe o atributo — o melhor dos dois para arma de acuidade (p. 148), mesmo
 * à distância como o dardo, e, com Artes Marciais, para arma de monge; fora disso Destreza para
 * arma à distância e Força para corpo a corpo, inclusive as de arremesso (p. 195: "Acuidade ou
 * Arremesso quebram essa regra") — e soma o modificador no ataque e no dano.
 *
 * Aplica a regra de ouro dos efeitos: o que vale SEMPRE com aquela arma entra no número
 * (Arquearia numa arma à distância; Artes Marciais numa arma de monge, com o dado maior); o que
 * depende de como ela é empunhada ou da situação vira nota com a condição (Duelismo, Armas
 * Grandes, o ataque da outra mão, o Dano de Fúria). Arma versátil leva o dano a duas mãos como
 * segundo valor.
 *
 * O bônus de proficiência só entra se `proficient` — "Se você realizar uma jogada de ataque
 * utilizando uma arma com a qual não tenha proficiência, não adiciona seu bônus de proficiência
 * na jogada de ataque" (p. 148).
 */
export function getWeaponAttack(weapon: Weapon, ctx: AttackContext): WeaponAttack {
  const { strMod, dexMod, proficiencyBonus, proficient } = ctx
  const effects = (ctx.effects ?? []).filter(e => isWeaponInScope(weapon, e.value.weapons))
  const martialArts = ctx.martialArts && isMonkWeapon(weapon) ? ctx.martialArts : undefined

  const finesse = hasProperty(weapon, 'finesse')
  const useDex = finesse || martialArts !== undefined ? dexMod >= strMod : weapon.weaponType === 'ranged'
  const mod = useDex ? dexMod : strMod
  const notes: string[] = []

  let attackBonus = (proficient ? proficiencyBonus : 0) + mod
  for (const { source, value } of effects) {
    if (!value.attackBonus) continue
    attackBonus += value.attackBonus
    notes.push(`inclui ${signed(value.attackBonus)} no ataque (${source})`)
  }

  const type = weapon.damageType ? ` ${DAMAGE_TYPE_PT[weapon.damageType]}` : ''
  const roll = weapon.damage ? withMartialArtsDie(weapon.damage, martialArts?.die) : null
  const damage = roll ? `${formatRoll(roll, mod)}${type}` : '—'

  const versatile = weapon.properties.find(p => p.kind === 'versatile')
  const versatileRoll = versatile ? withMartialArtsDie(versatile.alternateDamage, martialArts?.die) : null
  const versatileDamage = versatileRoll && roll && formatDamageRoll(versatileRoll) !== formatDamageRoll(roll)
    ? formatRoll(versatileRoll, mod)
    : undefined

  // Artes Marciais só ganha nota quando mudou alguma coisa: a Destreza no lugar da Força numa arma
  // sem acuidade, ou o dado dela no lugar do da arma.
  if (martialArts && ((useDex && !finesse && dexMod > strMod) || roll !== weapon.damage)) {
    notes.push(`inclui ${martialArts.source} (${martialArts.condition})`)
  }

  const fixed = roll && !('dice' in roll && roll.dice) ? { base: roll.flat ?? 0, mod } : undefined
  pushEffectNotes(notes, effects, useDex, hasProperty(weapon, 'thrown'), fixed)

  const attacksPerAction = getWeaponAttacksPerAction(weapon, ctx, notes)

  // Combater com duas armas (p. 196): o ataque da outra mão é de ação bônus e não soma o
  // modificador no dano, a menos que seja negativo — salvo com o Estilo de Luta (p. 85). A
  // regra-base só aparece pra quem carrega duas armas leves; o Estilo, sempre.
  if (isWeaponInScope(weapon, 'melee-light')) {
    const style = effects.find(e => e.value.offHandAddsModifier)
    if (style) {
      notes.push(`com outra arma leve na outra mão: ataque extra como ação bônus, somando o modificador no dano (${style.source})`)
    } else if (ctx.twoLightMeleeWeapons) {
      notes.push('com outra arma leve na outra mão: ataque extra como ação bônus, sem somar o modificador no dano (a menos que seja negativo)')
    }
  }

  return {
    name: weapon.name,
    ability: useDex ? 'Destreza' : 'Força',
    attackBonus: signed(attackBonus),
    proficient,
    damage,
    ...(versatileDamage ? { versatileDamage } : {}),
    ...(roll && !('dice' in roll && roll.dice) ? { fixedDamageBase: roll.flat ?? 0 } : {}),
    properties: formatWeaponProperties(weapon.properties),
    attacksPerAction,
    notes,
  }
}

/**
 * Os ataques da ação de Atacar com esta arma. Arma de recarga dispara "apenas uma peça de munição
 * da arma quando usa uma ação, ação bônus, ou reação para disparar, não importando quantos ataques
 * você possua" (p. 149): fica em 1, com nota quando isso tira ataques do personagem. O Especialista
 * em Besta ignora a recarga das bestas com que se é proficiente (p. 169) — aí vale o total.
 */
function getWeaponAttacksPerAction(weapon: Weapon, ctx: AttackContext, notes: string[]): number {
  const total = ctx.attacksPerAction?.value ?? 1
  if (!hasProperty(weapon, 'loading') || total <= 1) return total
  const override = (ctx.loadingOverrides ?? []).find(({ value }) =>
    value.weapons.includes(weapon.id) && (ctx.proficient || !value.requiresProficiency))
  if (override) {
    notes.push(`inclui ${override.source} (ignora a recarga)`)
    return total
  }
  const from = ctx.attacksPerAction?.source ? ` de ${ctx.attacksPerAction.source}` : ''
  notes.push(`recarga: um disparo por ação, ação bônus ou reação, mesmo com os ${total} ataques${from}`)
  return 1
}

export const UNARMED_STRIKE_NAME = 'Golpe desarmado'

export type UnarmedStrikeContext = Omit<AttackContext, 'proficient'> & {
  /** Dado que uma característica dá ao golpe desarmado (Especialista em Briga: 4). */
  unarmedDie?: { source: string; value: number }
}

/**
 * O golpe desarmado — soco, chute, cabeçada — que todo personagem tem: "causa dano de concussão
 * igual a 1 + seu modificador de Força. Você é proficiente com seus ataques desarmados" (p. 196).
 *
 * Com Artes Marciais (p. 104), pode usar Destreza e rolar o dado dela; com o Especialista em
 * Briga (p. 169), rola 1d4. Os dois juntos: fica o maior dado. Não é arma, então nenhum efeito
 * de arma (Arquearia, Duelismo) o alcança; é ataque corpo a corpo com arma (p. 196, pelo inglês),
 * então o de `melee-strength` (Dano de Fúria) sim, além dos de `unarmed` (Golpes de Chi).
 */
export function getUnarmedStrike(ctx: UnarmedStrikeContext): WeaponAttack {
  const { strMod, dexMod, proficiencyBonus, martialArts, unarmedDie } = ctx
  const effects = (ctx.effects ?? []).filter(e => isUnarmedStrikeInScope(e.value.weapons))
  const useDex = martialArts !== undefined && dexMod >= strMod
  const mod = useDex ? dexMod : strMod
  const die = Math.max(martialArts?.die ?? 0, unarmedDie?.value ?? 0)
  const roll: DamageRoll = die > 0 ? { dice: 1, sides: die } : { flat: 1 }
  const notes: string[] = []
  let attackBonus = proficiencyBonus + mod

  if (martialArts) notes.push(`inclui ${martialArts.source} (${martialArts.condition})`)
  else if (unarmedDie) notes.push(`inclui o d${unarmedDie.value} de ${unarmedDie.source}`)
  for (const { source, value } of effects) {
    if (!value.attackBonus) continue
    attackBonus += value.attackBonus
    notes.push(`inclui ${signed(value.attackBonus)} no ataque (${source})`)
  }
  pushEffectNotes(notes, effects, useDex, false, die > 0 ? undefined : { base: 1, mod })
  if (martialArts) {
    notes.push(`depois de atacar com golpe desarmado ou arma de monge na ação de Atacar, um golpe desarmado como ação bônus (${martialArts.source})`)
  }

  return {
    name: UNARMED_STRIKE_NAME,
    ability: useDex ? 'Destreza' : 'Força',
    attackBonus: signed(attackBonus),
    proficient: true,
    damage: `${formatRoll(roll, mod)} ${DAMAGE_TYPE_PT.bludgeoning}`,
    ...(die > 0 ? {} : { fixedDamageBase: 1 }),
    properties: '',
    attacksPerAction: ctx.attacksPerAction?.value ?? 1,
    notes,
  }
}
