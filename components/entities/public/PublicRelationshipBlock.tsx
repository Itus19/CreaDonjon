import Link from "next/link";
import RelationshipRadar from "@/components/entities/psyche/RelationshipRadar";
import type { RelationshipAxisKey } from "@/src/core/psyche/keys";

/**
 * Rendu public du bloc `relationship` (V2-H2, "juste la partie des
 * schemas") — le radar seul, plus la cible (indispensable pour lire un
 * radar dont le sujet n'est jamais l'entite hote elle-meme). Jamais les
 * curseurs ni le tableau de souvenirs. Coloration neutre du radar (pas de
 * detection du type de relation cote public, meme limitation que
 * l'editeur — `relationTypes` vide).
 */
export default function PublicRelationshipBlock({
  axes,
  target,
  hrefBase,
}: {
  axes: Partial<Record<RelationshipAxisKey, number>>;
  target: { name: string; slug: string } | null;
  hrefBase: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {target && (
        <p className="text-xs text-ink-muted">
          Envers{" "}
          <Link href={`${hrefBase}/${target.slug}`} className="rich-ref-mention">
            {target.name}
          </Link>
        </p>
      )}
      <RelationshipRadar axes={axes} relationTypes={[]} />
    </div>
  );
}
