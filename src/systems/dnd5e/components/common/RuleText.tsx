/**
 * Texto de regra vindo do livro (talentos, características, magias). Uma linha por parágrafo,
 * com duas convenções que a digitalização usa:
 *
 * - `## Título` abre uma seção (as magias têm "## Descrição" e "## Em níveis superiores");
 * - `- item` vira item de lista com marcador e recuo pendente.
 *
 * A convenção "- " veio do PDF: o extrator devolvia o marcador da fonte Wingdings (U+F0B7), que
 * o navegador desenhava como um quadrado vazio. O JSON guarda o texto já normalizado; desenhar o
 * marcador é responsabilidade daqui.
 */
type Props = {
  text: string
  /** Classes do bloco (cor/tamanho da fonte). O espaçamento entre parágrafos é fixo. */
  className?: string
  /** Classes do título de seção. Varia entre a tela (dourado) e a ficha impressa (cinza). */
  headingClassName?: string
  /** Prévia recolhida: achata em um parágrafo só, cortado em 3 linhas (cards não selecionados). */
  clamp?: boolean
}

const DEFAULT_HEADING = 'font-fantasy uppercase tracking-wider opacity-70 mt-2.5 first:mt-0'

export function RuleText({
  text,
  className = '',
  headingClassName = DEFAULT_HEADING,
  clamp = false,
}: Props) {
  if (clamp) {
    return (
      <p className={`${className} line-clamp-3`}>
        {text
          .split('\n')
          .filter(line => !line.startsWith('## ') && line.trim() !== '')
          .map(line => (line.startsWith('- ') ? `• ${line.slice(2)}` : line))
          .join(' ')}
      </p>
    )
  }

  return (
    <div className={className}>
      {text.split('\n').map((line, i) => {
        // Linha em branco só separa blocos na origem; o espaçamento aqui é dado pelas margens.
        if (line.trim() === '') return null
        if (line.startsWith('## ')) {
          return <p key={i} className={headingClassName}>{line.slice(3)}</p>
        }
        if (line.startsWith('- ')) {
          return (
            <p key={i} className="pl-3 -indent-3 mt-1 first:mt-0">
              {/* Marcador herda a cor do bloco (com opacidade) pra servir à ficha impressa também. */}
              <span className="opacity-60 mr-1.5">•</span>
              {line.slice(2)}
            </p>
          )
        }
        return <p key={i} className="mt-1.5 first:mt-0">{line}</p>
      })}
    </div>
  )
}
