import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { moveParticipant } = await import("./combatPositions");
const { undoLastCombatAction } = await import("./combats");
const { getOrOpenSessionForCampaign } = await import("./sessions");
const { applyResolvedEffects, targetDamageDefenses } = await import("./targetedRoll");
const { listCombatParticipants } = await import("../repos/combats");

/**
 * V3.1-169 (ADR 0077) — le plan et les défenses, contre la vraie base : une
 * joueuse déplace SON PJ (pas celui d'une autre, pas un monstre), le
 * mouvement se compte pendant son tour, le MJ déplace tout le monde et
 * « Annuler » rend la position ; un dégât typé contre une immunité de bloc de
 * stats tombe à 0. Comptes du groupe fixe (docs/TESTS.md §2), monde supprimé.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("le plan du combat et les défenses (V3.1-169, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let a: ReusableAccount;
  let b: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let combatId: string;
  const participant: Record<string, string> = {};
  const client = (u: ReusableAccount) => u.client as unknown as SupabaseClient<Database>;

  async function ligne(id: string) {
    const { data } = await admin.from("combat_participants").select("pos_x, pos_y, turn_usage, hp_current").eq("id", id).single();
    return data!;
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, a, b] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player"), getReusableTestAccount(admin, "playerB")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test plan", slug: `integration-test-plan-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: a.id, role: "player" },
      { campaign_id: campaignId, user_id: b.id, role: "player" },
    ]);

    const pcs: Record<string, string> = {};
    for (const [key, owner] of [["Naivara", a.id], ["Brunhild", b.id]] as const) {
      const { data: e } = await admin.from("entities").insert({ world_id: worldId, slug: `${key.toLowerCase()}-${Date.now()}`, name: key, entity_kind: "character", created_by: gm.id }).select("id").single();
      const { error: be } = await admin.from("blocks").insert({
        entity_id: e!.id,
        block_type: "character",
        display: { label: "Personnage", layout: "character" },
        visibility_level: "players",
        created_by: gm.id,
        data: { __v: 1, species: { kind: "rule", key: "human" }, background: null, classes: [{ class: { kind: "rule", key: "fighter" }, level: 1, subclass: null }], abilities: { method: "manual", base: { str: 16, dex: 14, con: 12, int: 8, wis: 13, cha: 10 } }, choices: {}, hp_method: "fixed", portrait_asset_id: null },
      });
      if (be) throw new Error(be.message);
      await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: e!.id, user_id: owner, is_pc: true });
      pcs[key] = e!.id;
    }

    const sessionId = await getOrOpenSessionForCampaign(client(gm), campaignId);
    const { data: combat } = await admin.from("combats").insert({ campaign_id: campaignId, session_id: sessionId, name: "Plan", status: "running", round: 1, turn_index: 0 }).select("id").single();
    combatId = combat!.id;
    const base = { combat_id: combatId, ac: 15, hp_max: 200, hp_current: 200, temp_hp: 0, is_ally: false, conditions: [] };
    const { data: rows, error: re } = await admin
      .from("combat_participants")
      .insert([
        // Naivara joue la première (initiative 20) : son tour est en cours.
        { ...base, source_kind: "entity", entity_id: pcs.Naivara, rule_key: null, label: "Naivara", initiative: 20, display_order: 1, pos_x: 0, pos_y: 0 },
        { ...base, source_kind: "entity", entity_id: pcs.Brunhild, rule_key: null, label: "Brunhild", initiative: 15, display_order: 2, pos_x: 3, pos_y: 0 },
        { ...base, source_kind: "statblock", entity_id: null, rule_key: "adult-black-dragon", label: "Dragon", initiative: 10, display_order: 3, pos_x: 20, pos_y: 0 },
      ])
      .select("id, label");
    if (re || !rows) throw new Error(re?.message ?? "participants");
    for (const r of rows) participant[r.label] = r.id;
  }, 180000);

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  const deplacer = (u: ReusableAccount, label: string, position: { x: number; y: number } | null) =>
    moveParticipant(client(u), { campaignId, combatId, userId: u.id, participantId: participant[label], position, locale: "fr" });

  it("une joueuse ne déplace ni le PJ d'une autre, ni un monstre", async () => {
    expect(await deplacer(a, "Brunhild", { x: 5, y: 5 })).toMatchObject({ ok: false, reason: "not_yours" });
    expect(await deplacer(a, "Dragon", { x: 5, y: 5 })).toMatchObject({ ok: false });
    expect(await ligne(participant.Brunhild)).toMatchObject({ pos_x: 3, pos_y: 0 });
    expect(await ligne(participant.Dragon)).toMatchObject({ pos_x: 20, pos_y: 0 });
  }, 60000);

  it("une joueuse déplace son PJ pendant son tour : le mouvement est décompté (9 m), un dépassement signalé", async () => {
    const r1 = await deplacer(a, "Naivara", { x: 6, y: 0 });
    expect(r1).toMatchObject({ ok: true, movement: { moved: 6, speed: 9, over: false } });
    const r2 = await deplacer(a, "Naivara", { x: 6, y: 4.5 });
    expect(r2).toMatchObject({ ok: true, movement: { moved: 10.5, over: true } });
    const row = await ligne(participant.Naivara);
    expect(row).toMatchObject({ pos_x: 6, pos_y: 4.5 });
    expect((row.turn_usage as { budget?: { moved?: number } }).budget?.moved).toBe(10.5);
  }, 60000);

  it("hors de son tour, un déplacement ne compte pas ; le MJ déplace tout le monde, retire un jeton, et « Annuler » le rend", async () => {
    const r = await deplacer(b, "Brunhild", { x: 3, y: 3 });
    expect(r).toMatchObject({ ok: true, movement: null });
    expect(await deplacer(gm, "Dragon", { x: 12, y: 0 })).toMatchObject({ ok: true });
    expect(await deplacer(gm, "Dragon", null)).toMatchObject({ ok: true, position: null });
    expect(await ligne(participant.Dragon)).toMatchObject({ pos_x: null, pos_y: null });
    expect(await undoLastCombatAction(client(gm), combatId, gm.id)).toBe(true);
    expect(await ligne(participant.Dragon)).toMatchObject({ pos_x: 12, pos_y: 0 });
  }, 60000);

  it("la vue des joueurs rend les positions", async () => {
    const { data } = await client(a).rpc("combat_player_view", { p_combat: combatId });
    expect(data?.find((row) => row.id === participant.Dragon)).toMatchObject({ pos_x: 12, pos_y: 0 });
  }, 30000);

  it("un dégât typé contre l'immunité d'un bloc de stats : 12 d'acide sur le dragon noir → 0", async () => {
    const dragon = (await listCombatParticipants(client(gm), combatId)).find((p) => p.id === participant.Dragon)!;
    const defenses = await targetDamageDefenses(client(gm), { target: dragon, isPc: false, campaignId, worldId, locale: "fr" });
    expect(defenses?.immune).toContain("acid");
    const key = `participant:${dragon.id}`;
    const outcome = await applyResolvedEffects(client(gm), {
      campaignId,
      callerId: gm.id,
      actor: null,
      scene: null,
      spend: null,
      effects: [{ action: "deal_damage", who: key, amount: 12, damage_type: "acid" }],
      note: "test défenses",
      fromEventId: null,
      combatId,
      defenses: { [key]: defenses },
    });
    expect(outcome.applied.state.actors[key]?.hp.current).toBe(200);
    expect(outcome.changes.join(" ")).toMatch(/12 → 0/);
  }, 60000);
});
