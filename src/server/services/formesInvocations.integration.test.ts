import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { playFormsAndSummons, endFormsAndSummons } = await import("./combatForms");
const { moveParticipant } = await import("./combatPositions");
const { getOrOpenSessionForCampaign } = await import("./sessions");
const { getCombatById } = await import("../repos/combats");
const { readCombatParticipantsSigned } = await import("./engineSigning");

/**
 * V3.1-183 (ADR 0078) — les formes et les invocations contre la vraie base :
 * une joueuse invoque une chouette (changement signé, la base vérifie que
 * celle qui invoque est SON PJ), la déplace, ne peut pas invoquer au nom du
 * PJ d'une autre ; une forme se pose ; la fin de l'effet de la règle retire
 * la créature et la forme. Comptes du groupe fixe, monde supprimé à la fin.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("formes et invocations (V3.1-183, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let a: ReusableAccount;
  let b: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let combatId: string;
  const pc: Record<string, string> = {};
  const ligne: Record<string, string> = {};
  const client = (u: ReusableAccount) => u.client as unknown as SupabaseClient<Database>;
  const lignes = async () => (await admin.from("combat_participants").select("id, label, summoned_by, controlled_by, source_rule_key, form, pos_x, is_ally").eq("combat_id", combatId)).data ?? [];

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, a, b] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player"), getReusableTestAccount(admin, "playerB")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test formes", slug: `integration-test-formes-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id })
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
    for (const [nom, owner] of [["Mira", a.id], ["Brunhild", b.id]] as const) {
      const { data: e } = await admin.from("entities").insert({ world_id: worldId, slug: `${nom.toLowerCase()}-${Date.now()}`, name: nom, entity_kind: "character", created_by: gm.id }).select("id").single();
      const { error: be } = await admin.from("blocks").insert({
        entity_id: e!.id, block_type: "character", display: { label: "Personnage", layout: "character" }, visibility_level: "players", created_by: gm.id,
        data: { __v: 1, species: { kind: "rule", key: "human" }, background: null, classes: [{ class: { kind: "rule", key: "druid" }, level: 2, subclass: null }], abilities: { method: "manual", base: { str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 10 } }, choices: {}, hp_method: "fixed", portrait_asset_id: null },
      });
      if (be) throw new Error(be.message);
      await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: e!.id, user_id: owner, is_pc: true });
      pc[nom] = e!.id;
    }
    const sessionId = await getOrOpenSessionForCampaign(client(gm), campaignId);
    const { data: combat } = await admin.from("combats").insert({ campaign_id: campaignId, session_id: sessionId, name: "Forêt", status: "running", round: 1, turn_index: 0 }).select("id").single();
    combatId = combat!.id;
    const base = { combat_id: combatId, ac: 12, hp_max: 20, hp_current: 20, temp_hp: 0, is_ally: false, conditions: [], source_kind: "entity", rule_key: null };
    const { data: rows, error: re } = await admin
      .from("combat_participants")
      .insert([
        { ...base, entity_id: pc.Mira, label: "Mira", initiative: 15, display_order: 1, pos_x: 0, pos_y: 0 },
        { ...base, entity_id: pc.Brunhild, label: "Brunhild", initiative: 12, display_order: 2, pos_x: 3, pos_y: 0 },
      ])
      .select("id, label");
    if (re || !rows) throw new Error(re?.message ?? "participants");
    for (const r of rows) ligne[r.label] = r.id;
  }, 180000);

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  const jouer = async (u: ReusableAccount, casterEntityId: string, effects: Parameters<typeof playFormsAndSummons>[1]["effects"]) => {
    const combat = (await getCombatById(client(gm), combatId))!;
    const participants = await readCombatParticipantsSigned(client(u), { campaignId, combatId });
    return playFormsAndSummons(client(u), { campaignId, combat, participants, effects, casterEntityId, ruleKey: "find-familiar", callerIsGm: false, worldId, locale: "fr" });
  };

  it("une joueuse invoque une chouette : alliée, à côté de Mira, pilotée par elle", async () => {
    const phrases = await jouer(a, pc.Mira, [{ action: "summon", who: pc.Mira, creature: "owl", count: 1 }]);
    expect(phrases.join(" ")).toMatch(/invoque/);
    const chouette = (await lignes()).find((r) => r.summoned_by === ligne.Mira);
    expect(chouette).toMatchObject({ controlled_by: a.id, source_rule_key: "find-familiar", is_ally: true, pos_x: 0 });
    ligne.Chouette = chouette!.id;
  }, 120000);

  it("elle déplace sa chouette, pas le PJ d'une autre ; et n'invoque pas au nom de Brunhild", async () => {
    expect(await moveParticipant(client(a), { campaignId, combatId, userId: a.id, participantId: ligne.Chouette, position: { x: 6, y: 1.5 }, locale: "fr" })).toMatchObject({ ok: true });
    expect(await moveParticipant(client(a), { campaignId, combatId, userId: a.id, participantId: ligne.Brunhild, position: { x: 9, y: 0 }, locale: "fr" })).toMatchObject({ ok: false });
    await expect(jouer(a, pc.Brunhild, [{ action: "summon", who: pc.Brunhild, creature: "owl", count: 1 }])).rejects.toThrow();
    expect((await lignes()).filter((r) => r.summoned_by === ligne.Brunhild)).toHaveLength(0);
  }, 120000);

  it("une forme se pose (Forme sauvage : loup), et la fin de l'effet de la règle retire forme et chouette", async () => {
    await jouer(a, pc.Mira, [{ action: "transform", who: pc.Mira, form: "wolf", mode: "overlay" }]);
    expect((await lignes()).find((r) => r.id === ligne.Mira)?.form).toMatchObject({ rule_key: "wolf", mode: "overlay", source_rule_key: "find-familiar" });
    expect(await endFormsAndSummons(client(a), { campaignId, combatId, bearerParticipantId: ligne.Mira, sourceRuleKey: "find-familiar", callerIsGm: false })).toBe(2);
    const apres = await lignes();
    expect(apres.find((r) => r.id === ligne.Mira)?.form).toBeNull();
    expect(apres.find((r) => r.id === ligne.Chouette)).toBeUndefined();
  }, 120000);
});
