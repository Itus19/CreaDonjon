import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RuleRefView } from "@/src/server/services/rules";

function RefList({
  title,
  refs,
  worldSlug,
  refKindLabels,
  withPath,
}: {
  title: string;
  refs: RuleRefView[];
  worldSlug: string;
  refKindLabels: Record<string, string>;
  /** Entrant : `path` designe un emplacement sur la fiche SOURCE, cible du lien. Sortant : `path` designe un emplacement sur CETTE fiche, sans usage pour le lien. */
  withPath: boolean;
}) {
  const t = useTranslations("regles");
  if (refs.length === 0) return null;
  return (
    <div>
      <h3 className="block-title mb-2">{title}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {refs.map((ref, i) => {
          const href =
            withPath && ref.path
              ? `/m/${worldSlug}/regles/${ref.key}?path=${encodeURIComponent(ref.path)}`
              : `/m/${worldSlug}/regles/${ref.key}`;
          return (
            <li key={i} className="flex items-baseline gap-2">
              {ref.entryType ? (
                <Link href={href} className="hover:underline">
                  {ref.name}
                </Link>
              ) : (
                <span className="text-ink-muted">
                  {ref.name} ({t("renvoiNonResolu")})
                </span>
              )}
              <span className="text-xs text-ink-muted">{refKindLabels[ref.refKind] ?? ref.refKind}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Renvois sortants et entrants d'une fiche (V1-A3, SCHEMA.md §9.3). Rien
 * n'est affiche pour les fiches sans renvoi — la plupart aujourd'hui, seul
 * le cas class_progression -> feature (grants) en produit.
 */
export default function RuleRefsPanel({
  worldSlug,
  outgoingRefs,
  incomingRefs,
}: {
  worldSlug: string;
  outgoingRefs: RuleRefView[];
  incomingRefs: RuleRefView[];
}) {
  const t = useTranslations("regles");
  if (outgoingRefs.length === 0 && incomingRefs.length === 0) return null;
  const refKindLabels = t.raw("refKinds") as Record<string, string>;

  return (
    <div className="grid grid-cols-1 gap-4 border-b border-edge/60 py-4 sm:grid-cols-2">
      <RefList
        title={t("renvoisSortants")}
        refs={outgoingRefs}
        worldSlug={worldSlug}
        refKindLabels={refKindLabels}
        withPath={false}
      />
      <RefList
        title={t("renvoisEntrants")}
        refs={incomingRefs}
        worldSlug={worldSlug}
        refKindLabels={refKindLabels}
        withPath={true}
      />
    </div>
  );
}
