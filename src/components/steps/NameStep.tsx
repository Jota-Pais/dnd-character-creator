import { useCharacterStore } from '../../stores/characterStore'

export function NameStep() {
  const name = useCharacterStore(state => state.draft.name)
  const setName = useCharacterStore(state => state.setName)
  const nextStep = useCharacterStore(state => state.nextStep)

  const canAdvance = name.trim().length > 0

  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="text-6xl mb-4">📜</div>

      <h2 className="font-fantasy text-3xl font-bold text-parchment-200 mb-2">
        Como és conhecido,<br />aventureiro?
      </h2>
      <p className="text-parchment-500 mb-10 leading-relaxed">
        Todo herói começa com um nome. Escolha o seu com sabedoria —
        as tavernas, masmorras e histórias vão lembrá-lo para sempre.
      </p>

      <div className="mb-8">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && canAdvance && nextStep()}
          placeholder="Ex: Thalindra Faelorn, Grom Pedraforte…"
          maxLength={60}
          autoFocus
          className="w-full px-5 py-4 rounded-xl border-2 border-parchment-800 bg-parchment-950/60 text-parchment-200 placeholder-parchment-700 text-lg text-center font-fantasy tracking-wide focus:outline-none focus:border-gold-500 focus:shadow-lg focus:shadow-gold-900/20 transition-all"
        />
      </div>

      <button
        onClick={nextStep}
        disabled={!canAdvance}
        className="px-8 py-3 rounded-xl font-fantasy font-bold text-base tracking-wider transition-all duration-200 bg-gold-500 text-parchment-950 hover:bg-gold-400 hover:shadow-lg hover:shadow-gold-900/30 disabled:bg-parchment-900 disabled:text-parchment-700 disabled:cursor-not-allowed"
      >
        Iniciar a Aventura ✦
      </button>
    </div>
  )
}
