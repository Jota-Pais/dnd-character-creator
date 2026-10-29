/**
 * Avisos de perícia ou ferramenta escolhida que outra fonte já dá (p. 125), embaixo do seletor que
 * a escolheu. A escolha continua marcada, com o aviso, até o jogador trocar — a etapa reprova
 * enquanto isso, com o mesmo texto na pendência. Nunca se apaga em silêncio.
 *
 * `ids` é o que este seletor escolheu, na ordem dele; `notes` vem de `getRepeatedProficiencyNotes`
 * (ou de `ClassSlotProficiencies`). O chip da escolha usa `REPEATED_CHIP_STYLE` (repeatedChipStyle).
 */
export function RepeatedProficiencyNotes({ ids, notes }: { ids: string[]; notes: Record<string, string> }) {
  const lines = ids.filter(id => notes[id] !== undefined)
  if (lines.length === 0) return null
  return (
    <div className="mt-2 space-y-0.5">
      {lines.map(id => (
        <p key={id} className="text-xs text-red-400 font-semibold">⚠ {notes[id]}</p>
      ))}
    </div>
  )
}
