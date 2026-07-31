"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BlockShell from "@/components/blocks/BlockShell";
import SegmentsEditor from "@/components/entities/SegmentsEditor";
import RelationsChips, { type OtherEntityOption, type RelationChip } from "@/components/entities/RelationsChips";
import EntityBlocks, { type BlockItem } from "@/components/blocks/EntityBlocks";
import Dropdown from "@/components/shared/Dropdown";
import type { Segment } from "@/src/core/schemas/entities/segments";
import { ENTITY_KINDS } from "@/lib/entities/schemas";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import type { EntitySummary } from "@/src/server/repos/entities";

const ENTITY_KIND_DROPDOWN_OPTIONS = ENTITY_KINDS.map((kind) => ({
  value: kind,
  label: ENTITY_KIND_LABELS[kind],
}));

export default function EditEntityForm({
  entity,
  worldSlug,
  initialBlocks,
  initialRelations,
  otherEntities,
}: {
  entity: EntitySummary;
  worldSlug: string;
  initialBlocks: BlockItem[];
  initialRelations: RelationChip[];
  otherEntities: OtherEntityOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(entity.name);
  const [entityKind, setEntityKind] = useState(entity.entity_kind);
  const [summary, setSummary] = useState(entity.summary);
  const [aliases, setAliases] = useState<string[]>(entity.aliases);
  const [newAlias, setNewAlias] = useState("");
  const [tags, setTags] = useState(entity.tags.join(", "));
  const [segments, setSegments] = useState<Segment[]>(entity.narrative_content);
  const [version, setVersion] = useState(entity.version);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "conflict" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function addAlias() {
    const value = newAlias.trim();
    if (value === "" || aliases.includes(value)) return;
    setAliases((prev) => [...prev, value]);
    setNewAlias("");
  }

  function removeAlias(alias: string) {
    setAliases((prev) => prev.filter((a) => a !== alias));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage(null);

    const res = await fetch(`/api/entities/${entity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        name,
        entityKind,
        summary,
        aliases,
        tags: tags.split(",").map((s) => s.trim()).filter((s) => s.length > 0),
        narrativeContent: segments,
      }),
    });

    if (res.status === 409) {
      setStatus("conflict");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setErrorMessage(body?.error ?? "Erreur inattendue.");
      setStatus("error");
      return;
    }

    const updated = await res.json();
    setVersion(updated.version);
    setStatus("saved");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-[1fr_auto] gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h1 className="font-narrative text-xl font-semibold text-accent">{name}</h1>
              <span className="font-mech text-xs text-ink-muted">{entity.slug}</span>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              Nom
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                required
                maxLength={200}
                className="rounded-md border border-edge bg-transparent px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Type
              <Dropdown
                value={entityKind}
                options={ENTITY_KIND_DROPDOWN_OPTIONS}
                onChange={setEntityKind}
                className="rounded-md border border-edge bg-transparent px-3 py-2 text-left text-sm text-ink"
              />
            </label>

            <div className="flex flex-col gap-1 text-sm">
              <span>Alias</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {aliases.map((alias) => (
                  <span
                    key={alias}
                    className="flex items-center gap-1 rounded-full border border-edge bg-panel-raised px-2.5 py-1 text-xs"
                  >
                    {alias}
                    <button
                      type="button"
                      onClick={() => removeAlias(alias)}
                      className="text-ink-muted hover:text-danger"
                      aria-label={`Retirer l'alias ${alias}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAlias();
                    }
                  }}
                  placeholder="+ ajouter"
                  className="w-24 rounded-full border border-edge bg-transparent px-2.5 py-1 text-xs outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <span>Relations</span>
              <RelationsChips
                entityId={entity.id}
                worldSlug={worldSlug}
                relations={initialRelations}
                otherEntities={otherEntities}
              />
            </div>
          </div>

          <div className="flex aspect-[3/4] w-40 shrink-0 items-center justify-center rounded-2xl border border-edge bg-panel-sunken text-center text-xs text-ink-muted">
            Portrait
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Résumé
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            maxLength={2000}
            className="rounded-md border border-edge bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Tags (séparés par des virgules)
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            type="text"
            className="rounded-md border border-edge bg-transparent px-3 py-2"
          />
        </label>

        <BlockShell title="Contenu narratif">
          <SegmentsEditor segments={segments} onChange={setSegments} />
        </BlockShell>

        {status === "conflict" && (
          <p className="text-sm text-danger">
            Cette fiche a été modifiée entre-temps. Rechargez la page avant de réessayer.
          </p>
        )}
        {status === "error" && errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
        {status === "saved" && <p className="text-sm text-ink-muted">Enregistré.</p>}

        <button
          type="submit"
          disabled={status === "saving"}
          className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {status === "saving" ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>

      <EntityBlocks entityId={entity.id} initialBlocks={initialBlocks} />
    </div>
  );
}
