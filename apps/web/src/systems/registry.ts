import { dnd5eSystem } from './dnd5e';
import { ordemSystem } from './ordem';
import type { IRpgSystem } from './system';

export const SYSTEMS: Record<string, IRpgSystem> = {
  dnd5e: dnd5eSystem,
  ordem: ordemSystem,
};
