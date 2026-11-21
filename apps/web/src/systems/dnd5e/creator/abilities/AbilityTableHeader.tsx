export function AbilityTableHeader() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-parchment-900 bg-parchment-950/80">
      <span className="w-14 text-xs text-parchment-700 font-fantasy uppercase tracking-wide flex-shrink-0">
        Atributo
      </span>
      <span className="flex-1 text-xs text-parchment-700 font-fantasy uppercase tracking-wide">
        Base
      </span>
      <span className="w-10 text-center text-xs text-parchment-700 font-fantasy uppercase tracking-wide flex-shrink-0">
        Raça
      </span>
      <span className="w-9 text-center text-xs text-parchment-700 font-fantasy uppercase tracking-wide flex-shrink-0">
        Final
      </span>
      <span className="w-12 text-center text-xs text-parchment-700 font-fantasy uppercase tracking-wide flex-shrink-0">
        Mod
      </span>
    </div>
  )
}
