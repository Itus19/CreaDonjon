"use client";

import { useState } from "react";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";

/** Meme reference que l'editeur (components/entities/PortraitUpload.tsx) : la taille du wiki s'aligne sur celle de la fiche par defaut. */
const BASE_WIDTH_PX = 224;

/**
 * Portrait flottant (V2-G11) : `float-left`/`float-right` pour que le
 * titre/alias/relations/premier bloc de texte (rendus par l'appelant juste
 * apres, dans le meme conteneur `flow-root`) s'ecoulent autour — jamais
 * `float-center`, qui n'existe pas en CSS (l'alignement se limite a
 * gauche/droite, cf. `portraitLayoutSchema`).
 */
export default function PublicPortrait({ entityId, layout }: { entityId: string; layout: EntityPortraitLayout }) {
  const [hasPortrait, setHasPortrait] = useState(true);
  if (!hasPortrait) return null;

  const widthPx = (BASE_WIDTH_PX * layout.displaySizePct) / 100;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/entities/${entityId}/portrait`}
      alt="Portrait"
      onError={() => setHasPortrait(false)}
      className={`aspect-[3/4] rounded-2xl border border-edge object-cover ${
        layout.align === "left" ? "float-left mr-4" : "float-right ml-4"
      } mb-3`}
      style={{ width: `${widthPx}px` }}
    />
  );
}
