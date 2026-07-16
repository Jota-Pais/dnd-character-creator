import { useEffect } from 'react'
import { useAppStore } from '../../core/stores/appStore'
import { useOrdemStore } from './stores/characterStore'
import { StepIndicator } from '../../components/wizard/StepIndicator'
import { ordemSystem } from './index'
import simboloMaior from './assets/simbolo-maior.webp'

export function OrdemApp() {
  const setActiveSystem = useAppStore(state => state.setActiveSystem)
  const view = useOrdemStore(state => state.view)
  const currentStep = useOrdemStore(state => state.currentStep)
  const draft = useOrdemStore(state => state.draft)
  const name = draft.name
  const prevStep = useOrdemStore(state => state.prevStep)
  const goToStep = useOrdemStore(state => state.goToStep)
  const goToGallery = useOrdemStore(state => state.goToGallery)
  const exitPrint = useOrdemStore(state => state.exitPrint)

  const PrintableSheet = ordemSystem.PrintableSheet
  const steps = ordemSystem.getSteps()
  const CurrentStepComponent = steps.find(s => s.id === currentStep)?.component
  // Navegação livre: uma etapa é clicável se todas as anteriores estão completas
  // (o mesmo alcance de avançar com "próximo" — nunca pula validação).
  const firstIncompleteIdx = steps.findIndex(s => !s.isComplete(draft))
  const maxReachableIdx = firstIncompleteIdx === -1 ? steps.length - 1 : firstIncompleteIdx
  const stepIndicatorProps = steps.map((s, i) => ({ id: s.id, label: s.title, clickable: i <= maxReachableIdx }))

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep, view])

  // Na tela de impressão, o título do documento vira o nome-padrão do PDF salvo.
  useEffect(() => {
    if (view !== 'print') return
    const previous = document.title
    document.title = `${name.trim() || 'Agente'} — Ordem Paranormal`
    return () => { document.title = previous }
  }, [view, name])

  useEffect(() => {
    if (view !== 'wizard') return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      prevStep()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [prevStep, view])

  if (view === 'print') {
    return (
      <div className="theme-ordem min-h-screen py-6 px-4">
        <div className="no-print max-w-[820px] mx-auto mb-4 flex justify-between items-center">
          <button
            onClick={exitPrint}
            className="px-4 py-2 text-parchment-400 hover:text-parchment-200 text-sm font-fantasy transition-colors"
          >
            ← Voltar
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 rounded-xl font-fantasy font-bold text-sm bg-gold-500 text-parchment-950 hover:bg-gold-400 transition-colors"
          >
            🖨 Imprimir / Salvar PDF
          </button>
        </div>
        <div className="overflow-x-auto print:overflow-visible">
          <PrintableSheet />
        </div>
        <p className="no-print max-w-[820px] mx-auto mt-4 text-center text-parchment-700 text-xs">
          Dica: na janela de impressão, escolha "Salvar como PDF" como destino.
        </p>
      </div>
    )
  }

  const stepIndex = steps.findIndex(s => s.id === currentStep)

  return (
    <div className="theme-ordem min-h-screen flex" style={{ backgroundColor: '#0b0608' }}>
      {/* Sidebar (desktop) — handoff "Redesign Ordem": 250px, logo + etapas + Meus agentes */}
      <aside
        className="hidden lg:flex w-[250px] shrink-0 flex-col py-6 sticky top-0 h-screen z-10"
        style={{ backgroundColor: '#0e080a', borderRight: '1px solid #2a1518' }}
      >
        <div className="flex items-center gap-3 px-5 pb-4" style={{ borderBottom: '1px solid #2a1518' }}>
          <div
            className="w-[34px] h-[34px] shrink-0"
            style={{
              backgroundColor: '#dc2626',
              maskImage: `url(${simboloMaior})`, WebkitMaskImage: `url(${simboloMaior})`,
              maskSize: 'contain', WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center', WebkitMaskPosition: 'center',
            }}
          />
          <div>
            <div className="font-fantasy font-bold text-[13px] tracking-wide" style={{ color: '#f3e9dc' }}>ORDEM</div>
            <div className="text-[10px] uppercase" style={{ color: '#a08b80', letterSpacing: '.13em' }}>Criador de Agente</div>
          </div>
        </div>

        {name && (
          <div className="px-5 pt-3 text-xs" style={{ color: '#a08b80' }}>
            Agente: <span className="font-fantasy font-semibold" style={{ color: '#fca5a5' }}>{name}</span> · NEX {draft.nex}%
          </div>
        )}

        <div className="px-5 pt-4 pb-1.5 text-[10px] uppercase" style={{ color: '#a08b80', letterSpacing: '.16em' }}>Etapas</div>
        <nav className="flex flex-col gap-0.5 px-2.5">
          {steps.map((s, i) => {
            const done = i < stepIndex
            const active = i === stepIndex
            const clickable = i <= maxReachableIdx && !active
            return (
              <button
                key={s.id}
                onClick={() => { if (clickable) goToStep(s.id as typeof currentStep) }}
                disabled={!clickable && !active}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                style={{
                  backgroundColor: active ? '#2a0d0f' : 'transparent',
                  border: active ? '1px solid #7f1d1d' : '1px solid transparent',
                  cursor: clickable ? 'pointer' : active ? 'default' : 'not-allowed',
                }}
                onMouseEnter={e => { if (clickable) e.currentTarget.style.backgroundColor = '#170d0f' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <span
                  className="w-[23px] h-[23px] shrink-0 rounded-full flex items-center justify-center font-fantasy font-bold text-[11.5px]"
                  style={done
                    ? { backgroundColor: '#7f1d1d', color: '#fecaca' }
                    : { border: `2px solid ${active ? '#ef4444' : '#3d2a2c'}`, color: active ? '#ef4444' : '#8a7368' }}
                >
                  {done ? '✦' : i + 1}
                </span>
                <span
                  className="font-fantasy text-[12.5px]"
                  style={{ color: active ? '#fca5a5' : done ? '#cbb8a8' : '#b3a094', fontWeight: active ? 700 : 600 }}
                >
                  {s.title}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="mt-auto px-5 pt-4" style={{ borderTop: '1px solid #2a1518' }}>
          <button onClick={goToGallery} className="text-xs transition-colors" style={{ color: '#a08b80' }}>
            ← <span style={{ color: '#cbb8a8' }}>Meus agentes</span>
          </button>
          <button onClick={() => setActiveSystem(null)} className="block mt-2 text-[11px] transition-colors" style={{ color: '#8a7368' }}>
            Trocar de sistema
          </button>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 relative overflow-hidden flex flex-col min-h-screen">
        {/* Sigilo ambiente girando + vinheta vermelha no mesmo canto */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            right: '-220px', top: '-160px', width: '640px', height: '640px',
            backgroundColor: '#dc2626', opacity: 0.12,
            maskImage: `url(${simboloMaior})`, WebkitMaskImage: `url(${simboloMaior})`,
            maskSize: 'contain', WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
            animation: 'sigilSpin 240s linear infinite',
          }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 85% 0%, rgba(127,29,29,.18), transparent 55%)' }} />

        {/* Stepper horizontal no mobile (a sidebar some) */}
        <div className="lg:hidden pt-6 pb-2 flex justify-center relative">
          <StepIndicator steps={stepIndicatorProps} currentStepId={currentStep} onStepClick={id => goToStep(id as typeof currentStep)} />
        </div>

        <main key={currentStep} className="animate-fade-in relative flex-1 px-4 lg:px-10 pt-6 lg:pt-10 pb-28 lg:pb-32">
          <div className="text-center mb-6">
            <p className="text-[11px] uppercase font-semibold" style={{ color: '#ef4444', letterSpacing: '.22em' }}>
              Etapa {stepIndex + 1} de {steps.length} · {steps[stepIndex]?.title}
            </p>
          </div>
          {CurrentStepComponent && <CurrentStepComponent />}
        </main>
      </div>
    </div>
  )
}
