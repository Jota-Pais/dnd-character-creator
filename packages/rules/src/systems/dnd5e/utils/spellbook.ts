import type { CharacterDraft } from '../types/character'
import type { SpellbookEntry, SpellbookList, SpellbookStatus } from '../types/spellbook'
import type { SpellcastingType } from '../types/class'
import type { Spell } from '../types/spell'
import { getFeat } from './featUtils'
import { getGrantedSpellGroups } from './progressionOptions'
import { describeInnateSpellUsage } from './raceUtils'
import { getKnownSpells } from './sheetModel'
import { canCastAsRitual, getCombinedSpellSlots, getPactSlots, getRitualRule } from './spellUtils'

/**
 * O grimório do jogo (Fase 2, onda `grimorio`): as magias que o personagem conjura, por conjuração,
 * com o que cada uma pede para sair. Montado sobre `getKnownSpells` (`sheetModel.ts`), a mesma lista
 * da aba Regras, da Revisão e da ficha imprimível — nenhuma magia é procurada de novo aqui; o que
 * entra é o jeito de conjurar: o status, os espaços que servem, o uso do talento e o ritual.
 */

/** O status das magias de 1º nível ou mais pelo tipo de Conjuração da classe. */
const STATUS_BY_TYPE: Record<SpellcastingType, SpellbookStatus> = {
  prepared: 'prepared',
  known: 'known',
  hybrid: 'inSpellbook',
}

/**
 * O mago conjura só as preparadas do dia (pág. 96, linhas 8374-8392), e o app ainda não sabe quais
 * são: preparar no jogo chega com a onda `preparar-magias`. Até lá, o grimório inteiro tem o
 * Conjurar, e a lista diz isso.
 */
export const SPELLBOOK_PREPARATION_NOTE = 'O app ainda não sabe quais magias você preparou hoje: conjure só as preparadas, e as com o descritor ritual também como ritual, sem preparar (pág. 96).'

/** "1 uso por descanso longo, como magia de 2º nível (o app ainda não conta esse uso)." */
const innateUsageNote = (text: string) => `${text[0].toUpperCase()}${text.slice(1)} (o app ainda não conta esse uso).`

/**
 * O grimório da ficha: uma lista por conjuração — cada classe conjuradora (`class:<classe>`), cada
 * talento que ensina magias (`feat:<talento>`, o Iniciado em Magia) e as de fora delas (`other`: o
 * truque da raça, o da subclasse e as inatas). A chave da classe e a do talento são as do guia de
 * rolagens (`RollGuide.spellcasting`), de onde vêm a CD e o ataque. Cada magia diz:
 * - o status: o truque, a preparada, a conhecida, a do grimório do mago ou a de uso por descanso;
 * - os espaços que servem: os níveis do pool combinado do dela para cima (pág. 201; na multiclasse,
 *   também os de nível acima do que a classe conhece, pág. 166, linhas 14828-14837) e o de Pacto
 *   quando é do nível dela ou acima — com Conjuração e Magia de Pacto, os dois servem às magias das
 *   duas (pág. 166, linhas 14845-14851);
 * - o uso do talento (a magia de 1º nível do Iniciado em Magia, no menor nível possível, uma vez por
 *   descanso longo, pág. 170) e o nível que a inata fixa ("como uma magia de 2° nível", pág. 43);
 * - se vai como ritual (`canCastAsRitual`).
 */
