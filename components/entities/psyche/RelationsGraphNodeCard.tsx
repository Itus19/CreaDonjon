"use client";

import { useCallback, useState } from "react";

/**
 * Carte icone + etiquette d'un nœud du graphe de relations (V2-H1 phase 5,
 * reprise visuelle sur references fournies par l'utilisateur) — icone
 * carree, etiquette de nom EN DESSOUS (pas en incrustation comme
 * `FamilyTreeCard`, dont l'aspect portrait vertical ne convient pas a un
 * graphe qui melange personnages, lieux et factions). Meme mecanique de
 * repli portrait manquant que `FamilyTreeCard.tsx`/`PublicPortrait.tsx`
 * (initiale tant que l'image n'a pas fini de charger AVEC succes, jamais
 * d'icone cassee) — dupliquee plutot que partagee : la mise en page differe
 * trop pour une seule carte generique.
 */
export default function RelationsGraphNodeCard({
  id,
  name,
  size,
  isRoot,
}: {
  id: string;
  name: string;
  size: number;
  isRoot: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  const checkAlreadyLoaded = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setStatus(img.naturalWidth > 0 ? "loaded" : "error");
  }, []);

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size + 40 }}>
      <div
        className={`overflow-hidden rounded-xl border bg-panel-raised shadow-md ${isRoot ? "border-accent" : "border-edge-strong"}`}
        style={{ width: size, height: size, borderWidth: isRoot ? 2 : 1 }}
      >
        {status !== "loaded" && (
          <div className="flex h-full w-full items-center justify-center font-semibold text-ink-muted" style={{ fontSize: size * 0.35 }}>
            {name.slice(0, 1).toUpperCase() || "?"}
          </div>
        )}
        {status !== "error" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={checkAlreadyLoaded}
            src={`/api/entities/${id}/portrait`}
            alt=""
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            className={`h-full w-full object-cover ${status === "loaded" ? "" : "hidden"}`}
          />
        )}
      </div>
      <span className={`max-w-full truncate text-center text-xs ${isRoot ? "font-semibold text-ink" : "text-ink-soft"}`}>{name}</span>
    </div>
  );
}
