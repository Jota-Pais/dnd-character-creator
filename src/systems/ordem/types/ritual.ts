export type OrdemRitualCircle = 1 | 2 | 3 | 4;

export type OrdemElement = 'blood' | 'death' | 'energy' | 'knowledge' | 'fear';

export type OrdemRitual = {
  id: string;
  name: string;
  circle: OrdemRitualCircle;
  element: OrdemElement;
  description: string;
};
