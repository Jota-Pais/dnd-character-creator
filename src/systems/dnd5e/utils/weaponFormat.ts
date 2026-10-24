import type { Armor, DamageRoll, DamageType, Weapon, WeaponProperty } from '../types/equipment'
import type { AttackScope, WeaponAttackEffect } from '../types/effects'

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

function hasProperty(weapon: Weapon, kind: WeaponProperty['kind']): boolean {
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

/** A arma está no alcance do efeito? O golpe desarmado não é arma (p. 196): só `unarmed` o pega. */
export function isWeaponInScope(weapon: Weapon, scope: AttackScope): boolean {
  const melee = weapon.weaponType === 'melee'
  switch (scope) {
    case 'ranged': return weapon.weaponType === 'ranged'
    case 'melee-one-handed': return melee && !hasProperty(weapon, 'two-handed')
    case 'melee-two-handed': return melee && (hasProperty(weapon, 'two-handed') || hasProperty(weapon, 'versatile'))
    case 'melee-light': return melee && hasProperty(weapon, 'light')
    case 'unarmed': return false
  }
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

function formatRoll(damage: DamageRoll, mod: number): string {
  return `${formatDamageRoll(damage)}${mod !== 0 ? signed(mod) : ''}`
}

/** Um efeito de ataque com o nome de quem o dá (o `SheetEffect` de `sheetEffects`). */
export type SourcedAttackEffect = { source: string; value: WeaponAttackEffect }

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
  /** Efeitos de ataque possuídos (`getWeaponAttackEffects`): Estilo de Luta, Golpes de Chi. */
  effects?: SourcedAttackEffect[]
  /** Artes Marciais, só quando o equipamento deixa usá-la (sem armadura nem escudo). */
  martialArts?: ActiveMartialArts
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
   * Propriedades da arma (ex.: "acuidade, leve, arremesso (6/18 m)"), ou "" se não tiver.
   * Sem elas a ficha não diz o alcance de arremesso/munição.
   */
  properties: string
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
 * depende de como ela é empunhada vira nota com a condição (Duelismo, Armas Grandes, o ataque da
 * outra mão). Arma versátil leva o dano a duas mãos como segundo valor.
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

  for (const { source, value } of effects) {
    if (value.note) notes.push(`${value.note} (${source})`)
  }

  // Combater com duas armas (p. 196): o ataque da outra mão é de ação bônus e não soma o
  // modificador no dano, a menos que seja negativo — salvo com o Estilo de Luta (p. 85).
  if (isWeaponInScope(weapon, 'melee-light')) {
    const style = effects.find(e => e.value.offHandAddsModifier)
    notes.push(style
      ? `com outra arma leve na outra mão: ataque extra como ação bônus, somando o modificador no dano (${style.source})`
      : 'com outra arma leve na outra mão: ataque extra como ação bônus, sem somar o modificador no dano (a menos que seja negativo)')
  }

  return {
    name: weapon.name,
    ability: useDex ? 'Destreza' : 'Força',
    attackBonus: signed(attackBonus),
    proficient,
    damage,
    ...(versatileDamage ? { versatileDamage } : {}),
    properties: formatWeaponProperties(weapon.properties),
    notes,
  }
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
 * de arma (Arquearia, Duelismo) o alcança — só os de escopo `unarmed` (Golpes de Chi).
 */
export function getUnarmedStrike(ctx: UnarmedStrikeContext): WeaponAttack {
  const { strMod, dexMod, proficiencyBonus, martialArts, unarmedDie } = ctx
  const useDex = martialArts !== undefined && dexMod >= strMod
  const mod = useDex ? dexMod : strMod
  const die = Math.max(martialArts?.die ?? 0, unarmedDie?.value ?? 0)
  const roll: DamageRoll = die > 0 ? { dice: 1, sides: die } : { flat: 1 }
  const notes: string[] = []
  let attackBonus = proficiencyBonus + mod

  if (martialArts) notes.push(`inclui ${martialArts.source} (${martialArts.condition})`)
  else if (unarmedDie) notes.push(`inclui o d${unarmedDie.value} de ${unarmedDie.source}`)
  for (const { source, value } of ctx.effects ?? []) {
    if (value.weapons !== 'unarmed') continue
    if (value.attackBonus) {
      attackBonus += value.attackBonus
      notes.push(`inclui ${signed(value.attackBonus)} no ataque (${source})`)
    }
    if (value.note) notes.push(`${value.note} (${source})`)
  }
  if (martialArts) {
    notes.push(`depois de atacar com golpe desarmado ou arma de monge na ação de Atacar, um golpe desarmado como ação bônus (${martialArts.source})`)
  }

  return {
    name: UNARMED_STRIKE_NAME,
    ability: useDex ? 'Destreza' : 'Força',
    attackBonus: signed(attackBonus),
    proficient: true,
    damage: `${formatRoll(roll, mod)} ${DAMAGE_TYPE_PT.bludgeoning}`,
    properties: '',
    notes,
  }
}
