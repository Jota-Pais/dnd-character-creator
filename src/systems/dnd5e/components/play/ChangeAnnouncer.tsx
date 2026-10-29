import { useState } from 'react'

/**
 * Região viva só para o leitor de tela: anuncia `text` quando ele muda, nunca ao montar (abrir a
 * ficha ou a aba não fala nada). Para o resultado que a tela mostra sem aviso — o PV depois do
 * dano, a contagem depois de gastar um uso, o PV parcial do descanso curto. Compara um desenho com
 * o seguinte, como o pulso do PV: pega toda mudança, venha de onde vier (toque, descanso, desfazer).
 */
export function ChangeAnnouncer({ text }: { text: string }) {
  const [seen, setSeen] = useState(text)
  const [announced, setAnnounced] = useState('')
  if (seen !== text) {
    setSeen(text)
    setAnnounced(text)
  }
  return <span className="sr-only" aria-live="polite" aria-atomic="true">{announced}</span>
}
