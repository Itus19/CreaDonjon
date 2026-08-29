import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  createSession,
  getOpenSessionForCampaign,
  getSessionById,
  listSessionEvents,
  updateSessionSummary,
  type SessionEventRow,
  type SessionRow,
} from "@/src/server/repos/sessions";
import { zSessionLogBlockData } from "@/src/core/schemas/blocks/sessionLog";
import { getBlockById } from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { listCampaigns } from "@/src/server/services/campaigns";
import { updateBlockContent, type VisibleBlock } from "@/src/server/services/blocks";

type TypedClient = SupabaseClient<Database>;

/**
 * Aucune gestion de seance n'existe encore dans l'application (pas de
 * bouton « demarrer une seance ») : les actions de jeu de la fiche jouable
 * (V1-B5 — attaque, repos) ont neanmoins besoin d'une session a laquelle
 * rattacher leur `session_event`/`dice_roll`. Decision de perimetre :
 * ouvre implicitement la derniere session sans `ended_at`, ou en cree une
 * a la volee. Une vraie interface de gestion de seance (demarrer, clore,
 * resumer) reste un ticket a part, non demande ici.
 */
export async function getOrOpenSessionForCampaign(supabase: TypedClient, campaignId: string): Promise<string> {
  const existing = await getOpenSessionForCampaign(supabase, campaignId);
  if (existing) return existing.id;
  const created = await createSession(supabase, campaignId);
  return created.id;
}

/** "Un monde = une campagne" (migration 20260826100001) : au plus une ligne. Meme resolution que `quests.ts`. */
async function resolveCampaignId(supabase: TypedClient, worldId: string): Promise<string | null> {
  const campaigns = await listCampaigns(supabase, worldId);
  return campaigns[0]?.id ?? null;
}

export type AttachSessionLogResult =
  | { ok: true; block: VisibleBlock; session: SessionRow }
  | { ok: false; reason: "not_found" | "not_a_session_log" | "no_campaign" | "conflict" };

/**
 * Epingle un bloc `session_log` (V2-H4) sur la session de campagne en
 * cours, une seule fois — appele par l'editeur quand `sessionId` est
 * encore `null`. Pas de vrai selecteur de seance (voir `sessionLog.ts`) :
 * hors partie (aucune campagne), rien a epingler, le bloc reste vide.
 */
export async function attachSessionLogBlock(
  supabase: TypedClient,
  params: { blockId: string; expectedVersion: number; changedBy: string }
): Promise<AttachSessionLogResult> {
  const existing = await getBlockById(supabase, params.blockId);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.block_type !== "session_log") return { ok: false, reason: "not_a_session_log" };

  const entity = await getEntityById(supabase, existing.entity_id);
  const campaignId = entity ? await resolveCampaignId(supabase, entity.world_id) : null;
  if (!campaignId) return { ok: false, reason: "no_campaign" };

  const sessionId = await getOrOpenSessionForCampaign(supabase, campaignId);
  const nextData = zSessionLogBlockData.parse({ __v: 1, sessionId });

  const result = await updateBlockContent(supabase, {
    id: params.blockId,
    expectedVersion: params.expectedVersion,
    display: existing.display,
    data: nextData,
    visibilityLevel: existing.visibility_level,
    visibilityScopeId: existing.visibility_scope_id,
    changedBy: params.changedBy,
  });
  if (!result.ok) return { ok: false, reason: result.reason === "not_found" ? "not_found" : "conflict" };

  const session = await getSessionById(supabase, sessionId);
  if (!session) return { ok: false, reason: "not_found" };

  return { ok: true, block: result.block, session };
}

export async function getSessionSummary(supabase: TypedClient, sessionId: string): Promise<SessionRow | null> {
  return getSessionById(supabase, sessionId);
}

export async function setSessionSummary(supabase: TypedClient, sessionId: string, summary: string): Promise<SessionRow> {
  return updateSessionSummary(supabase, sessionId, summary);
}

export async function getSessionEvents(supabase: TypedClient, sessionId: string): Promise<SessionEventRow[]> {
  return listSessionEvents(supabase, sessionId);
}
