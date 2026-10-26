import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createEntity } from "./entities";
import { getCreatureCombat } from "./creatureCombat";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-79 — la fiche de créature « en combat » : ses instances dans
 * l'initiative en cours, pour le MJ seulement. Un brouillon n'est pas un
 * combat en cours ; un joueur ne reçoit rien.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("combat d'une fiche de créature (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let ownerClient: SupabaseClient;
  let playerClient: SupabaseClient;
  let ownerId: string;
  let playerId: string;
  let worldId: string;
  let campaignId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const [owner, player] = await Promise.all([getReusableTestAccount(admin, "owner"), getReusableTestAccount(admin, "player")]);
    ownerId = owner.id;
    ownerClient = owner.client;
    playerId = player.id;
    playerClient = player.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test creature", slug: `integration-test-crea-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    // Le joueur doit appartenir à une campagne du monde pour voir le niveau `players`.
    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");

    campaignId = campaign.id;
    const { error: memberError } = await admin
      .from("campaign_members")
      .insert({ campaign_id: campaign.id, user_id: playerId, role: "player" });
    if (memberError) throw new Error(memberError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("deux gobelins en combat : le MJ lit leurs instances ; un brouillon et un joueur ne voient rien", async () => {
    const gobelin = await createEntity(ownerClient, { worldId, createdBy: ownerId, name: "Gobelin", entityKind: "creature", aliases: [] });

    const { data: combat, error: combatError } = await admin
      .from("combats")
      .insert({ campaign_id: campaignId, name: "Embuscade", status: "draft" })
      .select("id")
      .single();
    if (combatError || !combat) throw new Error(combatError?.message ?? "creation combat echouee");
    const participant = (label: string, hp: number) => ({
      combat_id: combat.id,
      source_kind: "entity",
      entity_id: gobelin.id,
      label,
      hp_max: 7,
      hp_current: hp,
      conditions: label === "Gobelin 2" ? ["À terre"] : [],
    });
    const { error: partError } = await admin.from("combat_participants").insert([participant("Gobelin 1", 7), participant("Gobelin 2", 3)]);
    if (partError) throw new Error(partError.message);

    expect(await getCreatureCombat(ownerClient, { entityId: gobelin.id, userId: ownerId })).toBeNull();

    const { error: runError } = await admin.from("combats").update({ status: "running" }).eq("id", combat.id);
    if (runError) throw new Error(runError.message);

    const vuMj = await getCreatureCombat(ownerClient, { entityId: gobelin.id, userId: ownerId });
    expect(vuMj?.combatId).toBe(combat.id);
    expect(vuMj?.instances.map((i) => [i.label, i.hpCurrent, i.conditions])).toEqual(
      expect.arrayContaining([
        ["Gobelin 1", 7, []],
        ["Gobelin 2", 3, ["À terre"]],
      ])
    );
    expect(await getCreatureCombat(playerClient, { entityId: gobelin.id, userId: playerId })).toBeNull();
  });
});
