import { create } from 'zustand'

export type AppState = {
  activeSystemId: string | null
  setActiveSystem: (id: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeSystemId: null, // By default, show the global gallery
  setActiveSystem: (id) => set({ activeSystemId: id })
}))
