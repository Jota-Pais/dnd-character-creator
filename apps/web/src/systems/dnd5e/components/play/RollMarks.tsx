import type { RollGuideEntry } from '@rpg/rules/systems/dnd5e/utils/rollGuide'

/** ▲ vantagem / ▼ desvantagem ao lado de um número que é rolagem, com o texto para leitor de tela. */
export function ModeMark({ entry }: { entry: RollGuideEntry }) {
  if (entry.mode === 'advantage') return <span className="text-emerald-300 text-xs" title="Com vantagem">▲<span className="sr-only"> com vantagem</span></span>
  if (entry.mode === 'disadvantage') return <span className="text-red-300 text-xs" title="Com desvantagem">▼<span className="sr-only"> com desvantagem</span></span>
  return null
}

/** ✕ discreto quando a jogada falha automaticamente (TR de FOR/DES do Paralisado, por exemplo). */
export function AutoFailMark({ entry }: { entry: RollGuideEntry }) {
  if (entry.autoFail.length === 0) return null
  return <span className="text-red-400 text-xs font-bold" title="Falha automática">✕<span className="sr-only"> falha automática</span></span>
}

/** Os dois marcadores juntos, na ordem em que aparecem ao lado do número. */
export function RollMarks({ entry }: { entry: RollGuideEntry }) {
  return (
    <>
      <ModeMark entry={entry} />
      <AutoFailMark entry={entry} />
    </>
  )
}
