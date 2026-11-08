import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { resolveCharacterActionContext } = await import("./characterActions");
const { activateFeature } = await import("./featureActivation");
const { applyResolvedEffects, targetSaveBonus } = await import("./targetedRoll");
const { getOrOpenSessionForCampaign } = await import("./sessions");
const { getCombatParticipantById } = await import("../repos/combats");

/**
 * V3.1-171 (ADR 0077) — les conditions de jeu du SRD, sur l'officiel APRÈS
 * réimport : la Rage résiste aux tranchants (12 → 6), la Résistance naine au
 * poison, l'Aura de protection couvre un allié posé à 3 m et plus à 4,5 m,
 * Aura étendue la porte à 9 m, l'Attaque sournoise exige une arme de finesse
 * ou à distance. Monde jetable, comptes du groupe fixe.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("les conditions de jeu du SRD (V3.1-171, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let joueuse: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let combatId: string;
  const ids: Record<string, string> = {};
  const lignes: Record<string, string> = {};
  const client = () => gm.client as unknown as SupabaseClient<Database>;

  async function personnage(slug: string, classe: string, niveau: number, espece = "human") {
    const { data: e } = await admin.from("entities").insert({ world_id: worldId, slug, name: slug, entity_kind: "character", created_by: gm.id }).select("id").single();
    const { error } = await admin.from("blocks").insert({
      entity_id: e!.id, block_type: "character", display: { label: "Personnage", layout: "character" }, created_by: gm.id, visibility_level: "players",
      data: { __v: 1, species: { kind: "rule", key: espece }, background: null, classes: [{ class: { kind: "rule", key: classe }, level: niveau, subclass: null }], abilities: { method: "manual", base: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 16 } }, choices: {}, hp_method: "fixed", portrait_asset_id: null } as unknown as Json,
    });
    if (error) throw new Error(error.message);
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: e!.id, user_id: joueuse.id, is_pc: true });
    ids[slug] = e!.id;
  }
  const fiche = async (slug: string) => (await resolveCharacterActionContext(client(), ids[slug], campaignId, "fr"))!;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const { data: world, error } = await admin.from("worlds").insert({ name: "Monde de test conditions SRD", slug: `integration-test-conditions-srd-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id }).select("id").single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([{ campaign_id: campaignId, user_id: gm.id, role: "gm" }, { campaign_id: campaignId, user_id: joueuse.id, role: "player" }]);
    await personnage("grok", "barbarian", 3);
    await personnage("thorin", "fighter", 1, "dwarf");
    await personnage("aldric", "paladin", 6);
    await personnage("sire", "paladin", 18);
    await personnage("lia", "fighter", 3);
    await personnage("ombre", "rogue", 3);

    const sessionId = await getOrOpenSessionForCampaign(client(), campaignId);
    const { data: combat } = await admin.from("combats").insert({ campaign_id: campaignId, session_id: sessionId, name: "Aura", status: "running", round: 1, turn_index: 0 }).select("id").single();
    combatId = combat!.id;
    const base = { combat_id: combatId, source_kind: "entity", rule_key: null, ac: 15, hp_max: 40, hp_current: 40, temp_hp: 0, is_ally: false, conditions: [] };
    const { data: rows, error: re } = await admin
      .from("combat_participants")
      .insert([
        { ...base, entity_id: ids.aldric, label: "Aldric", initiative: 20, display_order: 1, pos_x: 0, pos_y: 0 },
        { ...base, entity_id: ids.lia, label: "Lia", initiative: 15, display_order: 2, pos_x: 3, pos_y: 0 },
      ])
      .select("id, label");
    if (re || !rows) throw new Error(re?.message ?? "participants");
    for (const r of rows) lignes[r.label] = r.id;
  }, 180000);

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("Barbare en Rage : résistance aux contondants, perforants, tranchants ; 12 tranchants → 6, 12 feu → 12", async () => {
    expect((await fiche("grok")).sheet.damageDefenses.resist).toEqual([]);
    const r = await activateFeature(client(), {
      entityId: ids.grok, campaignId, ruleKey: "barbarian-rage", activationId: "rage", variantId: null, targetParticipantIds: [], callerId: gm.id, callerIsGm: true, locale: "fr",
    });
    expect(r.ok).toBe(true);
    const ctx = await fiche("grok");
    expect(ctx.sheet.damageDefenses.resist).toEqual(["bludgeoning", "piercing", "slashing"]);
    const coup = async (type: string) =>
      (
        await applyResolvedEffects(client(), {
          campaignId, callerId: gm.id, actor: { entityId: ids.grok, name: "Grok", hpMax: ctx.sheet.hitPoints.max, speed: ctx.sheet.speed.value },
          scene: null, spend: null, effects: [{ action: "deal_damage", who: ids.grok, amount: 12, damage_type: type }], note: "test", fromEventId: null, combatId: null,
          defenses: { [ids.grok]: ctx.sheet.damageDefenses },
        })
      ).changes.join(" ");
    expect(await coup("slashing")).toMatch(/12 → 6/);
    expect(await coup("fire")).not.toMatch(/→ 6, résiste/);
  }, 120000);

  it("Nain : Résistance naine au poison", async () => {
    expect((await fiche("thorin")).sheet.damageDefenses.resist).toContain("poison");
  }, 60000);

  it("Paladin 6 : aura de 3 m ; Paladin 18 : Aura étendue, 9 m", async () => {
    const aura = async (slug: string) => (await fiche(slug)).sheet.features.find((f) => f.key === "paladin-aura-of-protection")?.auras?.[0]?.radius;
    expect(await aura("aldric")).toBe(3);
    expect(await aura("sire")).toBe(9);
  }, 60000);

  it("l'allié posé à 3 m du paladin reçoit + mod. CHA à sa sauvegarde ; à 4,5 m, rien", async () => {
    const bonus = async () =>
      (await targetSaveBonus(client(), { target: (await getCombatParticipantById(client(), lignes.Lia))!, isPc: true, ability: "wis", campaignId, worldId, locale: "fr" })).bonus;
    const pres = await bonus();
    await admin.from("combat_participants").update({ pos_x: 4.5 }).eq("id", lignes.Lia);
    const loin = await bonus();
    expect(pres - loin).toBe(3);
  }, 120000);

  it("Attaque sournoise : réservée à une arme de finesse ou à distance", async () => {
    const sa = (await fiche("ombre")).sheet.features.find((f) => f.key === "rogue-sneak-attack");
    expect(sa?.activation?.activations[0]?.when).toEqual({ wielding: ["finesse", "ranged"] });
  }, 60000);
});
