import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../stores/playStore'
import { activateToggle, addCondition } from '@rpg/rules/systems/dnd5e/utils/playState'
import type { CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { liveRegions, openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

const playState = () => usePlayStore.getState().state!

/**
 * Krusk como outra classe, com o que ele compra (método riqueza): o criador equipa a primeira
 * armadura. Humano: +1 em tudo (DES 15, +2; SAB 11, +0).
 */
function character(classId: string, ...items: string[]): CharacterDraft {
  const d = structuredClone(COMPLETE_DRAFT)
  d.equipment.purchasedItems = items.map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const }))
  return { ...d, race: 'human', class: classId, level: 6, abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 } }
}

function openStatus(draft: CharacterDraft) {
  openDraft(draft)
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
}

const section = () => screen.getByRole('heading', { name: 'Equipamento vestido' }).closest('section')!
const vitalsAc = () => screen.getByRole('button', { name: /^Classe de Armadura \d+/ })

describe('WornEquipmentSection — vestir e tirar pela tela do jogo', () => {
  it('trocar a armadura muda a CA no mesmo toque, nos vitais e na seção, com o "era"; o foco fica no botão', () => {
    openStatus(character('fighter', 'leather', 'chain-mail', 'shield'))
    // Couro 11 + DES 2 + escudo 2.
    expect(within(section()).getByTestId('worn-ac')).toHaveTextContent('CA 15 = 11 (Couro) + 2 (DES) + 2 (Escudo)')
    expect(vitalsAc()).toHaveAccessibleName('Classe de Armadura 15: de onde vem')

    const don = within(section()).getByRole('button', { name: 'Vestir Cota de Malha' })
    don.focus()
    fireEvent.click(don)
    expect(playState().wornArmor).toEqual({ bodyArmorId: 'chain-mail', shield: true, basis: { bodyArmorId: 'leather', shield: true } })
    expect(within(section()).getByTestId('worn-ac')).toHaveTextContent('CA 18 (era 15) = 16 (Cota de Malha) + 2 (Escudo)')
    expect(vitalsAc()).toHaveAccessibleName('Classe de Armadura 18, era 15: de onde vem')
    expect(vitalsAc()).toHaveTextContent('era 15')
    // O mesmo botão vira "Tirar", com o foco; o Couro volta a ter o "Vestir".
    expect(within(section()).getByRole('button', { name: 'Tirar Cota de Malha' })).toHaveFocus()
    expect(within(section()).getByRole('button', { name: 'Vestir Couro' })).toBeInTheDocument()
    expect(section()).toHaveTextContent('Cota de Malha: desvantagem em Furtividade.')
    expect(screen.getByRole('status')).toHaveTextContent('Tirar Couro leva 1 minuto (a metade com ajuda), e vestir Cota de Malha, 10 minutos (pág. 148)')
    // A CA nova, que só aparece no número, sai na região viva da seção.
    expect(liveRegions().some(r => r.textContent === 'Vestido: Cota de Malha e escudo. CA 18.')).toBe(true)

    // O desfazer volta a troca e a CA.
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(playState().wornArmor).toBeUndefined()
    expect(vitalsAc()).toHaveAccessibleName('Classe de Armadura 15: de onde vem')
  })

  it('o escudo leva uma ação: marca o turno; o "Voltar ao da ficha" leva o foco ao título da seção', () => {
    openStatus(character('fighter', 'leather', 'shield'))
    fireEvent.click(within(section()).getByRole('button', { name: 'Tirar o escudo' }))
    expect(playState().turn.action).toBe(true)
    expect(within(section()).getByRole('button', { name: 'Vestir o escudo' })).toBeInTheDocument()
    expect(vitalsAc()).toHaveAccessibleName('Classe de Armadura 13, era 15: de onde vem')
    expect(section()).toHaveTextContent('Na ficha: Couro e escudo.')

    fireEvent.click(within(section()).getByRole('button', { name: 'Voltar ao da ficha' }))
    expect(playState().wornArmor).toBeUndefined()
    expect(screen.getByRole('heading', { name: 'Equipamento vestido' })).toHaveFocus()
    expect(within(section()).queryByRole('button', { name: 'Voltar ao da ficha' })).toBeNull()
    expect(vitalsAc()).toHaveAccessibleName('Classe de Armadura 15: de onde vem')
  })

  it('o monge que tira a armadura: o deslocamento sobe, com o "era" nos vitais e a linha na seção', () => {
    openStatus(character('monk', 'leather'))
    fireEvent.click(within(section()).getByRole('button', { name: 'Tirar Couro' }))
    // Defesa sem Armadura: 10 + DES 2 + SAB 0; Movimento sem Armadura do monge 6: +4,5 m.
    expect(vitalsAc()).toHaveAccessibleName('Classe de Armadura 12, era 13: de onde vem')
    expect(screen.getByText('13,5 m')).toBeInTheDocument()
    expect(screen.getByText('era 9 m')).toBeInTheDocument()
    expect(section()).toHaveTextContent('Deslocamento inclui +4,5 m sem armadura nem escudo (Movimento sem Armadura).')
  })

  it('a peça sem proficiência avisa na seção; recusado (Atordoado), o aviso diz por quê e o foco fica', () => {
    // O bárbaro não tem proficiência em armadura pesada (pág. 47).
    openStatus(character('barbarian', 'hide', 'plate'))
    expect(within(section()).getByTestId('worn-plate')).toHaveTextContent('sem proficiência')
    fireEvent.click(within(section()).getByRole('button', { name: 'Vestir Placas' }))
    expect(section()).toHaveTextContent('Usando Placas sem proficiência, você tem desvantagem em testes de habilidade')

    usePlayStore.getState().run((st, sh) => addCondition(st, sh, 'stunned'))
    const doff = within(section()).getByRole('button', { name: 'Tirar Placas' })
    doff.focus()
    fireEvent.click(doff)
    expect(playState().wornArmor?.bodyArmorId).toBe('plate')
    expect(screen.getByRole('status')).toHaveTextContent('Tirar Placas: Incapacitado (por Atordoado), sem ações nem reações (pág. 292).')
    expect(doff).toHaveFocus()
  })

  it('a região viva da seção fala só a troca: a CA que um efeito muda (o Escudo da Fé) não diz "Vestido:"', () => {
    openStatus(character('fighter', 'chain-mail', 'shield'))
    const region = () => within(section()).getAllByText((_, el) => el?.getAttribute('aria-live') === 'polite')[0]
    act(() => { usePlayStore.getState().run((st, sh) => activateToggle(st, sh, 'spell:shield-of-faith', { now: 1 })) })
    expect(vitalsAc()).toHaveAccessibleName('Classe de Armadura 20, era 18: de onde vem')
    expect(region()).toHaveTextContent(/^$/)
    // Tirar o escudo é troca: a região fala o vestido e a CA de agora (16 + 2 do Escudo da Fé).
    fireEvent.click(within(section()).getByRole('button', { name: 'Tirar o escudo' }))
    expect(region()).toHaveTextContent('Vestido: Cota de Malha. CA 18.')
  })

  it('com a Maestria em Armadura Média, a linha da armadura média diz a regra da CA (pág. 170)', () => {
    // Humano com o talento e DES 16 (15 + 1): Meia-Armadura 15 + 3 de DES, sem a desvantagem da tabela.
    const d = character('fighter', 'half-plate', 'shield')
    openStatus({ ...d, raceChoices: { ...d.raceChoices, feat: 'maestria-em-armadura-media' }, abilityScores: { ...d.abilityScores, DEX: 15 } })
    expect(within(section()).getByTestId('worn-ac')).toHaveTextContent('CA 20 = 15 (Meia-Armadura) + 3 (DES) + 2 (Escudo)')
    const row = within(section()).getByTestId('worn-half-plate')
    expect(row).toHaveTextContent('Armadura média · CA 15 + Des (máx. +3)')
    expect(row).not.toHaveTextContent('máx. +2')
    expect(section()).not.toHaveTextContent('Furtividade')
  })

  it('a região viva já existe vazia; quem não carrega armadura nem escudo não tem a seção', () => {
    openStatus(character('fighter', 'leather'))
    expect(within(section()).getAllByText((_, el) => el?.getAttribute('aria-live') === 'polite' && el.textContent === '').length).toBe(1)
    cleanup()
    resetPlay()
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    expect(screen.queryByRole('heading', { name: 'Equipamento vestido' })).toBeNull()
  })
})
