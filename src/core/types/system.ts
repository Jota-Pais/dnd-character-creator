import type { ComponentType } from 'react';

export interface AppState {
  view: 'system-select' | 'wizard' | 'gallery' | 'print';
  activeSystemId: string | null;
  draft: Record<string, unknown>;
  currentStepId: string;
  currentId: string | null;
}

export interface StepConfig {
  id: string;
  title: string;
  component: ComponentType;
  isComplete: (draft: unknown) => boolean;
}

export interface IRpgSystem {
  id: string;
  name: string;
  subtitle: string;
  getEmptyDraft: () => Record<string, unknown>;
  getSteps: () => StepConfig[];
  PrintableSheet: ComponentType;
  formatDraftName: (draft: unknown) => string;
  Component: ComponentType;
}
