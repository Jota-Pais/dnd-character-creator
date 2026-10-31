import { formatModifier } from '@rpg/rules/systems/dnd5e/utils/abilityScoreUtils'
import type { RollGuideEntry } from '@rpg/rules/systems/dnd5e/utils/rollGuide'
import type { SpellGuide } from '@rpg/rules/systems/dnd5e/utils/spellGuide'
import { rollButtonLabel } from './playFormat'
import { RollMarks } from './RollMarks'
import type { PlayTabProps } from './usePlayView'

/** Uma jogada da magia, tocável: o rótulo curto e a fórmula, que abrem a receita. */
function RecipeButton({ entry, label, openRecipe }: { entry: RollGuideEntry; label: string; openRecipe: PlayTabProps['openRecipe'] }) {
  return (
    <button
      onClick={() => openRecipe(entry)}
      aria-label={rollButtonLabel(entry)}
      className="min-h-10 flex items-center gap-1.5 rounded-lg border border-parchment-800 px-3 hover:border-gold-700 transition-colors"
    >
      <span className="text-[10px] uppercase tracking-wider text-parchment-500">{label}</span>
      <span className="text-sm text-parchment-100">{entry.formula}</span>
    </button>
  )
}

/**
 * O que rolar numa magia, pelo guia dela (`getSpellGuide`): o TR do alvo com a CD, os feixes, os
 * alvos e o ganho do nível maior numa linha cada; o ataque, o dano, a cura e os PV temporários,
 * tocáveis, abrem a receita (o ataque leva ao dano). A aba Magia mostra por conjuração, e a folha
 * da magia na aba Regras, a de cada uma. Nenhum número é montado aqui.
 */
export function SpellRecipe({ guide, openRecipe }: { guide: SpellGuide; openRecipe: PlayTabProps['openRecipe'] }) {
  const facts = [
    guide.instances && guide.instances.count > 1 ? `${guide.instances.text}, cada um com a sua jogada.` : null,
    guide.save?.text ?? null,
    guide.targets?.text ?? null,
    guide.upcastGain ?? null,
  ].filter((f): f is string => f !== null)
  const damageLabel = guide.instances ? `Dano por ${guide.instances.noun}` : 'Dano'
  return (
    <div>
      {facts.map(f => <p key={f} className="text-xs text-parchment-400 leading-snug">{f}</p>)}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {guide.attack && (
          <button
            onClick={() => openRecipe(guide.attack!)}
            aria-label={rollButtonLabel(guide.attack)}
            className="min-h-10 flex items-center gap-1.5 rounded-lg border border-gold-800 px-3 hover:border-gold-600 transition-colors"
          >
            <span className="text-[10px] uppercase tracking-wider text-gold-500">Ataque</span>
            <span className="font-fantasy font-bold text-lg text-parchment-100" aria-hidden="true">
              {formatModifier(guide.attack.modifier)} <RollMarks entry={guide.attack} />
            </span>
          </button>
        )}
        {guide.damage.map(d => <RecipeButton key={d.id} entry={d} label={damageLabel} openRecipe={openRecipe} />)}
        {guide.heal && <RecipeButton entry={guide.heal} label="Cura" openRecipe={openRecipe} />}
        {guide.tempHp && <RecipeButton entry={guide.tempHp} label="PV temporários" openRecipe={openRecipe} />}
        {guide.maxHpIncrease && <RecipeButton entry={guide.maxHpIncrease} label="PV máximo" openRecipe={openRecipe} />}
      </div>
      {guide.notes.map(n => <p key={n} className="mt-1 text-[11px] text-parchment-500 leading-snug">{n}</p>)}
    </div>
  )
}
