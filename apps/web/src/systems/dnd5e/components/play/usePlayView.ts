import { useMemo } from 'react'
import { useCharacterStore } from '../../stores/characterStore'
import { usePlayStore, type PlayOperation, type RunOptions } from '../../stores/playStore'
import type { CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import type { PlayResult, PlaySheet, PlayState } from '@rpg/rules/systems/dnd5e/types/playState'
import type { ArmorClassResult } from '@rpg/rules/systems/dnd5e/utils/armorClassUtils'
import { getFinalAbilityScores } from '@rpg/rules/systems/dnd5e/utils/asiUtils'
import { getClass, getSubclass } from '@rpg/rules/systems/dnd5e/utils/classUtils'
import { allClassEntries, formatClassLevelLabel } from '@rpg/rules/systems/dnd5e/utils/multiclassUtils'
import { getSubclassDetails } from '@rpg/rules/systems/dnd5e/utils/progressionOptions'
import { getRace, getSubrace } from '@rpg/rules/systems/dnd5e/utils/raceUtils'
import { getRollGuide, type RollGuide, type RollGuideEntry } from '@rpg/rules/systems/dnd5e/utils/rollGuide'
import { getSheetArmorClass } from '@rpg/rules/systems/dnd5e/utils/sheetEffects'
import type { NumberSource } from './numberSources'

/**
 * Tudo que a tela de jogo lê, num lugar só: a ficha (draft, só leitura), o `PlaySheet` e o
 * `PlayState` do playStore, o guia de rolagens e a CA. Cada bloco (vitais, PV, abas) recebe
 * daqui e muda o estado só por `run(op)` com as funções puras de `utils/playState.ts`.
 */
export type PlayView = {
  draft: CharacterDraft
  characterName: string
  sheet: PlaySheet
  state: PlayState
  guide: RollGuide
  armorClass: ArmorClassResult
  /** Preferência "Usar os dados do app" (desligada por padrão). */
  appDice: boolean
  run: (op: PlayOperation, options?: RunOptions) => PlayResult | null
}

/**
 * Props de toda aba da tela de jogo: a visão inteira, mais o "abrir a receita" de uma jogada
 * (a folha `RollRecipeSheet`, com o "Rolar" quando os dados do app estão ligados). `crit` abre
 * uma jogada de dano já com os dados dobrados. `openSource` abre o "de onde vem" de um número que
 * não se rola (CA, CD de magia, Percepção passiva).
 */
export type PlayTabProps = PlayView & {
  openRecipe: (entry: RollGuideEntry, options?: { crit?: boolean }) => void
  openSource: (source: NumberSource) => void
}

/** A visão da tela de jogo, ou null sem ficha aberta no playStore. */
export function usePlayView(): PlayView | null {
  const draft = useCharacterStore(s => s.draft)
  const characterName = usePlayStore(s => s.characterName)
  const sheet = usePlayStore(s => s.sheet)
  const state = usePlayStore(s => s.state)
  const appDice = usePlayStore(s => s.prefs.appDice)
  const run = usePlayStore(s => s.run)

  const guide = useMemo(() => (state ? getRollGuide(draft, state) : null), [draft, state])
  const armorClass = useMemo(() => getSheetArmorClass(draft, getFinalAbilityScores(draft)), [draft])

  if (!sheet || !state || !guide) return null
  return { draft, characterName, sheet, state, guide, armorClass, appDice, run }
}

/** "Meio-Orc · Bárbaro · nível 3"; na multiclasse, "Humano · Guerreiro 3º / Mago 2º — nível 5". */
export function formatPlaySubtitle(draft: CharacterDraft): string {
  const race = draft.race ? getRace(draft.race) : undefined
  const subrace = race && draft.subrace ? getSubrace(race, draft.subrace) : undefined
  const raceName = subrace?.name ?? race?.name
  const level = draft.level ?? 1
  let classLabel: string | null
  if ((draft.additionalClasses?.length ?? 0) > 0) {
    classLabel = formatClassLevelLabel(draft)
  } else {
    const cls = draft.class ? getClass(draft.class) : undefined
    const sub = cls && draft.classChoices.subclass ? getSubclass(cls, draft.classChoices.subclass) : undefined
    // O detalhe da subclasse (ancestral Azul) como no cabeçalho da Revisão.
    const entry = allClassEntries(draft)[0]
    const subLabel = sub ? [sub.name, ...(entry ? getSubclassDetails(entry) : [])].join(', ') : ''
    classLabel = cls ? `${cls.name}${subLabel ? ` (${subLabel})` : ''} · nível ${level}` : `Nível ${level}`
  }
  return [raceName, classLabel].filter(Boolean).join(' · ')
}
