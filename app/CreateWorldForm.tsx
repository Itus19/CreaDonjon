"use client";

import { useActionState } from "react";
import { createWorldAction, type ActionState } from "./actions";

const initialState: ActionState = null;

/**
 * Un monde = une campagne (decision produit, prepa V2-G1 export/import) :
 * ruleset et mode se choisissent desormais des la creation, plus dans un
 * second formulaire (`CampaignsPanel.tsx`, qui ne sait plus creer de
 * campagne). Seuls les rulesets OFFICIELS sont proposes ici — une variante
 * personnelle se cree apres coup depuis les Reglages du monde
 * (`RulesetSelector.tsx`), jamais dupliquee dans ce formulaire.
 */
export default function CreateWorldForm({
  officialRulesets,
}: {
  officialRulesets: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createWorldAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="name"
        type="text"
        required
        maxLength={100}
        placeholder="Nom du monde"
        className="flex-1 rounded-md border border-edge bg-transparent px-3 py-2 text-sm"
      />
      <select
        name="rulesetId"
        required
        defaultValue=""
        className="rounded-md border border-edge bg-transparent px-3 py-2 text-sm text-ink"
      >
        <option value="" disabled>
          Ruleset…
        </option>
        {officialRulesets.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <select name="mode" defaultValue="campaign" className="rounded-md border border-edge bg-transparent px-3 py-2 text-sm text-ink">
        <option value="campaign">Campagne (MJ humain)</option>
        <option value="solo">Solo (MJ IA)</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Création..." : "Créer"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
