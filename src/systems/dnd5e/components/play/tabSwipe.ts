import { useRef, type TouchEvent as ReactTouchEvent } from 'react'

/** Distância horizontal mínima (px) para o gesto trocar de aba. */
export const SWIPE_MIN_DISTANCE = 64

/**
 * Quanto (px) o dedo anda antes de o gesto escolher o eixo. Se sair na vertical, é rolagem da
 * página e não troca de aba, mesmo que depois o dedo vá de lado.
 */
export const AXIS_LOCK_DISTANCE = 12

/** Predominantemente horizontal: o deslocamento lateral é pelo menos o dobro do vertical (até ~27°). */
const HORIZONTAL_RATIO = 2

/** Para a esquerda, a aba seguinte; para a direita, a anterior (como virar a página). */
export type SwipeDirection = 'next' | 'previous'

/** O gesto pelo deslocamento do dedo, do toque até soltar; null se não foi um deslizar de lado. */
export function classifySwipe(dx: number, dy: number): SwipeDirection | null {
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < HORIZONTAL_RATIO * Math.abs(dy)) return null
  return dx < 0 ? 'next' : 'previous'
}

/** Onde o arrasto é do próprio controle: campo de texto, controle deslizante, editável. */
const OWN_GESTURE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

/** Área que rola de lado: o arrasto horizontal nela é dela. */
function scrollsHorizontally(el: Element): boolean {
  if (el.scrollWidth <= el.clientWidth) return false
  const overflow = getComputedStyle(el).overflowX
  return overflow === 'auto' || overflow === 'scroll'
}

/**
 * O gesto que começa em `target` fica com o elemento, não com a troca de aba: campo de texto,
 * textarea, controle deslizante, uma área com rolagem horizontal entre o alvo e a área do gesto
 * (`container`), ou qualquer ponto com uma folha modal aberta dentro da área (a regra da aba
 * Regras): o fundo escuro cobre a aba, e trocar de aba fecharia a folha.
 */
export function isSwipeExempt(target: EventTarget | null, container: Element): boolean {
  if (!(target instanceof Element)) return false
  if (container.querySelector('[aria-modal="true"]')) return true
  const own = target.closest(OWN_GESTURE)
  if (own && container.contains(own)) return true
  for (let el: Element | null = target; el && el !== container; el = el.parentElement) {
    if (scrollsHorizontally(el)) return true
  }
  return false
}

type Gesture = { x: number; y: number; horizontal: boolean }

/**
 * Deslizar o dedo de lado na área de conteúdo troca de aba, no celular. Só toque (o mouse não
 * arrasta abas) e só leitura dos eventos, sem `preventDefault`: a rolagem vertical segue com o
 * navegador. Um dedo só; o gesto que começa vertical fica vertical; os que começam num controle
 * com arrasto próprio (`isSwipeExempt`) são ignorados. Devolve os handlers para espalhar no elemento.
 */
export function useTabSwipe(onSwipe: (direction: SwipeDirection) => void) {
  const gesture = useRef<Gesture | null>(null)
  return {
    onTouchStart(e: ReactTouchEvent<HTMLElement>) {
      const touch = e.touches[0]
      gesture.current = e.touches.length === 1 && touch && !isSwipeExempt(e.target, e.currentTarget)
        ? { x: touch.clientX, y: touch.clientY, horizontal: false }
        : null
    },
    onTouchMove(e: ReactTouchEvent<HTMLElement>) {
      const g = gesture.current
      if (!g || g.horizontal) return
      const touch = e.touches[0]
      // Pinça (dois dedos): é zoom, não troca de aba.
      if (e.touches.length !== 1 || !touch) {
        gesture.current = null
        return
      }
      const dx = Math.abs(touch.clientX - g.x)
      const dy = Math.abs(touch.clientY - g.y)
      if (Math.max(dx, dy) < AXIS_LOCK_DISTANCE) return
      if (dy >= dx) gesture.current = null
      else g.horizontal = true
    },
    onTouchEnd(e: ReactTouchEvent<HTMLElement>) {
      const g = gesture.current
      gesture.current = null
      const touch = e.changedTouches[0]
      if (!g || !touch) return
      const direction = classifySwipe(touch.clientX - g.x, touch.clientY - g.y)
      if (direction) onSwipe(direction)
    },
    onTouchCancel() {
      gesture.current = null
    },
  }
}
