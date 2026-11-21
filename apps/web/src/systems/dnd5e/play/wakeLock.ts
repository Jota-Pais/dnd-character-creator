import { useEffect } from 'react'

/**
 * Tela acesa durante o jogo (decisão 10.2.22): o celular na mesa não apaga entre um turno e outro.
 * É a Screen Wake Lock API — só em contexto seguro (https ou localhost) e não em todo navegador.
 * Sem ela, a opção fica explicada nas configurações e nada mais acontece.
 */
export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.wakeLock?.request === 'function'
}

/**
 * Fora de contexto seguro (o app aberto pelo IP da rede, em http), a API não existe nem no
 * navegador que a tem: a culpa é do endereço, e o mesmo navegador funciona por https.
 */
export function isInsecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === false
}

/**
 * Mantém a tela acesa enquanto `enabled` e a página estiver visível. O navegador solta a trava
 * sozinho quando a página some (troca de aba ou de app, tela bloqueada): ao voltar a ficar
 * visível, ela é pedida de novo. Pedido recusado (economia de bateria, permissão) fica sem trava,
 * sem erro. Desligar, ou sair do jogo, solta a trava.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !isWakeLockSupported()) return
    let sentinel: WakeLockSentinel | null = null
    let requesting = false
    let active = true

    async function acquire() {
      if (!active || requesting || sentinel || document.visibilityState !== 'visible') return
      requesting = true
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (!active) {
          void lock.release().catch(() => {})
          return
        }
        sentinel = lock
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null
        })
      } catch {
        // Recusado: a tela segue o tempo de bloqueio do aparelho.
      } finally {
        requesting = false
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', handleVisibility)
      const lock = sentinel
      sentinel = null
      void lock?.release().catch(() => {})
    }
  }, [enabled])
}
