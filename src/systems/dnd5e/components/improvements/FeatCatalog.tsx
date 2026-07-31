import type { AbilityScore } from '../../types/race'
import { ABILITY_LABELS } from '../../utils/abilityScoreUtils'
import { getAllFeats } from '../../utils/featUtils'

type Props = {
  selectedFeatId: string
  onSelect: (featId: string) => void
  accent: string
  /** Meio-talento: atributo que já recebeu o +1, se houver. */
  abilityChoice?: AbilityScore
  onAbilityChoice: (ability: AbilityScore) => void
  /** Valor do atributo sem este slot — usado só pra travar o teto de 20. */
  scoreWithout: (ability: AbilityScore) => number
}

/**
 * Catálogo dos 42 talentos, no padrão "tudo à vista" (o mesmo do catálogo de poderes do Ordem):
 * um card por talento com a descrição sempre visível, em vez do <select> que obrigava a escolher
 * pra só então descobrir o que o talento fazia.
 *
 * O pré-requisito aparece como selo com o texto que vem do JSON. NÃO é avaliado: o D&D não tem
 * camada de pré-requisito calculado, e checar isso seria implementar regra nova. Nenhum card
 * aparece desabilitado — a leitura é do jogador.
 */
export function FeatCatalog({
  selectedFeatId,
  onSelect,
  accent,
  abilityChoice,
  onAbilityChoice,
  scoreWithout,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 items-start">
      {getAllFeats().map(feat => {
        const selected = feat.id === selectedFeatId
        const halfOptions = feat.abilityIncrease ?? []

        return (
          <div
            key={feat.id}
            className="rounded-xl border-2 transition-all duration-200 overflow-hidden"
            style={{
              borderColor: selected ? accent : 'rgba(90, 62, 36, 0.5)',
              backgroundColor: selected ? `${accent}12` : 'rgba(15, 10, 4, 0.6)',
            }}
          >
            <button onClick={() => onSelect(feat.id)} className="w-full text-left p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span
                  className="font-fantasy font-bold text-sm leading-tight"
                  style={{ color: selected ? accent : '#c4a97a' }}
                >
                  {feat.name}
                </span>
                {selected && <span className="shrink-0" style={{ color: accent }}>✦</span>}
              </div>

              {feat.prerequisite && (
                <span className="inline-block mb-1.5 text-[10px] uppercase px-1.5 py-0.5 rounded font-bold text-gold-400 bg-gold-950/40 border border-gold-800">
                  Requer {feat.prerequisite}
                </span>
              )}

              <p
                className={[
                  'text-parchment-500 text-xs leading-relaxed whitespace-pre-line',
                  selected ? '' : 'line-clamp-3',
                ].join(' ')}
              >
                {feat.description}
              </p>
            </button>

            {/* Meio-talento: o +1 é parte do talento, então mora dentro do card escolhido. */}
            {selected && halfOptions.length > 0 && (
              <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: `${accent}30` }}>
                <p className="text-xs font-semibold text-parchment-300 mb-1.5 mt-2">
                  +1 no atributo (parte do talento):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {halfOptions.map(ability => {
                    const isSelected = abilityChoice === ability
                    const wouldExceed = !isSelected && scoreWithout(ability) + 1 > 20
                    return (
                      <button
                        key={ability}
                        onClick={() => { if (!wouldExceed) onAbilityChoice(ability) }}
                        disabled={wouldExceed}
                        title={wouldExceed ? 'Excederia o máximo de 20' : undefined}
                        className="px-2 py-1 rounded-lg border text-xs font-semibold font-fantasy"
                        style={{
                          borderColor: isSelected ? accent : 'rgba(58,38,20,0.6)',
                          backgroundColor: isSelected ? `${accent}20` : 'transparent',
                          color: isSelected ? accent : wouldExceed ? '#4a3520' : '#b8946f',
                          cursor: wouldExceed ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {ABILITY_LABELS[ability].short}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
