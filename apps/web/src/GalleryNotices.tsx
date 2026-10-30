import { useState, type ReactNode } from 'react'
import { applyUpdate, useAppUpdateStore } from './core/pwa/serviceWorker'
import { useNativeVersionStore } from './core/native/appVersion'
import { shouldShowInstallHint } from './core/pwa/platform'
import { useDeviceStore } from './core/stores/deviceStore'
import { BACKUP_SNOOZE_MS, shouldRemindBackup } from './core/utils/backupReminder'

/**
 * Os avisos discretos da galeria, do app instalável (docs/app-instalavel.md): a versão nova pronta,
 * o APK velho demais (só no APK do Android; docs/app-android.md), a dica de instalar no iPhone e o
 * lembrete de cópia de segurança. Moram só na galeria, onde não há
 * jogo aberto. A dica e o lembrete não aparecem juntos: a dica (que também fala de guardar as
 * fichas e, com ficha aqui, oferece a cópia para levá-las ao app) vem primeiro, e o lembrete espera
 * ela ser dispensada.
 */
export function GalleryNotices({ latestChangeAt, onExportAll }: {
  /** A última mudança nas fichas e nos estados de jogo deste navegador; null sem ficha. */
  latestChangeAt: number | null
  onExportAll: () => void
}) {
  const updateReady = useAppUpdateStore(s => s.updateReady)
  const nativeOutdated = useNativeVersionStore(s => s.outdated)
  const device = useDeviceStore()
  // A hora de quando a galeria abriu: o lembrete não aparece nem some com o relógio andando.
  const [now] = useState(() => Date.now())

  const hasSheets = latestChangeAt !== null
  const installHint = shouldShowInstallHint(window, device.installHintDismissedAt)
  const backupReminder = !installHint && shouldRemindBackup({
    latestChangeAt,
    lastBackupAt: device.lastBackupAt,
    snoozedUntil: device.backupSnoozedUntil,
    now,
  })

  return (
    <>
      {/* A versão nova termina de baixar, e a conferência do APK volta da rede, com a galeria já
          aberta: região viva montada vazia. */}
      <div aria-live="polite">
        {updateReady && (
          <Notice actions={<NoticeButton onClick={() => { if (!applyUpdate()) useAppUpdateStore.setState({ updateReady: false }) }}>Atualizar agora</NoticeButton>}>
            Versão nova do app pronta: ela entra na próxima vez que você abrir o app.
          </Notice>
        )}
        {/* O APK só muda com a parte nativa, e quem o distribui é o grupo: o app não baixa nada. */}
        {nativeOutdated && <Notice>Tem uma versão nova do app: peça o APK no grupo.</Notice>}
      </div>

      {installHint && (
        <Notice
          actions={
            <>
              {hasSheets && <NoticeButton onClick={onExportAll}>Exportar todas</NoticeButton>}
              <NoticeButton subtle={hasSheets} onClick={() => device.update({ installHintDismissedAt: Date.now() })}>Entendi</NoticeButton>
            </>
          }
        >
          <strong className="font-semibold" style={{ color: '#ede2d6' }}>Instale no iPhone:</strong> toque em Compartilhar e
          em “Adicionar à Tela de Início”. Instalado, o app abre sem internet e guarda as fichas com mais segurança.
          {/* No iPhone, o app da tela de início guarda à parte do navegador: começa sem as fichas daqui. */}
          {hasSheets && ' As fichas deste navegador não passam sozinhas para o app: antes de instalar, toque em Exportar todas e, no app, em Importar.'}
        </Notice>
      )}

      {backupReminder && (
        <Notice
          actions={
            <>
              <NoticeButton onClick={onExportAll}>Exportar todas</NoticeButton>
              <NoticeButton subtle onClick={() => device.update({ backupSnoozedUntil: Date.now() + BACKUP_SNOOZE_MS })}>Agora não</NoticeButton>
            </>
          }
        >
          {device.lastBackupAt === null
            ? 'As fichas ficam só neste navegador. Guarde uma cópia em arquivo.'
            : `Sua última cópia das fichas é de ${new Date(device.lastBackupAt).toLocaleDateString('pt-BR')}. Guarde uma nova.`}
        </Notice>
      )}
    </>
  )
}

function Notice({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ border: '1px solid #3a332b', backgroundColor: '#131110' }}>
      <p className="flex-1 basis-60 text-[13px] leading-relaxed" style={{ color: '#cbbfae' }}>{children}</p>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

function NoticeButton({ onClick, subtle, children }: { onClick: () => void; subtle?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="min-h-10 px-3 rounded-lg text-[13px] transition-colors"
      style={subtle ? { color: '#a39685' } : { border: '1px solid #5c5245', color: '#ede2d6' }}
    >
      {children}
    </button>
  )
}
