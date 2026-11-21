import { Suspense, useLayoutEffect, useState, type ComponentType } from 'react'
import { printPage } from '../utils/print'
import { Loading } from './Loading'

/**
 * A tela de impressão dos dois sistemas: a barra, a ficha imprimível e a dica. A ficha desce sob
 * demanda (core/utils/lazyScreen.ts), e a barra não espera por ela: o "← Voltar" está lá desde o
 * começo. O "Imprimir" só entra com a ficha na tela: antes, ele imprimiria o "Carregando…" no lugar
 * dela. Já carregada, a ficha e o "Imprimir" aparecem no mesmo quadro.
 */
export function PrintScreen({ Sheet, onBack, className = '' }: {
  /** A ficha imprimível do sistema (`IRpgSystem.PrintableSheet`). */
  Sheet: ComponentType
  onBack: () => void
  /** O tema do sistema (o `.theme-ordem`). */
  className?: string
}) {
  const [sheetShown, setSheetShown] = useState(false)
  return (
    <div className={`min-h-screen py-6 px-4 ${className}`}>
      <div className="no-print max-w-[820px] mx-auto mb-4 flex justify-between items-center">
        <button
          onClick={onBack}
          className="px-4 py-2 text-parchment-400 hover:text-parchment-200 text-sm font-fantasy transition-colors"
        >
          ← Voltar
        </button>
        {sheetShown && (
          <button
            onClick={() => printPage()}
            className="px-5 py-2 rounded-xl font-fantasy font-bold text-sm bg-gold-500 text-parchment-950 hover:bg-gold-400 transition-colors"
          >
            🖨 Imprimir / Salvar PDF
          </button>
        )}
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <Suspense fallback={<Loading className="py-16" />}>
          <Sheet />
          <WhenShown run={() => setSheetShown(true)} />
        </Suspense>
      </div>
      <p className="no-print max-w-[820px] mx-auto mt-4 text-center text-parchment-700 text-xs">
        Dica: na janela de impressão, escolha "Salvar como PDF" como destino.
      </p>
    </div>
  )
}

/**
 * Avisa quando entra na tela. No mesmo `Suspense` da ficha, entra com ela, e nunca com o
 * `fallback`. O efeito de layout roda antes do desenho: o "Imprimir" não pisca depois da ficha.
 */
function WhenShown({ run }: { run: () => void }) {
  useLayoutEffect(() => {
    run()
  }, [run])
  return null
}
