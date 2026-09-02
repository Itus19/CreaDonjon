"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import type { MapElementRef } from "@/src/core/schemas/mapElementRef";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";

export interface MapRegionDraft {
  /** `null` = zone pas encore creee (polygone qui vient d'etre trace, en attente de son premier enregistrement). */
  id: string | null;
  shape: { x: number; y: number }[];
  name: string;
  ref: MapElementRef | null;
  fillColor: string;
  borderColor: string;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

const NO_LINK = "__none__";

/**
 * Popup d'edition d'une zone (Lot I, phase D) — meme structure que
 * `MapPinEditorPopup.tsx` (nom/lien independants, meme selecteur de fiche),
 * un choix de couleur remplissage + contour a la place de la taille.
 */
export default function MapRegionEditorPopup({
  draft,
  otherEntities,
  onSave,
  onDelete,
  onClose,
}: {
  draft: MapRegionDraft;
  otherEntities: OtherEntityOption[];
  onSave: (draft: MapRegionDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [refEntityId, setRefEntityId] = useState(draft.ref?.id ?? NO_LINK);
  const [fillColor, setFillColor] = useState(draft.fillColor);
  const [borderColor, setBorderColor] = useState(draft.borderColor);
  const [visibilityLevel, setVisibilityLevel] = useState(draft.visibilityLevel);

  function save() {
    onSave({
      ...draft,
      name: name.trim(),
      ref: refEntityId === NO_LINK ? null : { kind: "entity", id: refEntityId },
      fillColor,
      borderColor,
      visibilityLevel,
      visibilityScopeId: null,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-edge-strong bg-panel p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">{draft.id ? "Modifier la zone" : "Nouvelle zone"}</span>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Nom
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la zone"
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
            Remplissage
            <input
              type="color"
              value={fillColor}
              onChange={(e) => setFillColor(e.target.value)}
              className="h-8 w-full cursor-pointer rounded-md border border-edge bg-transparent"
              aria-label="Couleur de remplissage"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-ink-muted">
            Contour
            <input
              type="color"
              value={borderColor}
              onChange={(e) => setBorderColor(e.target.value)}
              className="h-8 w-full cursor-pointer rounded-md border border-edge bg-transparent"
              aria-label="Couleur du contour"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-ink-muted">
            Visibilité
            <Dropdown
              value={visibilityLevel}
              options={VISIBILITY_OPTIONS}
              onChange={setVisibilityLevel}
              aria-label="Visibilité de la zone"
              className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-left text-sm text-ink outline-none hover:bg-panel-raised"
            />
          </label>
        </div>

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
