import type { ReactNode } from 'react'
import { StepIndicator } from './StepIndicator'

export type ShellStep = {
  id: string
  label: string
  /** Completude real do draft — não a posição no fluxo. */
  complete: boolean
}

type Props = {
  /** Marca do sistema no topo da sidebar. Ex.: "ORDEM", "D&D 5E". */
  systemLabel: string
  /** Linha de baixo, em caixa alta pequena. Ex.: "Criador de Agente". */
  systemSubtitle: string
  /** Símbolo de 34px ao lado do nome do sistema. */
  logo: ReactNode
  /** Mesmo símbolo em grande, girando atrás do conteúdo. O shell posiciona e anima. */
  watermark?: ReactNode
  /** Resumo do personagem na sidebar (nome + nível/NEX). Some enquanto não há nome. */
  characterSummary?: ReactNode
  steps: ShellStep[]
  currentStepId: string
  /**
   * Quantas etapas impedem concluir a ficha. Cada sistema conta do seu jeito (o Ordem tira a
   * Revisão da conta; o D&D usa getMissingSteps), então vem pronto de fora.
   */
  pendingCount: number
  onStepClick: (id: string) => void
  onGallery: () => void
  /** Ex.: "Meus agentes", "Meus personagens". */
  galleryLabel: string
  onSwitchSystem: () => void
  children: ReactNode
}

/** Amarelo de aviso: é semântico, não de marca — não acompanha o tema do sistema. */
const WARNING = '#c9a05a'

/**
 * Casca do wizard, compartilhada pelos sistemas (nasceu do handoff "Redesign Ordem" e foi
 * generalizada pra valer também no D&D). Só usa tokens de cor, então o `.theme-ordem` no
 * elemento raiz re-tematiza tudo sem o shell saber de que sistema se trata.
 *
 * No desktop: sidebar de 250px com marca, resumo, etapas e rodapé. Abaixo de `lg` a sidebar
 * some e o stepper horizontal assume — o `StepNav` de cada etapa acompanha com o mesmo breakpoint.
 */
export function WizardShell({
  systemLabel,
  systemSubtitle,
  logo,
  watermark,
  characterSummary,
  steps,
  currentStepId,
  pendingCount,
  onStepClick,
  onGallery,
  galleryLabel,
  onSwitchSystem,
  children,
}: Props) {
  const stepIndex = steps.findIndex(s => s.id === currentStepId)

  return (
    <div className="min-h-screen flex bg-surface-base">
      <aside className="hidden lg:flex w-[250px] shrink-0 flex-col py-6 sticky top-0 h-screen z-10 bg-surface-raised border-r border-parchment-900">
        <div className="flex items-center gap-3 px-5 pb-4 border-b border-parchment-900">
          <div className="w-[34px] h-[34px] shrink-0 text-gold-500">{logo}</div>
          <div>
            <div className="font-fantasy font-bold text-[13px] tracking-wide text-parchment-100">
              {systemLabel}
            </div>
            <div className="text-[10px] uppercase text-parchment-600" style={{ letterSpacing: '.13em' }}>
              {systemSubtitle}
            </div>
          </div>
        </div>

        {characterSummary && (
          <div className="px-5 pt-3 text-xs text-parchment-600">{characterSummary}</div>
        )}

        <div className="px-5 pt-4 pb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[10px] uppercase text-parchment-600" style={{ letterSpacing: '.16em' }}>
            Etapas
          </span>
          {pendingCount > 0 && (
            <span
              className="text-[10px]"
              style={{ color: WARNING }}
              title="Pendências que impedem concluir a ficha"
            >
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <nav className="flex flex-col gap-0.5 px-2.5">
          {steps.map((step, i) => {
            const active = step.id === currentStepId
            return (
              <button
                key={step.id}
                onClick={() => { if (!active) onStepClick(step.id) }}
                disabled={active}
                title={active ? undefined : step.complete ? `Revisar ${step.label}` : `Preencher ${step.label}`}
                className={[
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors border',
                  active
                    ? 'bg-gold-900 border-gold-800 cursor-default'
                    : 'bg-transparent border-transparent hover:bg-gold-900/45 cursor-pointer',
                ].join(' ')}
              >
                <span
                  className={[
                    'w-[23px] h-[23px] shrink-0 rounded-full flex items-center justify-center font-fantasy font-bold text-[11.5px] border-2',
                    step.complete
                      ? 'bg-gold-800 border-gold-800 text-gold-300'
                      : active
                        ? 'border-gold-400 text-gold-400'
                        : 'border-parchment-800 text-parchment-700',
                  ].join(' ')}
                >
                  {step.complete ? '✦' : i + 1}
                </span>
                <span
                  className={[
                    'font-fantasy text-[12.5px]',
                    active
                      ? 'text-gold-300 font-bold'
                      : step.complete
                        ? 'text-parchment-400 font-semibold'
                        : 'text-parchment-500 font-semibold',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="mt-auto px-5 pt-4 border-t border-parchment-900">
          <button onClick={onGallery} className="text-xs text-parchment-600 transition-colors hover:text-parchment-300">
            ← <span className="text-parchment-400">{galleryLabel}</span>
          </button>
          <button
            onClick={onSwitchSystem}
            className="block mt-2 text-[11px] text-parchment-600 transition-colors hover:text-parchment-300"
          >
            Trocar de sistema
          </button>
          {/* Assinatura do projeto: vivia no rodapé do wizard do D&D, que a sidebar substituiu. */}
          <p className="mt-3 text-[10px] font-fantasy tracking-wider text-parchment-600">
            Forjado por Jota ·{' '}
            <a
              href="https://github.com/Jota-Pais/dnd-character-creator"
              target="_blank"
              rel="noopener noreferrer"
              className="text-parchment-500 hover:text-gold-500 transition-colors"
            >
              GitHub ↗
            </a>
          </p>
        </div>
      </aside>

      <div className="flex-1 relative overflow-hidden flex flex-col min-h-screen">
        {watermark && (
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              right: '-220px', top: '-160px', width: '640px', height: '640px',
              opacity: 0.12,
              animation: 'sigilSpin 240s linear infinite',
            }}
          >
            {watermark}
          </div>
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 85% 0%, color-mix(in srgb, var(--color-gold-800) 18%, transparent), transparent 55%)',
          }}
        />

        {/* Sem sidebar abaixo de lg, o stepper horizontal assume a navegação. */}
        <div className="lg:hidden pt-6 pb-2 flex justify-center relative">
          <StepIndicator steps={steps} currentStepId={currentStepId} onStepClick={onStepClick} />
        </div>

        <main key={currentStepId} className="animate-fade-in relative flex-1 px-4 lg:px-10 pt-6 lg:pt-10 pb-28 lg:pb-32">
          <div className="text-center mb-6">
            <p className="text-[11px] uppercase font-semibold text-gold-400" style={{ letterSpacing: '.22em' }}>
              Etapa {stepIndex + 1} de {steps.length} · {steps[stepIndex]?.label}
            </p>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
