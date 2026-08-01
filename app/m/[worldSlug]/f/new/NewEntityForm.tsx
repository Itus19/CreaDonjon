"use client";

import { useActionState, useState } from "react";
import SegmentsEditor from "@/components/entities/SegmentsEditor";
import Dropdown from "@/components/shared/Dropdown";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import type { Segment } from "@/src/core/schemas/entities/segments";
import { ENTITY_KINDS } from "@/lib/entities/schemas";
import { createEntityAction, type ActionState } from "../../actions";

const initialState: ActionState = null;

const ENTITY_KIND_DROPDOWN_OPTIONS = ENTITY_KINDS.map((kind) => ({
  value: kind,
  label: ENTITY_KIND_LABELS[kind],
}));

export default function NewEntityForm({ worldId, worldSlug }: { worldId: string; worldSlug: string }) {
  const [state, formAction, pending] = useActionState(createEntityAction, initialState);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [entityKind, setEntityKind] = useState<string>("other");
  const [name, setName] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="entityKind" value={entityKind} />
      <input type="hidden" name="narrativeContent" value={JSON.stringify(segments)} />

      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nouvelle entité"
        required
        maxLength={200}
        className="entity-title bg-transparent outline-none placeholder:text-ink-muted focus:border-b focus:border-accent"
      />

      <div className="inline-flex w-fit items-center rounded-md border border-edge bg-panel-sunken px-1">
        <Dropdown
          value={entityKind}
          options={ENTITY_KIND_DROPDOWN_OPTIONS}
          onChange={setEntityKind}
          className="bg-transparent px-2 py-1 text-xs font-medium text-ink"
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Résumé
        <textarea
          name="summary"
          rows={2}
          maxLength={2000}
          className="rounded-md border border-edge bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Alias (séparés par des virgules)
        <input name="aliases" type="text" className="rounded-md border border-edge bg-transparent px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Tags (séparés par des virgules)
        <input name="tags" type="text" className="rounded-md border border-edge bg-transparent px-3 py-2" />
      </label>

      <div className="border-t border-edge pt-3">
        <h2 className="block-title mb-2">Contenu narratif</h2>
        <SegmentsEditor segments={segments} onChange={setSegments} />
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Création..." : "Créer"}
      </button>
    </form>
  );
}
