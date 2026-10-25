"use client";

import { useCallback, useState } from "react";
import { IconeFiche } from "@/components/entities/psyche/PortraitRelation";
import { groupeDe, type GroupeReseau } from "@/lib/ui/reseau";

/** Liseré de couleur par genre : quatre teintes de la charte (personnes, lieux, factions, objets), le reste en neutre. */
const LISERE: Record<GroupeReseau, string> = {
  character: "outline-link-entity",
  location: "outline-success",
  faction: "outline-gm",
  item: "outline-players",
  autre: "outline-edge-strong",
};

/** Teinte d'un genre pour les pastilles de filtre (même table que le liseré, en fond). */
export const TEINTE_FOND: Record<GroupeReseau, string> = {
  character: "bg-link-entity",
  location: "bg-success",
  faction: "bg-gm",
  item: "bg-players",
  autre: "bg-edge-strong",
};

/**
 * Vignette d'une fiche du graphe de relations (V2-H1 phase 5, refaite en
 * V3.1-72) : 40 px, coins de 11 px (56 px et bord accent pour la fiche du
 * centre), son portrait — sinon l'icône de son genre — un liseré de couleur
 * par genre, le nom dessous (`nom` à `false` : le téléphone n'écrit que les
 * noms utiles). Même repli que `FamilyTreeCard` : l'image reste cachée tant
 * qu'elle n'a pas chargé avec succès, jamais une image cassée.
 */
export default function RelationsGraphNodeCard({
  id,
  name,
  entityKind,
  hasPortrait,
  size,
  isRoot,
  nom,
  brille,
}: {
  id: string;
  name: string;
  entityKind: string;
  hasPortrait: boolean;
  size: number;
  isRoot: boolean;
  /** Écrire le nom sous vignette. */
  nom: boolean;
  /** « Trouver… » : la vignette brille. */
  brille: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const checkAlreadyLoaded = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setStatus(img.naturalWidth > 0 ? "loaded" : "error");
  }, []);

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size + 40 }}>
      <div
        className={`flex items-center justify-center overflow-hidden bg-panel-raised shadow-md outline outline-2 outline-offset-1 ${LISERE[groupeDe(entityKind)]} ${
          isRoot ? "border-2 border-accent" : "border border-edge-strong"
        } ${brille ? "ring-4 ring-accent" : ""}`}
        style={{ width: size, height: size, borderRadius: 11 }}
      >
        {(!hasPortrait || status !== "loaded") && <IconeFiche genre={entityKind} />}
        {hasPortrait && status !== "error" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={checkAlreadyLoaded}
            src={`/api/entities/${id}/portrait`}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            className={`h-full w-full object-cover ${status === "loaded" ? "" : "hidden"}`}
          />
        )}
      </div>
      {nom && (
        <span className={`max-w-full truncate text-center text-xs ${isRoot ? "font-semibold text-ink" : "text-ink-soft"}`} title={name}>
          {name}
        </span>
      )}
    </div>
  );
}
