import { usePlayStore } from '../../stores/playStore'
import { isInsecureContext, isWakeLockSupported } from './wakeLock'

/**
 * Configurações do modo de jogo (preferência do aparelho, não da ficha). Os dados do app ficam
 * desligados por padrão e sem destaque: a mesa rola os próprios dados (decisão de 2026-10-25). A
 * tela acesa fica ligada por padrão (decisão 10.2.22); sem a Screen Wake Lock, a opção dá lugar à
 * explicação, que separa o endereço em http (o mesmo navegador funciona por https) do navegador
 * que não a tem.
 */
export function PlaySettings() {
  const appDice = usePlayStore(s => s.prefs.appDice)
  const setAppDice = usePlayStore(s => s.setAppDice)
  const keepScreenOn = usePlayStore(s => s.prefs.keepScreenOn)
  const setKeepScreenOn = usePlayStore(s => s.setKeepScreenOn)

  return (
    <div className="rounded-xl border border-parchment-900 bg-surface-raised px-4 py-3 space-y-3">
      <label className="flex items-start gap-3 cursor-pointer min-h-10">
        <input
          type="checkbox"
          checked={appDice}
          onChange={e => setAppDice(e.target.checked)}
          className="mt-1 w-5 h-5 shrink-0 accent-gold-500 cursor-pointer"
        />
        <span>
          <span className="block text-sm text-parchment-200">Usar os dados do app</span>
          <span className="block text-xs text-parchment-600 leading-snug">
            Mostra um botão "Rolar" nas jogadas, para quem está sem dados à mão. Desligado, a tela
            só diz o que rolar e quanto somar.
          </span>
        </span>
      </label>
      {isWakeLockSupported() ? (
        <label className="flex items-start gap-3 cursor-pointer min-h-10">
          <input
            type="checkbox"
            checked={keepScreenOn}
            onChange={e => setKeepScreenOn(e.target.checked)}
            className="mt-1 w-5 h-5 shrink-0 accent-gold-500 cursor-pointer"
          />
          <span>
            <span className="block text-sm text-parchment-200">Manter a tela acesa</span>
            <span className="block text-xs text-parchment-600 leading-snug">
              Enquanto a ficha estiver aberta aqui, a tela do aparelho não apaga sozinha.
            </span>
          </span>
        </label>
      ) : (
        <div className="min-h-10">
          <p className="text-sm text-parchment-200">Manter a tela acesa</p>
          <p className="text-xs text-parchment-600 leading-snug">
            {isInsecureContext()
              ? 'Aberto pelo endereço da rede (sem https), o app não consegue manter a tela acesa.'
              : 'Este navegador não deixa o app manter a tela acesa.'}
            {' '}Para ela não apagar no meio do jogo, aumente o tempo de bloqueio da tela nas
            configurações do aparelho.
          </p>
        </div>
      )}
    </div>
  )
}
