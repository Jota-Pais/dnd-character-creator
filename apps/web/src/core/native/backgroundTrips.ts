/**
 * As idas do app ao segundo plano, contadas na volta (docs/app-android.md). No APK, a volta é a hora
 * em que a galeria aplica sozinha a versão nova (core/pwa/serviceWorker.ts), e para isso ela precisa
 * saber quais idas foram do próprio app: o seletor de arquivo do Importar, o "Salvar como" do
 * exportar, a impressão. Voltar delas é continuar o que a pessoa pediu, e recarregar ali perderia o
 * arquivo escolhido ou a data da cópia gravada.
 *
 * O fim dessas idas não tem aviso confiável: o seletor de arquivo cancelado não avisa nada no
 * WebView 109 (sem o evento `cancel`), e a impressão da casca responde antes de a tela dela abrir.
 * Por isso a marca vale para a próxima ida, quando quer que ela venha, e se gasta nela: o que a
 * pessoa fizer lá fora, por quanto tempo for, a volta não interrompe. A marca que sobrar (o seletor
 * fechado sem sair do app) só faz a ida seguinte também não contar: a versão nova espera mais uma
 * volta, e nada se perde.
 */

let ownTripPending = false

/** O app vai sair da frente por conta própria: chamar logo antes de abrir a tela de fora. */
export function markOwnTrip(): void {
  ownTripPending = true
}

/** Lê e apaga a marca: true quando a ida que começa agora é do próprio app. */
export function takeOwnTrip(): boolean {
  const own = ownTripPending
  ownTripPending = false
  return own
}

/** Uma ida ao segundo plano, contada na volta. */
export type Trip = {
  /** Quanto tempo a página ficou escondida. */
  awayMs: number
  /** Foi o próprio app que saiu (`markOwnTrip`). */
  own: boolean
}

/**
 * Chama `onReturn` a cada volta do segundo plano, com a ida que terminou. A página escondida (outro
 * app na frente, a tela apagada) é a ida; a marca do app é lida quando ela começa.
 */
export function watchTrips(
  doc: Pick<Document, 'visibilityState' | 'addEventListener'>,
  onReturn: (trip: Trip) => void,
  now: () => number = Date.now,
): void {
  let leftAt: number | null = null
  let own = false
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') {
      if (leftAt !== null) return
      leftAt = now()
      own = takeOwnTrip()
      return
    }
    // A primeira página visível, sem ida antes, não é volta.
    if (doc.visibilityState !== 'visible' || leftAt === null) return
    const trip = { awayMs: now() - leftAt, own }
    leftAt = null
    onReturn(trip)
  })
}
