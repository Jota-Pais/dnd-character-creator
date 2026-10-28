import type { ComponentType } from 'react'
import type { PlayTabProps } from './usePlayView'
import { AttacksTab } from './AttacksTab'
import { ChecksTab } from './ChecksTab'
import { MagicTab } from './MagicTab'
import { NotesTab } from './NotesTab'
import { RulesTab } from './RulesTab'
import { StatusTab } from './StatusTab'

export type PlayTabId = 'checks' | 'attacks' | 'magic' | 'rules' | 'status' | 'notes'

export type PlayTab = {
  id: PlayTabId
  label: string
  /** O que a aba vai mostrar, para o espaço reservado enquanto ela não existe. */
  hint: string
  /** O conteúdo da aba. Sem ele, a tela mostra o espaço reservado com o `hint`. */
  component?: ComponentType<PlayTabProps>
}

/**
 * Abas da tela de jogo, na ordem em que aparecem. Para plugar uma aba, crie o componente (que
 * recebe `PlayTabProps`) e ponha em `component` — a `PlayScreen` não muda.
 *
 * Rótulos de uma palavra: no celular as abas dividem a largura (360 px) em colunas iguais, sem
 * rolagem escondida. A aba Magia também traz os recursos (Fúria, Chi…), o que o `hint` diz; a
 * lista de magias, com o texto de cada uma, fica em Regras, junto das características.
 */
export const PLAY_TABS: readonly PlayTab[] = [
  { id: 'checks', label: 'Testes', hint: 'Atributos, testes de resistência e perícias, com o que rolar em cada um.', component: ChecksTab },
  { id: 'attacks', label: 'Ataques', hint: 'Suas armas: o ataque, o dano e o crítico.', component: AttacksTab },
  { id: 'magic', label: 'Magia', hint: 'Espaços de magia, CD, ataque de magia e os usos das suas características.', component: MagicTab },
  { id: 'rules', label: 'Regras', hint: 'Suas magias, características, traços e talentos, com a regra inteira a um toque.', component: RulesTab },
  { id: 'status', label: 'Estado', hint: 'Condições, exaustão, concentração e descansos.', component: StatusTab },
  { id: 'notes', label: 'Notas', hint: 'Suas anotações da sessão; com os dados do app, o rolador livre e o histórico de rolagens.', component: NotesTab },
]
