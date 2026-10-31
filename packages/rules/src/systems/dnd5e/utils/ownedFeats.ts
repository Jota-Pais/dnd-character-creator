import type { CharacterDraft } from '../types/character'
import type { Feat } from '../types/feat'
import { getFeat } from './featUtils'
import { getAllAsiChoices } from './multiclassUtils'

/**
 * Talentos que o personagem possui, por qualquer via: o do Humano Variante e os escolhidos em
 * cada espaço de ASI (da classe primária e das adicionais). Sem repetir: o livro só deixa pegar o
 * mesmo talento de novo quando a descrição diz (o Adepto Elemental, p. 167), e a ficha guarda cada
 * talento uma vez só — o repetido trava a etapa Aprimoramentos (`getRepeatedFeatSlots`), e até a
 * troca a ficha não dobra o bônus.
 *
 * Mora num módulo próprio (e não em `sheetEffects`, que o reexporta) para `spellUtils` poder ler
 * os talentos que ensinam magia (Iniciado em Magia) sem importar o agregador de efeitos, que já
 * depende de `spellUtils`.
 */
export function getOwnedFeats(draft: CharacterDraft): Feat[] {
  const ids = [
    ...(draft.raceChoices.feat ? [draft.raceChoices.feat] : []),
    ...getAllAsiChoices(draft)
      .filter(c => c.kind === 'feat')
      .map(c => (c as { featId: string }).featId)
      .filter(Boolean),
  ]
  return [...new Set(ids)]
    .map(getFeat)
    .filter((f): f is Feat => f !== undefined)
}