export function getPlaySpellbook(draft: CharacterDraft): SpellbookList[] {
  const known = getKnownSpells(draft)
  const pool = getCombinedSpellSlots(draft)
  const pact = getPactSlots(draft)
  const slots = (spell: Spell): Pick<SpellbookEntry, 'slotLevels' | 'pactLevel' | 'free'> => spell.level === 0
    ? { slotLevels: [], pactLevel: null, free: true }
    : {
      slotLevels: pool.flatMap((count, i) => (count > 0 && i + 1 >= spell.level ? [i + 1] : [])),
      pactLevel: pact && pact.slots > 0 && pact.slotLevel >= spell.level ? pact.slotLevel : null,
      free: false,
    }

  const lists: SpellbookList[] = known.classes.map(({ caster, spells }) => {
    const ritualRule = getRitualRule(caster.casting.spellcasting)
    const asRitual = new Set(getGrantedSpellGroups(caster.entry).filter(g => g.asRitual).flatMap(g => g.spellIds))
    const status = STATUS_BY_TYPE[caster.casting.spellcasting.type]
    return {
      key: `class:${caster.cls.id}`,
      kind: 'class' as const,
      label: caster.casting.label,
      ritualRule,
      ...(status === 'inSpellbook' ? { note: SPELLBOOK_PREPARATION_NOTE } : {}),
      spells: spells.map(({ spell, group }) => {
        const entryStatus: SpellbookStatus = spell.level === 0 ? 'cantrip' : status
        return {
          spellId: spell.id,
          status: entryStatus,
          origin: group,
          ...slots(spell),
          ritual: canCastAsRitual(ritualRule, entryStatus, spell, asRitual.has(spell.id)),
        }
      }),
    }
  })

  // O Iniciado em Magia: os truques à vontade e a magia de 1º nível pelo uso do talento, no menor
  // nível possível (pág. 170). Os espaços não servem a ela: o texto só dá esse jeito de conjurá-la.
  for (const feat of known.feats) {
    const resourceId = getFeat(feat.featId)?.effects?.resources?.find(r => r.nameFromChosenSpell)?.id
    lists.push({
      key: `feat:${feat.featId}`,
      kind: 'feat',
      label: feat.label,
      ritualRule: null,
      spells: [
        ...feat.cantrips.map(spell => ({ spellId: spell.id, status: 'cantrip' as const, origin: null, ...slots(spell), ritual: false })),
        ...feat.spells.map(spell => ({
          spellId: spell.id,
          status: 'perRest' as const,
          origin: null,
          slotLevels: [],
          pactLevel: null,
          free: false,
          ...(resourceId ? { resourceId } : {}),
          castLevel: spell.level,
          ritual: false,
        })),
      ],
    })
  }

  // De fora da conjuração de uma classe ou de um talento: sem CD nem ataque no app (o guia da magia
  // diz isso). A inata de 1º nível ou mais tem um uso por descanso longo, que o contador da onda
  // `recursos-completos` vai contar; até lá, sai sem gastar, com a nota.
  const others: SpellbookEntry[] = [
    ...(known.raceCantrip ? [{ spellId: known.raceCantrip.id, status: 'cantrip' as const, origin: 'da raça', ...slots(known.raceCantrip), ritual: false }] : []),
    ...known.subclassCantrips.map(({ spell, subclassName }) => ({
      spellId: spell.id, status: 'cantrip' as const, origin: subclassName ? `de ${subclassName}` : 'da subclasse', ...slots(spell), ritual: false,
    })),
    ...known.innate.map(({ spell, innate }) => {
      const usage = describeInnateSpellUsage(innate, spell.level)
      return {
        spellId: spell.id,
        status: spell.level === 0 ? 'cantrip' as const : 'perRest' as const,
        origin: 'da raça',
        slotLevels: [],
        pactLevel: null,
        free: true,
        ...(innate.castLevel ? { castLevel: innate.castLevel } : {}),
        ritual: false,
        ...(usage.limited ? { note: innateUsageNote(usage.text) } : {}),
      }
    }),
  ]
  if (others.length > 0) lists.push({ key: 'other', kind: 'other', label: 'Outras magias', ritualRule: null, spells: others })
  return lists.filter(l => l.spells.length > 0)
}

/** A magia de uma conjuração do grimório, ou null (a lista ou a magia não estão nele). */
export function findSpellbookEntry(
  spellbook: readonly SpellbookList[],
  key: string,
  spellId: string,
): { list: SpellbookList; entry: SpellbookEntry } | null {
  const list = spellbook.find(l => l.key === key)
  const entry = list?.spells.find(s => s.spellId === spellId)
  return list && entry ? { list, entry } : null
}
