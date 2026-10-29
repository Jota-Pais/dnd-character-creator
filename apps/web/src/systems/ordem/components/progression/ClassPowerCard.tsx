import type { ReactNode } from 'react'
import type { ClassPower } from '../../types/power'

type Props = {
  power: ClassPower
  /** Etiquetas das instâncias já escolhidas (uma por slot; repetível pode ter várias). */
  chosen: { key: string; label: string; onRelease: () => void }[]
  /** Escolher este poder. Ausente = não cabe agora (ver `reasons`). */
  onPick?: () => void
  /** Por que não dá pra escolher agora. Nunca esconde o poder — explica. */
  reasons?: string[]
  /** Parâmetros da instância escolhida (perícias, elemento) e avisos do Transcender. */
  children?: ReactNode
}

/**
 * Card de um poder de classe no catálogo da Progressão: nome, descrição SEMPRE visível e o estado
 * da escolha. Poder bloqueado aparece desabilitado com o motivo, nunca escondido — o jogador vê o
 * que existe na classe dele e o que falta pra alcançar.
 */
export function ClassPowerCard({ power, chosen, onPick, reasons = [], children }: Props) {
  const isChosen = chosen.length > 0
  const blocked = !onPick && !isChosen

  return (
    <div
      className="rounded-xl border p-3 transition-colors"
      style={{
        borderColor: isChosen ? '#dc2626' : blocked ? '#241a1c' : '#2a2213',
        backgroundColor: isChosen ? '#dc262612' : blocked ? '#0a070466' : '#0a070499',
        opacity: blocked ? 0.65 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <p className="font-fantasy font-bold leading-tight" style={{ color: isChosen ? '#fca5a5' : '#f3e9dc' }}>
            {power.name}
          </p>
          {/* No card bloqueado o motivo lá embaixo já diz o requisito (com o seu valor atual),
              então o selo só aparece quando ele é a única informação do pré-requisito. */}
          {power.prerequisite && !(blocked && reasons.length > 0) && (
            <span className="inline-block mt-1 text-[9px] uppercase px-1.5 py-0.5 rounded font-bold text-amber-500/90 bg-amber-950/30 border border-amber-900">
              Requer {power.prerequisite}
            </span>
          )}
        </div>
        {onPick && (
          <button
            onClick={onPick}
            className="shrink-0 px-3 py-1.5 rounded-lg font-fantasy font-bold text-[12px] transition-colors"
            style={{ backgroundColor: '#2a0d0f', border: '1px solid #7f1d1d', color: '#fca5a5' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#3d1114' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#2a0d0f' }}
          >
            {isChosen ? '+ De novo' : 'Escolher'}
          </button>
        )}
      </div>

      <p className="text-xs leading-relaxed" style={{ color: blocked ? '#8a7368' : '#b3a094' }}>
        {power.description}
      </p>

      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {chosen.map(instance => (
            <span
              key={instance.key}
              className="inline-flex items-center gap-1.5 text-[11px] rounded-full pl-2.5 pr-1.5 py-0.5"
              style={{ color: '#fca5a5', border: '1px solid #7f1d1d' }}
            >
              ✓ {instance.label}
              <button
                onClick={instance.onRelease}
                title="Soltar este poder"
                className="w-4 h-4 flex items-center justify-center rounded-full transition-colors"
                style={{ color: '#c9a5a5' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ffffff' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#c9a5a5' }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {blocked && reasons.length > 0 && (
        <p className="text-[11px] mt-2 leading-snug" style={{ color: '#c9a05a' }}>⛔ {reasons.join(' · ')}</p>
      )}

      {children}
    </div>
  )
}
