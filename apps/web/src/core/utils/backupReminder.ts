/**
 * O lembrete de cópia de segurança da galeria (docs/app-instalavel.md). As fichas moram só no
 * navegador; o lembrete aparece quando há mudança que nenhuma cópia guardou e a última cópia (se
 * houve) tem mais de `BACKUP_REMINDER_INTERVAL_MS`. "Agora não" o cala por `BACKUP_SNOOZE_MS`.
 */

const DAY_MS = 24 * 60 * 60 * 1000
export const BACKUP_REMINDER_INTERVAL_MS = 14 * DAY_MS
export const BACKUP_SNOOZE_MS = 7 * DAY_MS

export type BackupReminderInput = {
  /** A última mudança nas fichas e nos estados de jogo; null sem ficha. */
  latestChangeAt: number | null
  lastBackupAt: number | null
  snoozedUntil: number | null
  now: number
}

export function shouldRemindBackup({ latestChangeAt, lastBackupAt, snoozedUntil, now }: BackupReminderInput): boolean {
  if (latestChangeAt === null) return false
  if (snoozedUntil !== null && now < snoozedUntil) return false
  if (lastBackupAt === null) return true
  return latestChangeAt > lastBackupAt && now - lastBackupAt >= BACKUP_REMINDER_INTERVAL_MS
}
