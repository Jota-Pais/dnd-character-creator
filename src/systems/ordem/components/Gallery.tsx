import { useRef, useState } from 'react'
import { useOrdemStore } from '../stores/characterStore'
import { getOrdemClass } from '../utils/classUtils'
import { getOrigin } from '../utils/originUtils'
import { exportCharacter, importCharacter, type SavedCharacter } from '../utils/storage'
import type { OrdemCharacterDraft } from '../types/character'

const CLASS_EMOJI: Record<string, string> = {
  combatant: '⚔️',
  specialist: '🧠',
  occultist: '🔮',
}

export function Gallery() {
  const library = useOrdemStore(state => state.library)
  const newCharacter = useOrdemStore(state => state.newCharacter)
  const openCharacter = useOrdemStore(state => state.openCharacter)
  const duplicateCharacter = useOrdemStore(state => state.duplicateCharacter)
  const deleteCharacter = useOrdemStore(state => state.deleteCharacter)
  const importDraft = useOrdemStore(state => state.importDraft)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState(false)

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError(false)
    const draft = await importCharacter(file)
    if (draft) importDraft(draft)
    else setImportError(true)
  }

  const sorted = [...library].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200">Meus Agentes</h2>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl border border-parchment-800 text-parchment-400 hover:text-parchment-200 text-sm font-fantasy transition-colors"
          >
            ↑ Importar
          </button>
          <button
            onClick={newCharacter}
            className="px-4 py-2 rounded-xl font-fantasy font-bold text-sm bg-gold-500 text-parchment-950 hover:bg-gold-400 transition-colors"
          >
            ＋ Novo agente
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
      </div>

      {importError && (
        <p className="text-red-400 text-sm mb-4">Arquivo inválido — não parece uma ficha exportada.</p>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-parchment-800 p-10 text-center">
          <div className="text-5xl mb-3">🕯️</div>
          <p className="text-parchment-400 mb-4">Você ainda não tem agentes salvos.</p>
          <button
            onClick={newCharacter}
            className="px-5 py-2.5 rounded-xl font-fantasy font-bold text-sm bg-gold-500 text-parchment-950 hover:bg-gold-400 transition-colors"
          >
            ＋ Criar meu primeiro agente
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(char => (
            <CharacterCard
              key={char.id}
              char={char}
              onOpen={() => openCharacter(char.id)}
              onDuplicate={() => duplicateCharacter(char.id)}
              onExport={() => exportCharacter(char.draft)}
              onDelete={() => deleteCharacter(char.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function describe(draft: OrdemCharacterDraft): { emoji: string; subtitle: string } {
  const origin = draft.origin ? getOrigin(draft.origin) : undefined
  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  const emoji = cls ? (CLASS_EMOJI[cls.id] ?? '🕯️') : '🕯️'
  const parts = [origin?.name, cls?.name].filter(Boolean)
  const subtitle = parts.length > 0 ? parts.join(' · ') : 'Agente incompleto'
  return { emoji, subtitle }
}

function CharacterCard({
  char,
  onOpen,
  onDuplicate,
  onExport,
  onDelete,
}: {
  char: SavedCharacter
  onOpen: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { emoji, subtitle } = describe(char.draft)
  const name = char.draft.name.trim() || '(sem nome)'

  return (
    <div className="rounded-xl border border-parchment-800 bg-parchment-950/60 p-4 flex items-center gap-4">
      <button onClick={onOpen} className="flex items-center gap-4 flex-1 min-w-0 text-left">
        <span className="text-3xl shrink-0">{emoji}</span>
        <div className="min-w-0">
          <p className="font-fantasy font-bold text-parchment-200 truncate">{name}</p>
          <p className="text-parchment-500 text-sm truncate">{subtitle}</p>
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        <IconBtn title="Abrir" onClick={onOpen}>✎</IconBtn>
        <IconBtn title="Duplicar" onClick={onDuplicate}>⧉</IconBtn>
        <IconBtn title="Exportar JSON" onClick={onExport}>↓</IconBtn>
        {confirmDelete ? (
          <>
            <button onClick={onDelete} className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-300 font-fantasy" title="Confirmar exclusão">Excluir?</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 text-parchment-600" title="Cancelar">✕</button>
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
      className="w-8 h-8 rounded-lg border border-parchment-800 text-parchment-400 hover:text-parchment-200 hover:border-parchment-600 transition-colors text-sm"
    >
      {children}
    </button>
  )
}
