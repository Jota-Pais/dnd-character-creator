import battleMasterManeuvers from '../data/battle-master-maneuvers.json'
import eldritchInvocations from '../data/eldritch-invocations.json'
import metamagicOptions from '../data/metamagic-options.json'
import fourElementsDisciplines from '../data/four-elements-disciplines.json'
import totemWarriorTotems from '../data/totem-warrior-totems.json'
import landCircleTerrains from '../data/land-circle-terrains.json'
import huntersPrey from '../data/hunters-prey.json'
import hunterDefensiveTactics from '../data/hunter-defensive-tactics.json'
import hunterMultiattack from '../data/hunter-multiattack.json'
import hunterSuperiorDefense from '../data/hunter-superior-defense.json'
import spells from '../data/spells.json'
import type { Spell } from '../types/spell'
import { FIGHTING_STYLES } from './classUtils'

export type ProgressionOption = {
  id: string
  name: string
  description?: string
  prerequisite?: string
  tier3?: string
  tier6?: string
  tier14?: string
}

export function getProgressionOptions(optionsListId: string): ProgressionOption[] {
  switch (optionsListId) {
    case 'battle-master-maneuvers': return battleMasterManeuvers as ProgressionOption[]
    case 'eldritch-invocations': return eldritchInvocations as ProgressionOption[]
    case 'metamagic-options': return metamagicOptions as ProgressionOption[]
    case 'four-elements-disciplines': return fourElementsDisciplines as ProgressionOption[]
    case 'totem-warrior-totems': return totemWarriorTotems as ProgressionOption[]
    case 'land-circle-terrains': return landCircleTerrains as ProgressionOption[]
    case 'hunters-prey': return huntersPrey as ProgressionOption[]
    case 'hunter-defensive-tactics': return hunterDefensiveTactics as ProgressionOption[]
    case 'hunter-multiattack': return hunterMultiattack as ProgressionOption[]
    case 'hunter-superior-defense': return hunterSuperiorDefense as ProgressionOption[]
    case 'FIGHTING_STYLES': return FIGHTING_STYLES as ProgressionOption[]
    case 'any-known-spell':
      // Retorna todas as magias para seleção de Segredos Mágicos (qualquer classe/nível)
      return (spells as Spell[]).map(s => ({
        id: s.id,
        name: s.name,
        description: `Nível ${s.level} (${s.school}) - ${s.classes.join(', ')}`,
      }))
    default: return []
  }
}
