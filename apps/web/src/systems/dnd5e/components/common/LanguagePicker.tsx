import { LANGUAGES, type Language } from '@rpg/rules/systems/dnd5e/utils/raceUtils'
import { isChoiceFull, toggleChoice } from '@rpg/rules/systems/dnd5e/utils/choiceToggle'
import { RepeatedProficiencyNotes } from './RepeatedProficiencyNotes'
import { REPEATED_OPTION_STYLE } from './repeatedChipStyle'

type Props = {
  /** Quantos idiomas esta concessão deixa escolher. */
  count: number
  selected: string[]
  /** Já vindos de outra fonte: aparecem com ✓ e travados (o livro manda escolher outro). */
  excluded?: string[]
  /**
   * Escolhidos aqui que outra fonte passou a dar (id → aviso): ficam marcados, com ⚠ e o aviso
   * embaixo, até o jogador trocar — nunca apagados em silêncio (getRepeatedProficiencyNotes).
   */
  repeated?: Record<string, string>
  accent: string
  onChange: (languages: string[]) => void
}

const STANDARD = LANGUAGES.filter(l => !l.exotic)
const EXOTIC = LANGUAGES.filter(l => l.exotic)

/**
 * Seletor de idiomas de toda concessão "à sua escolha" — raça, antecedente, Domínio do
 * Conhecimento, Poliglota. Separa as duas tabelas da p. 125: a escolha sai dos Idiomas Padrão;
 * um exótico só com a permissão do Mestre. Não veta o exótico — avisa, e a ficha marca com "*".
 */
export function LanguagePicker({ count, selected, excluded, repeated = {}, accent, onChange }: Props) {
  const excludedSet = new Set(excluded)
  // Escolha de 1 idioma (raça, antecedente) é rádio: outro troca o marcado. A de N para no limite
  // (decisão de 2026-10-26).
  const full = isChoiceFull(selected.length, count)

  function toggle(id: string) {
    const next = toggleChoice(selected, id, count)
    if (next) onChange(next)
  }

  const group = (title: string, languages: readonly Language[]) => (
    <div>
      <p className="text-[11px] text-parchment-600 mb-1">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {languages.map(lang => {
          const isSelected = selected.includes(lang.id)
          // O marcado nunca trava (dá para desmarcar ou trocar), mesmo que outra fonte o dê.
          const isExcluded = !isSelected && excludedSet.has(lang.id)
          const isRepeated = isSelected ? repeated[lang.id] : undefined
          const isDisabled = isExcluded || (!isSelected && full)
          return (
            <button
              key={lang.id}
              type="button"
              onClick={() => toggle(lang.id)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              title={isRepeated ?? (isExcluded ? 'Você já fala este idioma por outra fonte' : undefined)}
              className="px-2 py-1.5 rounded-lg border text-xs text-left transition-all"
              style={{
                borderColor: isSelected ? accent : isExcluded ? '#1e150a' : 'rgba(58, 38, 20, 0.6)',
                backgroundColor: isSelected ? `${accent}15` : 'transparent',
                color: isSelected ? accent : isExcluded ? '#3a2614' : isDisabled ? '#5a3e24' : '#9a7650',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                ...(isRepeated ? REPEATED_OPTION_STYLE : {}),
              }}
            >
              {isRepeated ? '⚠ ' : isExcluded ? '✓ ' : ''}{lang.name}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-2">
      {group('Idiomas padrão', STANDARD)}
      {group('Idiomas exóticos — só com permissão do Mestre (p. 125)', EXOTIC)}
      <RepeatedProficiencyNotes ids={selected} notes={repeated} />
    </div>
  )
}
