import { formatModifier } from '../../utils/abilityScoreUtils'
import type { AttackGuide } from '../../utils/rollGuide'
import { rollButtonLabel } from './playFormat'
import { RollMarks } from './RollMarks'
import type { PlayTabProps } from './usePlayView'

/**
 * Uma arma: o ataque (tocar abre a receita, que leva ao dano), o dano e o dano a duas mãos,
 * cada um tocável, o "2×" do Ataque Extra e as notas da arma (Duelismo, Armas Grandes…).
 */
function AttackCard({ attack, openRecipe }: { attack: AttackGuide; openRecipe: PlayTabProps['openRecipe'] }) {
  const { damage, versatile } = attack
  return (
    <li className="rounded-xl border border-parchment-900 bg-surface-raised p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-fantasy font-bold text-parchment-100 leading-tight">{attack.name}</h3>
        {attack.attacksPerAction > 1 && (
          <span
            className="shrink-0 rounded-full border border-gold-800 px-2 text-xs text-gold-300"
            title={`Ataque Extra: ${attack.attacksPerAction} ataques por ação de Atacar`}
          >
            {attack.attacksPerAction}× por ação
          </span>
        )}
      </div>
      {attack.properties && <p className="text-[11px] text-parchment-500 leading-snug">{attack.properties}</p>}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          onClick={() => openRecipe(attack.attack)}
          aria-label={rollButtonLabel(attack.attack)}
          className="min-h-10 flex items-center gap-1.5 rounded-lg border border-gold-800 px-3 hover:border-gold-600 transition-colors"
        >
          <span className="text-[10px] uppercase tracking-wider text-gold-500">Ataque</span>
          <span className="font-fantasy font-bold text-lg text-parchment-100" aria-hidden="true">
            {formatModifier(attack.attack.modifier)} <RollMarks entry={attack.attack} />
          </span>
        </button>
        {damage ? (
          <button
            onClick={() => openRecipe(damage)}
            aria-label={rollButtonLabel(damage)}
            className="min-h-10 flex items-center gap-1.5 rounded-lg border border-parchment-800 px-3 hover:border-gold-700 transition-colors"
          >
            <span className="text-[10px] uppercase tracking-wider text-parchment-500">Dano</span>
            <span className="text-sm text-parchment-100">{damage.formula}</span>
          </button>
        ) : (
          <span className="min-h-10 flex items-center px-3 text-xs text-parchment-500">Sem dano</span>
        )}
        {versatile && (
          <button
            onClick={() => openRecipe(versatile)}
            aria-label={rollButtonLabel(versatile)}
            className="min-h-10 flex items-center gap-1.5 rounded-lg border border-parchment-800 px-3 hover:border-gold-700 transition-colors"
          >
            <span className="text-[10px] uppercase tracking-wider text-parchment-500">Duas mãos</span>
            <span className="text-sm text-parchment-100">{versatile.formula}</span>
          </button>
        )}
      </div>

      {attack.notes.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {attack.notes.map((n, i) => (
            <li key={i} className="text-xs text-parchment-400 leading-snug">• {n}</li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Aba "Ataques": uma linha por ataque da ficha (`getSheetAttacks`, pelo guia de rolagens), com o
 * bônus já com o modo das condições. No crítico (20 natural, ou a margem do `critThreshold`), os
 * dados de dano dobram (pág. 196): a folha do ataque leva ao dano normal ou ao do crítico.
 */
export function AttacksTab({ guide, openRecipe }: PlayTabProps) {
  if (guide.attacks.length === 0) {
    return <p className="text-sm text-parchment-500">Nenhum ataque na ficha.</p>
  }
  return (
    <div>
      {/* Do md para cima, os cartões em duas colunas, da mesma altura em cada linha. */}
      <ul className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-2">
        {guide.attacks.map(a => <AttackCard key={a.key} attack={a} openRecipe={openRecipe} />)}
      </ul>
      <p className="mt-3 text-[11px] text-parchment-600 leading-snug">
        Toque no ataque para ver o que rolar; se acertar, a folha leva ao dano. {critFooter(guide.attacks)}
      </p>
    </div>
  )
}

/**
 * O rodapé do crítico, pela margem do guia: "20 natural" ou a do Campeão, que vale nas armas e no
 * golpe desarmado, os ataques com arma desta aba.
 */
function critFooter(attacks: AttackGuide[]): string {
  const threshold = Math.min(...attacks.map(a => a.critThreshold))
  if (threshold >= 20) return '20 natural: crítico, os dados de dano dobram.'
  const range = threshold === 19 ? '19 ou 20' : `${threshold} a 20`
  return `${range} natural é crítico se acertar (só o 20 acerta sempre): os dados de dano dobram.`
}
