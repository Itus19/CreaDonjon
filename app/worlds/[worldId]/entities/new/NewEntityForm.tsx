"use client";

import { useActionState, useState } from "react";
import SegmentsEditor from "@/components/entities/SegmentsEditor";
import type { Segment } from "@/src/core/schemas/entities/segments";
import { ENTITY_KINDS } from "@/lib/entities/schemas";
import { createEntityAction, type ActionState } from "../../actions";

const initialState: ActionState = null;

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

export default function NewEntityForm({ worldId }: { worldId: string }) {
  const [state, formAction, pending] = useActionState(createEntityAction, initialState);
  const [segments, setSegments] = useState<Segment[]>([]);

  return (
    <div className="flex flex-1 justify-center font-sans">
      <form
        action={formAction}
        className="flex w-full max-w-2xl flex-col gap-4 py-16 px-8"
      >
        <input type="hidden" name="worldId" value={worldId} />
        <input type="hidden" name="narrativeContent" value={JSON.stringify(segments)} />

        <h1 className="text-xl font-semibold text-accent">Nouvelle entité</h1>

        <label className="flex flex-col gap-1 text-sm">
          Nom
          <input
            name="name"
            type="text"
            required
            maxLength={200}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            name="entityKind"
            defaultValue="other"
            className="rounded-md border border-border bg-transparent px-3 py-2"
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
            name="summary"
            rows={2}
            maxLength={2000}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Alias (séparés par des virgules)
          <input
            name="aliases"
            type="text"
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Tags (séparés par des virgules)
          <input
            name="tags"
            type="text"
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>

        <SegmentsEditor segments={segments} onChange={setSegments} />

        {state?.error && <p className="text-sm text-danger">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Création..." : "Créer"}
        </button>
      </form>
    </div>
  );
}
