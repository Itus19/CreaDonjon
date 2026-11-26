"use client";

import { useEffect, useState } from "react";

/** Au-delà, la liste affiche « Morceau N » : une playlist de 300 vidéos ne vaut pas 300 requêtes d'affilée. */
const TITRES_MAX = 50;

/** Cache du navigateur pour la session : un titre lu n'est jamais redemandé. */
const cache = new Map<string, string>();
/** Une première requête refusée (réseau, CORS) coupe les suivantes : inutile de répéter un échec. */
let indisponible = false;

/**
 * AG-20 — les titres des morceaux d'une playlist YouTube, demandés à YouTube
 * (oEmbed, sans clé d'API) depuis le navigateur, une requête par morceau,
 * seulement quand la liste est affichée. Rien ne passe par nos serveurs ni
 * nos quotas (docs/QUOTAS.md). Un titre inconnu reste absent : l'écran
 * affiche alors « Morceau N ».
 */
export function useTitresYouTube(ids: readonly string[] | null): Record<string, string> {
  const [titres, setTitres] = useState<Record<string, string>>({});
  const cle = ids ? ids.slice(0, TITRES_MAX).join(",") : "";

  useEffect(() => {
    if (!cle) return;
    const aLire = cle.split(",");
    const controleur = new AbortController();
    (async () => {
      for (const id of aLire) {
        if (controleur.signal.aborted || indisponible) return;
        const connu = cache.get(id);
        if (connu) {
          setTitres((prev) => (prev[id] ? prev : { ...prev, [id]: connu }));
          continue;
        }
        try {
          const adresse = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
          const res = await fetch(adresse, { signal: controleur.signal });
          if (!res.ok) continue; // vidéo privée ou retirée : pas de titre, on passe à la suivante
          const corps = (await res.json()) as { title?: unknown };
          if (typeof corps.title === "string" && corps.title) {
            cache.set(id, corps.title);
            setTitres((prev) => ({ ...prev, [id]: corps.title as string }));
          }
        } catch (e) {
          if (controleur.signal.aborted) return;
          console.warn("Titres YouTube indisponibles depuis le navigateur", e);
          indisponible = true;
          return;
        }
      }
    })();
    return () => controleur.abort();
  }, [cle]);

  return titres;
}
