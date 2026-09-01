"use client";

import { useState } from "react";
import MapWorkspace from "./MapWorkspace";
import Dropdown from "@/components/shared/Dropdown";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import type { BlockItem } from "@/components/blocks/EntityBlocks";
import type { MapBlockData } from "@/src/core/schemas/blocks/map";

/**
 * Contenu du bloc `map` d'une fiche de type `carte` (Lot I, retour
 * utilisateur : "une catégorie 'Cartes'... une fiche fenêtre avec la
 * carte en grand"). Sauvegarde directe (`PATCH /api/blocks/[id]`), sans
 * passer par `EntityBlocks.tsx` — cette vue ne montre jamais la liste de
 * blocs generique, seulement ce bloc unique en plein format.
 */
export default function CarteMapPanel({ worldSlug, block }: { worldSlug: string; block: BlockItem }) {
  const [version, setVersion] = useState(block.version);
  const [data, setData] = useState(block.data as MapBlockData);
  const [visibilityLevel, setVisibilityLevel] = useState(block.visibilityLevel);
  const [error, setError] = useState<string | null>(null);

  async function patch(overrides: { data?: MapBlockData; visibilityLevel?: string }) {
    setError(null);
    const res = await fetch(`/api/blocks/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        display: block.display,
        data: overrides.data ?? data,
        visibility: { level: overrides.visibilityLevel ?? visibilityLevel, scopeId: block.visibilityScopeId },
      }),
    });
    if (!res.ok) {
      setError(res.status === 409 ? "Cette carte a été modifiée ailleurs — rechargez la page." : "Échec de l'enregistrement.");
      return;
    }
    const updated = (await res.json()) as { version: number };
    setVersion(updated.version);
    if (overrides.data) setData(overrides.data);
    if (overrides.visibilityLevel) setVisibilityLevel(overrides.visibilityLevel);
  }

  if (data.mode !== "own") {
    return <p className="text-sm text-danger">Ce bloc référence une autre carte — édition non disponible ici pour l&apos;instant.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-end gap-2">
        {error && <p className="text-xs text-danger">{error}</p>}
        <Dropdown
          value={visibilityLevel}
          options={VISIBILITY_OPTIONS}
          onChange={(v) => patch({ visibilityLevel: v })}
          aria-label="Visibilité de la carte"
          className="rounded-full border border-edge bg-panel-raised px-2 py-0.5 text-xs text-ink transition-colors hover:bg-panel"
        />
      </div>
      <div className="min-h-0 flex-1">
        <MapWorkspace worldSlug={worldSlug} data={data} onChange={(d) => patch({ data: d })} height="100%" />
      </div>
    </div>
  );
}
