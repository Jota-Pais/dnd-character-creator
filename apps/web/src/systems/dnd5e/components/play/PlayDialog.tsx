import { useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { getOpener } from './pressedControl'

/** O que recebe o foco dentro da folha (para prender o Tab). */
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A folha modal do modo de jogo: sobe do pé da tela no celular, centralizada no desktop. Fecha no
 * ✕, no fundo escuro e no Esc; o foco entra nela ao abrir, circula dentro dela no Tab e volta para
 * quem a abriu ao fechar — ou, se ele sumiu enquanto ela estava aberta, a `onFocusAway`. O
 * conteúdo (`children`) vem logo abaixo do título.
 */
export function PlayDialog({ title, titleId, onClose, onFocusAway, children }: {
  title: ReactNode
  titleId: string
  onClose: () => void
  /**
   * Quem abriu a folha não existe mais ao fechar (o "Ver o que rolar" do aviso que a ação da folha
   * trocou): a tela diz para onde vai o foco, que senão cairia no body.
   */
  onFocusAway?: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const focusAwayRef = useRef(onFocusAway)

  useLayoutEffect(() => {
    focusAwayRef.current = onFocusAway
  })

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Diálogo modal: o foco entra na folha ao abrir e volta para quem a abriu ao fechar. A limpeza
  // roda depois da tela já atualizada: o que a tela oferece no lugar de quem abriu já existe.
  // Quem abriu sai de `getOpener`: no Safari, o botão tocado não fica com o foco.
  useEffect(() => {
    const opener = getOpener()
    closeRef.current?.focus()
    return () => {
      if (opener?.isConnected) opener.focus()
      else focusAwayRef.current?.()
    }
  }, [])

  // O Tab circula dentro da folha: a ficha atrás do fundo escuro não recebe o foco.
  function trapTab(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || !dialogRef.current) return
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    const inside = active instanceof Node && dialogRef.current.contains(active)
    if (e.shiftKey ? (!inside || active === first) : (!inside || active === last)) {
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      {/* A altura em dvh, a da tela à vista: o vh do Safari é o da tela com a barra dele escondida,
          e com a barra à vista a folha alta passaria da tela, com o título e o ✕ fora dela por cima.
          O fim fica acima da barra de gestos, e a rolagem da folha não arrasta a página de trás. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        onKeyDown={trapTab}
        className="w-full sm:max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl border border-parchment-800 bg-surface-raised px-5 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-fantasy font-bold text-base text-parchment-200 leading-snug pt-2">{title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fechar"
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-parchment-500 hover:text-parchment-200"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
