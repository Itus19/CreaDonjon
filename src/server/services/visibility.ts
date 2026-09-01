import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import { getCampaignRolesForWorld, getWorldRole } from "@/src/server/repos/access";

type TypedClient = SupabaseClient<Database>;

/**
 * Construit le `Viewer` (SCHEMA.md §4.2) de l'utilisateur authentifie pour ce
 * monde. Le cas `anonymous` (partage en lecture seule, V0-07) n'est pas
 * couvert ici : chaque appelant a deja verifie `auth.getUser()` avant.
 *
 * `React.cache()` (retour utilisateur : "recharge des choses déjà
 * présentes") — appelee independamment par `canEditEntity`,
 * `listVisibleBlocks`, `getFamilyTree`, `getRelationsGraph`,
 * `getPlayerEntityDetail`... souvent plusieurs fois sur UNE seule fiche
 * (un bloc genealogie + un bloc reseau + le filtrage des autres blocs, par
 * exemple) : memes deux requetes "quel role a ce viewer dans ce monde"
 * repetees a chaque fois sans ce cache.
 */
export const buildViewerForWorld = cache(async function buildViewerForWorld(
  supabase: TypedClient,
  worldId: string,
  userId: string
): Promise<Viewer> {
  const [worldRole, campaignRoles] = await Promise.all([
    getWorldRole(supabase, worldId, userId),
    getCampaignRolesForWorld(supabase, worldId, userId),
  ]);

  return { kind: "user", userId, worldRole, campaignRoles };
});
