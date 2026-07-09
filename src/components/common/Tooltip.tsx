import { useState, useRef, useEffect, type ReactNode } from 'react'

type Props = {
  term: string
  definition: ReactNode
}

/**
 * Ícone "?" que revela, sob demanda, uma explicação de um termo.
 * Click-to-toggle (funciona no mobile); fecha ao clicar fora.
 * Mantém a tela limpa — o texto só aparece quando o jogador pede.
 */
export function Tooltip({ term, definition }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`O que é ${term}?`}
        aria-expanded={open}
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(o => !o)
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border text-[10px] font-bold leading-none border-parchment-700 text-parchment-600 hover:border-gold-500 hover:text-gold-400 transition-colors"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-56 rounded-lg border border-parchment-700 bg-parchment-950 px-3 py-2 text-left text-xs leading-relaxed text-parchment-300 normal-case tracking-normal shadow-xl"
        >
          <span className="mb-0.5 block font-bold text-gold-400">{term}</span>
          {definition}
        </span>
      )}
    </span>
  )
}
