"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import Dropdown from "@/components/shared/Dropdown";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import { useDesktop } from "@/components/shell/DesktopContext";
import { RELATION_TYPES } from "@/src/core/relations/inverses";
import { RELATION_LABELS_FR } from "@/src/i18n/fr";

export interface RelationChip {
  id: string;
  relationType: string;
  label: string;
  other: { id: string; name: string; slug: string; entity_kind: string };
}

export interface OtherEntityOption {
  id: string;
  name: string;
  slug: string;
  entity_kind: string;
}

export default function RelationsChips({
  entityId,
  worldSlug,
  relations,
  otherEntities,
}: {
  entityId: string;
  worldSlug: string;
  relations: RelationChip[];
  otherEntities: OtherEntityOption[];
}) {
  const router = useRouter();
  const desktop = useDesktop();
  const [targetEntityId, setTargetEntityId] = useState(otherEntities[0]?.id ?? "");
  const [relationType, setRelationType] = useState<(typeof RELATION_TYPES)[number]>(
    RELATION_TYPES[0]
  );
  const [visibilityLevel, setVisibilityLevel] = useState("public");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = new Map<string, RelationChip[]>();
  for (const relation of relations) {
    const kind = relation.other.entity_kind;
    const list = groups.get(kind) ?? [];
    list.push(relation);
    groups.set(kind, list);
  }

  async function removeRelation(id: string) {
    await fetch(`/api/relations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function addRelation() {
    if (!targetEntityId) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/entities/${entityId}/relations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetEntityId,
        relationType,
        visibility: { level: visibilityLevel, scopeId: null },
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Impossible d'ajouter cette relation.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {[...groups.entries()].map(([kind, chips]) => (
        <div key={kind} className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {ENTITY_KIND_LABELS[kind as keyof typeof ENTITY_KIND_LABELS] ?? kind}
          </span>
          {chips.map((relation) => (
            <span
              key={relation.id}
              className="flex items-center gap-1.5 rounded-full border border-edge bg-panel-raised px-3 py-1 text-xs"
            >
              <span className="text-ink-muted">{RELATION_LABELS_FR[relation.label] ?? relation.label}</span>
              <Link
                href={`/m/${worldSlug}/f/${relation.other.slug}`}
                onClick={(e) => {
                  if (!desktop) return;
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                  e.preventDefault();
                  desktop.openRef({ kind: "entity", key: relation.other.slug });
                }}
                className="font-medium text-link-entity hover:underline"
              >
                {relation.other.name}
              </Link>
              <button
                type="button"
                onClick={() => removeRelation(relation.id)}
                className="text-ink-muted hover:text-danger"
                aria-label="Retirer cette relation"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ))}
      {relations.length === 0 && (
        <p className="text-sm text-ink-muted">Aucune relation pour l&apos;instant.</p>
      )}

      {otherEntities.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Dropdown
            value={relationType}
            options={RELATION_TYPES.map((type) => ({ value: type, label: RELATION_LABELS_FR[type] ?? type }))}
            onChange={(v) => setRelationType(v as (typeof RELATION_TYPES)[number])}
            aria-label="Type de relation"
          />
          <Dropdown
            value={targetEntityId}
            options={otherEntities.map((other) => ({ value: other.id, label: other.name }))}
            onChange={setTargetEntityId}
            aria-label="Entité cible"
          />
          <Dropdown
            value={visibilityLevel}
            options={VISIBILITY_OPTIONS}
            onChange={setVisibilityLevel}
            aria-label="Visibilité de la relation"
          />
          <button
            type="button"
            onClick={addRelation}
            disabled={pending}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            + Ajouter une relation
          </button>
          {error && <span className="text-xs text-danger">{error}</span>}
        </div>
      )}
    </div>
  );
}
