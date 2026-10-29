/**
 * O que o app guarda do aparelho, fora das fichas (docs/app-instalavel.md): a resposta do pedido de
 * armazenamento persistente e os avisos da galeria (a dica de instalar no iPhone, o lembrete de
 * cópia de segurança). É do aparelho, como as preferências do jogo. Perder isto só faz um aviso
 * voltar: tudo cai no padrão, e uma escrita que falha (cota, navegação privada) não vira erro.
 */

export const DEVICE_KEY = 'app-device'

export type PersistAnswer = {
  /** O navegador deu o armazenamento persistente. */
  granted: boolean
  /** O app estava instalado (tela cheia) quando pediu: instalar muda a resposta do Chrome. */
  installed: boolean
}

export type DeviceState = {
  persist: PersistAnswer | null
  /** Quando a dica de instalar no iPhone foi dispensada; null enquanto ela vale. */
  installHintDismissedAt: number | null
  /** Quando a última cópia de todas as fichas foi baixada. */
  lastBackupAt: number | null
  /** O "Agora não" do lembrete de cópia: até quando ele fica quieto. */
  backupSnoozedUntil: number | null
}

export const DEFAULT_DEVICE_STATE: DeviceState = {
  persist: null,
  installHintDismissedAt: null,
  lastBackupAt: null,
  backupSnoozedUntil: null,
}

const timeOrNull = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)

function toDeviceState(raw: unknown): DeviceState {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_DEVICE_STATE }
  const r = raw as Record<string, unknown>
  const persist = r.persist as Record<string, unknown> | null | undefined
  return {
    persist: typeof persist === 'object' && persist !== null && typeof persist.granted === 'boolean'
      ? { granted: persist.granted, installed: persist.installed === true }
      : null,
    installHintDismissedAt: timeOrNull(r.installHintDismissedAt),
    lastBackupAt: timeOrNull(r.lastBackupAt),
    backupSnoozedUntil: timeOrNull(r.backupSnoozedUntil),
  }
}

/** O estado salvo, campo a campo; JSON quebrado, campo estranho ou localStorage fora caem no padrão. */
export function loadDeviceState(): DeviceState {
  try {
    const raw = localStorage.getItem(DEVICE_KEY)
    return raw ? toDeviceState(JSON.parse(raw)) : { ...DEFAULT_DEVICE_STATE }
  } catch {
    return { ...DEFAULT_DEVICE_STATE }
  }
}

/** Grava os campos dados sobre o que está salvo; devolve o estado novo (o gravado, se gravou). */
export function updateDeviceState(patch: Partial<DeviceState>): DeviceState {
  const next = toDeviceState({ ...loadDeviceState(), ...patch })
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(next))
  } catch {
    // Sem onde gravar, o aviso só volta na próxima abertura.
  }
  return next
}
