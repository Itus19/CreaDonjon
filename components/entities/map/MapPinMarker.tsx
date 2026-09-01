"use client";

import { useCallback, useState } from "react";
import type { MapPinSize } from "@/src/core/schemas/mapPin";

const SIZE_PX: Record<MapPinSize, number> = { small: 20, medium: 28, large: 36 };

/**
 * Icone d'une punaise (Lot I, phase C) — portrait de la fiche liee quand il
 * y en a une (meme repli initiale-en-attendant-le-chargement que
 * `RelationsGraphNodeCard.tsx`/`FamilyTreeCard.tsx`, jamais une icone
 * cassee), simple point neutre sinon (retour utilisateur : "un point qui
 * permet d'ajouter des points en lien ou non avec des fiches").
 */
export default function MapPinMarker({
  label,
  size,
  refEntityId,
  left,
  top,
  onClick,
}: {
  label: string;
  size: MapPinSize;
  refEntityId?: string | null;
  left: number;
  top: number;
  onClick?: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  const checkAlreadyLoaded = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setStatus(img.naturalWidth > 0 ? "loaded" : "error");
  }, []);

  const px = SIZE_PX[size];

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      title={label || undefined}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-accent bg-panel-raised shadow-md transition-transform hover:scale-110"
      style={{ left, top, width: px, height: px }}
    >
      {refEntityId ? (
        <>
          {status !== "loaded" && (
            <span className="font-semibold text-ink-muted" style={{ fontSize: px * 0.4 }}>
              {label.slice(0, 1).toUpperCase() || "?"}
            </span>
          )}
          {status !== "error" && (
            // eslint-disable-next-line @next/next/no-img-element -- avatar dynamique, meme motif que RelationsGraphNodeCard.tsx
            <img
              ref={checkAlreadyLoaded}
              src={`/api/entities/${refEntityId}/portrait`}
              alt=""
              onLoad={() => setStatus("loaded")}
              onError={() => setStatus("error")}
              className={`h-full w-full object-cover ${status === "loaded" ? "" : "hidden"}`}
            />
          )}
        </>
      ) : (
        <span className="h-2 w-2 rounded-full bg-accent" />
      )}
    </button>
  );
}
