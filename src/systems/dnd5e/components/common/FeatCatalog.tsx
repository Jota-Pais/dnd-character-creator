import { useState } from 'react'
import type { AbilityScore } from '../../types/race'
import { ABILITY_LABELS } from '../../utils/abilityScoreUtils'
import { getAllFeats } from '../../utils/featUtils'
import { RuleText } from '../common/RuleText'

type Props = {
  selectedFeatId: string
  onSelect: (featId: string) => void
  accent: string
  /** Meio-talento: atributo que já recebeu o +1, se houver. */
  abilityChoice?: AbilityScore
  onAbilityChoice: (ability: AbilityScore) => void
  /**
   * Valor do atributo sem este slot, pra travar o teto de 20. Ausente quando os atributos ainda
   * não foram definidos (Humano Variante escolhe o talento na Raça, antes do passo Atributos):
   * sem valores não há teto a checar.
   */
  scoreWithout?: (ability: AbilityScore) => number
  /**
   * Classes de coluna da grade. O padrão serve à largura cheia do passo Aprimoramentos; o painel
   * lateral da Raça é estreito e passa uma grade mais magra.
   */
  gridClassName?: string
  /**
   * Altura máxima da grade (ex.: 'max-h-[26rem]'), pra caber num painel lateral. Só a GRADE rola:
   * a busca fica fixa acima, senão ela sai de vista justamente quando começa a ser útil.
   */
  gridMaxHeightClassName?: string
}

/** Faixa Unicode dos acentos que a decomposição NFD separa da letra. */
const COMBINING_START = 0x0300
const COMBINING_END = 0x036f

/** Normaliza para busca sem acento: "magia" acha "Atirador de Magia", "pericia" acha "perícia". */
function normalize(text: string): string {
  return [...text.normalize('NFD')]
    .filter(char => {
      const code = char.codePointAt(0) ?? 0
      return code < COMBINING_START || code > COMBINING_END
    })
    .join('')
    .toLowerCase()
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
  gridClassName = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  gridMaxHeightClassName = '',
}: Props) {
  const [query, setQuery] = useState('')
  const needle = normalize(query.trim())
  // Busca no nome E na descrição: quem procura "iniciativa" quer achar o Alerta.
  const visible = needle
    ? getAllFeats().filter(f => normalize(`${f.name} ${f.description}`).includes(needle))
    : getAllFeats()

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar talento (nome ou efeito)…"
          className="flex-1 px-3 py-1.5 rounded-lg border border-parchment-800 bg-parchment-950 text-parchment-200 text-xs"
        />
        <span className="text-[11px] text-parchment-600 shrink-0">
          {visible.length} de {getAllFeats().length}
        </span>
      </div>

      {visible.length === 0 && (
        <p className="text-xs text-parchment-600 py-2">Nenhum talento corresponde a “{query}”.</p>
      )}

      <div
        className={[
          'grid gap-2 items-start',
          gridClassName,
          gridMaxHeightClassName && `${gridMaxHeightClassName} overflow-y-auto pr-1`,
        ].filter(Boolean).join(' ')}
      >
      {visible.map(feat => {
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

              <RuleText
                text={feat.description}
                clamp={!selected}
                className="text-parchment-500 text-xs leading-relaxed"
              />
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
                    const wouldExceed =
                      !isSelected && scoreWithout !== undefined && scoreWithout(ability) + 1 > 20
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
    </div>
  )
}
