import { Tooltip } from '../../../../components/common/Tooltip'
import { GLOSSARY, type TermId } from '../../utils/glossary'

type Props = {
  term: TermId
}

export function InfoTooltip({ term }: Props) {
  const entry = GLOSSARY[term]
  if (!entry) return null

  return <Tooltip term={entry.term} definition={entry.definition} />
}
