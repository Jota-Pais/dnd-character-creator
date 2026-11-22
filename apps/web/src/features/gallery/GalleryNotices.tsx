import { useState, type ReactNode } from 'react'
import { applyUpdate, useAppUpdateStore } from '../../core/pwa/serviceWorker'
import { useNativeVersionStore } from '../../core/native/appVersion'
import { sheetsPlace, shouldShowInstallHint } from '../../core/pwa/platform'
import { isNativeApp } from '../../core/native/nativeApp'
import { useDeviceStore } from '../../core/stores/deviceStore'
import { AuthScreen } from '../auth/AuthScreen'
import { useAuthStore } from '../auth/authStore'
import { useSyncStore } from '../sync/syncStore'
import { isSynced } from '../sync/syncText'
import { BACKUP_SNOOZE_MS, shouldRemindBackup } from './backupReminder'

/**
 * Os avisos discretos da galeria. Do app instalável (docs/app-instalavel.md): a versão nova pronta,
 * o APK velho demais (só no APK do Android; docs/app-android.md), a dica de instalar no iPhone e o
 * lembrete de cópia de segurança. Da conta e da sincronização (docs/servidor-e-sincronizacao.md): a
 * sessão que expirou, a cópia que um conflito criou, e a ficha que não pôde subir. Moram só na
 * galeria, onde não há jogo aberto. A dica e o lembrete não aparecem juntos: a dica vem primeiro, e
 * o lembrete espera ela ser dispensada. Com a sincronização em dia, o lembrete de cópia não
 * aparece: as fichas já estão guardadas fora do aparelho.
 */
export function GalleryNotices({ latestChangeAt, onExportAll }: {
  /** A última mudança nas fichas e nos estados de jogo deste navegador; null sem ficha. */
  latestChangeAt: number | null
  onExportAll: () => void
}) {
  const updateReady = useAppUpdateStore(s => s.updateReady)
  const nativeOutdated = useNativeVersionStore(s => s.outdated)
  const device = useDeviceStore()
  const user = useAuthStore(s => s.user)
  const sessionState = useAuthStore(s => s.session)
  const sync = useSyncStore(s => s.status)
  const conflictCopies = useSyncStore(s => s.conflictCopies)
  // A folha de entrar de novo, aberta pelo aviso da sessão expirada.
  const [reauth, setReauth] = useState(false)
  // A hora de quando a galeria abriu: o lembrete não aparece nem some com o relógio andando.
  const [now] = useState(() => Date.now())

  const native = isNativeApp()
  const place = sheetsPlace(window, native)
  const installHint = shouldShowInstallHint(window, device.installHintDismissedAt)
  const expired = sessionState === 'expired'
  const backupReminder = !installHint && !isSynced(sync, sessionState) && shouldRemindBackup({
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
            {/* No APK, abrir pelo ícone só traz de volta a tela que o Android guardou: não há
                "próxima abertura" a prometer. A versão esperando entra pelo toque, ou sozinha na
                volta do segundo plano à galeria parada (applyUpdateOnReturn), que o aviso não
                promete: depende de onde a pessoa estiver ao voltar. E "versão nova do app" lá é o
                APK novo, o aviso de baixo. */}
            {native
              ? 'Atualização pronta: toque em Atualizar agora para usá-la.'
              : 'Versão nova do app pronta: ela entra na próxima vez que você abrir o app.'}
          </Notice>
        )}
        {/* O APK só muda com a parte nativa, e quem o distribui é o grupo: o app não baixa nada. */}
        {nativeOutdated && <Notice>Tem uma versão nova do app: peça o APK no grupo.</Notice>}

        {/* A sessão expira no servidor com a galeria aberta, e os avisos da sincronização chegam
            ao fim de um ciclo: a mesma região viva. */}
        {expired && (
          <Notice actions={<NoticeButton onClick={() => setReauth(true)}>Entrar de novo</NoticeButton>}>
            Sua sessão expirou. As fichas continuam neste aparelho; entre de novo para voltar a sincronizar.
          </Notice>
        )}
        {conflictCopies > 0 && (
          <Notice actions={<NoticeButton onClick={() => useSyncStore.setState({ conflictCopies: 0 })}>Entendi</NoticeButton>}>
            {conflictCopies === 1 ? 'Uma ficha mudou' : 'Algumas fichas mudaram'} em dois aparelhos ao mesmo tempo. A versão que não ficou
            virou uma cópia, com “conflito” no nome: confira as duas e apague a que não quiser.
          </Notice>
        )}
        {sync.outdated > 0 && (
          <Notice>
            {sync.outdated === 1 ? 'Uma ficha foi alterada' : 'Algumas fichas foram alteradas'} numa versão mais nova do app. Atualize o app neste
            aparelho para {sync.outdated === 1 ? 'vê-la' : 'vê-las'} e voltar a sincronizá-{sync.outdated === 1 ? 'la' : 'las'}.
          </Notice>
        )}
        {sync.refused > 0 && (
          <Notice actions={<NoticeButton onClick={onExportAll}>Exportar todas</NoticeButton>}>
            {sync.refused === 1 ? 'Uma ficha não pôde ser enviada ao servidor' : 'Algumas fichas não puderam ser enviadas ao servidor'}: {sync.refused === 1 ? 'ela continua' : 'elas continuam'} só
            neste aparelho. Guarde uma cópia em arquivo.
          </Notice>
        )}
      </div>

      {reauth && user && (
        <AuthScreen reauthEmail={user.email} onCancel={() => setReauth(false)} onDone={() => setReauth(false)} />
      )}

      {installHint && (
        <Notice actions={<NoticeButton onClick={() => device.update({ installHintDismissedAt: Date.now() })}>Entendi</NoticeButton>}>
          <strong className="font-semibold" style={{ color: '#ede2d6' }}>Instale no iPhone:</strong> toque em Compartilhar e
          em “Adicionar à Tela de Início”. Instalado, o app abre sem internet e guarda as fichas com mais segurança.
          {/* No iPhone, o app da tela de início guarda à parte do navegador e começa vazio: as fichas
              chegam pela conta, não pelo aparelho. */}
          {' No app instalado, entre com esta mesma conta: as fichas aparecem lá.'}
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
            ? `As fichas ficam só ${place}. Guarde uma cópia em arquivo.`
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
