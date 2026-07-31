import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/**
 * `null` si l'utilisateur n'est ni proprietaire ni membre du monde. Le
 * proprietaire n'a pas forcement de ligne dans `world_members` (l'appartenance
 * du proprietaire se lit sur `worlds.owner_id`, pas dans la table de
 * collaborateurs) — voir app.is_world_member en RLS.
 */
export async function getWorldRole(
  supabase: TypedClient,
  worldId: string,
  userId: string
): Promise<"owner" | "editor" | "viewer" | null> {
  const { data: world, error: worldError } = await supabase
    .from("worlds")
    .select("owner_id")
    .eq("id", worldId)
    .maybeSingle();
  if (worldError) throw new Error(worldError.message);
  if (world?.owner_id === userId) return "owner";

  const { data: member, error: memberError } = await supabase
    .from("world_members")
    .select("role")
    .eq("world_id", worldId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  return (member?.role as "owner" | "editor" | "viewer" | undefined) ?? null;
}

/** Roles de campagne de cet utilisateur, pour toutes les campagnes de ce monde. */
export async function getCampaignRolesForWorld(
  supabase: TypedClient,
  worldId: string,
  userId: string
): Promise<Record<string, "gm" | "player">> {
  const { data, error } = await supabase
    .from("campaign_members")
    .select("campaign_id, role, campaigns!inner(world_id)")
    .eq("user_id", userId)
    .eq("campaigns.world_id", worldId);
  if (error) throw new Error(error.message);

  return Object.fromEntries(data.map((row) => [row.campaign_id, row.role as "gm" | "player"]));
}
