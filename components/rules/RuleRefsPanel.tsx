import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RuleRefView } from "@/src/server/services/rules";
import { renderMarkdownBoldText } from "./layouts/Prose";

function RefList({
  refs,
  worldSlug,
  refKindLabels,
  withPath,
}: {
  refs: RuleRefView[];
  worldSlug: string;
  refKindLabels: Record<string, string>;
  /** Entrant : `path` designe un emplacement sur la fiche SOURCE, cible du lien. Sortant : `path` designe un emplacement sur CETTE fiche, sans usage pour le lien. */
  withPath: boolean;
}) {
  const t = useTranslations("regles");
  return (
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
  );
}

/**
 * Renvois sortants enrichis (V1-D7, retour utilisateur : "je veux voir le
 * texte de chaque aptitude directement depuis la fiche de classe") : pour un
 * renvoi "grants", affiche le niveau et le texte de l'aptitude visee plutot
 * que son seul nom — trie par niveau croissant. Un renvoi sans niveau/texte
 * (aucun cas aujourd'hui, mais un futur ref_kind comme `requires` en aurait)
 * retombe sur la ligne simple de `RefList`.
 */
function GrantedRefList({
  refs,
  worldSlug,
  refKindLabels,
}: {
  refs: RuleRefView[];
  worldSlug: string;
  refKindLabels: Record<string, string>;
}) {
  const t = useTranslations("regles");
  const sorted = [...refs].sort((a, b) => (a.level ?? -1) - (b.level ?? -1));
  return (
    <ul className="flex flex-col gap-4 text-sm">
      {sorted.map((ref, i) => (
        <li key={i} className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            {ref.level !== undefined && <span className="mech text-xs text-ink-muted">Niveau {ref.level}</span>}
            {ref.entryType ? (
              <Link
                href={`/m/${worldSlug}/regles/${ref.key}`}
                className="text-xs font-bold uppercase tracking-wide text-ink hover:underline"
              >
                {ref.name}
              </Link>
            ) : (
              <span className="text-ink-muted">
                {ref.name} ({t("renvoiNonResolu")})
              </span>
            )}
            <span className="text-xs text-ink-muted">{refKindLabels[ref.refKind] ?? ref.refKind}</span>
          </div>
          {ref.description && <div className="text-ink-muted">{renderMarkdownBoldText(ref.description, `outref-${i}`)}</div>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Renvois sortants et entrants d'une fiche (V1-A3, SCHEMA.md §9.3). Rien
 * n'est affiche pour les fiches sans renvoi — la plupart aujourd'hui, seul
 * le cas class_progression -> feature (grants) en produit. Sortants replies
 * par defaut (V1-D7, retour utilisateur), meme motif `<details>` que les
 * autres blocs repliables (RuleBlockRenderer) — place par l'appelant juste
 * avant le bloc "Donnees brutes (SRD)", plus jamais apres.
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
    <>
      {outgoingRefs.length > 0 && (
        <details className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0">
          <summary className="block-title mb-2 cursor-pointer">{t("renvoisSortants")}</summary>
          <GrantedRefList refs={outgoingRefs} worldSlug={worldSlug} refKindLabels={refKindLabels} />
        </details>
      )}
      {incomingRefs.length > 0 && (
        <div className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0">
          <h3 className="block-title mb-2">{t("renvoisEntrants")}</h3>
          <RefList refs={incomingRefs} worldSlug={worldSlug} refKindLabels={refKindLabels} withPath={true} />
        </div>
      )}
    </>
  );
}
