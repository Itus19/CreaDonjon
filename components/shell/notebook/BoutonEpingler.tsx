"use client";

import { useState } from "react";
import RefLinkPopover, { type RefLinkTarget } from "@/components/entities/richtext/RefLinkPopover";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import { GLYPHE_FICHE } from "@/lib/ui/cahier";

/** « ◆ Épingler une fiche ou une règle » : le bouton et sa recherche (`RefLinkPopover`, déjà partagé avec l'éditeur). */
export default function BoutonEpingler({
  worldSlug,
  otherEntities,
  libelle,
  onEpingler,
}: {
  worldSlug: string;
  otherEntities: OtherEntityOption[];
  libelle: string;
  onEpingler: (cible: RefLinkTarget) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    // Le bouton est au bas d'une colonne : la recherche s'ouvre vers le haut (sinon elle sortirait de l'écran).
    <div className="relative [&>div]:bottom-full [&>div]:top-auto [&>div]:mb-1 [&>div]:mt-0">
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
        className="w-full rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        {GLYPHE_FICHE} {libelle}
      </button>
      {ouvert && (
        <RefLinkPopover
          worldSlug={worldSlug}
          otherEntities={otherEntities}
          onSelect={(cible) => {
            onEpingler(cible);
            setOuvert(false);
          }}
          onClose={() => setOuvert(false)}
        />
      )}
    </div>
  );
}
