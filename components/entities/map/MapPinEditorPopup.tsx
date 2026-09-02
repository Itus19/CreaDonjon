"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import type { MapPinSize } from "@/src/core/schemas/mapPin";
import type { MapElementRef } from "@/src/core/schemas/mapElementRef";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import type { VisibleMapLayer } from "@/src/server/services/mapLayers";

export interface MapPinDraft {
  /** `null` = punaise pas encore creee (vient d'etre posee, en attente de son premier enregistrement). */
  id: string | null;
  x: number;
  y: number;
  label: string;
  ref: MapElementRef | null;
  size: MapPinSize;
  layerId: string | null;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

const SIZE_OPTIONS: { value: MapPinSize; label: string }[] = [
  { value: "small", label: "Petite" },
  { value: "medium", label: "Moyenne" },
  { value: "large", label: "Grande" },
];

const NO_LINK = "__none__";

/**
 * Popup d'edition d'une punaise (Lot I, phase C) — nom libre et lien vers
 * une fiche existante sont INDEPENDANTS l'un de l'autre (retour utilisateur,
 * point 1) : changer l'un ne touche jamais l'autre. Meme selecteur de cible
 * que `RelationsChips.tsx` (`otherEntities`, Dropdown trie par nom) — pas
 * de nouvelle recherche a construire pour ce meme besoin.
 */
const NO_LAYER = "__none__";

export default function MapPinEditorPopup({
  draft,
  otherEntities,
  layers,
  onSave,
  onDelete,
  onClose,
}: {
  draft: MapPinDraft;
  otherEntities: OtherEntityOption[];
  layers: VisibleMapLayer[];
  onSave: (draft: MapPinDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(draft.label);
  const [refEntityId, setRefEntityId] = useState(draft.ref?.id ?? NO_LINK);
  const [size, setSize] = useState<MapPinSize>(draft.size);
  const [layerId, setLayerId] = useState(draft.layerId ?? NO_LAYER);
  const [visibilityLevel, setVisibilityLevel] = useState(draft.visibilityLevel);

  function save() {
    onSave({
      ...draft,
      label: label.trim(),
      ref: refEntityId === NO_LINK ? null : { kind: "entity", id: refEntityId },
      size,
      layerId: layerId === NO_LAYER ? null : layerId,
      visibilityLevel,
      visibilityScopeId: null,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-edge-strong bg-panel p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">{draft.id ? "Modifier la punaise" : "Nouvelle punaise"}</span>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Nom
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nom de la punaise"
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
        </label>

        {otherEntities.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Lien vers une fiche
            <Dropdown
              value={refEntityId}
              options={[
                { value: NO_LINK, label: "Aucun lien" },
                ...otherEntities.map((e) => ({ value: e.id, label: e.name })).sort((a, b) => a.label.localeCompare(b.label, "fr")),
              ]}
              onChange={setRefEntityId}
              aria-label="Fiche liée"
              className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-left text-sm text-ink outline-none hover:bg-panel-raised"
            />
          </label>
        )}

        <div className="flex items-center gap-3">
          <label className="flex flex-1 flex-col gap-1 text-xs text-ink-muted">
            Taille
            <Dropdown
              value={size}
              options={SIZE_OPTIONS}
              onChange={(v) => setSize(v as MapPinSize)}
              aria-label="Taille de la punaise"
              className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-left text-sm text-ink outline-none hover:bg-panel-raised"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-ink-muted">
            Visibilité
            <Dropdown
              value={visibilityLevel}
              options={VISIBILITY_OPTIONS}
              onChange={setVisibilityLevel}
              aria-label="Visibilité de la punaise"
              className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-left text-sm text-ink outline-none hover:bg-panel-raised"
            />
          </label>
        </div>

        {layers.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Couche
            <Dropdown
              value={layerId}
              options={[{ value: NO_LAYER, label: "Aucune couche" }, ...layers.map((l) => ({ value: l.id, label: l.name || "(sans nom)" }))]}
              onChange={setLayerId}
              aria-label="Couche de la punaise"
              className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-left text-sm text-ink outline-none hover:bg-panel-raised"
            />
          </label>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          {draft.id && onDelete ? (
            <button type="button" onClick={onDelete} className="rounded-full border border-edge px-3 py-1 text-xs text-danger transition-colors hover:bg-panel-raised">
              Supprimer
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={save} className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
