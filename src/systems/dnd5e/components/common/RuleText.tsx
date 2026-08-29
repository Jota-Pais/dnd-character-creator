/**
 * Texto de regra vindo do livro (talentos, características, magias). Uma linha por parágrafo;
 * linha iniciada por "- " vira item de lista com marcador e recuo pendente.
 *
 * A convenção "- " veio da digitalização do PDF: o extrator devolvia o marcador da fonte
 * Wingdings (U+F0B7), que o navegador desenhava como um quadrado vazio. O JSON guarda o texto
 * já normalizado; a apresentação do marcador é responsabilidade daqui.
 */
type Props = {
  text: string
  /** Classes do bloco (cor/tamanho da fonte). O espaçamento entre parágrafos é fixo. */
  className?: string
  /** Prévia recolhida: achata em um parágrafo só, cortado em 3 linhas (cards não selecionados). */
  clamp?: boolean
}

export function RuleText({ text, className = '', clamp = false }: Props) {
  if (clamp) {
    return (
      <p className={`${className} line-clamp-3`}>
        {text.split('\n').map(line => (line.startsWith('- ') ? `• ${line.slice(2)}` : line)).join(' ')}
      </p>
    )
  }

  return (
    <div className={className}>
      {text.split('\n').map((line, i) =>
        line.startsWith('- ') ? (
          <p key={i} className="pl-3 -indent-3 mt-1 first:mt-0">
            {/* Marcador herda a cor do bloco (com opacidade) pra servir à ficha impressa também. */}
            <span className="opacity-60 mr-1.5">•</span>
            {line.slice(2)}
          </p>
        ) : (
          <p key={i} className="mt-1.5 first:mt-0">{line}</p>
        ),
      )}
    </div>
  )
}
