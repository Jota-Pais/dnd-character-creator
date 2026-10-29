/**
 * Cores de cada elemento nos selos e botões (texto, fundo e borda). É tela, não regra: mora no site,
 * onde o Tailwind procura as classes e o teste de cores do tema as lê; os nomes ficam no motor
 * (`ELEMENT_NAMES`, ritualUtils).
 */
export const ELEMENT_COLORS: Record<string, string> = {
  blood: 'text-red-500 bg-red-950/30 border-red-900',
  death: 'text-zinc-400 bg-zinc-950/30 border-zinc-800',
  energy: 'text-purple-400 bg-purple-950/30 border-purple-900',
  knowledge: 'text-amber-500 bg-amber-950/30 border-amber-900',
  fear: 'text-white bg-slate-900/50 border-slate-700',
}
