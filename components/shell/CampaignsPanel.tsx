"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import CampaignDetail from "./CampaignDetail";

export interface CampaignSummaryView {
  id: string;
  worldId: string;
  name: string;
  rulesetId: string;
  gmUserId: string | null;
  mode: string;
  partyEntityId: string | null;
  createdAt: string;
}

/**
 * La campagne du monde (V1-C1, revu V2-G1 "un monde = une campagne") : au
 * plus une par monde desormais (contrainte d'unicite, migration
 * 20260826100001), creee avec le monde lui-meme
 * (`createWorldWithCampaign`) — plus de formulaire de creation ici dans le
 * cas normal. Le formulaire de creation ne reste visible QUE si ce monde
 * n'en a encore aucune (monde plus ancien que cette decision, jamais
 * complete) : reparation, pas un chemin a emprunter deux fois — la
 * contrainte d'unicite refuse de toute facon une seconde tentative
 * (409 `world_already_has_campaign`).
 */
export default function CampaignsPanel({
  worldSlug,
  defaultRulesetId,
  initialCampaigns,
  worldEntities,
  grantableEntities,
  canUseSoloMode,
  canManage,
}: {
  worldSlug: string;
  defaultRulesetId: string | null;
  initialCampaigns: CampaignSummaryView[];
  worldEntities: { id: string; name: string }[];
  /** V2-M9 (Lot M) : toutes les fiches du monde (pas seulement les personnages) — pour le selecteur "Octrois d'edition" de `CampaignDetail`, distinct de `worldEntities` (reserve a "Personnages attribues"). */
  grantableEntities: { id: string; name: string }[];
  /** V2-M2 (Lot M) : le mode solo est reserve au superadmin — verifie cote serveur (route `/api/campaigns/[id]` et `/api/worlds/[slug]/campaigns`), cette prop ne fait qu'eviter d'afficher une option qui echouerait toujours. */
  canUseSoloMode: boolean;
  /** V2-M7 (Lot M) : revocation de fiche PJ et octrois d'edition (`CampaignDetail`) reserves au MJ reel de ce monde (`isWorldAdmin`, deja verifie cote serveur par la page appelante) — cette prop ne fait qu'eviter d'afficher des actions qui echoueraient toujours pour un simple joueur qui atteindrait cette page. */
  canManage: boolean;
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"campaign" | "solo">("campaign");
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const modeOptions = canUseSoloMode
    ? [
        { value: "campaign", label: "Campagne (MJ humain)" },
        { value: "solo", label: "Solo (MJ IA)" },
      ]
    : [{ value: "campaign", label: "Campagne (MJ humain)" }];

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!defaultRulesetId) {
      setError("Ce monde n'a pas encore de ruleset par défaut.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`/api/worlds/${worldSlug}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rulesetId: defaultRulesetId, mode }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec de la création.");
      return;
    }
    const campaign = (await res.json()) as CampaignSummaryView;
    setCampaigns((prev) => [campaign, ...prev]);
    setName("");
  }

  async function switchMode(campaignId: string, nextMode: "campaign" | "solo") {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: nextMode }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec du changement de mode.");
      return;
    }
    const updated = (await res.json()) as CampaignSummaryView;
    setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? updated : c)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-edge bg-panel-sunken p-4">
      <h2 className="block-title text-base">Campagne</h2>

      {campaigns.length === 0 && (
        <>
          <p className="text-xs text-ink-muted">
            Ce monde n&apos;a pas encore de campagne (créé avant cette fonctionnalité) — complétez-le :
          </p>
          <form onSubmit={createCampaign} className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de la campagne"
              className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            />
            <Dropdown
              value={mode}
              onChange={(v) => setMode(v as "campaign" | "solo")}
              options={modeOptions}
              aria-label="Mode de jeu"
              className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
            />
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? "Création..." : "Créer"}
            </button>
          </form>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {campaigns.length > 0 && (
        <ul className="flex flex-col gap-2">
          {campaigns.map((c) => (
            <li key={c.id}>
              <div className="flex w-full items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  className="flex-1 text-left text-sm text-ink hover:text-accent"
                >
                  {c.name}
                </button>
                <Dropdown
                  value={c.mode}
                  onChange={(v) => switchMode(c.id, v as "campaign" | "solo")}
                  options={modeOptions}
                  disabled={pending}
                  aria-label="Mode de jeu"
                  className="rounded-full border border-edge bg-transparent px-2 py-0.5 text-xs text-ink-muted outline-none transition-colors hover:bg-panel-raised disabled:opacity-50"
                />
              </div>
              {expandedId === c.id && (
                <CampaignDetail campaignId={c.id} worldEntities={worldEntities} grantableEntities={grantableEntities} canManage={canManage} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
