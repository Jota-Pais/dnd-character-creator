import { useMemo, useState } from 'react'
import { RuleText } from '../common/RuleText'
import { PlayDialog } from './PlayDialog'
import {
  describeSpellDuration, describeSpellKind, getRuleReference, type RuleDetail, type RuleEntry,
} from './ruleReference'
import type { PlayTabProps } from './usePlayView'

const HEADING = 'font-fantasy uppercase tracking-wider text-[11px] text-gold-500 mt-3 first:mt-0'

/** A folha de uma magia: o que se lê antes de conjurar e o texto inteiro. Sem conjurar (Fase 2). */
function SpellBody({ detail }: { detail: Extract<RuleDetail, { kind: 'spell' }> }) {
  const { spell, source } = detail
  const rows: [string, string][] = [
    ['Tempo de conjuração', spell.castingTime],
    ['Alcance', spell.range],
    ['Componentes', spell.components],
    ['Duração', describeSpellDuration(spell)],
  ]
  return (
    <>
      <p className="text-xs text-parchment-500">
        {describeSpellKind(spell)}
        {source && <> · {source}</>}
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-parchment-500">{label}</dt>
            <dd className="text-parchment-200">{value}</dd>
          </div>
        ))}
      </dl>
      <RuleText text={spell.description} className="mt-3 text-sm text-parchment-300 leading-relaxed" headingClassName={HEADING} />
    </>
  )
}

function TextBody({ detail }: { detail: Extract<RuleDetail, { kind: 'text' }> }) {
  return (
    <>
      {detail.kicker && <p className="text-xs text-parchment-500">{detail.kicker}</p>}
      {detail.chosen && (
        <p className="mt-2 text-sm text-parchment-400">
          {detail.chosenLabel ?? 'Escolha'}: <span className="font-semibold text-gold-300">{detail.chosen}</span>
        </p>
      )}
      <RuleText text={detail.text} className="mt-3 text-sm text-parchment-300 leading-relaxed" headingClassName={HEADING} />
    </>
  )
}

/**
 * Aba "Regras", só leitura: as magias por classe conjuradora e nível, as características de classe,
 * os traços raciais e os talentos, cada um com a regra completa numa folha a um toque. As listas
 * vêm de `getRuleReference` (as mesmas fontes da Revisão e da ficha imprimível).
 */
export function RulesTab({ draft }: PlayTabProps) {
  const sections = useMemo(() => getRuleReference(draft), [draft])
  const [open, setOpen] = useState<RuleEntry | null>(null)

  if (sections.length === 0) {
    return <p className="text-sm text-parchment-500">Nada para consultar nesta ficha.</p>
  }

  return (
    <div className="space-y-5">
      <p className="text-[11px] text-parchment-600">Toque num nome para ler a regra inteira.</p>
      {sections.map(section => (
        <section key={section.id} aria-labelledby={`rules-${section.id}`}>
          <h2 id={`rules-${section.id}`} className="text-[11px] uppercase tracking-wider text-parchment-600 font-fantasy mb-1.5">
            {section.title}
          </h2>
          <div className="space-y-3">
            {section.blocks.map((block, bi) => (
              <div key={block.label ?? bi}>
                {block.label && <p className="font-fantasy text-sm text-gold-400">{block.label}</p>}
                {block.groups.map((group, gi) => (
                  <div key={group.title ?? gi} className="mt-1">
                    {group.title && <h3 className="mt-2 text-xs text-parchment-500">{group.title}</h3>}
                    <ul className="divide-y divide-parchment-900">
                      {group.entries.map(entry => (
                        <li key={entry.key}>
                          <button
                            onClick={() => setOpen(entry)}
                            aria-haspopup="dialog"
                            className="w-full min-h-10 py-1.5 flex items-baseline justify-between gap-3 text-left hover:text-gold-300 transition-colors"
                          >
                            <span className="text-sm text-parchment-100 min-w-0">{entry.name}</span>
                            {entry.meta && (
                              <span className="shrink-0 max-w-[50%] truncate text-[11px] text-parchment-500">
                                {entry.meta}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}

      {open && (
        <PlayDialog title={open.name} titleId="rule-sheet-title" onClose={() => setOpen(null)}>
          <div className="mt-1" data-testid="rule-sheet">
            {open.detail.kind === 'spell' ? <SpellBody detail={open.detail} /> : <TextBody detail={open.detail} />}
          </div>
        </PlayDialog>
      )}
    </div>
  )
}
