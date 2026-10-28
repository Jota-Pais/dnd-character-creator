import type { ReactNode } from 'react'
import type { RollRecord } from '../../../../core/dice'
import { formatModifier } from '../../utils/abilityScoreUtils'

/** A cor e o movimento do total: o 20 e o 1 naturais só em destaque (decisão 8, regras-rolagens). */
function totalClass(natural: number | null): string {
  if (natural === 20) return 'text-gold-300 motion-safe:animate-nat20'
  if (natural === 1) return 'text-red-400 motion-safe:animate-nat1'
  return 'text-parchment-100'
}

/** Uma estrela da celebração do 20 natural: enfeite, fora do leitor de tela. */
function Spark() {
  return <span aria-hidden="true" className="inline-block motion-safe:animate-nat20-spark">✦</span>
}

/**
 * O resultado de uma rolagem dos dados do app: o total em destaque e as faces, com a descartada
 * riscada. Entra com um pulo curto (`animate-roll-in`); o 20 natural ganha uma celebração discreta
 * (o total cresce e brilha, duas estrelas piscam) e o 1, o vermelho e um tremor — só visual, sem
 * sucesso nem falha automáticos fora do que a jogada diz. Com prefers-reduced-motion, fica só a cor
 * (`motion-safe:`, em index.css).
 *
 * Quem o usa dá a ele `key={record.id}`, para a animação recomeçar a cada rolagem, e o põe dentro de
 * um `aria-live` que já existe antes da primeira: o leitor de tela anuncia cada resultado novo.
 */
export function RollOutcome({ record, natural, prefix = '', naturalOneText = '1 natural.', children }: {
  record: RollRecord
  /** O d20 natural que valeu; null quando a rolagem não é de um d20. */
  natural: number | null
  /** Antes do "Total" ("Crítico: "). */
  prefix?: string
  /** A frase do 1 natural, quando a jogada dá sentido a ele (o ataque erra, pág. 196). */
  naturalOneText?: string
  /** Linhas da jogada, abaixo dos dados (passou ou não na CD). */
  children?: ReactNode
}) {
  const faces = record.terms.flatMap(t => t.dice)
  return (
    <div className="mt-3 motion-safe:animate-roll-in">
      <p className="text-sm text-parchment-400">
        {prefix}Total{' '}
        <span className={`inline-block font-fantasy font-bold text-2xl ${totalClass(natural)}`} data-testid="roll-total">
          {record.total}
        </span>
      </p>
      <p className="text-xs text-parchment-600">
        Dados:{' '}
        {faces.map((d, i) => (
          <span key={i} className={d.kept ? 'text-parchment-300' : 'line-through'}>{i > 0 ? ', ' : ''}{d.value}</span>
        ))}
        {record.modifierTotal !== 0 && <> ({formatModifier(record.modifierTotal)})</>}
      </p>
      {natural === 20 && (
        <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gold-300" data-testid="nat20">
          <Spark /><span>20 natural!</span><Spark />
        </p>
      )}
      {natural === 1 && <p className="mt-1 text-sm font-bold text-red-400">{naturalOneText}</p>}
      {children}
    </div>
  )
}
