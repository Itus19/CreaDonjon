import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getOpenAiCompatibleProviderFromEnv } from "./adapters/openAiCompatible";
import { askSoloGm } from "./soloGmQuestion";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { Viewer } from "@/src/core/visibility";

/**
 * V3-D4 — Contre le vrai modèle plutôt qu'un mock, même gabarit `skipIf`/
 * `ctx.skip()` que `soloNarration.integration.test.ts` : ce que ce fichier
 * vérifie (une réponse non vide, journalisée en `note`, jamais en `roll`)
 * ne se laisse pas rejouer fidèlement par un fournisseur factice.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);
const hasAiEnv = Boolean(process.env.AI_LOCAL_BASE_URL && process.env.AI_LOCAL_MODEL);

async function isAiReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.AI_LOCAL_BASE_URL}/models`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

describe.skipIf(!hasSupabaseCreds || !hasAiEnv)("askSoloGm (integration, base et modele reels)", () => {
  let admin: SupabaseClient;
  let playerClient: SupabaseClient;
  let playerUserId: string;
  let worldId: string;
  let campaignId: string;
  let sessionId: string;
  let playerEntityId: string;
  let aiReachable = false;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    aiReachable = await isAiReachable();
    if (!aiReachable) {
      console.warn(`AI_LOCAL_BASE_URL (${process.env.AI_LOCAL_BASE_URL}) injoignable — tests de ce fichier sautes.`);
      return;
    }

    const [gm, player] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    playerUserId = player.id;
    playerClient = player.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test question MJ", slug: `integration-test-gm-question-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: official, error: officialError } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official.id, mode: "solo" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;

    const { error: membersError } = await admin.from("campaign_members").insert([{ campaign_id: campaignId, user_id: playerUserId, role: "player" }]);
    if (membersError) throw new Error(membersError.message);

    const { data: session, error: sessionError } = await admin.from("sessions").insert({ campaign_id: campaignId }).select("id").single();
    if (sessionError || !session) throw new Error(sessionError?.message ?? "creation session echouee");
    sessionId = session.id;

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: `pj-mj-question-${Date.now()}`, name: "Perrin (test)", entity_kind: "character", created_by: gm.id })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    playerEntityId = entity.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("répond, journalise en `note`, et ne touche ni scene_states ni entity_runtime_state", async (ctx) => {
    if (!aiReachable) ctx.skip();
    const provider = getOpenAiCompatibleProviderFromEnv();
    const viewer: Viewer = { kind: "user", userId: playerUserId, worldRole: null, campaignRoles: { [campaignId]: "player" } };

    const outcome = await askSoloGm(playerClient, provider, {
      worldId,
      campaignId,
      playerEntityId,
      viewer,
      userId: playerUserId,
      sessionId,
      question: "Combien de personnages composent en général une compagnie d'aventuriers ?",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.answer!.length).toBeGreaterThan(0);

    const { data: event, error } = await admin.from("session_events").select("kind, payload").eq("id", outcome.eventId!).single();
    if (error) throw new Error(error.message);
    expect(event.kind).toBe("note");
    expect((event.payload as { answer: string }).answer).toBe(outcome.answer);

    const { data: scene } = await admin.from("scene_states").select("id").eq("campaign_id", campaignId).maybeSingle();
    expect(scene).toBeNull();
    const { data: runtimeRows } = await admin.from("entity_runtime_state").select("id").eq("entity_id", playerEntityId);
    expect(runtimeRows).toEqual([]);
  }, 30_000);
});
