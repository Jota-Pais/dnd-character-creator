import { describe, it, expect, afterEach } from 'vitest'
import { classifySwipe, isSwipeExempt, SWIPE_MIN_DISTANCE } from '../tabSwipe'
import { adjacentPlayTab } from '../playTabs'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('classifySwipe', () => {
  it('para a esquerda é a aba seguinte; para a direita, a anterior', () => {
    expect(classifySwipe(-80, 0)).toBe('next')
    expect(classifySwipe(80, 10)).toBe('previous')
  })

  it('abaixo do limiar não troca', () => {
    expect(classifySwipe(-(SWIPE_MIN_DISTANCE - 1), 0)).toBeNull()
    expect(classifySwipe(-SWIPE_MIN_DISTANCE, 0)).toBe('next')
  })

  it('só o gesto predominantemente horizontal: o lateral pelo menos o dobro do vertical', () => {
    expect(classifySwipe(-100, 50)).toBe('next')
    expect(classifySwipe(-100, 51)).toBeNull()
    expect(classifySwipe(20, 200)).toBeNull()
  })
})

describe('adjacentPlayTab', () => {
  it('vai à vizinha na ordem da barra, sem dar a volta nas pontas', () => {
    expect(adjacentPlayTab('checks', 'next')).toBe('attacks')
    expect(adjacentPlayTab('attacks', 'previous')).toBe('checks')
    expect(adjacentPlayTab('checks', 'previous')).toBeNull()
    expect(adjacentPlayTab('notes', 'next')).toBeNull()
  })
})

describe('isSwipeExempt', () => {
  function mount(html: string): HTMLElement {
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    return container
  }

  it('botão e texto comuns deixam o gesto para a troca de aba', () => {
    const container = mount('<p><button id="b">Atletismo</button></p>')
    expect(isSwipeExempt(container.querySelector('#b'), container)).toBe(false)
    expect(isSwipeExempt(container.querySelector('p'), container)).toBe(false)
  })

  it('campo de texto, textarea, controle deslizante e editável ficam com o próprio arrasto', () => {
    const container = mount(`
      <input id="text" type="text" />
      <input id="range" type="range" />
      <textarea id="area"></textarea>
      <div contenteditable="true"><span id="editable">x</span></div>
      <div contenteditable="false"><span id="locked">x</span></div>
    `)
    for (const id of ['text', 'range', 'area', 'editable']) {
      expect(isSwipeExempt(container.querySelector(`#${id}`), container), id).toBe(true)
    }
    expect(isSwipeExempt(container.querySelector('#locked'), container)).toBe(false)
  })

  it('folha modal aberta dentro da aba (a regra da aba Regras): nem na folha nem no fundo escuro', () => {
    const container = mount(`
      <button id="behind">Fúria</button>
      <div id="backdrop"><div role="dialog" aria-modal="true"><p id="text">Fúria</p></div></div>
    `)
    for (const id of ['text', 'backdrop', 'behind']) {
      expect(isSwipeExempt(container.querySelector(`#${id}`), container), id).toBe(true)
    }
    container.querySelector('#backdrop')!.remove()
    expect(isSwipeExempt(container.querySelector('#behind'), container)).toBe(false)
  })

  it('área com rolagem horizontal entre o alvo e a área do gesto fica com o arrasto', () => {
    const container = mount('<div id="strip" style="overflow-x: auto"><button id="chip">Caído</button></div>')
    const strip = container.querySelector<HTMLElement>('#strip')!
    const chip = container.querySelector('#chip')
    // Sem layout no jsdom: a largura do conteúdo e a da área vêm à mão.
    Object.defineProperty(strip, 'clientWidth', { configurable: true, value: 300 })
    Object.defineProperty(strip, 'scrollWidth', { configurable: true, value: 300 })
    expect(isSwipeExempt(chip, container)).toBe(false)
    Object.defineProperty(strip, 'scrollWidth', { configurable: true, value: 520 })
    expect(isSwipeExempt(chip, container)).toBe(true)
    // Conteúdo mais largo, mas cortado (sem rolagem): o gesto continua sendo de troca de aba.
    strip.style.overflowX = 'hidden'
    expect(isSwipeExempt(chip, container)).toBe(false)
  })
})
