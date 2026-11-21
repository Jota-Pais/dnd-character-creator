import { EMPTY_DRAFT } from '@rpg/rules/systems/dnd5e/types/character';
import { getMissingSteps, canPlayDraft } from '@rpg/rules/systems/dnd5e/utils/draftValidation';
import { Dnd5eApp } from './Dnd5eApp';
import { lazyScreen } from '../../core/utils/lazyScreen';
import { useCharacterStore } from './stores/characterStore';
import { getRace, getSubrace } from '@rpg/rules/systems/dnd5e/utils/raceUtils';
import { getClass } from '@rpg/rules/systems/dnd5e/utils/classUtils';
import type { IRpgSystem } from '../system';
import type { CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character';

export const dnd5eSystem: IRpgSystem = {
  id: 'dnd5e',
  name: 'D&D 5e',
  subtitle: 'PHB 2014',
  getEmptyDraft: () => ({ ...EMPTY_DRAFT }),
  // A ficha imprimível desce sob demanda (core/utils/lazyScreen.ts), com o que só ela usa.
  PrintableSheet: lazyScreen(() => import('./print/PrintableSheet').then(m => m.PrintableSheet)),
  formatDraftName: (draft: unknown) => {
    const dndDraft = draft as CharacterDraft;
    const race = dndDraft.race ? getRace(dndDraft.race) : undefined;
    const classNames = [
      ...(dndDraft.class ? [getClass(dndDraft.class)?.name] : []),
      ...(dndDraft.additionalClasses ?? []).map(c => getClass(c.classId)?.name),
    ].filter(Boolean);
    const classLabel = classNames.length > 0 ? classNames.join('/') : null;
    const parts = [race?.name, classLabel].filter(Boolean);
    return parts.length > 0
      ? `${parts.join(' · ')} — nível ${dndDraft.level ?? 1}`
      : `Nível ${dndDraft.level ?? 1}`;
  },
  getGalleryFacets: (draft: unknown) => {
    const d = draft as CharacterDraft;
    const race = d.race ? getRace(d.race) : undefined;
    const subrace = race && d.subrace ? getSubrace(race, d.subrace) : undefined;
    const level = d.level ?? 1;
    return {
      levelLabel: 'Nível',
      levelValue: `${level}`,
      levelSort: level,
      // Só a classe primária: agrupar por "Guerreiro/Ladino" espalharia a multiclasse
      // em grupos de um item cada (a linha da ficha já mostra a combinação completa).
      classValue: (d.class ? getClass(d.class)?.name : null) ?? null,
      originLabel: 'Raça',
      originValue: subrace?.name ?? race?.name ?? null,
      missingCount: getMissingSteps(d).length,
    };
  },
  // O modo de jogo (ficha viva): só ficha sem etapa pendente; o estado de jogo fica no playStore.
  play: {
    canPlay: (draft: unknown) => canPlayDraft(draft as CharacterDraft),
    startPlay: (characterId: string) => useCharacterStore.getState().playCharacter(characterId),
  },
  Component: Dnd5eApp,
};
