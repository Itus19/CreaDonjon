"use client";

import { useCallback, useState } from "react";
import { prenom } from "@/lib/ui/relationFace";

/** Icône au trait du genre de la fiche, quand elle n'a pas de portrait : silhouette (personne), bouclier (faction), griffes (créature), montagne (lieu). */
export function IconeFiche({ genre }: { genre: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-1/2 w-1/2 text-ink-muted"
    >
      {genre === "character" ? (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </>
      ) : genre === "faction" ? (
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      ) : genre === "creature" ? (
        <>
          <path d="M6 4c1.5 5 1.5 11-.5 16" />
          <path d="M12 3c1.7 6 1.7 12 0 18" />
          <path d="M18 4c1.5 5 1.5 11-.5 16" />
        </>
      ) : genre === "location" ? (
        <path d="M3 20l6-11 4 6 3-4 5 9H3Z" />
      ) : genre === "item" ? (
        <>
          <path d="M5 8h14l-1 12H6L5 8Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4" />
          <path d="M12 16.8h.01" />
        </>
      )}
    </svg>
  );
}

/**
 * V3.1-71 — un portrait du face-à-face, au gabarit de la Généalogie B : la
 * photo de la fiche (ou l'icône de son genre), le nom en pastille à cheval
 * sur le bas. Large (bloc ≥ 28 rem) : colonne de 184 px, nom tronqué avec le
 * nom complet au survol. Étroit (téléphone) : 70 × 92 et le prénom seul.
 * Même repli que `FamilyTreeCard` : l'image reste cachée tant qu'elle n'a pas
 * chargé avec succès.
 */
export default function PortraitRelation({
  side,
}: {
  side: { id: string; name: string; entityKind: string; hasPortrait: boolean };
}) {
  const [etat, setEtat] = useState<"chargement" | "charge" | "echec">("chargement");
  const verifier = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setEtat(img.naturalWidth > 0 ? "charge" : "echec");
  }, []);
  const nom = side.name || "";

  return (
    <div className="relative h-[92px] w-[70px] shrink-0 @md/bloc:h-60 @md/bloc:w-[184px]" title={nom}>
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-edge bg-panel-raised">
        {(!side.hasPortrait || etat !== "charge") && <IconeFiche genre={side.entityKind} />}
        {side.hasPortrait && etat !== "echec" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={verifier}
            src={`/api/entities/${side.id}/portrait`}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setEtat("charge")}
            onError={() => setEtat("echec")}
            className={`h-full w-full object-cover ${etat === "charge" ? "" : "hidden"}`}
          />
        )}
      </div>
      <span className="absolute inset-x-1 -bottom-2 block truncate rounded-full border border-edge-strong bg-panel px-2 py-1 text-center text-xs font-semibold text-ink shadow-md @md/bloc:inset-x-2">
        <span className="@md/bloc:hidden">{prenom(nom)}</span>
        <span className="hidden @md/bloc:inline">{nom}</span>
      </span>
    </div>
  );
}
