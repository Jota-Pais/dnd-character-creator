import { dnd5eSystem } from '../../systems/dnd5e';
import type { IRpgSystem } from '../types/system';

export const SYSTEMS: Record<string, IRpgSystem> = {
  dnd5e: dnd5eSystem,
};
