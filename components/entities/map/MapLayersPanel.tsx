"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import EyeIcon from "@/components/shared/EyeIcon";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import type { VisibleMapLayer } from "@/src/server/services/mapLayers";

/**
 * Panneau des couches (Lot I, phase E) — creer/nommer/reordonner/masquer
 * une couche pendant l'edition, comme le retour utilisateur le decrit
 * ("outil de couche... bascule afficher/masquer une couche entiere cote
 * MJ, confort d'edition"). La bascule masquer/afficher ici est un etat
 * LOCAL (jamais persiste, jamais un filtre de securite en soi — voir
 * `hiddenLayerIds` dans `MapWorkspace.tsx`) : la visibilite REELLE d'une
 * couche passe par son propre `visibilityLevel`, resolu cote serveur
 * (ADR 0017 decision 2, "ET jamais l'un sans l'autre").
 */
export default function MapLayersPanel({
  layers,
  hiddenLayerIds,
  onToggleHidden,
  onCreate,
  onRename,
  onChangeVisibility,
  onMove,
  onDelete,
  onClose,
}: {
  layers: VisibleMapLayer[];
  hiddenLayerIds: Set<string>;
  onToggleHidden: (layerId: string) => void;
  onCreate: (name: string) => void;
  onRename: (layerId: string, name: string) => void;
  onChangeVisibility: (layerId: string, level: string) => void;
  onMove: (layerId: string, direction: "up" | "down") => void;
  onDelete: (layerId: string) => void;
  onClose: () => void;
}) {
  const [newLayerName, setNewLayerName] = useState("");

  function submitNewLayer() {
    const name = newLayerName.trim();
    if (!name) return;
    onCreate(name);
    setNewLayerName("");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-edge-strong bg-panel p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Couches</span>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {layers.length === 0 && <p className="text-xs italic text-ink-muted">Aucune couche pour l&apos;instant.</p>}
          {layers.map((layer, index) => (
            <div key={layer.id} className="flex items-center gap-1.5 rounded-md border border-edge px-2 py-1.5">
              <button
                type="button"
                onClick={() => onToggleHidden(layer.id)}
                className="shrink-0 text-ink-muted hover:text-ink"
                aria-label={hiddenLayerIds.has(layer.id) ? "Afficher cette couche pendant l'édition" : "Masquer cette couche pendant l'édition"}
                title="Bascule d'édition seulement — n'affecte pas qui peut voir cette couche"
              >
                <EyeIcon open={!hiddenLayerIds.has(layer.id)} className="h-4 w-4" />
              </button>
              <LayerNameInput name={layer.name} onRename={(name) => onRename(layer.id, name)} />
              <Dropdown
                value={layer.visibilityLevel}
                options={VISIBILITY_OPTIONS}
                onChange={(v) => onChangeVisibility(layer.id, v)}
                aria-label="Visibilité de la couche"
                className="shrink-0 rounded-full border border-edge bg-panel-raised px-2 py-0.5 text-xs text-ink transition-colors hover:bg-panel"
              />
              <button
                type="button"
                onClick={() => onMove(layer.id, "up")}
                disabled={index === 0}
                className="shrink-0 text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
                aria-label="Monter"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => onMove(layer.id, "down")}
                disabled={index === layers.length - 1}
                className="shrink-0 text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
                aria-label="Descendre"
              >
                ▼
              </button>
              <button type="button" onClick={() => onDelete(layer.id)} className="shrink-0 text-xs text-ink-muted hover:text-danger" aria-label="Supprimer la couche">
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-edge/60 pt-2.5">
          <input
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNewLayer();
              }
            }}
            placeholder="Nouvelle couche…"
            className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <button type="button" onClick={submitNewLayer} className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover">
            + Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

/** Nom de couche editable en place, sauvegarde au blur (meme convention que le titre d'un bloc, EntityBlocks.tsx) — jamais un appel reseau a chaque frappe. */
function LayerNameInput({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  const [trackedName, setTrackedName] = useState(name);
  if (name !== trackedName) {
    setTrackedName(name);
    setDraft(name);
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed !== name) onRename(trimmed);
      }}
      placeholder="Nom de la couche"
      className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
    />
  );
}
