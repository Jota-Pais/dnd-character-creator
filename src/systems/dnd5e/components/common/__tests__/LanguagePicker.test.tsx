import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, within } from '@testing-library/react'
import { LanguagePicker } from '../LanguagePicker'

afterEach(cleanup)

describe('LanguagePicker', () => {
  it('separa padrão e exóticos, com o aviso do Mestre no grupo dos exóticos', () => {
    const { getByText } = render(
      <LanguagePicker count={1} selected={[]} accent="#fff" onChange={() => {}} />,
    )
    const standard = getByText('Idiomas padrão').parentElement!
    const exotic = getByText('Idiomas exóticos — só com permissão do Mestre (p. 125)').parentElement!
    expect(within(standard).queryByText('Élfico')).not.toBeNull()
    expect(within(standard).queryByText('Dracônico')).toBeNull()
    expect(within(exotic).queryByText('Dracônico')).not.toBeNull()
  })

  it('não veta o exótico: escolher Dracônico funciona', () => {
    const onChange = vi.fn()
    const { getByText } = render(
      <LanguagePicker count={1} selected={[]} accent="#fff" onChange={onChange} />,
    )
    fireEvent.click(getByText('Dracônico'))
    expect(onChange).toHaveBeenCalledWith(['draconic'])
  })

  it('trava o que já vem de outra fonte e o que passa do limite', () => {
    const { getByText } = render(
      <LanguagePicker count={2} selected={['elvish', 'dwarvish']} excluded={['common']} accent="#fff" onChange={() => {}} />,
    )
    expect(getByText(/Comum/).closest('button')!.disabled).toBe(true)
    expect(getByText('Dracônico').closest('button')!.disabled).toBe(true)
    expect(getByText('Élfico').closest('button')!.disabled).toBe(false)
  })

  it('escolha de 1 idioma é rádio: outro troca o marcado; o de outra fonte segue travado', () => {
    const onChange = vi.fn()
    const { getByText } = render(
      <LanguagePicker count={1} selected={['elvish']} excluded={['common']} accent="#fff" onChange={onChange} />,
    )
    expect(getByText('Dracônico').closest('button')!.disabled).toBe(false)
    expect(getByText(/Comum/).closest('button')!.disabled).toBe(true)
    fireEvent.click(getByText('Dracônico'))
    expect(onChange).toHaveBeenCalledWith(['draconic'])
  })
})
