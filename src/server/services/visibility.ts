import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import { getCampaignRolesForWorld, getWorldRole } from "@/src/server/repos/access";

type TypedClient = SupabaseClient<Database>;

/**
 * Construit le `Viewer` (SCHEMA.md §4.2) de l'utilisateur authentifie pour ce
 * monde. Le cas `anonymous` (partage en lecture seule, V0-07) n'est pas
 * couvert ici : chaque appelant a deja verifie `auth.getUser()` avant.
 */
export async function buildViewerForWorld(
  supabase: TypedClient,
  worldId: string,
  userId: string
): Promise<Viewer> {
  const [worldRole, campaignRoles] = await Promise.all([
    getWorldRole(supabase, worldId, userId),
    getCampaignRolesForWorld(supabase, worldId, userId),
  ]);

  return { kind: "user", userId, worldRole, campaignRoles };
}
