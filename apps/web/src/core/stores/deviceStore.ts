import { create } from 'zustand'
import { loadDeviceState, updateDeviceState, type DeviceState } from '../utils/deviceStorage'

/**
 * O que o app guarda do aparelho (deviceStorage), para a galeria: os avisos dela leem daqui, e quem
 * muda (dispensar a dica, adiar o lembrete, baixar a cópia) muda aqui e no aparelho junto.
 */
export const useDeviceStore = create<DeviceState & { update: (patch: Partial<DeviceState>) => void }>(set => ({
  ...loadDeviceState(),
  update: patch => set(updateDeviceState(patch)),
}))
