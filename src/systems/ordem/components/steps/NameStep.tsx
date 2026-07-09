import { useRef, useState } from 'react'
import { useOrdemStore } from '../../stores/characterStore'
import { importCharacter } from '../../utils/storage'
import { StepNav } from '../common/StepNav'

export function NameStep() {
  const name = useOrdemStore(state => state.draft.name)
  const concept = useOrdemStore(state => state.draft.concept)
  const setName = useOrdemStore(state => state.setName)
  const setConcept = useOrdemStore(state => state.setConcept)
  const nextStep = useOrdemStore(state => state.nextStep)
  const importDraft = useOrdemStore(state => state.importDraft)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState(false)

  const canAdvance = name.trim().length > 0

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError(false)
    const draft = await importCharacter(file)
    if (draft) importDraft(draft)
    else setImportError(true)
  }

  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="text-6xl mb-4">🕯️</div>

      <h2 className="font-fantasy text-3xl font-bold text-parchment-200 mb-2">
        Quem é você antes<br />de cruzar o véu?
      </h2>
      <p className="text-parchment-500 mb-8 leading-relaxed">
        Todo agente da Ordem tem uma vida antes do Paranormal. Escolha um nome
        e resuma quem seu personagem é numa frase curta — isso vai guiar as próximas escolhas.
      </p>

      <div className="mb-4">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Bianca Alencar, Rafael Torres…"
          maxLength={60}
          autoFocus
          className="w-full px-5 py-4 rounded-xl border-2 border-parchment-800 bg-parchment-950/60 text-parchment-200 placeholder-parchment-700 text-lg text-center font-fantasy tracking-wide focus:outline-none focus:border-gold-500 focus:shadow-lg focus:shadow-gold-900/20 transition-all"
        />
      </div>

      <div className="mb-8">
        <textarea
          value={concept}
          onChange={e => setConcept(e.target.value)}
          placeholder="Ex: uma cientista forense curiosa e corajosa, que ainda não sabe usar armas"
          maxLength={280}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border-2 border-parchment-800 bg-parchment-950/60 text-parchment-200 placeholder-parchment-700 text-sm text-left focus:outline-none focus:border-gold-500 transition-all resize-none"
        />
        <p className="text-parchment-700 text-xs mt-1 text-left">
          Conceito (opcional, mas ajuda a decidir origem e classe a seguir).
        </p>
      </div>

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

      <StepNav onNext={nextStep} canAdvance={canAdvance} nextLabel="Continuar ✦" />
    </div>
  )
}
