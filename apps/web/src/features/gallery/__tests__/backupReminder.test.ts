import { describe, it, expect } from 'vitest'
import { BACKUP_REMINDER_INTERVAL_MS, shouldRemindBackup } from '../backupReminder'

const NOW = 10_000_000_000

describe('shouldRemindBackup', () => {
  it('sem ficha, não lembra', () => {
    expect(shouldRemindBackup({ latestChangeAt: null, lastBackupAt: null, snoozedUntil: null, now: NOW })).toBe(false)
  })

  it('com ficha e nenhuma cópia, lembra', () => {
    expect(shouldRemindBackup({ latestChangeAt: NOW - 1, lastBackupAt: null, snoozedUntil: null, now: NOW })).toBe(true)
  })

  it('"Agora não": quieto até o fim do adiamento', () => {
    expect(shouldRemindBackup({ latestChangeAt: NOW - 1, lastBackupAt: null, snoozedUntil: NOW + 1, now: NOW })).toBe(false)
    expect(shouldRemindBackup({ latestChangeAt: NOW - 1, lastBackupAt: null, snoozedUntil: NOW, now: NOW })).toBe(true)
  })

  it('cópia recente: quieto, mesmo com mudança depois dela', () => {
    const lastBackupAt = NOW - BACKUP_REMINDER_INTERVAL_MS + 1
    expect(shouldRemindBackup({ latestChangeAt: NOW - 1, lastBackupAt, snoozedUntil: null, now: NOW })).toBe(false)
  })

  it('cópia antiga: lembra só se algo mudou depois dela', () => {
    const lastBackupAt = NOW - BACKUP_REMINDER_INTERVAL_MS
    expect(shouldRemindBackup({ latestChangeAt: lastBackupAt + 1, lastBackupAt, snoozedUntil: null, now: NOW })).toBe(true)
    expect(shouldRemindBackup({ latestChangeAt: lastBackupAt, lastBackupAt, snoozedUntil: null, now: NOW })).toBe(false)
  })
})
