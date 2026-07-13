import { useMemo, useRef, useState } from 'react'
import { exportCharacter as exportDnd, importCharacter as importDnd, type SavedCharacter as DndSaved } from './systems/dnd5e/utils/storage'
import { exportCharacter as exportOrdem, importCharacter as importOrdem, type SavedCharacter as OrdemSaved } from './systems/ordem/utils/storage'
import { useAppStore } from './core/stores/appStore'
import { useCharacterStore as useDndStore } from './systems/dnd5e/stores/characterStore'
import { useOrdemStore } from './systems/ordem/stores/characterStore'
import { dnd5eSystem } from './systems/dnd5e'
import { ordemSystem } from './systems/ordem'

type UnifiedCharacter =
  | (DndSaved & { system: 'dnd5e' })
  | (OrdemSaved & { system: 'ordem' })

export function GlobalGallery() {
  const setActiveSystem = useAppStore(s => s.setActiveSystem)

  // Assina as bibliotecas dos dois sistemas: qualquer ação (criar/duplicar/excluir/importar)
  // atualiza o `library` do store e re-renderiza a galeria — sem estado local nem useEffect.
  const dndLibrary = useDndStore(s => s.library)
  const dndNew = useDndStore(s => s.newCharacter)
  const dndOpen = useDndStore(s => s.openCharacter)
  const dndDuplicate = useDndStore(s => s.duplicateCharacter)
  const dndDelete = useDndStore(s => s.deleteCharacter)
  const dndImport = useDndStore(s => s.importDraft)

  const ordemLibrary = useOrdemStore(s => s.library)
  const ordemNew = useOrdemStore(s => s.newCharacter)
  const ordemOpen = useOrdemStore(s => s.openCharacter)
  const ordemDuplicate = useOrdemStore(s => s.duplicateCharacter)
  const ordemDelete = useOrdemStore(s => s.deleteCharacter)
  const ordemImport = useOrdemStore(s => s.importDraft)

  const [importError, setImportError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showSystemSelect, setShowSystemSelect] = useState(false)

  const characters = useMemo<UnifiedCharacter[]>(() => {
    const dnd = dndLibrary.map(c => ({ ...c, system: 'dnd5e' as const }))
    const ordem = ordemLibrary.map(c => ({ ...c, system: 'ordem' as const }))
    return [...dnd, ...ordem].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [dndLibrary, ordemLibrary])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError(false)

    const dndDraft = await importDnd(file)
    if (dndDraft) {
      dndImport(dndDraft)
      setActiveSystem('dnd5e')
      return
    }

    const ordemDraft = await importOrdem(file)
    if (ordemDraft) {
      ordemImport(ordemDraft)
      setActiveSystem('ordem')
      return
    }

    setImportError(true)
  }

  function handleOpen(char: UnifiedCharacter) {
    if (char.system === 'dnd5e') dndOpen(char.id)
    else ordemOpen(char.id)
    setActiveSystem(char.system)
  }

  function handleDuplicate(char: UnifiedCharacter) {
    if (char.system === 'dnd5e') dndDuplicate(char.id)
    else ordemDuplicate(char.id)
  }

  function handleDelete(char: UnifiedCharacter) {
    if (char.system === 'dnd5e') dndDelete(char.id)
    else ordemDelete(char.id)
  }

  function handleExport(char: UnifiedCharacter) {
    if (char.system === 'dnd5e') exportDnd(char.draft)
    else exportOrdem(char.draft)
  }

  function handleCreate(system: 'dnd5e' | 'ordem') {
    if (system === 'dnd5e') dndNew()
    else ordemNew()
    setActiveSystem(system)
  }

  return (
    <div className="min-h-screen bg-parchment-950 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <div className="text-5xl mb-3">🕯️</div>
          <h1 className="font-fantasy text-4xl font-bold text-gold-400 tracking-wide mb-2">
            Multiverso de Agentes e Aventureiros
          </h1>
          <p className="text-parchment-500 font-fantasy">Escolha o seu destino e comece a jornada.</p>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="font-fantasy text-2xl font-bold text-parchment-200">Meus Personagens</h2>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl border border-parchment-800 text-parchment-400 hover:text-parchment-200 text-sm font-fantasy transition-colors"
            >
              ↑ Importar
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSystemSelect(!showSystemSelect)}
                className="px-4 py-2 rounded-xl font-fantasy font-bold text-sm bg-gold-500 text-parchment-950 hover:bg-gold-400 transition-colors"
              >
                ＋ Novo personagem
              </button>
              {showSystemSelect && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-parchment-900 border border-parchment-800 rounded-xl shadow-xl z-50 overflow-hidden">
                  <button onClick={() => handleCreate('dnd5e')} className="w-full text-left px-4 py-3 hover:bg-parchment-800 font-fantasy text-parchment-200 text-sm border-b border-parchment-800/50">
                    🐉 D&D 5e
                  </button>
                  <button onClick={() => handleCreate('ordem')} className="w-full text-left px-4 py-3 hover:bg-parchment-800 font-fantasy text-parchment-200 text-sm">
                    👁️ Ordem Paranormal
                  </button>
                </div>
              )}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
        </div>

        {importError && (
          <p className="text-red-400 text-sm mb-4">Arquivo inválido — não parece uma ficha exportada compatível.</p>
        )}

        {characters.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-parchment-800 p-10 text-center">
            <div className="text-5xl mb-3">📜</div>
            <p className="text-parchment-400 mb-4">Você ainda não tem personagens salvos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {characters.map(char => (
              <CharacterCard
                key={`${char.system}-${char.id}`}
                char={char}
                onOpen={() => handleOpen(char)}
                onDuplicate={() => handleDuplicate(char)}
                onExport={() => handleExport(char)}
                onDelete={() => handleDelete(char)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CharacterCard({
  char,
  onOpen,
  onDuplicate,
  onExport,
  onDelete,
}: {
  char: UnifiedCharacter
  onOpen: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const name = char.draft.name?.trim() || '(sem nome)'
  const subtitle = char.system === 'dnd5e' ? dnd5eSystem.formatDraftName(char.draft) : ordemSystem.formatDraftName(char.draft)
  const emoji = char.system === 'dnd5e' ? '🐉' : '👁️'
  const systemName = char.system === 'dnd5e' ? 'D&D 5e' : 'Ordem Paranormal'

  return (
    <div className="rounded-xl border border-parchment-800 bg-parchment-950/60 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <button onClick={onOpen} className="flex items-center gap-4 flex-1 min-w-0 text-left">
          <span className="text-3xl shrink-0 opacity-80">{emoji}</span>
          <div className="min-w-0">
            <p className="font-fantasy font-bold text-parchment-200 truncate text-lg">{name}</p>
            <p className="text-parchment-500 text-xs truncate">{subtitle}</p>
            <span className="inline-block mt-1 text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-parchment-900/50 text-parchment-600 border border-parchment-800/50">
              {systemName}
            </span>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2 justify-end border-t border-parchment-900/50 pt-3">
        <IconBtn title="Abrir" onClick={onOpen}>✎</IconBtn>
        <IconBtn title="Duplicar" onClick={onDuplicate}>⧉</IconBtn>
        <IconBtn title="Exportar JSON" onClick={onExport}>↓</IconBtn>
        {confirmDelete ? (
          <>
            <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded-lg bg-red-900/50 text-red-300 font-fantasy border border-red-800/50" title="Confirmar exclusão">Excluir?</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 rounded-lg text-parchment-600 hover:bg-parchment-900/50" title="Cancelar">✕</button>
          </>
        ) : (
          <IconBtn title="Excluir" onClick={() => setConfirmDelete(true)}>🗑</IconBtn>
        )}
      </div>
    </div>
  )
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-parchment-800 text-parchment-400 hover:text-parchment-200 hover:border-parchment-600 hover:bg-parchment-900/50 transition-colors text-sm"
    >
      {children}
    </button>
  )
}
