import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { setCombatLighting, recomputeMasking, attackSightFor } = await import("./combatPerception");
const { getOrOpenSessionForCampaign } = await import("./sessions");
const { getCombatById, listCombatParticipants } = await import("../repos/combats");

/**
 * V3.1-181 (ADR 0078) — la perception contre la vraie base : dans le noir, un
 * gobelin loin des PJ disparaît de la vue d'une joueuse (appel direct de la
 * fonction compris) et revient au jour ; un gobelin Invisible aussi ; un PJ
 * caché (Discrétion 20) attaque avec avantage un gobelin qui ne le trouve pas.
 * Comptes du groupe fixe (docs/TESTS.md §2), monde supprimé à la fin.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("la perception en combat (V3.1-181, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let a: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let combatId: string;
  let pcId: string;
  const ligne: Record<string, string> = {};
  const client = (u: ReusableAccount) => u.client as unknown as SupabaseClient<Database>;

  const vueJoueuse = async () => (await client(a).rpc("combat_player_view", { p_combat: combatId })).data ?? [];
  const recalculer = async () => {
    const combat = (await getCombatById(client(gm), combatId))!;
    return recomputeMasking(client(gm), { campaignId, combat, callerIsGm: true, locale: "fr" });
  };

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, a] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test perception", slug: `integration-test-perception-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: a.id, role: "player" },
    ]);
    // Un PJ humain : pas de vision dans le noir.
    const { data: e } = await admin.from("entities").insert({ world_id: worldId, slug: `lia-${Date.now()}`, name: "Lia", entity_kind: "character", created_by: gm.id }).select("id").single();
    const { error: be } = await admin.from("blocks").insert({
      entity_id: e!.id,
      block_type: "character",
      display: { label: "Personnage", layout: "character" },
      visibility_level: "players",
      created_by: gm.id,
      data: { __v: 1, species: { kind: "rule", key: "human" }, background: null, classes: [{ class: { kind: "rule", key: "rogue" }, level: 1, subclass: null }], abilities: { method: "manual", base: { str: 10, dex: 16, con: 12, int: 10, wis: 12, cha: 10 } }, choices: {}, hp_method: "fixed", portrait_asset_id: null },
    });
    if (be) throw new Error(be.message);
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: e!.id, user_id: a.id, is_pc: true });
    pcId = e!.id;

    const sessionId = await getOrOpenSessionForCampaign(client(gm), campaignId);
    const { data: combat } = await admin.from("combats").insert({ campaign_id: campaignId, session_id: sessionId, name: "Nuit", status: "running", round: 1, turn_index: 0 }).select("id").single();
    combatId = combat!.id;
    const base = { combat_id: combatId, ac: 13, hp_max: 10, hp_current: 10, temp_hp: 0, is_ally: false, conditions: [] };
    const { data: rows, error: re } = await admin
      .from("combat_participants")
      .insert([
        { ...base, source_kind: "entity", entity_id: pcId, rule_key: null, label: "Lia", initiative: 18, display_order: 1, pos_x: 0, pos_y: 0 },
        { ...base, source_kind: "statblock", entity_id: null, rule_key: "goblin-warrior", label: "Gobelin", initiative: 12, display_order: 2, pos_x: 12, pos_y: 0 },
      ])
      .select("id, label");
    if (re || !rows) throw new Error(re?.message ?? "participants");
    for (const r of rows) ligne[r.label] = r.id;
  }, 180000);

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("dans le noir, le gobelin disparaît de la vue de la joueuse (« Quelqu'un », sans position) ; au jour, il revient", async () => {
    await setCombatLighting(client(gm), { campaignId, combatId, lighting: "dark", actorUserId: gm.id, locale: "fr" });
    const nuit = (await vueJoueuse()).find((r) => r.id === ligne.Gobelin);
    expect(nuit).toMatchObject({ label: "Quelqu'un", pos_x: null, pos_y: null, conditions: [], wound: null });
    // Son PJ, lui, reste visible.
    expect((await vueJoueuse()).find((r) => r.id === ligne.Lia)).toMatchObject({ label: "Lia", pos_x: 0 });
    await setCombatLighting(client(gm), { campaignId, combatId, lighting: "bright", actorUserId: gm.id, locale: "fr" });
    expect((await vueJoueuse()).find((r) => r.id === ligne.Gobelin)).toMatchObject({ label: "Gobelin", pos_x: 12 });
  }, 120000);

  it("un gobelin Invisible est masqué, puis revient quand l'état tombe", async () => {
    await admin.from("combat_participants").update({ conditions: ["Invisible"] }).eq("id", ligne.Gobelin);
    expect(await recalculer()).toBe(1);
    expect((await vueJoueuse()).find((r) => r.id === ligne.Gobelin)?.label).toBe("Quelqu'un");
    await admin.from("combat_participants").update({ conditions: [] }).eq("id", ligne.Gobelin);
    expect(await recalculer()).toBe(1);
    expect((await vueJoueuse()).find((r) => r.id === ligne.Gobelin)?.label).toBe("Gobelin");
  }, 120000);

  it("Lia cachée (Discrétion 20) attaque avec avantage un gobelin qui ne la trouve pas (Perception passive 9)", async () => {
    await admin.from("combat_participants").update({ conditions: ["hidden"], stealth_total: 20 }).eq("id", ligne.Lia);
    const combat = (await getCombatById(client(gm), combatId))!;
    const rows = await listCombatParticipants(client(gm), combatId);
    const vue = await attackSightFor(client(gm), {
      combat, rows, attacker: rows.find((r) => r.id === ligne.Lia)!, target: rows.find((r) => r.id === ligne.Gobelin)!,
      campaignId, worldId, locale: "fr", pcEntityIds: new Set([pcId]),
    });
    expect(vue).toMatchObject({ sight: "advantage", targetSees: "unseen", attackerSees: "clear" });
  }, 120000);
});
