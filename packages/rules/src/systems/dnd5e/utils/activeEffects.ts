import type { CharacterDraft } from '../types/character'
import type { RollModeEffect } from '../types/condition'
import type { AttackScope } from '../types/effects'
import type { ActiveToggle, PlayState } from '../types/playState'
import type { ResolvedToggle, SheetSession, SheetToggle } from '../types/session'
import { ABILITY_LABELS, formatMeters } from './abilityScoreUtils'
import { getFinalAbilityScores } from './asiUtils'
import { describeDamageDefenses, getSheetToggles, getWeaponAttackEffects, toSheetDefenses } from './sheetEffects'
import { joinPt } from './textUtils'

/**
 * Os efeitos ligados do estado de jogo, resolvidos contra a ficha: o que cada um faz AGORA. Uma
 * função só para a tela e para as operações — as operações leem os efeitos do `PlaySheet`
 * (`sheet.toggles`), a tela e o guia de rolagens os da ficha (`getSheetSession`), e os dois são o
 * mesmo `getSheetToggles`.
 */

/**
 * O que vale agora de cada efeito ligado: os efeitos de sempre, os benefícios que o equipamento
 * deixa (a Fúria de Placas liga, mas fica com `blockedBy` e sem eles; o Urso, sem cláusula de
 * armadura, vale assim mesmo) e os da opção escolhida ao ligar (o Frenesi). Efeito que a ficha não
 * tem mais (a característica saiu no criador) fica de fora — a reconciliação o tira do estado.
 */
export function resolveActiveEffects(active: readonly ActiveToggle[], toggles: readonly SheetToggle[]): ResolvedToggle[] {
  return active.flatMap(a => {
    const t = toggles.find(o => o.id === a.id)
    if (!t) return []
    const option = a.option ? t.options.find(o => o.id === a.option) : undefined
    const blocked = t.benefits.find(b => b.blockedBy)
    return [{
      id: t.id, label: t.label, source: t.source, page: t.page,
      effects: [
        ...t.effects,
        ...t.benefits.filter(b => !b.blockedBy).flatMap(b => b.effects),
        ...(option ? (option.effects ?? []).map(effect => ({ source: option.source, effect })) : []),
      ],
      ...(blocked?.blockedBy ? { blockedBy: blocked.blockedBy } : {}),
      ...(option ? { option } : {}),
    }]
  })
}

/**
 * A sessão para as funções da ficha, derivada do estado de jogo — a porta de quem já recebe o
 * estado (o guia de rolagens, o da concentração, a tela). A Revisão e o PDF não a têm.
 */
export function getSheetSession(draft: CharacterDraft, state: PlayState): SheetSession {
  return { active: resolveActiveEffects(state.activeEffects, getSheetToggles(draft)) }
}

// ── O que o efeito ligado está fazendo, em texto ────────────────────────────

const ROLL_TEXT: Record<RollModeEffect['rolls'][number], string> = {
  attack: 'jogadas de ataque',
  abilityCheck: 'testes',
  save: 'testes de resistência',
}

/** As linhas de ataque que o bônus de dano alcança, depois de "de dano" (o escopo do efeito). */
const SCOPE_TEXT: Record<AttackScope, string> = {
  'ranged': 'nos ataques com arma à distância',
  'melee-one-handed': 'nos ataques com arma corpo a corpo empunhada numa mão',
  'melee-two-handed': 'nos ataques com arma corpo a corpo empunhada com as duas mãos',
  'melee-light': 'nos ataques com arma leve corpo a corpo',
  'melee-strength': 'nos ataques com arma corpo a corpo usando Força',
  'unarmed': 'no golpe desarmado',
  'weapon-attack': 'nos ataques com arma',
  'melee-weapon-attack': 'nos ataques corpo a corpo com arma',
}

/** "Vantagem em testes e testes de resistência de Força". */
function describeRollMode(e: RollModeEffect): string {
  if (e.scope === 'notice') return e.text
  const of = e.abilities ? ` de ${joinPt(e.abilities.map(a => ABILITY_LABELS[a].long))}` : ''
  return `${e.mode === 'advantage' ? 'Vantagem' : 'Desvantagem'} em ${joinPt(e.rolls.map(r => ROLL_TEXT[r]))}${of}`
}

/**
 * O que um efeito ligado está fazendo agora, uma linha por efeito com quem o dá — a seção Efeitos
 * ativos da aba Estado. As mesmas fontes dos números: o bônus de dano que as linhas de ataque somam
 * (`getWeaponAttackEffects` com a sessão), as defesas com o texto de `describeDamageDefenses`, o
 * voo pelo deslocamento de caminhada do jogo (`walkingFeet`, `getPlaySpeed`). Primeiro o que muda
 * número ou modo, depois os lembretes e, no fim, o que fica proibido.
 */
export function describeToggleEffects(draft: CharacterDraft, toggle: ResolvedToggle, walkingFeet: number): string[] {
  const modes: string[] = []
  const defenses: string[] = []
  const immunities: string[] = []
  const notices: string[] = []
  const blocks = new Map<string, { cast: boolean; concentrate: boolean }>()
  for (const { source, effect } of toggle.effects) {
    switch (effect.kind) {
      case 'rollMode':
        modes.push(`${describeRollMode(effect)} (${source})`)
        break
      case 'damageDefenses':
        defenses.push(...describeDamageDefenses(toSheetDefenses(source, effect.defenses)))
        break
      case 'conditionImmunity':
        immunities.push(...describeDamageDefenses(toSheetDefenses(source, { conditionImmunities: effect.conditions })))
        break
      case 'flySpeed':
        notices.push(`Deslocamento de voo de ${formatMeters(walkingFeet)}, igual ao de caminhada (${source})`)
        break
      case 'notice':
        // O texto dos dados é frase com ponto; a origem vem antes dele.
        notices.push(`${effect.text.replace(/\.$/, '')} (${source})`)
        break
      case 'cannotCast':
      case 'endsConcentration': {
        const b = blocks.get(source) ?? { cast: false, concentrate: false }
        if (effect.kind === 'cannotCast') b.cast = true
        else b.concentrate = true
        blocks.set(source, b)
        break
      }
    }
  }
  const damage = getWeaponAttackEffects(draft, getFinalAbilityScores(draft), { active: [toggle] }).flatMap(({ value, conditionalDamage: d }) =>
    d?.met && !d.blockedBy && value.conditionalDamage?.toggle === toggle.id
      ? [`+${d.value} de dano ${SCOPE_TEXT[value.weapons]} (${d.name})`]
      : [])
  const forbidden = [...blocks].map(([source, b]) => {
    const what = b.cast && b.concentrate ? 'conjurar magias nem se concentrar nelas' : b.cast ? 'conjurar magias' : 'se concentrar em magias'
    return `Não pode ${what} (${source})`
  })
  return [...modes, ...damage, ...defenses, ...immunities, ...notices, ...forbidden]
}
