export type OrdemRitualCircle = 1 | 2 | 3 | 4;

export type OrdemElement = 'blood' | 'death' | 'energy' | 'knowledge' | 'fear';

/** Os 4 elementos de poderes paranormais/afinidade — o Medo é reservado aos "Marcados" (p. 114). */
export type ParanormalElement = Exclude<OrdemElement, 'fear'>;

/** Na ordem de apresentação do livro (lista de poderes, p. 114–117). */
export const PARANORMAL_ELEMENTS: ParanormalElement[] = ['knowledge', 'energy', 'death', 'blood'];

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
