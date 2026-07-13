import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useOrdemStore } from '../../stores/characterStore'
import { importCharacter } from '../../utils/storage'
import { NEX_STEPS } from '../../utils/progressionUtils'
import { StepNav } from '../common/StepNav'
import simboloMaior from '../../assets/simbolo-maior.webp'

export function NameStep() {
  const name = useOrdemStore(state => state.draft.name)
  const nex = useOrdemStore(state => state.draft.nex)
  const setName = useOrdemStore(state => state.setName)
  const setNex = useOrdemStore(state => state.setNex)
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
      {/* Símbolo Maior ao fundo da PÁGINA — via portal no body, porque o <main> do wizard
          tem transform (animação) e recortaria um position:fixed interno. A arte é branca
          sobre transparente, então vira MÁSCARA de uma camada vermelha. */}
      {createPortal(
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-[0.22]"
          style={{
            backgroundColor: '#dc2626',
            maskImage: `url(${simboloMaior})`,
            WebkitMaskImage: `url(${simboloMaior})`,
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
            maskSize: '105vmin',
            WebkitMaskSize: '105vmin',
          }}
        />,
        document.body,
      )}

      <h2 className="font-fantasy text-3xl font-bold text-parchment-200 mb-8">
        Qual o nome de seu Agente?
      </h2>

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

      <div className="mb-8 rounded-xl border border-parchment-800 bg-parchment-950/60 p-4">
        <p className="text-xs font-fantasy text-parchment-600 uppercase tracking-widest mb-3">
          Nível de Exposição Paranormal (NEX)
        </p>
        <input
          type="range"
          min={0}
          max={NEX_STEPS.length - 1}
          value={NEX_STEPS.indexOf(nex)}
          onChange={e => setNex(NEX_STEPS[Number(e.target.value)])}
          className="w-full accent-gold-500"
        />
        <p className="text-parchment-200 font-fantasy font-bold text-lg mt-1">NEX {nex}%</p>
        <p className="text-parchment-600 text-xs mt-1">
          Todo agente novo começa em 5%. Suba a barra se quiser criar um agente já experiente
          (com trilha, poderes e mais PV/PE/Sanidade já desenvolvidos).
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
