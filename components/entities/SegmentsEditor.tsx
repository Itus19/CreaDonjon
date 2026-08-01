"use client";

import type { Segment } from "@/src/core/schemas/entities/segments";
import Dropdown from "@/components/shared/Dropdown";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import VisibilityBadge from "./VisibilityBadge";

let nextLocalId = 1;
function generateSegmentId(): string {
  return `s${Date.now()}-${nextLocalId++}`;
}

export function newSegment(): Segment {
  return {
    id: generateSegmentId(),
    visibility: { level: "public", scopeId: null },
    content: [{ t: "text", v: "" }],
  };
}

function segmentText(segment: Segment): string {
  return segment.content
    .map((node) => (node.t === "ref" ? node.label : node.v))
    .join("");
}

export default function SegmentsEditor({
  segments,
  onChange,
  onBlur,
}: {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
  /** Sauvegarde a la perte de focus (comme l'ancienne application) — optionnel : NewEntityForm n'a pas encore de fiche a sauvegarder. */
  onBlur?: () => void;
}) {
  function updateSegment(index: number, patch: Partial<Segment>) {
    onChange(segments.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function updateText(index: number, text: string) {
    updateSegment(index, { content: [{ t: "text", v: text }] });
  }

  function updateVisibilityLevel(index: number, level: (typeof VISIBILITY_OPTIONS)[number]["value"]) {
    updateSegment(index, { visibility: { level, scopeId: null } });
    onBlur?.();
  }

  function removeSegment(index: number) {
    onChange(segments.filter((_, i) => i !== index));
    onBlur?.();
  }

  function addSegment() {
    onChange([...segments, newSegment()]);
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={addSegment}
        className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        + Ajouter un segment
      </button>

      {segments.length === 0 && (
        <p className="text-sm text-ink-muted">Aucun segment pour l&apos;instant.</p>
      )}

      {segments.map((segment, index) => (
        <div key={segment.id} className="flex flex-col gap-2 rounded-lg border border-edge p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <VisibilityBadge level={segment.visibility.level} />
              <Dropdown
                value={segment.visibility.level}
                options={VISIBILITY_OPTIONS}
                onChange={(v) => updateVisibilityLevel(index, v as (typeof VISIBILITY_OPTIONS)[number]["value"])}
                aria-label="Visibilité du segment"
              />
            </div>
            <button
              type="button"
              onClick={() => removeSegment(index)}
              className="text-xs text-danger hover:underline"
            >
              Supprimer
            </button>
          </div>
          <textarea
            value={segmentText(segment)}
            onChange={(e) => updateText(index, e.target.value)}
            onBlur={onBlur}
            rows={3}
            className="prose-narrative w-full rounded-md border border-edge bg-transparent px-3 py-2"
          />
        </div>
      ))}
    </div>
  );
}
