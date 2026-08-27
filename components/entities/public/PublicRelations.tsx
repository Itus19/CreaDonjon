import Link from "next/link";
import type { PublicRelation } from "@/src/server/services/publicShare";

/**
 * Relations d'une fiche sur le wiki public (V2-G11) — jusqu'ici seule la
 * fiche d'edition (RelationsChips.tsx) les affichait. Simple liste, jamais
 * de fenetre flottante ici (peau « livre », lecture seule) : navigation
 * normale via `hrefBase`, comme le reste de cette peau.
 */
export default function PublicRelations({
  relations,
  hrefBase,
}: {
  relations: PublicRelation[];
  hrefBase: string;
}) {
  if (relations.length === 0) return null;

  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
      {relations.map((relation) => (
        <li key={relation.id}>
          {relation.label}{" "}
          <Link href={`${hrefBase}/${relation.other.slug}`} className="text-ink-soft hover:text-accent hover:underline">
            {relation.other.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
