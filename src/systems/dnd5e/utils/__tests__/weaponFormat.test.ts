import { describe, it, expect } from 'vitest'
import {
  formatDamageRoll,
  formatWeaponDamage,
  formatWeaponProperty,
  formatWeaponSummary,
  formatArmorSummary,
  getWeaponAttack,
  getUnarmedStrike,
  formatAttackDamage,
  isMonkWeapon,
  type AttackContext,
} from '../weaponFormat'
import { getWeaponById, getArmorById, getPackById, formatPackContents } from '../equipmentUtils'
import { FIGHTING_STYLES } from '../classUtils'

function ctx(
  strMod: number, dexMod: number, proficiencyBonus: number, proficient: boolean,
  extra: Partial<AttackContext> = {},
): AttackContext {
  return { strMod, dexMod, proficiencyBonus, proficient, ...extra }
}

const TWF_BASE = 'com outra arma leve na outra mão: ataque extra como ação bônus, sem somar o modificador no dano (a menos que seja negativo)'

describe('weaponFormat', () => {
  it('formatDamageRoll cobre dados, dano fixo e ausência de dano', () => {
    expect(formatDamageRoll({ dice: 1, sides: 8 })).toBe('1d8')
    expect(formatDamageRoll({ dice: 2, sides: 6 })).toBe('2d6')
    expect(formatDamageRoll({ flat: 1 })).toBe('1')
    expect(formatDamageRoll(null)).toBe('—')
  })

  it('formatWeaponProperty traduz as propriedades para português', () => {
    expect(formatWeaponProperty({ kind: 'finesse' })).toBe('acuidade')
    expect(formatWeaponProperty({ kind: 'light' })).toBe('leve')
    expect(formatWeaponProperty({ kind: 'two-handed' })).toBe('duas mãos')
    expect(formatWeaponProperty({ kind: 'versatile', alternateDamage: { dice: 1, sides: 10 } })).toBe('versátil (1d10)')
    expect(formatWeaponProperty({ kind: 'thrown', normalRange: 6, longRange: 18 })).toBe('arremesso (6/18 m)')
  })

  it('formatWeaponDamage inclui o tipo de dano em português', () => {
    const rapier = getWeaponById('rapier')!
    expect(formatWeaponDamage(rapier)).toBe('1d8 perfurante')
  })

  it('formatWeaponSummary distingue rapieira de espada curta (o caso do playtest, F1)', () => {
    // Rapieira: 1d8 perfurante, acuidade (uma mão)
    expect(formatWeaponSummary(getWeaponById('rapier')!)).toBe('1d8 perfurante · acuidade')
    // Espada Curta: 1d6 perfurante, acuidade + leve
    expect(formatWeaponSummary(getWeaponById('shortsword')!)).toBe('1d6 perfurante · acuidade, leve')
  })

  describe('formatArmorSummary (F1 — armaduras/escudos)', () => {
    it('leve mostra CA + Des; média limita a +2; pesada é fixa', () => {
      expect(formatArmorSummary(getArmorById('leather')!)).toBe('CA 11 + Des')
      expect(formatArmorSummary(getArmorById('hide')!)).toBe('CA 12 + Des (máx. +2)')
      expect(formatArmorSummary(getArmorById('ring-mail')!)).toBe('CA 14 · desv. em Furtividade')
    })
    it('escudo mostra +2', () => {
      expect(formatArmorSummary(getArmorById('shield')!)).toBe('CA +2 (escudo)')
    })
  })

  describe('formatPackContents (F1 — pacotes)', () => {
    it('lista o conteúdo do pacote com quantidades', () => {
      const contents = formatPackContents(getPackById('entertainers-pack')!)
      expect(contents).toContain('Mochila')
      expect(contents).toMatch(/\d+×/) // tem itens com quantidade > 1
    })
  })

  describe('getWeaponAttack (F5 — linha de ataque por arma)', () => {
    it('arma de acuidade usa Destreza quando ela é melhor', () => {
      // Rapieira (acuidade), Força +1, Destreza +3, prof +2 → usa Destreza
      const atk = getWeaponAttack(getWeaponById('rapier')!, ctx(1, 3, 2, true))
      expect(atk).toEqual({ name: 'Rapieira', ability: 'Destreza', attackBonus: '+5', proficient: true, damage: '1d8+3 perfurante', properties: 'acuidade', notes: [] })
    })

    it('arma corpo a corpo sem acuidade usa Força', () => {
      // Espada Grande (2d6, sem acuidade), Força +3, Destreza +1, prof +2 → usa Força
      const atk = getWeaponAttack(getWeaponById('greatsword')!, ctx(3, 1, 2, true))
      expect(atk).toEqual({ name: 'Espada Grande', ability: 'Força', attackBonus: '+5', proficient: true, damage: '2d6+3 cortante', properties: 'pesada, duas mãos', notes: [] })
    })

    it('arma à distância usa Destreza', () => {
      // Arco Longo (à distância), Força +3, Destreza +2, prof +2 → usa Destreza
      const atk = getWeaponAttack(getWeaponById('longbow')!, ctx(3, 2, 2, true))
      expect(atk.ability).toBe('Destreza')
      expect(atk.attackBonus).toBe('+4')
      expect(atk.damage).toBe('1d8+2 perfurante')
    })

    it('leva as propriedades da arma: a adaga do bardo mostra o alcance de arremesso (p. 149)', () => {
      // Adaga (1d4 perfurante; acuidade, leve, arremesso 6/18 m), Força 0, Destreza +1, prof +2
      const atk = getWeaponAttack(getWeaponById('dagger')!, ctx(0, 1, 2, true))
      expect(atk).toEqual({
        name: 'Adaga',
        ability: 'Destreza',
        attackBonus: '+3',
        proficient: true,
        damage: '1d4+1 perfurante',
        properties: 'acuidade, leve, arremesso (6/18 m)',
        notes: [TWF_BASE],
      })
    })

    it('arma de munição mostra o alcance; arma sem propriedade fica vazia', () => {
      expect(getWeaponAttack(getWeaponById('longbow')!, ctx(0, 2, 2, true)).properties).toBe('munição (45/180 m), pesada, duas mãos')
      expect(getWeaponAttack(getWeaponById('mace')!, ctx(1, 0, 2, true)).properties).toBe('')
    })

    it('sem proficiência na arma, o bônus de proficiência não entra no ataque (p. 148)', () => {
      // Feiticeiro com uma maça (a "qualquer arma simples" do equipamento): Força +1, prof +2
      const atk = getWeaponAttack(getWeaponById('mace')!, ctx(1, 0, 2, false))
      expect(atk.attackBonus).toBe('+1')
      expect(atk.proficient).toBe(false)
      // o dano não muda: proficiência nunca entrou nele
      expect(atk.damage).toBe('1d6+1 concussão')
    })

    it('modificador 0 não aparece no dano', () => {
      // Porrete (1d4 concussão), Força 0, Destreza 0, prof +2 → dano sem "+0"
      const atk = getWeaponAttack(getWeaponById('club')!, ctx(0, 0, 2, true))
      expect(atk.damage).toBe('1d4 concussão')
      expect(atk.attackBonus).toBe('+2')
    })
  })

  // p. 85: Arquearia entra no número; Duelismo, Armas Grandes e Duas Armas dependem de como a
  // arma é empunhada e viram nota — nunca mexem no número.
  describe('Estilo de Luta na linha de ataque', () => {
    const style = (id: string) => {
      const s = FIGHTING_STYLES.find(f => f.id === id)!
      return s.effects!.weaponAttacks!.map(value => ({ source: s.name, value }))
    }

    it('Arquearia soma +2 no arco longo, mas não na adaga arremessada (arma corpo a corpo)', () => {
      const bow = getWeaponAttack(getWeaponById('longbow')!, ctx(0, 3, 2, true, { effects: style('archery') }))
      expect(bow.attackBonus).toBe('+7')
      expect(bow.damage).toBe('1d8+3 perfurante')
      expect(bow.notes).toEqual(['inclui +2 no ataque (Arquearia)'])
      const dagger = getWeaponAttack(getWeaponById('dagger')!, ctx(0, 3, 2, true, { effects: style('archery') }))
      expect(dagger.attackBonus).toBe('+5')
    })

    it('Arquearia vale no dardo, que é arma à distância', () => {
      expect(getWeaponAttack(getWeaponById('dart')!, ctx(0, 3, 2, true, { effects: style('archery') })).attackBonus).toBe('+7')
    })

    it('Duelismo vira nota em arma de uma mão (versátil incluída), e não muda o dano', () => {
      const longsword = getWeaponAttack(getWeaponById('longsword')!, ctx(3, 0, 2, true, { effects: style('dueling') }))
      expect(longsword.damage).toBe('1d8+3 cortante')
      expect(longsword.attackBonus).toBe('+5')
      expect(longsword.notes).toEqual(['+2 de dano empunhando-a numa mão, sem outra arma (Duelismo)'])
      const greatsword = getWeaponAttack(getWeaponById('greatsword')!, ctx(3, 0, 2, true, { effects: style('dueling') }))
      expect(greatsword.notes).toEqual([])
      const bow = getWeaponAttack(getWeaponById('shortbow')!, ctx(0, 3, 2, true, { effects: style('dueling') }))
      expect(bow.notes).toEqual([])
    })

    it('Combate com Armas Grandes: nota em arma de duas mãos ou versátil corpo a corpo, não na maça', () => {
      const note = 'rerrola 1 e 2 nos dados de dano empunhando-a com as duas mãos (Combate com Armas Grandes)'
      const gwf = { effects: style('great-weapon-fighting') }
      expect(getWeaponAttack(getWeaponById('greatsword')!, ctx(3, 0, 2, true, gwf)).notes).toEqual([note])
      expect(getWeaponAttack(getWeaponById('longsword')!, ctx(3, 0, 2, true, gwf)).notes).toEqual([note])
      expect(getWeaponAttack(getWeaponById('mace')!, ctx(3, 0, 2, true, gwf)).notes).toEqual([])
      // arco longo é de duas mãos, mas à distância
      expect(getWeaponAttack(getWeaponById('longbow')!, ctx(3, 0, 2, true, gwf)).notes).toEqual([])
      expect(getWeaponAttack(getWeaponById('greatsword')!, ctx(3, 0, 2, true, gwf)).damage).toBe('2d6+3 cortante')
    })

    it('arma leve: a regra-base do ataque da outra mão (p. 196), trocada pelo Combate com Duas Armas', () => {
      expect(getWeaponAttack(getWeaponById('shortsword')!, ctx(0, 3, 2, true)).notes).toEqual([TWF_BASE])
      const twf = getWeaponAttack(getWeaponById('shortsword')!, ctx(0, 3, 2, true, { effects: style('two-weapon-fighting') }))
      expect(twf.notes).toEqual([
        'com outra arma leve na outra mão: ataque extra como ação bônus, somando o modificador no dano (Combate com Duas Armas)',
      ])
      expect(twf.damage).toBe('1d6+3 perfurante')
      // besta de mão é leve, mas à distância: não é combate com duas armas
      expect(getWeaponAttack(getWeaponById('hand-crossbow')!, ctx(0, 3, 2, true)).notes).toEqual([])
    })
  })

  // p. 149: "Um valor de dano aparece entre parênteses [...] quando usada com as duas mãos".
  describe('arma versátil', () => {
    it('espada longa mostra o dano a duas mãos como segundo valor', () => {
      const atk = getWeaponAttack(getWeaponById('longsword')!, ctx(3, 0, 2, true))
      expect(atk.versatileDamage).toBe('1d10+3')
      expect(formatAttackDamage(atk)).toBe('1d8+3 cortante (1d10+3 a duas mãos)')
    })

    it('arma sem versátil não tem segundo valor', () => {
      const atk = getWeaponAttack(getWeaponById('mace')!, ctx(3, 0, 2, true))
      expect(atk.versatileDamage).toBeUndefined()
      expect(formatAttackDamage(atk)).toBe('1d6+3 concussão')
    })
  })

  // p. 104: arma de monge = espada curta e arma simples corpo a corpo sem duas mãos nem pesada.
  describe('Artes Marciais', () => {
    const ma = (die: number) => ({ martialArts: { source: 'Artes Marciais', die, condition: 'sem armadura nem escudo' } })

    it('arma de monge: espada curta e simples corpo a corpo leves; clava grande e dardo não', () => {
      expect(isMonkWeapon(getWeaponById('shortsword')!)).toBe(true)
      expect(isMonkWeapon(getWeaponById('quarterstaff')!)).toBe(true)
      expect(isMonkWeapon(getWeaponById('spear')!)).toBe(true)
      expect(isMonkWeapon(getWeaponById('greatclub')!)).toBe(false)
      expect(isMonkWeapon(getWeaponById('dart')!)).toBe(false)
      expect(isMonkWeapon(getWeaponById('scimitar')!)).toBe(false)
    })

    it('monge 1 de bordão com Destreza melhor: usa Destreza, e o d6 do bordão fica acima do d4', () => {
      const atk = getWeaponAttack(getWeaponById('quarterstaff')!, ctx(1, 3, 2, true, ma(4)))
      expect(atk.ability).toBe('Destreza')
      expect(atk.attackBonus).toBe('+5')
      expect(formatAttackDamage(atk)).toBe('1d6+3 concussão (1d8+3 a duas mãos)')
      expect(atk.notes).toEqual(['inclui Artes Marciais (sem armadura nem escudo)'])
    })

    it('monge 5 de clava (1d4): o dano vira 1d6', () => {
      const atk = getWeaponAttack(getWeaponById('club')!, ctx(0, 3, 3, true, ma(6)))
      expect(atk.damage).toBe('1d6+3 concussão')
    })

    it('monge 11 de bordão: d8 nas duas empunhaduras, sem segundo valor repetido', () => {
      const atk = getWeaponAttack(getWeaponById('quarterstaff')!, ctx(0, 4, 4, true, ma(8)))
      expect(atk.damage).toBe('1d8+4 concussão')
      expect(atk.versatileDamage).toBeUndefined()
    })

    it('fora da arma de monge não vale: a clava grande segue na Força e no d8', () => {
      const atk = getWeaponAttack(getWeaponById('greatclub')!, ctx(1, 4, 2, true, ma(10)))
      expect(atk.ability).toBe('Força')
      expect(atk.damage).toBe('1d8+1 concussão')
      expect(atk.notes).toEqual([])
    })

    it('Força melhor e dado da arma maior: nada muda, e nenhuma nota', () => {
      const atk = getWeaponAttack(getWeaponById('spear')!, ctx(3, 1, 2, true, ma(4)))
      expect(atk.ability).toBe('Força')
      expect(atk.notes).toEqual([])
    })
  })

  // p. 196: "1 + seu modificador de Força. Você é proficiente com seus ataques desarmados".
  describe('getUnarmedStrike', () => {
    it('qualquer personagem: 1 + Força, concussão, proficiente', () => {
      const atk = getUnarmedStrike({ strMod: 3, dexMod: 1, proficiencyBonus: 2 })
      expect(atk).toEqual({
        name: 'Golpe desarmado', ability: 'Força', attackBonus: '+5', proficient: true,
        damage: '1+3 concussão', properties: '', notes: [],
      })
    })

    it('Força 10: só o 1', () => {
      expect(getUnarmedStrike({ strMod: 0, dexMod: 0, proficiencyBonus: 2 }).damage).toBe('1 concussão')
    })

    it('monge 11: d8 de Artes Marciais com Destreza, e o golpe da ação bônus na nota', () => {
      const atk = getUnarmedStrike({
        strMod: 0, dexMod: 4, proficiencyBonus: 4,
        martialArts: { source: 'Artes Marciais', die: 8, condition: 'sem armadura nem escudo' },
      })
      expect(atk.ability).toBe('Destreza')
      expect(atk.attackBonus).toBe('+8')
      expect(atk.damage).toBe('1d8+4 concussão')
      expect(atk.notes[0]).toBe('inclui Artes Marciais (sem armadura nem escudo)')
      expect(atk.notes[1]).toMatch(/ação bônus \(Artes Marciais\)$/)
    })

    it('Especialista em Briga: 1d4 + Força (p. 169); com Artes Marciais maior, fica o dado dela', () => {
      const brawler = { source: 'Especialista em Briga', value: 4 }
      const atk = getUnarmedStrike({ strMod: 2, dexMod: 0, proficiencyBonus: 2, unarmedDie: brawler })
      expect(atk.damage).toBe('1d4+2 concussão')
      expect(atk.notes).toEqual(['inclui o d4 de Especialista em Briga'])
      const monk = getUnarmedStrike({
        strMod: 0, dexMod: 3, proficiencyBonus: 3, unarmedDie: brawler,
        martialArts: { source: 'Artes Marciais', die: 6, condition: 'sem armadura nem escudo' },
      })
      expect(monk.damage).toBe('1d6+3 concussão')
    })

    it('efeitos de arma não alcançam o golpe desarmado; os de escopo unarmed, sim', () => {
      const atk = getUnarmedStrike({
        strMod: 0, dexMod: 0, proficiencyBonus: 2,
        effects: [
          { source: 'Arquearia', value: { weapons: 'ranged', attackBonus: 2 } },
          { source: 'Golpes de Chi', value: { weapons: 'unarmed', note: 'conta como arma mágica' } },
        ],
      })
      expect(atk.attackBonus).toBe('+2')
      expect(atk.notes).toEqual(['conta como arma mágica (Golpes de Chi)'])
    })
  })
})
