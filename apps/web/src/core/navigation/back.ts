import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * O "voltar" do app: o botão voltar do Android, no APK (core/native/nativeApp.ts;
 * docs/app-android.md). O app não usa o histórico do navegador, então cada tela e cada folha
 * aberta diz o que o voltar faz nela, e o voltar faz o da camada de cima: a folha ou o menu aberto
 * fecha antes de a tela voltar. Sem nenhum (a galeria), não há para onde voltar.
 */
export type BackLayer = 'screen' | 'overlay'

type Entry = { layer: BackLayer; order: number; run: () => void }

const LAYER_RANK: Record<BackLayer, number> = { screen: 0, overlay: 1 }

const entries = new Set<Entry>()
let nextOrder = 0

/**
 * Registra o que o voltar faz enquanto a tela (ou a folha) está aberta. Devolve o cancelamento.
 * A camada manda, não a ordem de registro: a folha que monta junto com a tela (o efeito do filho
 * roda antes do do pai) continua por cima dela.
 */
export function registerBackHandler(layer: BackLayer, run: () => void): () => void {
  const entry: Entry = { layer, order: nextOrder++, run }
  entries.add(entry)
  return () => {
    entries.delete(entry)
  }
}

/**
 * Há algo aberto que o voltar fecharia: uma tela fora da galeria, uma folha, um menu. Na galeria sem
 * nada aberto, nada (é ela que a versão nova espera para entrar sozinha, core/pwa/serviceWorker.ts).
 */
export function hasOpenLayer(): boolean {
  return entries.size > 0
}

/** Faz o voltar da camada de cima (a mais recente, na mesma camada). False: não há para onde voltar. */
export function handleBack(): boolean {
  let top: Entry | null = null
  for (const entry of entries) {
    if (!top || LAYER_RANK[entry.layer] > LAYER_RANK[top.layer]
      || (entry.layer === top.layer && entry.order > top.order)) top = entry
  }
  if (!top) return false
  top.run()
  return true
}

/**
 * O caminho percorrido no criador desde que ele abriu, para o voltar do Android refazê-lo, como o
 * voltar de qualquer app: cada etapa aberta entra no caminho, e abrir a etapa de onde se veio (pelo
 * voltar, pelo "← Voltar" do rodapé ou pelo stepper) a tira. Devolve a etapa de onde se veio, ou
 * null na primeira que se abriu: a de uma ficha nova, ou a do "Abrir" na galeria (a Revisão, numa
 * ficha pronta), de onde o voltar leva de volta à galeria. O Esc e o "← Voltar" do rodapé
 * continuam indo à etapa anterior do fluxo.
 */
export function useStepPath<Step extends string>(step: Step): () => Step | null {
  const path = useRef<Step[]>([])
  useEffect(() => {
    const steps = path.current
    if (steps[steps.length - 1] === step) return
    if (steps[steps.length - 2] === step) steps.pop()
    else steps.push(step)
  }, [step])
  return () => path.current[path.current.length - 2] ?? null
}

/**
 * O voltar desta tela (ou folha) enquanto ela está montada; `null` não registra (o menu fechado).
 * A função pode mudar a cada desenho: o voltar chama a do último.
 */
export function useBackHandler(handler: (() => void) | null, layer: BackLayer = 'screen'): void {
  const handlerRef = useRef(handler)
  useLayoutEffect(() => {
    handlerRef.current = handler
  })
  const enabled = handler !== null
  useEffect(() => {
    if (!enabled) return
    return registerBackHandler(layer, () => handlerRef.current?.())
  }, [enabled, layer])
}
