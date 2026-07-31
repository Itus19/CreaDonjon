"use client";

import type { Segment } from "@/src/core/schemas/entities/segments";
import VisibilityBadge from "./VisibilityBadge";

// campaign/user necessitent un scopeId (une campagne ou un utilisateur
// precis) : pas de selecteur pour ca encore, donc pas propose ici. Le
// schema et la base acceptent deja les six niveaux, cet editeur n'en
// expose que quatre par simplicite (V0).
const VISIBILITY_OPTIONS: { value: "public" | "players" | "gm" | "private"; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "players", label: "Joueurs" },
  { value: "gm", label: "MJ uniquement" },
  { value: "private", label: "Privé" },
];

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
}: {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
}) {
  function updateSegment(index: number, patch: Partial<Segment>) {
    onChange(segments.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function updateText(index: number, text: string) {
    updateSegment(index, { content: [{ t: "text", v: text }] });
  }

  function updateVisibilityLevel(index: number, level: (typeof VISIBILITY_OPTIONS)[number]["value"]) {
    updateSegment(index, { visibility: { level, scopeId: null } });
  }

  function removeSegment(index: number) {
    onChange(segments.filter((_, i) => i !== index));
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
              <select
                value={segment.visibility.level}
                onChange={(e) =>
                  updateVisibilityLevel(index, e.target.value as (typeof VISIBILITY_OPTIONS)[number]["value"])
                }
                className="rounded-md border border-edge bg-transparent px-2 py-1 text-xs"
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <VisibilityBadge level={segment.visibility.level} />
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
            rows={3}
            className="prose-narrative w-full rounded-md border border-edge bg-transparent px-3 py-2"
          />
        </div>
      ))}
    </div>
  );
}
