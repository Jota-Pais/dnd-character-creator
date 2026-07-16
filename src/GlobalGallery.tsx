import { useMemo, useRef, useState } from 'react'
import { exportCharacter as exportDnd, importCharacter as importDnd, type SavedCharacter as DndSaved } from './systems/dnd5e/utils/storage'
import { exportCharacter as exportOrdem, importCharacter as importOrdem, type SavedCharacter as OrdemSaved } from './systems/ordem/utils/storage'
import { useAppStore } from './core/stores/appStore'
import { useCharacterStore as useDndStore } from './systems/dnd5e/stores/characterStore'
import { useOrdemStore } from './systems/ordem/stores/characterStore'
import { dnd5eSystem } from './systems/dnd5e'
import { ordemSystem } from './systems/ordem'
import simboloMaior from './systems/ordem/assets/simbolo-maior.webp'

type UnifiedCharacter =
  | (DndSaved & { system: 'dnd5e' })
  | (OrdemSaved & { system: 'ordem' })

/** Paleta por sistema nas linhas da galeria (handoff "Redesign Ordem": chrome neutro, acento por seção). */
const SYSTEM_UI = {
  ordem: {
    rowBorder: '#2a1518', rowBg: '#120a0c', rowHoverBorder: '#7f1d1d', rowHoverBg: '#170c0e',
    avatarBg: '#1a0c0e', avatarBorder: '#7f1d1d', accent: '#ef4444',
    openBg: '#2a0d0f', openBorder: '#7f1d1d', openColor: '#fca5a5', openHoverBg: '#3d1114',
    headerColor: '#fca5a5', rule: 'linear-gradient(90deg,#7f1d1d,transparent)',
    levelLabel: 'NEX',
  },
  dnd5e: {
    rowBorder: '#2a2014', rowBg: '#13100a', rowHoverBorder: '#7a4e05', rowHoverBg: '#181308',
    avatarBg: '#1a150c', avatarBorder: '#7a4e05', accent: '#f0b429',
    openBg: '#241a08', openBorder: '#7a4e05', openColor: '#fcd67a', openHoverBg: '#31230b',
    headerColor: '#fcd67a', rule: 'linear-gradient(90deg,#7a4e05,transparent)',
    levelLabel: 'Nível',
  },
} as const

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

  const ordemChars = useMemo<UnifiedCharacter[]>(
    () => ordemLibrary.map(c => ({ ...c, system: 'ordem' as const })).sort((a, b) => b.updatedAt - a.updatedAt),
    [ordemLibrary],
  )
  const dndChars = useMemo<UnifiedCharacter[]>(
    () => dndLibrary.map(c => ({ ...c, system: 'dnd5e' as const })).sort((a, b) => b.updatedAt - a.updatedAt),
    [dndLibrary],
  )
  const total = ordemChars.length + dndChars.length

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
    setShowSystemSelect(false)
    if (system === 'dnd5e') dndNew()
    else ordemNew()
    setActiveSystem(system)
  }

  return (
    <div className="min-h-screen px-6 lg:px-14 py-10" style={{ backgroundColor: '#0e0c0a', color: '#ede2d6' }}>
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-fantasy font-bold text-2xl" style={{ color: '#f6ece0', letterSpacing: '.04em' }}>MEUS PERSONAGENS</h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#a39685' }}>
              {total === 0 ? 'Nenhuma ficha salva neste navegador' : `${total} ficha${total > 1 ? 's' : ''} salva${total > 1 ? 's' : ''} neste navegador`}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-lg text-[13.5px] transition-colors"
              style={{ border: '1px solid #3a332b', color: '#cbbfae' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#5c5245'; e.currentTarget.style.color = '#ede2d6' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a332b'; e.currentTarget.style.color = '#cbbfae' }}
            >
              ↑ Importar
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSystemSelect(!showSystemSelect)}
                className="px-5 py-2.5 rounded-lg font-fantasy font-bold text-[13.5px] transition-colors"
                style={{ backgroundColor: '#e8d5b7', color: '#1a1510' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f5e8cc' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#e8d5b7' }}
              >
                ＋ Novo personagem
              </button>
              {showSystemSelect && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-lg shadow-xl z-50 overflow-hidden" style={{ backgroundColor: '#171310', border: '1px solid #3a332b' }}>
                  <button onClick={() => handleCreate('ordem')} className="w-full text-left px-4 py-3 font-fantasy text-sm" style={{ color: '#fca5a5', borderBottom: '1px solid #3a332b' }}>
                    👁️ Ordem Paranormal
                  </button>
                  <button onClick={() => handleCreate('dnd5e')} className="w-full text-left px-4 py-3 font-fantasy text-sm" style={{ color: '#fcd67a' }}>
                    🐉 D&D 5e
                  </button>
                </div>
              )}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
        </header>

        {importError && (
          <p className="text-sm mb-4" style={{ color: '#ef4444' }}>Arquivo inválido — não parece uma ficha exportada compatível.</p>
        )}

        {total === 0 && (
          <div className="rounded-xl p-10 text-center" style={{ border: '2px dashed #3a332b' }}>
            <div className="text-5xl mb-3">📜</div>
            <p style={{ color: '#a39685' }}>Você ainda não tem personagens salvos.</p>
          </div>
        )}

        {ordemChars.length > 0 && (
          <Section
            marker={
              <span
                className="w-[26px] h-[26px] inline-block"
                style={{
                  backgroundColor: '#ef4444',
                  maskImage: `url(${simboloMaior})`, WebkitMaskImage: `url(${simboloMaior})`,
                  maskSize: 'contain', WebkitMaskSize: 'contain',
                  maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
                  maskPosition: 'center', WebkitMaskPosition: 'center',
                }}
              />
            }
            title="ORDEM PARANORMAL"
            count={`${ordemChars.length} agente${ordemChars.length > 1 ? 's' : ''}`}
            ui={SYSTEM_UI.ordem}
          >
            {ordemChars.map(c => (
              <CharacterRow key={`ordem-${c.id}`} char={c} onOpen={() => handleOpen(c)} onDuplicate={() => handleDuplicate(c)} onExport={() => handleExport(c)} onDelete={() => handleDelete(c)} />
            ))}
          </Section>
        )}

        {dndChars.length > 0 && (
          <Section
            marker={<span className="text-xl">🐉</span>}
            title="DUNGEONS & DRAGONS 5E"
            count={`${dndChars.length} aventureiro${dndChars.length > 1 ? 's' : ''}`}
            ui={SYSTEM_UI.dnd5e}
          >
            {dndChars.map(c => (
              <CharacterRow key={`dnd-${c.id}`} char={c} onOpen={() => handleOpen(c)} onDuplicate={() => handleDuplicate(c)} onExport={() => handleExport(c)} onDelete={() => handleDelete(c)} />
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ marker, title, count, ui, children }: {
  marker: React.ReactNode
  title: string
  count: string
  ui: (typeof SYSTEM_UI)[keyof typeof SYSTEM_UI]
  children: React.ReactNode
}) {
  return (
    <section className="mb-9">
      <div className="flex items-center gap-3.5 mb-3.5">
        {marker}
        <span className="font-fantasy font-bold text-base" style={{ color: ui.headerColor, letterSpacing: '.08em' }}>{title}</span>
        <span className="text-xs rounded-full px-2.5 py-0.5" style={{ color: '#a08b80', border: '1px solid #3d2a2c' }}>{count}</span>
        <div className="flex-1 h-px" style={{ background: ui.rule }} />
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

function CharacterRow({ char, onOpen, onDuplicate, onExport, onDelete }: {
  char: UnifiedCharacter
  onOpen: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hover, setHover] = useState(false)
  const ui = SYSTEM_UI[char.system]
  const name = char.draft.name?.trim() || '(sem nome)'
  const subtitle = char.system === 'dnd5e' ? dnd5eSystem.formatDraftName(char.draft) : ordemSystem.formatDraftName(char.draft)
  const levelValue = char.system === 'dnd5e' ? `${char.draft.level}` : `${char.draft.nex}%`

  return (
    <div
      className="rounded-[10px] px-5 py-3 grid items-center gap-4 transition-colors"
      style={{
        gridTemplateColumns: '40px 1.4fr 1fr auto auto',
        border: `1px solid ${hover ? ui.rowHoverBorder : ui.rowBorder}`,
        backgroundColor: hover ? ui.rowHoverBg : ui.rowBg,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Avatar losango: quadrado 40px rotacionado 45° com a inicial */}
      <div className="w-10 h-10 flex items-center justify-center" style={{ transform: 'rotate(45deg)', backgroundColor: ui.avatarBg, border: `2px solid ${ui.avatarBorder}` }}>
        <span className="font-fantasy font-black text-sm" style={{ transform: 'rotate(-45deg)', color: ui.accent }}>{name.charAt(0).toUpperCase()}</span>
      </div>
      <div className="min-w-0">
        <p className="font-fantasy font-bold text-base truncate" style={{ color: '#f6ece0' }}>{name}</p>
        <p className="text-[12.5px] truncate" style={{ color: '#b3a094' }}>{subtitle}</p>
      </div>
      <div className="text-[13px] invisible sm:visible" style={{ color: '#cbb8a8' }}>
        {ui.levelLabel} <span className="font-fantasy font-black text-base" style={{ color: ui.accent }}>{levelValue}</span>
      </div>
      <button
        onClick={onOpen}
        className="px-5 py-2 rounded-lg font-fantasy font-bold text-[13px] transition-colors"
        style={{ backgroundColor: ui.openBg, border: `1px solid ${ui.openBorder}`, color: ui.openColor }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = ui.openHoverBg }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = ui.openBg }}
      >
        Abrir
      </button>
      <div className="flex gap-1.5">
        <IconBtn title="Duplicar" onClick={onDuplicate}>⧉</IconBtn>
        <IconBtn title="Exportar JSON" onClick={onExport}>↓</IconBtn>
        {confirmDelete ? (
          <>
            <button onClick={onDelete} className="text-xs px-2.5 rounded-lg font-fantasy" style={{ backgroundColor: '#2a0d0f', color: '#ef4444', border: '1px solid #7f1d1d' }} title="Confirmar exclusão">Excluir?</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-2" style={{ color: '#8a7368' }} title="Cancelar">✕</button>
          </>
        ) : (
          <IconBtn title="Excluir" onClick={() => setConfirmDelete(true)} danger dangerColor={ui.accent} dangerBorder={ui.openBorder}>🗑</IconBtn>
        )}
      </div>
    </div>
  )
}

function IconBtn({ title, onClick, children, danger, dangerColor, dangerBorder }: {
  title: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
  dangerColor?: string
  dangerBorder?: string
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-[35px] h-[35px] flex items-center justify-center rounded-lg text-[13px] transition-colors"
      style={{ border: '1px solid #3d2a2c', color: danger ? '#8a7368' : '#b3a094' }}
      onMouseEnter={e => {
        if (danger) { e.currentTarget.style.color = dangerColor ?? '#ef4444'; e.currentTarget.style.borderColor = dangerBorder ?? '#7f1d1d' }
        else e.currentTarget.style.color = '#ede2d6'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = danger ? '#8a7368' : '#b3a094'
        e.currentTarget.style.borderColor = '#3d2a2c'
      }}
    >
      {children}
    </button>
  )
}
