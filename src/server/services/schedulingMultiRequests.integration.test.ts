import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import { declineRequest, getSchedulingBoard, openAvailabilityRequest, respondToRequest } from "./scheduling";

/**
 * V3.1-190 — plusieurs demandes de disponibilités ouvertes, vérifiées sur la
 * vraie base (migration `20261109150000_availability_requests_multiples`) :
 * deux demandes ouvertes ensemble ; le même jour coché dans les deux ne
 * s'écrase plus ; « aucune date ne me va » compte comme une réponse ; et la
 * RLS de `availability_declines` ne laisse écrire qu'à soi-même.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("calendrier réel à plusieurs demandes (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let gm: { id: string; client: SupabaseClient };
  let player: { id: string; client: SupabaseClient };
  let playerB: { id: string; client: SupabaseClient };
  let worldId: string;
  let campaignId: string;
  let premiere: string;
  let seconde: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, player, playerB] = await Promise.all([
      getReusableTestAccount(admin, "gm"),
      getReusableTestAccount(admin, "player"),
      getReusableTestAccount(admin, "playerB"),
    ]);

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test calendrier", slug: `integration-test-calendrier-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: official, error: officialError } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test calendrier", ruleset_id: official.id, mode: "campaign", gm_user_id: gm.id })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;

    const { error: membersError } = await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: player.id, role: "player" },
      { campaign_id: campaignId, user_id: playerB.id, role: "player" },
    ]);
    if (membersError) throw new Error(membersError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("le MJ ouvre deux demandes en même temps, qui partagent un jour", async () => {
    const a = await openAvailabilityRequest(gm.client, { campaignId, title: "Janvier", candidateDates: ["2030-01-05", "2030-01-06"], startsAt: "14:00", endsAt: "22:00", createdBy: gm.id });
    const b = await openAvailabilityRequest(gm.client, { campaignId, title: "Février", candidateDates: ["2030-01-06", "2030-02-02"], startsAt: "14:00", endsAt: "22:00", createdBy: gm.id });
    premiere = a.id;
    seconde = b.id;
    const board = await getSchedulingBoard(gm.client, { campaignId, userId: gm.id, requestId: null });
    expect(board.requests.map((r) => r.title)).toEqual(["Janvier", "Février"]);
  });

  it("le même jour coché dans les deux demandes garde deux réponses distinctes", async () => {
    const r1 = await respondToRequest(player.client, { campaignId, requestId: premiere, userId: player.id, date: "2030-01-06", startsAt: "14:00", endsAt: "18:00" });
    const r2 = await respondToRequest(player.client, { campaignId, requestId: seconde, userId: player.id, date: "2030-01-06", startsAt: "18:00", endsAt: "22:00" });
    expect(r1.ok && r2.ok).toBe(true);
    const { data } = await admin.from("real_session_availabilities").select("request_id, starts_at").eq("user_id", player.id).eq("campaign_id", campaignId);
    expect((data ?? []).map((d) => `${d.request_id === premiere ? "A" : "B"} ${d.starts_at.slice(0, 5)}`).sort()).toEqual(["A 14:00", "B 18:00"]);
  });

  it("« aucune date ne me va » compte comme une réponse, et cocher une date l'annule", async () => {
    expect(await declineRequest(playerB.client, { campaignId, requestId: premiere, userId: playerB.id })).toBe(true);
    let board = await getSchedulingBoard(gm.client, { campaignId, userId: gm.id, requestId: premiere });
    expect(board.responses.find((r) => r.userId === playerB.id)?.responded).toBe(true);

    await respondToRequest(playerB.client, { campaignId, requestId: premiere, userId: playerB.id, date: "2030-01-05", startsAt: "15:00", endsAt: "19:00" });
    board = await getSchedulingBoard(playerB.client, { campaignId, userId: playerB.id, requestId: premiere });
    expect(board.declined).toBe(false);
    expect(board.myResponses).toHaveLength(1);
  });

  it("un joueur ne peut pas écrire « aucune date » au nom d'un autre", async () => {
    const { error } = await player.client.from("availability_declines").insert({ request_id: seconde, campaign_id: campaignId, user_id: playerB.id });
    expect(error).not.toBeNull();
  });

  it("une réponse à une demande close est refusée", async () => {
    await admin.from("availability_requests").update({ status: "closed" }).eq("id", seconde);
    const r = await respondToRequest(player.client, { campaignId, requestId: seconde, userId: player.id, date: "2030-02-02", startsAt: "14:00", endsAt: "18:00" });
    expect(r).toEqual({ ok: false, reason: "no_open_request" });
  });
});
