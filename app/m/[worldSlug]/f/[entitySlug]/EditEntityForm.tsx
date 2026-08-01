"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

/**
 * Toujours editable en place, comme l'ancienne application (master,
 * EntityDetail.tsx) : chaque champ sauvegarde tout seul (blur/changement),
 * jamais de bouton "Enregistrer" separe a chercher.
 */
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
  const versionRef = useRef(entity.version);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "conflict" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  type SaveOverrides = {
    name?: string;
    entityKind?: string;
    summary?: string;
    aliases?: string[];
    tags?: string;
    segments?: Segment[];
  };

  /**
   * Deux declencheurs de sauvegarde peuvent se suivre a quelques
   * millisecondes d'intervalle (ex. changer le type puis quitter le champ
   * resume) : sans serialisation, le second part avec une version deja
   * perimee et echoue en 409, perdant silencieusement son changement. La
   * chaine garantit l'ordre et une version toujours a jour.
   */
  function save(overrides?: SaveOverrides) {
    const run = () => doSave(overrides);
    const next = saveChainRef.current.then(run, run);
    saveChainRef.current = next;
    return next;
  }

  async function doSave(overrides?: SaveOverrides) {
    setStatus("saving");
    setErrorMessage(null);

    const nextTags = overrides?.tags ?? tags;
    const res = await fetch(`/api/entities/${entity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: versionRef.current,
        name: overrides?.name ?? name,
        entityKind: overrides?.entityKind ?? entityKind,
        summary: overrides?.summary ?? summary,
        aliases: overrides?.aliases ?? aliases,
        tags: nextTags.split(",").map((s) => s.trim()).filter((s) => s.length > 0),
        narrativeContent: overrides?.segments ?? segments,
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
    versionRef.current = updated.version;
    setStatus("saved");
    router.refresh();
  }

  function addAlias() {
    const value = newAlias.trim();
    if (value === "" || aliases.includes(value)) return;
    const next = [...aliases, value];
    setAliases(next);
    setNewAlias("");
    save({ aliases: next });
  }

  function removeAlias(alias: string) {
    const next = aliases.filter((a) => a !== alias);
    setAliases(next);
    save({ aliases: next });
  }

  function handleKindChange(kind: string) {
    setEntityKind(kind);
    save({ entityKind: kind });
  }

  function saveSegments() {
    save({ segments });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[1fr_auto] gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => save()}
              className="entity-title flex-1 bg-transparent outline-none focus:border-b focus:border-accent"
            />
            <span className="font-mech text-xs text-ink-muted">{entity.slug}</span>
          </div>

          <div className="inline-flex w-fit items-center rounded-md border border-edge bg-panel-sunken px-1">
            <Dropdown
              value={entityKind}
              options={ENTITY_KIND_DROPDOWN_OPTIONS}
              onChange={handleKindChange}
              className="bg-transparent px-2 py-1 text-xs font-medium text-ink"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Alias :
            </span>
            {aliases.map((alias) => (
              <span
                key={alias}
                className="flex items-center gap-1 rounded-full border border-edge bg-panel-raised px-2.5 py-1"
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
              className="w-24 rounded-full border border-edge bg-transparent px-2.5 py-1 outline-none focus:border-accent"
            />
          </div>

          <div className="mt-1 flex flex-col gap-1.5 border-t border-edge/60 pt-2.5 text-xs">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Relations :
            </span>
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

      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        onBlur={() => save()}
        placeholder="Résumé..."
        rows={2}
        maxLength={2000}
        className="bg-transparent text-sm text-ink outline-none placeholder:italic placeholder:text-ink-muted focus:border-b focus:border-accent"
      />

      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        onBlur={() => save()}
        placeholder="Tags (séparés par des virgules)..."
        className="bg-transparent text-xs text-ink-muted outline-none placeholder:italic focus:border-b focus:border-accent"
      />

      {status === "conflict" && (
        <p className="text-sm text-danger">
          Cette fiche a été modifiée entre-temps. Rechargez la page avant de réessayer.
        </p>
      )}
      {status === "error" && errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

      <div className="border-t border-edge pt-3">
        <h2 className="block-title mb-2">Contenu narratif</h2>
        <SegmentsEditor segments={segments} onChange={setSegments} onBlur={saveSegments} />
      </div>

      <EntityBlocks entityId={entity.id} initialBlocks={initialBlocks} />
    </div>
  );
}
