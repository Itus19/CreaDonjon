"use client";

import { useActionState, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
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
  canUseSoloMode,
}: {
  officialRulesets: { id: string; name: string }[];
  /** V2-M2 (Lot M) : le mode solo est reserve au superadmin — verifie cote serveur (`createWorldAction`), cette prop ne fait qu'eviter d'afficher une option qui echouerait toujours. */
  canUseSoloMode: boolean;
}) {
  const [state, formAction, pending] = useActionState(createWorldAction, initialState);
  const [rulesetId, setRulesetId] = useState("");
  const [mode, setMode] = useState<"campaign" | "solo">("campaign");
  const modeOptions = canUseSoloMode
    ? [
        { value: "campaign", label: "Campagne (MJ humain)" },
        { value: "solo", label: "Solo (MJ IA)" },
      ]
    : [{ value: "campaign", label: "Campagne (MJ humain)" }];

  return (
    // `contents` : ce formulaire ne genere pas sa propre boite de mise en
    // page — ses champs deviennent des elements flex directs du conteneur
    // partage avec ImportWorldForm (app/page.tsx), pour que "Creer" et
    // "Importer" restent sur la meme ligne au lieu de deux contextes de
    // retour a la ligne independants qui se desynchronisent selon la
    // largeur d'ecran. La soumission par Entree et `useActionState`
    // fonctionnent pareil : `contents` ne change que l'affichage, jamais
    // l'arbre DOM ni le rattachement du formulaire a ses champs.
    <form action={formAction} className="contents">
      <input
        name="name"
        type="text"
        required
        maxLength={100}
        placeholder="Nom du monde"
        className="flex-1 rounded-md border border-edge bg-transparent px-3 py-2 text-sm"
      />
      <input type="hidden" name="rulesetId" value={rulesetId} />
      <Dropdown
        value={rulesetId}
        onChange={setRulesetId}
        options={[{ value: "", label: "Ruleset…" }, ...officialRulesets.map((r) => ({ value: r.id, label: r.name }))]}
        aria-label="Ruleset"
        className="rounded-md border border-edge bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
      />
      <input type="hidden" name="mode" value={mode} />
      <Dropdown
        value={mode}
        onChange={(v) => setMode(v as "campaign" | "solo")}
        options={modeOptions}
        aria-label="Mode de jeu"
        className="rounded-md border border-edge bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
      />
      <button
        type="submit"
        disabled={pending || !rulesetId}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Création..." : "Créer"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
