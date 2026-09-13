"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import type { MapElementRef } from "@/src/core/schemas/mapElementRef";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import type { VisibleMapLayer } from "@/src/server/services/mapLayers";
import Checkbox from "@/components/shared/Checkbox";

export interface MapRegionDraft {
  /** `null` = zone pas encore creee (polygone qui vient d'etre trace, en attente de son premier enregistrement). */
  id: string | null;
  shape: { x: number; y: number }[];
  name: string;
  ref: MapElementRef | null;
  fillColor: string;
  borderColor: string;
  layerId: string | null;
  /** V2-I2 (brouillard de guerre) — soumise au brouillard ou non. */
  fogGated: boolean;
  /** V2-I2 — revelee pour LA campagne courante (sans objet tant que `id` est `null`, une zone pas encore creee n'a rien a reveler). */
  revealed: boolean;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

const NO_LINK = "__none__";
const NO_LAYER = "__none__";

/**
 * Popup d'edition d'une zone (Lot I, phase D) — meme structure que
 * `MapPinEditorPopup.tsx` (nom/lien independants, meme selecteur de fiche),
 * un choix de couleur remplissage + contour a la place de la taille.
 */
export default function MapRegionEditorPopup({
  draft,
  otherEntities,
  layers,
  onSave,
  onDelete,
  onReveal,
  onClose,
}: {
  draft: MapRegionDraft;
  otherEntities: OtherEntityOption[];
  layers: VisibleMapLayer[];
  onSave: (draft: MapRegionDraft) => void;
  onDelete?: () => void;
  /** V2-I2 — absent tant que `draft.id` est `null` (rien a reveler avant le premier enregistrement). */
  onReveal?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [refEntityId, setRefEntityId] = useState(draft.ref?.id ?? NO_LINK);
  const [fillColor, setFillColor] = useState(draft.fillColor);
  const [borderColor, setBorderColor] = useState(draft.borderColor);
  const [layerId, setLayerId] = useState(draft.layerId ?? NO_LAYER);
  const [fogGated, setFogGated] = useState(draft.fogGated);
  const [visibilityLevel, setVisibilityLevel] = useState(draft.visibilityLevel);

  function save() {
    onSave({
      ...draft,
      name: name.trim(),
      ref: refEntityId === NO_LINK ? null : { kind: "entity", id: refEntityId },
      fillColor,
      borderColor,
      layerId: layerId === NO_LAYER ? null : layerId,
      fogGated,
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
              triggerClassName="rounded-md border border-edge bg-transparent px-2 py-1.5 text-left text-sm text-ink outline-none hover:bg-panel-raised"
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
              triggerClassName="rounded-md border border-edge bg-transparent px-2 py-1.5 text-left text-sm text-ink outline-none hover:bg-panel-raised"
            />
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <Checkbox
            checked={fogGated}
            onChange={() => setFogGated(!fogGated)}
            label="Soumise au brouillard (cachée aux joueurs tant qu'elle n'est pas révélée)"
            className="gap-2 text-xs text-ink"
          />
          {draft.id && fogGated && (
            <div className="flex items-center gap-2 pl-5 text-xs">
              {draft.revealed ? (
                <span className="text-ink-muted">Révélée aux joueurs.</span>
              ) : (
                <>
                  <span className="text-ink-muted">Cachée aux joueurs.</span>
                  {onReveal && (
                    <button
                      type="button"
                      onClick={onReveal}
                      className="rounded-full border border-accent px-2.5 py-0.5 text-accent transition-colors hover:bg-accent/10"
                    >
                      Révéler
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {layers.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Couche
            <Dropdown
              value={layerId}
              options={[{ value: NO_LAYER, label: "Aucune couche" }, ...layers.map((l) => ({ value: l.id, label: l.name || "(sans nom)" }))]}
              onChange={setLayerId}
              aria-label="Couche de la zone"
              triggerClassName="rounded-md border border-edge bg-transparent px-2 py-1.5 text-left text-sm text-ink outline-none hover:bg-panel-raised"
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
