"use client";

import { useState } from "react";
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

const MODE_LABELS: Record<string, string> = { campaign: "Campagne", solo: "Solo" };

/**
 * Campagnes du monde (V1-C1) : creation (nom + mode, le ruleset epingle est
 * toujours celui par defaut du monde — pas de selecteur ici, cf.
 * docs/BACKLOG_V1.md), liste, et gestion (invitation, attribution de
 * personnage) en depliant une campagne. Rendu sur la page d'accueil du
 * monde, meme emplacement que `ShareLinkPanel` — pas un nouvel onglet du
 * chrome (`SectionToggle` reste volontairement a deux onglets).
 */
export default function CampaignsPanel({
  worldSlug,
  defaultRulesetId,
  initialCampaigns,
  worldEntities,
}: {
  worldSlug: string;
  defaultRulesetId: string | null;
  initialCampaigns: CampaignSummaryView[];
  worldEntities: { id: string; name: string }[];
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"campaign" | "solo">("campaign");
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-edge bg-panel-sunken p-4">
      <h2 className="block-title text-base">Campagnes</h2>
      <p className="text-xs text-ink-muted">
        Une campagne épingle une version précise des règles ; son groupe de joueurs est une entité à part, créée
        avec elle.
      </p>

      <form onSubmit={createCampaign} className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de la campagne"
          className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "campaign" | "solo")}
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        >
          <option value="campaign">Campagne (MJ humain)</option>
          <option value="solo">Solo (MJ IA)</option>
        </select>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Création..." : "Créer"}
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}

      {campaigns.length === 0 ? (
        <p className="text-xs italic text-ink-muted">Aucune campagne pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2 border-t border-edge/60 pt-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                className="flex w-full items-center justify-between text-left text-sm text-ink hover:text-accent"
              >
                <span>{c.name}</span>
                <span className="text-xs text-ink-muted">{MODE_LABELS[c.mode] ?? c.mode}</span>
              </button>
              {expandedId === c.id && <CampaignDetail campaignId={c.id} worldEntities={worldEntities} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
