import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getRegionById } from "@/src/server/repos/mapRegions";
import { getBlockById } from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { insertRegionReveal, isRegionRevealed } from "@/src/server/repos/mapRegionReveals";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { canUserEditEntityById } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

export type RevealMapRegionResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "not_found" | "no_campaign" };

/**
 * Revele une zone `fog_gated` pour la campagne du monde qui la porte (V2-I2,
 * brouillard de guerre) — un geste de MJ (`canUserEditEntityById`, meme
 * garde que les autres mutations de zone). Idempotent (`isRegionRevealed`
 * verifie avant d'inserer) : recliquer sur une zone deja revelee ne
 * journalise pas un second `session_event` pour rien.
 *
 * "un monde = une campagne" (V2-G1, `campaigns_world_id_unique`) — la
 * campagne se resout depuis le monde de la fiche qui porte le bloc, jamais
 * fournie par l'appelant (qui n'a aucune raison d'en connaitre l'id).
 */
export async function revealMapRegion(supabase: TypedClient, params: { regionId: string; userId: string }): Promise<RevealMapRegionResult> {
  const region = await getRegionById(supabase, params.regionId);
  if (!region) return { ok: false, reason: "not_found" };
  const block = await getBlockById(supabase, region.block_id);
  if (!block) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: block.entity_id, userId: params.userId });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const entity = await getEntityById(supabase, block.entity_id);
  if (!entity) return { ok: false, reason: "not_found" };
  const campaignId = await resolveCampaignId(supabase, entity.world_id);
  if (!campaignId) return { ok: false, reason: "no_campaign" };

  const already = await isRegionRevealed(supabase, campaignId, params.regionId);
  if (already) return { ok: true };

  await insertRegionReveal(supabase, { campaignId, regionId: params.regionId });

  const sessionId = await getOrOpenSessionForCampaign(supabase, campaignId);
  const seq = await nextEventSeq(supabase, sessionId);
  await insertSessionEvent(supabase, {
    sessionId,
    seq,
    kind: "world_update",
    actor: "gm",
    actorUserId: params.userId,
    payload: { note: `Zone révélée aux joueurs : ${region.name || "sans nom"}` } as unknown as Json,
  });

  return { ok: true };
}
