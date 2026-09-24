import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getOpenAiCompatibleProviderFromEnv } from "./adapters/openAiCompatible";
import { narrateSoloTurn, reconstructTurnForNarration } from "./soloNarration";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { Viewer } from "@/src/core/visibility";

/**
 * V3-B2/B4 — Contre le vrai modèle plutôt qu'un mock : ce que ce fichier
 * vérifie (un `tool_call` valide, la reconstruction d'un tour passé depuis
 * `session_events`, deux narrations liées au même `from_event`) ne se
 * laisse pas rejouer fidèlement par un fournisseur factice — même motif
 * que `openAiCompatible.integration.test.ts`, dont ce fichier reprend le
 * gabarit `skipIf`/`ctx.skip()`.
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

describe.skipIf(!hasSupabaseCreds || !hasAiEnv)("narrateSoloTurn / reconstructTurnForNarration (integration, base et modele reels)", () => {
  let admin: SupabaseClient;
  let playerClient: SupabaseClient;
  let playerUserId: string;
  let worldId: string;
  let campaignId: string;
  let sessionId: string;
  let playerEntityId: string;
  let fromEventId: string;
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
      .insert({ name: "Monde de test narration", slug: `integration-test-narration-${Date.now()}`, owner_id: gm.id })
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
      .insert({ world_id: worldId, slug: `pj-narration-${Date.now()}`, name: "Perrin (test)", entity_kind: "character", created_by: gm.id })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    playerEntityId = entity.id;

    // Un tour deja journalise, comme playTurn (V3-B2) l'aurait fait — pas
    // besoin de la boucle complete pour verifier CE que ce fichier verifie :
    // reconstruire depuis le journal, jamais rejouer le tour.
    const { data: rollEvent, error: rollError } = await admin
      .from("session_events")
      .insert({
        session_id: sessionId,
        seq: 1,
        kind: "player_action",
        actor: "player",
        payload: { __v: 1, facts: ["Perrin fouille la pièce."], intent: { text: "je fouille la pièce" }, resolution: "aucune" },
      })
      .select("id")
      .single();
    if (rollError || !rollEvent) throw new Error(rollError?.message ?? "creation evenement roll echouee");

    const { error: applicationError } = await admin.from("session_events").insert({
      session_id: sessionId,
      seq: 2,
      kind: "rule_application",
      actor: "system",
      payload: { __v: 1, from_event: rollEvent.id, effects: [], changes: [], persisted: [], changes_text: ["Perrin trouve une clé rouillée."], hints_text: [] },
    });
    if (applicationError) throw new Error(applicationError.message);

    fromEventId = rollEvent.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("reconstruit playerAction/facts/changes depuis le journal, sans rejouer le tour", async (ctx) => {
    if (!aiReachable) ctx.skip();
    const reconstructed = await reconstructTurnForNarration(playerClient, sessionId, fromEventId);

    expect(reconstructed.ok).toBe(true);
    if (!reconstructed.ok) return;
    expect(reconstructed.playerAction).toBe("je fouille la pièce");
    expect(reconstructed.facts).toEqual(["Perrin fouille la pièce."]);
    expect(reconstructed.changes).toEqual(["Perrin trouve une clé rouillée."]);
  });

  it("« raconter autrement » ecrit une SECONDE narration, liee au MEME from_event, jamais un nouveau jet", async (ctx) => {
    if (!aiReachable) ctx.skip();
    const provider = getOpenAiCompatibleProviderFromEnv();
    const viewer: Viewer = { kind: "user", userId: playerUserId, worldRole: null, campaignRoles: { [campaignId]: "player" } };
    const reconstructed = await reconstructTurnForNarration(playerClient, sessionId, fromEventId);
    if (!reconstructed.ok) throw new Error(reconstructed.reason);

    const params = {
      worldId,
      campaignId,
      playerEntityId,
      viewer,
      userId: playerUserId,
      sessionId,
      fromEventId,
      playerAction: reconstructed.playerAction,
      facts: reconstructed.facts,
      changes: reconstructed.changes,
      hints: reconstructed.hints,
    };

    const first = await narrateSoloTurn(playerClient, provider, params);
    expect(first.ok).toBe(true);

    const again = await narrateSoloTurn(playerClient, provider, params);
    expect(again.ok).toBe(true);
    expect(again.eventId).not.toBe(first.eventId);

    const { data: narrationEvents, error } = await admin
      .from("session_events")
      .select("id, payload")
      .eq("session_id", sessionId)
      .eq("kind", "narration");
    if (error) throw new Error(error.message);

    expect(narrationEvents.length).toBe(2);
    for (const row of narrationEvents) {
      expect((row.payload as { from_event: string }).from_event).toBe(fromEventId);
    }
  }, 60_000);
});
