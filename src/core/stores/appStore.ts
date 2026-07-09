import { create } from 'zustand'

export type AppState = {
  activeSystemId: string | null
  setActiveSystem: (id: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeSystemId: 'dnd5e', // By default, show D&D until we build the menu
  setActiveSystem: (id) => set({ activeSystemId: id })
}))
