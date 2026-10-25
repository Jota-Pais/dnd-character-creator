import { useAppStore } from '../../../../../core/stores/appStore'
import { useCharacterStore } from '../../../stores/characterStore'
import { usePlayStore } from '../../../stores/playStore'
import { COMPLETE_DRAFT } from '../../../../../test/fixtures'

/** Limpa o armazenamento e fecha o modo de jogo (o `beforeEach` dos testes da tela). */
export function resetPlay(): void {
  localStorage.clear()
  usePlayStore.getState().close()
}

/** Salva a ficha completa (Krusk, meio-orc bárbaro 1, 14 PV) e abre no modo de jogo. */
export function openKrusk(): string {
  useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
  const id = useCharacterStore.getState().currentId!
  useCharacterStore.getState().playCharacter(id)
  useAppStore.getState().setActiveSystem('dnd5e')
  return id
}
