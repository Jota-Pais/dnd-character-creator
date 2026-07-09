export type OrdemRitualCircle = 1 | 2 | 3 | 4;

export type OrdemElement = 'blood' | 'death' | 'energy' | 'knowledge' | 'fear';

export type OrdemRitual = {
  id: string;
  name: string;
  circle: OrdemRitualCircle;
  /** Um ritual pode existir em mais de um elemento (ex.: Amaldiçoar Arma). */
  elements: OrdemElement[];
  /** Stat block do livro. */
  execution: string;
  range: string;
  target: string;
  duration: string;
  resistance: string;
  description: string;
};
