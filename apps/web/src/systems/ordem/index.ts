import { EMPTY_DRAFT } from '@rpg/rules/systems/ordem/types/character'
import { getMissingSteps } from '@rpg/rules/systems/ordem/utils/draftValidation'
import { getOrigin } from '@rpg/rules/systems/ordem/utils/originUtils'
import { getOrdemClass } from '@rpg/rules/systems/ordem/utils/classUtils'
import { lazyScreen } from '../../core/utils/lazyScreen'
import type { IRpgSystem } from '../system'
import type { OrdemCharacterDraft } from '@rpg/rules/systems/ordem/types/character'

export const ordemSystem: IRpgSystem = {
  id: 'ordem',
  name: 'Ordem Paranormal',
  subtitle: 'RPG de investigação paranormal',
  getEmptyDraft: () => ({ ...EMPTY_DRAFT }),
  // A ficha imprimível desce sob demanda, num pedaço à parte do criador (core/utils/lazyScreen.ts).
  PrintableSheet: lazyScreen(() => import('./components/PrintableSheet').then(m => m.PrintableSheet)),
  formatDraftName: (draft: unknown) => {
    const d = draft as OrdemCharacterDraft
    const origin = d.origin ? getOrigin(d.origin) : undefined
    const cls = d.class ? getOrdemClass(d.class) : undefined
    const parts = [origin?.name, cls?.name].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : 'Agente incompleto'
  },
  getGalleryFacets: (draft: unknown) => {
    const d = draft as OrdemCharacterDraft
    return {
      levelLabel: 'NEX',
      levelValue: `${d.nex}%`,
      levelSort: d.nex,
      classValue: (d.class ? getOrdemClass(d.class)?.name : null) ?? null,
      originLabel: 'Origem',
      originValue: (d.origin ? getOrigin(d.origin)?.name : null) ?? null,
      missingCount: getMissingSteps(d).length,
    }
  },
  // O criador do Ordem desce sob demanda (core/utils/lazyScreen.ts): a galeria, que abre o app, só
  // precisa do que está acima (as facetas, o nome), e a regra do Ordem que elas usam fica com ela.
  Component: lazyScreen(() => import('./OrdemApp').then(m => m.OrdemApp)),
}
