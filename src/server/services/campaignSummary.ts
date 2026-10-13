import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { listCampaignsForWorld, type CampaignRow } from "@/src/server/repos/campaigns";

/**
 * Module feuille (V3.1-120) : il n'importe aucun service. Sorti de
 * `campaigns.ts`, qui le reexporte, pour que `worldPlayerCharacters.ts`
 * liste les campagnes d'un monde sans former de cycle avec `campaigns.ts`.
 */

type TypedClient = SupabaseClient<Database>;

export interface CampaignSummary {
  id: string;
  worldId: string;
  name: string;
  rulesetId: string;
  gmUserId: string | null;
  mode: string;
  partyEntityId: string | null;
  createdAt: string;
}

export function toSummary(row: CampaignRow): CampaignSummary {
  return {
    id: row.id,
    worldId: row.world_id,
    name: row.name,
    rulesetId: row.ruleset_id,
    gmUserId: row.gm_user_id,
    mode: row.mode,
    partyEntityId: row.party_entity_id,
    createdAt: row.created_at,
  };
}

/** `React.cache()` (retour utilisateur : "recharge des choses déjà présentes") — "un monde = une campagne" (V2-G1), appelee independamment par de nombreux layouts/pages pour LA campagne du meme monde sur une seule requete. */
export const listCampaigns = cache(async function listCampaigns(supabase: TypedClient, worldId: string): Promise<CampaignSummary[]> {
  const rows = await listCampaignsForWorld(supabase, worldId);
  return rows.map(toSummary);
});
