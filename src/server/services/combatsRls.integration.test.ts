import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import { checkCombatAccess } from "./combats";

/**
 * V3.1-101 (ADR 0040) — l'initiative fermee aux joueurs, verifiee sur la
 * vraie base : un joueur de la campagne voit qu'un combat existe (statut,
 * round), mais ne lit aucun participant et n'ecrit ni le combat ni ses
 * participants ; le MJ, lui, garde tout. Et la porte des routes
 * (`checkCombatAccess`) rend le meme verdict avant toute requete.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("combats et participants reserves au MJ (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let gm: { id: string; client: SupabaseClient };
  let player: { id: string; client: SupabaseClient };
  let worldId: string;
  let campaignId: string;
  let combatId: string;
  let participantId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, player] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test combats", slug: `integration-test-combats-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: official, error: officialError } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test combats", ruleset_id: official.id, mode: "campaign", gm_user_id: gm.id })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;

    const { error: membersError } = await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: player.id, role: "player" },
    ]);
    if (membersError) throw new Error(membersError.message);

    const { data: combat, error: combatError } = await admin.from("combats").insert({ campaign_id: campaignId, name: "Embuscade" }).select("id").single();
    if (combatError || !combat) throw new Error(combatError?.message ?? "creation combat echouee");
    combatId = combat.id;

    const { data: participant, error: participantError } = await admin
      .from("combat_participants")
      .insert({ combat_id: combatId, source_kind: "custom", label: "Gobelin", ac: 15, hp_max: 7, hp_current: 7 })
      .select("id")
      .single();
    if (participantError || !participant) throw new Error(participantError?.message ?? "creation participant echouee");
    participantId = participant.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("un joueur voit le combat (statut, round) mais aucun participant", async () => {
    const { data: combats } = await player.client.from("combats").select("id, status, round").eq("id", combatId);
    expect(combats).toHaveLength(1);
    const { data: participants } = await player.client.from("combat_participants").select("id, ac, hp_current").eq("combat_id", combatId);
    expect(participants).toEqual([]);
  });

  it("un joueur n'ecrit ni le combat ni ses participants", async () => {
    await player.client.from("combats").update({ round: 99 }).eq("id", combatId);
    await player.client.from("combat_participants").update({ hp_current: 0 }).eq("id", participantId);
    const { error: insertError } = await player.client
      .from("combat_participants")
      .insert({ combat_id: combatId, source_kind: "custom", label: "Intrus", ac: 1, hp_max: 1, hp_current: 1 });
    expect(insertError).not.toBeNull();

    const { data: combat } = await admin.from("combats").select("round").eq("id", combatId).single();
    expect(combat?.round).not.toBe(99);
    const { data: goblin } = await admin.from("combat_participants").select("hp_current").eq("id", participantId).single();
    expect(goblin?.hp_current).toBe(7);
  });

  it("le MJ lit et ecrit les participants", async () => {
    const { data: participants } = await gm.client.from("combat_participants").select("id").eq("combat_id", combatId);
    expect(participants).toHaveLength(1);
    const { error } = await gm.client.from("combat_participants").update({ hp_current: 5 }).eq("id", participantId);
    expect(error).toBeNull();
    const { data: goblin } = await admin.from("combat_participants").select("hp_current").eq("id", participantId).single();
    expect(goblin?.hp_current).toBe(5);
  });

  it("la porte des routes : joueur refuse, MJ admis, adresse incoherente introuvable", async () => {
    expect(await checkCombatAccess(player.client, { userId: player.id, campaignId, combatId })).toBe("forbidden");
    expect(await checkCombatAccess(gm.client, { userId: gm.id, campaignId, combatId, participantId })).toBe("ok");
    expect(await checkCombatAccess(gm.client, { userId: gm.id, campaignId, combatId: participantId })).toBe("not_found");
  });
});
