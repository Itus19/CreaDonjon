"use client";

import { useState } from "react";

/**
 * Portrait en lecture seule (retour utilisateur, V2-G7) : meme route que
 * `PortraitUpload.tsx` (`GET /api/entities/[id]/portrait`, accessible sans
 * session — un portrait est public comme le nom de la fiche). Rien affiche
 * si la fiche n'a pas de portrait, jamais un placeholder ici (pas d'action
 * possible sur cette vue).
 */
export default function PublicPortrait({ entityId }: { entityId: string }) {
  const [hasPortrait, setHasPortrait] = useState(true);
  if (!hasPortrait) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/entities/${entityId}/portrait`}
      alt="Portrait"
      onError={() => setHasPortrait(false)}
      className="w-40 shrink-0 rounded-2xl border border-edge object-cover"
    />
  );
}
