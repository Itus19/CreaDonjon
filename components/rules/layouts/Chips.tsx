/** Mise en page `chips` (specs/regles-blocs.md §4) : liste courte d'elements. Aucun bloc du catalogue V1 ne l'utilise encore (renvois = V1-A3) — construite pour que le contrat des six mises en page soit complet des ce ticket. */
export default function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className="rounded-full border border-edge px-2 py-0.5 text-xs">
          {item}
        </span>
      ))}
    </div>
  );
}
