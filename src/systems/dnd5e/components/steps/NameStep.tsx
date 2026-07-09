import { useRef, useState } from 'react'
import { useCharacterStore } from '../../stores/characterStore'
import { importCharacter } from '../../utils/storage'

const ORDINALS = [
  '', '1°', '2°', '3°', '4°', '5°', '6°', '7°', '8°', '9°', '10°',
  '11°', '12°', '13°', '14°', '15°', '16°', '17°', '18°', '19°', '20°',
]

export function NameStep() {
  const name = useCharacterStore(state => state.draft.name)
  const level = useCharacterStore(state => state.draft.level)
  const setName = useCharacterStore(state => state.setName)
  const setLevel = useCharacterStore(state => state.setLevel)
  const nextStep = useCharacterStore(state => state.nextStep)
  const importDraft = useCharacterStore(state => state.importDraft)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState(false)

  const canAdvance = name.trim().length > 0

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError(false)
    const draft = await importCharacter(file)
    if (draft) {
      importDraft(draft)
    } else {
      setImportError(true)
    }
  }

  function handleLevelInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10)
    if (!isNaN(v)) setLevel(v)
  }

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

      <div className="mb-6">
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

      {/* Level selector */}
      <div className="mb-8 rounded-xl border border-parchment-800 bg-parchment-950/60 p-4">
        <p className="text-xs font-fantasy text-parchment-600 uppercase tracking-widest mb-3">
          Nível do Personagem
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={20}
            value={level}
            onChange={e => setLevel(Number(e.target.value))}
            className="flex-1 accent-gold-500"
          />
          <input
            type="number"
            min={1}
            max={20}
            value={level}
            onChange={handleLevelInput}
            className="w-16 px-2 py-1.5 rounded-lg border border-parchment-800 bg-parchment-900 text-parchment-200 text-center font-fantasy font-bold text-lg focus:outline-none focus:border-gold-500"
          />
        </div>
        <p className="text-parchment-600 text-xs mt-2 font-fantasy">
          {ORDINALS[level]} nível — bônus de proficiência +{level <= 4 ? 2 : level <= 8 ? 3 : level <= 12 ? 4 : level <= 16 ? 5 : 6}
        </p>
      </div>

      <button
        onClick={nextStep}
        disabled={!canAdvance}
        className="px-8 py-3 rounded-xl font-fantasy font-bold text-base tracking-wider transition-all duration-200 bg-gold-500 text-parchment-950 hover:bg-gold-400 hover:shadow-lg hover:shadow-gold-900/30 disabled:bg-parchment-900 disabled:text-parchment-700 disabled:cursor-not-allowed"
      >
        Iniciar a Aventura ✦
      </button>

      <div className="mt-8 pt-8 border-t border-parchment-900">
        <p className="text-parchment-700 text-xs mb-3 font-fantasy">Já tem uma ficha?</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-5 py-2 rounded-lg border border-parchment-800 text-parchment-500 hover:text-parchment-300 hover:border-parchment-700 transition-all text-sm font-fantasy"
        >
          Importar ficha (.json)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
        {importError && (
          <p className="text-red-500 text-xs mt-2 font-fantasy">
            Arquivo inválido — selecione um .json exportado por este criador.
          </p>
        )}
      </div>
    </div>
  )
}
