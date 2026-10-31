import type { ComponentType } from 'react';

/**
 * Uma etapa do criador de um sistema (o `steps.ts` dele). Fica fora do `IRpgSystem`: só a tela do
 * próprio sistema a usa, e a do Ordem desce sob demanda com ela (core/utils/lazyScreen.ts).
 */
export interface StepConfig {
  id: string;
  title: string;
  component: ComponentType;
  isComplete: (draft: unknown) => boolean;
}

/**
 * Facetas de uma ficha usadas pela galeria para agrupar, ordenar e buscar. Cada sistema traduz
 * o próprio vocabulário (NEX/Nível, Origem/Raça) — o núcleo só consome os rótulos e valores.
 */
export interface GalleryFacets {
  /** Nome da escala de poder do sistema: "NEX" no Ordem, "Nível" no D&D. */
  levelLabel: string;
  /** Valor já formatado para exibição: "50%", "7". */
  levelValue: string;
  /** Mesmo valor em número, para ordenar. */
  levelSort: number;
  /** Classe/arquétipo (a primária, em caso de multiclasse); null se ainda não escolhida. */
  classValue: string | null;
  /** Nome do eixo de procedência: "Origem" no Ordem, "Raça" no D&D. */
  originLabel: string;
  originValue: string | null;
  /** Quantas etapas ainda faltam para fechar a ficha (0 = pronta). */
  missingCount: number;
}

/**
 * Modo de jogo: a ficha usada durante a sessão. Capacidade opcional do sistema — sem ela, a galeria
 * não mostra "Jogar". A regra de quando uma ficha pode ser jogada é do sistema, não da galeria.
 */
export interface PlayCapability {
  /** Se a ficha pode ir para o jogo (no D&D: sem etapa pendente). */
  canPlay: (draft: unknown) => boolean;
  /** Abre no jogo a ficha salva na biblioteca do sistema. */
  startPlay: (characterId: string) => void;
}

export interface IRpgSystem {
  id: string;
  name: string;
  subtitle: string;
  getEmptyDraft: () => Record<string, unknown>;
  PrintableSheet: ComponentType;
  formatDraftName: (draft: unknown) => string;
  getGalleryFacets: (draft: unknown) => GalleryFacets;
  play?: PlayCapability;
  /**
   * A tela do sistema (criador, impressão, jogo). Pode descer sob demanda (core/utils/lazyScreen.ts):
   * quem a mostra a põe num `Suspense` (o `App`).
   */
  Component: ComponentType;
}
