import { usePlayStore } from '../../stores/playStore'

/**
 * Configurações do modo de jogo (preferência do aparelho, não da ficha). Os dados do app ficam
 * desligados por padrão e sem destaque: a mesa rola os próprios dados (decisão de 2026-10-25).
 */
export function PlaySettings() {
  const appDice = usePlayStore(s => s.prefs.appDice)
  const setAppDice = usePlayStore(s => s.setAppDice)

  return (
    <div className="rounded-xl border border-parchment-900 bg-surface-raised px-4 py-3">
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
    </div>
  )
}
