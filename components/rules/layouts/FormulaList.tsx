/** Mise en page `formula_list` (specs/regles-blocs.md §4) : effets avec formule et trace, filet lateral. */
export default function FormulaList({
  items,
}: {
  items: {
    id: string;
    trigger?: string;
    damageType?: string;
    formulaText?: string;
    save?: { ability: string; effectOnSuccess?: string };
  }[];
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.id} className="border-l-2 border-edge pl-3 text-sm">
          {item.trigger && <p className="text-xs text-ink-muted">{item.trigger}</p>}
          <p>
            {item.formulaText && <span className="mech font-semibold">{item.formulaText}</span>}
            {item.damageType && <span className="ml-1.5 text-ink-muted">({item.damageType})</span>}
          </p>
          {item.save && (
            <p className="text-xs text-ink-muted">
              Sauvegarde <span className="mech">{item.save.ability}</span>
              {item.save.effectOnSuccess && ` — reussite : ${item.save.effectOnSuccess}`}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
