import type { ComponentType } from 'react'
import type { PlayTabProps } from './usePlayView'
import { ActionsTab } from './ActionsTab'
import { ChecksTab } from './ChecksTab'
import { MagicTab } from './MagicTab'
import { NotesTab } from './NotesTab'
import { RulesTab } from './RulesTab'
import { StatusTab } from './StatusTab'
import type { SwipeDirection } from './tabSwipe'

export type PlayTabId = 'checks' | 'actions' | 'magic' | 'rules' | 'status' | 'notes'

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
 * rolagem escondida — seis abas, sem 7ª (decisão de 2026-10-30): uma a mais apertaria os alvos de
 * toque. A aba Ações (a antiga Ataques) traz os ataques no grupo Ação, com o checklist do turno no
 * topo. A aba Magia é o grimório (onda `grimorio`): os espaços, as magias por conjuração com o
 * Conjurar e os recursos (Fúria, Chi…), o que o `hint` diz; o texto inteiro de cada magia fica em
 * Regras, só leitura, junto das características.
 */
export const PLAY_TABS: readonly PlayTab[] = [
  { id: 'checks', label: 'Testes', hint: 'Atributos, testes de resistência e perícias, com o que rolar em cada um.', component: ChecksTab },
  { id: 'actions', label: 'Ações', hint: 'O que fazer no turno: atacar, a ação bônus, a reação e o resto, com o custo e o checklist do turno.', component: ActionsTab },
  { id: 'magic', label: 'Magia', hint: 'Espaços de magia, o grimório com o Conjurar, a CD e o ataque de magia e os usos das suas características.', component: MagicTab },
  { id: 'rules', label: 'Regras', hint: 'Suas magias, características, traços e talentos, com a regra inteira a um toque.', component: RulesTab },
  { id: 'status', label: 'Estado', hint: 'Condições, exaustão, concentração e descansos.', component: StatusTab },
  { id: 'notes', label: 'Notas', hint: 'Suas anotações da sessão; com os dados do app, o rolador livre e o histórico de rolagens.', component: NotesTab },
]

/**
 * A aba vizinha de `id` no deslizar do dedo, na ordem da barra; null nas pontas (não dá a volta:
 * da última não se vai à primeira).
 */
export function adjacentPlayTab(id: PlayTabId, direction: SwipeDirection): PlayTabId | null {
  const index = PLAY_TABS.findIndex(t => t.id === id)
  if (index < 0) return null
  return PLAY_TABS[index + (direction === 'next' ? 1 : -1)]?.id ?? null
}

/**
 * A aba que a tecla abre a partir de `id`, no padrão de abas da WAI-ARIA (barra horizontal): as
 * setas de lado andam em círculo — ao contrário do deslizar, da última vai à primeira —, Home e End
 * vão às pontas. null para as outras teclas (para cima e para baixo ficam com a rolagem da página).
 */
export function keyboardPlayTab(id: PlayTabId, key: string): PlayTabId | null {
  const index = PLAY_TABS.findIndex(t => t.id === id)
  const count = PLAY_TABS.length
  const target = key === 'ArrowRight' ? (index + 1) % count
    : key === 'ArrowLeft' ? (index - 1 + count) % count
      : key === 'Home' ? 0
        : key === 'End' ? count - 1
          : null
  return target === null ? null : PLAY_TABS[target].id
}
