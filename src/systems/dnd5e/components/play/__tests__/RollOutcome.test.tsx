import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { roll, sequenceRoller } from '../../../../../core/dice'
import { RollOutcome } from '../RollOutcome'

afterEach(() => {
  cleanup()
  // O clipboard de mentira de cada teste: o jsdom não tem um.
  Reflect.deleteProperty(navigator, 'clipboard')
})

const d20 = (face: number, notation = '1d20+5') => roll(notation, { roller: sequenceRoller([face]), at: 1, id: 'r1' })

/** As classes de animação do nó e dos filhos: todas precisam vir com `motion-safe:`. */
function animationClasses(root: Element): string[] {
  return [root, ...root.querySelectorAll('*')].flatMap(el => [...el.classList].filter(c => c.includes('animate-')))
}

describe('RollOutcome', () => {
  it('total, faces e modificador; entra com o pulo curto', () => {
    const { container } = render(<RollOutcome copyText="x" record={d20(12)} natural={12} />)
    expect(screen.getByTestId('roll-total')).toHaveTextContent('17')
    expect(screen.getByText(/Dados:/)).toHaveTextContent('Dados: 12 (+5)')
    expect(animationClasses(container)).toEqual(['motion-safe:animate-roll-in'])
    expect(screen.queryByTestId('nat20')).toBeNull()
  })

  it('20 natural: celebração discreta no total e nas estrelas, que o leitor de tela não lê', () => {
    const { container } = render(<RollOutcome copyText="x" record={d20(20)} natural={20} />)
    expect(screen.getByText('20 natural!')).toBeInTheDocument()
    expect(screen.getByTestId('roll-total')).toHaveClass('text-gold-300', 'motion-safe:animate-nat20')
    const sparks = screen.getByTestId('nat20').querySelectorAll('[aria-hidden="true"]')
    expect(sparks).toHaveLength(2)
    // Com prefers-reduced-motion, nada se mexe: toda animação é `motion-safe:`.
    expect(animationClasses(container).every(c => c.startsWith('motion-safe:'))).toBe(true)
  })

  it('1 natural: vermelho e tremor; a frase vem da jogada', () => {
    render(<RollOutcome copyText="x" record={d20(1)} natural={1} naturalOneText="1 natural: erra automaticamente (pág. 196)." />)
    expect(screen.getByTestId('roll-total')).toHaveClass('text-red-400', 'motion-safe:animate-nat1')
    expect(screen.getByText('1 natural: erra automaticamente (pág. 196).')).toBeInTheDocument()
  })

  it('sem d20 (dano), nenhum destaque de natural', () => {
    render(<RollOutcome copyText="x" record={roll('2d6+3', { roller: sequenceRoller([6, 1]), at: 1 })} natural={null} />)
    expect(screen.getByTestId('roll-total')).toHaveTextContent('10')
    expect(screen.getByTestId('roll-total')).toHaveClass('text-parchment-100')
    expect(screen.queryByText(/natural/)).toBeNull()
  })

  it('vantagem: o d20 descartado fica riscado, nunca escondido', () => {
    render(<RollOutcome copyText="x" record={roll('2d20kh1+5', { roller: sequenceRoller([4, 18]), at: 1 })} natural={18} />)
    const discarded = screen.getByText('4')
    expect(discarded).toHaveClass('line-through')
    expect(screen.getByTestId('roll-total')).toHaveTextContent('23')
  })
})

describe('RollOutcome — Copiar resultado', () => {
  it('sem clipboard no navegador, o botão não aparece', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    render(<RollOutcome copyText="Atletismo: 17" record={d20(12)} natural={12} />)
    expect(screen.queryByRole('button', { name: 'Copiar resultado' })).toBeNull()
  })

  it('copia o texto da rolagem e avisa; se o navegador recusar, diz que não deu', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<RollOutcome copyText="Atletismo: 17 (1d20 + 5; dados: 12)" record={d20(12)} natural={12} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar resultado' }))
    expect(writeText).toHaveBeenCalledWith('Atletismo: 17 (1d20 + 5; dados: 12)')
    expect(await screen.findByText('Copiado.')).toBeInTheDocument()

    cleanup()
    writeText.mockRejectedValueOnce(new Error('negado'))
    render(<RollOutcome copyText="x" record={d20(12)} natural={12} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar resultado' }))
    expect(await screen.findByText('Não deu para copiar.')).toBeInTheDocument()
  })
})
