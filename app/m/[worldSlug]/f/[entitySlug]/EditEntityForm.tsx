"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BlockShell from "@/components/blocks/BlockShell";
import SegmentsEditor from "@/components/entities/SegmentsEditor";
import type { Segment } from "@/src/core/schemas/entities/segments";
import { ENTITY_KINDS } from "@/lib/entities/schemas";
import type { EntitySummary } from "@/src/server/repos/entities";

const ENTITY_KIND_LABELS: Record<(typeof ENTITY_KINDS)[number], string> = {
  character: "Personnage",
  location: "Lieu",
  faction: "Faction",
  item: "Objet",
  creature: "Créature",
  quest: "Quête",
  event: "Événement",
  other: "Autre",
};

export default function EditEntityForm({ entity }: { entity: EntitySummary }) {
  const router = useRouter();
  const [name, setName] = useState(entity.name);
  const [entityKind, setEntityKind] = useState(entity.entity_kind);
  const [summary, setSummary] = useState(entity.summary);
  const [aliases, setAliases] = useState(entity.aliases.join(", "));
  const [tags, setTags] = useState(entity.tags.join(", "));
  const [segments, setSegments] = useState<Segment[]>(entity.narrative_content);
  const [version, setVersion] = useState(entity.version);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "conflict" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        aliases: aliases.split(",").map((s) => s.trim()).filter((s) => s.length > 0),
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
        <select
          value={entityKind}
          onChange={(e) => setEntityKind(e.target.value)}
          className="rounded-md border border-edge bg-transparent px-3 py-2"
        >
          {ENTITY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ENTITY_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>

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
        Alias (séparés par des virgules)
        <input
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          type="text"
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
  );
}
