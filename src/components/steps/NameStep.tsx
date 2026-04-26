import { useCharacterStore } from '../../stores/characterStore'

export function NameStep() {
  const name = useCharacterStore(state => state.draft.name)
  const setName = useCharacterStore(state => state.setName)
  const nextStep = useCharacterStore(state => state.nextStep)

  const canAdvance = name.trim().length > 0

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-stone-100 mb-2">Como se chama o seu personagem?</h2>
      <p className="text-stone-400 mb-8">
        Escolha um nome que combine com a história que você quer contar.
      </p>

      <div className="mb-8">
        <label htmlFor="character-name" className="block text-sm font-medium text-stone-300 mb-2">
          Nome do personagem
        </label>
        <input
          id="character-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && canAdvance && nextStep()}
          placeholder="Ex: Thalindra Faelorn"
          maxLength={60}
          className="w-full px-4 py-3 bg-stone-800 border border-stone-600 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-lg"
          autoFocus
        />
      </div>

      <button
        onClick={nextStep}
        disabled={!canAdvance}
        className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-700 disabled:text-stone-500 disabled:cursor-not-allowed text-stone-950 font-bold rounded-lg transition-colors"
      >
        Continuar →
      </button>
    </div>
  )
}
