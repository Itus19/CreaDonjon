"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconeFiche } from "@/components/entities/psyche/PortraitRelation";
import { prenom } from "@/lib/ui/relationFace";
import type { Gabarit, LigneDates } from "@/lib/ui/arbre";

/**
 * Carte portrait + nom en pastille à cheval sur le bas (V2-H3, refaite en
 * V3.1-73) : 100 × 130 sur ordinateur, 66 × 88 au téléphone (prénom seul), le
 * portrait de la fiche — ou la silhouette de son genre — et, DESSOUS, la ligne
 * de dates quand il y en a (jamais une ligne vide sans dates).
 *
 * Le portrait n'est demandé que si la fiche en a un (`hasPortrait`) : plus un
 * 404 par carte sans portrait. Un défunt (`defunt`) a le portrait désaturé et
 * la carte grise. Avec `onSelect`, la carte est un bouton (l'éditeur ouvre la
 * barre de la fiche) ; sans, c'est un lien vers la fiche (wiki public).
 * Même repli que `PublicPortrait` : l'image reste cachée tant qu'elle n'a pas
 * chargé avec succès, jamais une icône d'image cassée.
 */
export default function FamilyTreeCard({
  node,
  href,
  gabarit,
  dates,
  defunt,
  choisie,
  centre,
  onSelect,
}: {
  node: { id: string; name: string; entityKind: string; hasPortrait?: boolean };
  href: string;
  gabarit: Gabarit;
  /** Dates déjà formatées par l'appelant (calendrier du monde) ; `null` : rien à écrire. */
  dates: LigneDates | null;
  defunt: boolean;
  choisie: boolean;
  /** La fiche au centre de l'arbre : bord accent. */
  centre: boolean;
  onSelect?: () => void;
}) {
  const t = useTranslations("fiche.genealogie");
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const checkAlreadyLoaded = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setStatus(img.naturalWidth > 0 ? "loaded" : "error");
  }, []);
  const etroit = gabarit.largeur < 100;
  const nom = node.name || t("sansNom");

  const corps = (
    <>
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-xl border bg-panel-raised transition-colors ${
          choisie ? "border-accent ring-2 ring-accent/60" : centre ? "border-2 border-accent" : "border-edge hover:border-edge-strong"
        } ${defunt ? "bg-panel-sunken" : ""}`}
      >
        {(!node.hasPortrait || status !== "loaded") && <IconeFiche genre={node.entityKind} />}
        {node.hasPortrait && status !== "error" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={checkAlreadyLoaded}
            src={`/api/entities/${node.id}/portrait`}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            className={`h-full w-full object-cover ${status === "loaded" ? "" : "hidden"} ${defunt ? "grayscale" : ""}`}
          />
        )}
      </div>
      <span
        className={`absolute inset-x-1 -bottom-3 block truncate rounded-full border border-edge-strong bg-panel px-2 py-0.5 text-center text-xs font-semibold shadow-md ${
          defunt ? "text-ink-muted" : "text-ink"
        }`}
        title={nom}
      >
        {etroit ? prenom(nom) : nom}
      </span>
      {dates && (
        <span className="pointer-events-none absolute left-1/2 top-[calc(100%+1.25rem)] -translate-x-1/2 whitespace-nowrap text-xs text-ink-soft">
          {datesTexte(dates, t)}
        </span>
      )}
    </>
  );

  const classes = `relative block h-full w-full ${defunt ? "opacity-80" : ""}`;
  if (onSelect) {
    return (
      <button
        type="button"
        aria-pressed={choisie}
        aria-label={nom}
        onClick={(e) => {
          // Le fond du canevas désélectionne au clic : un clic sur une carte ne doit pas y remonter.
          e.stopPropagation();
          onSelect();
        }}
        className={classes}
      >
        {corps}
      </button>
    );
  }
  return (
    /* `prefetch={false}` (V2.1-20 lot 6) : voir `PublicBlockView` — une route dynamique prechargee n est jamais reutilisee (`staleTimes.dynamic` vaut 0), le prechargement ne rapporte que du travail serveur. */
    <Link href={href} prefetch={false} className={classes}>
      {corps}
    </Link>
  );
}

function datesTexte(
  ligne: LigneDates,
  t: (cle: string, valeurs?: Record<string, string | number>) => string,
): string {
  const { naissance, mort } = ligne;
  const periode = naissance && mort ? `${naissance} – ${mort}` : naissance ? t("ne", { date: naissance }) : mort ? t("mort", { date: mort }) : "";
  return ligne.age !== undefined ? `${periode} · ${t("age", { n: ligne.age })}` : periode;
}
