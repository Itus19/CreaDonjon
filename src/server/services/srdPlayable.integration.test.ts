import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { activateFeature } = await import("./featureActivation");
const { resolveCharacterActionContext } = await import("./characterActions");
const { getEntityRuntimeState, applyRuntimeStateChange } = await import("./runtimeState");
const { getRuleEntryForWorld } = await import("./rules");

/**
 * V3.1-133 — le quotidien du SRD rendu jouable, contre la base réelle APRÈS
 * réimport (`data/srd/playable-2024.json`) : un monde sur le SRD 5.2.1
 * officiel, SANS variante, et un Guerrier 5 hors combat. Rien n'est surchargé :
 * ce sont les données officielles qui jouent. Monde jetable, comptes réutilisés.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("le quotidien du SRD jouable (V3.1-133, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let joueuse: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let guerrierId: string;
  const client = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test SRD jouable", slug: `integration-test-srd-jouable-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: joueuse.id, role: "player" },
    ]);
    const { data: pj } = await admin.from("entities").insert({ world_id: worldId, slug: "brunhild", name: "Brunhild", entity_kind: "character", created_by: gm.id }).select("id").single();
    guerrierId = pj!.id;
    const { error: blocError } = await admin.from("blocks").insert({
      entity_id: guerrierId,
      block_type: "character",
      display: { label: "Personnage", layout: "character" },
      created_by: gm.id,
      data: {
        __v: 1,
        species: { kind: "rule", key: "human" },
        background: null,
        classes: [{ class: { kind: "rule", key: "fighter" }, level: 5, subclass: null }],
        abilities: { method: "manual", base: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 } },
        choices: {},
        hp_method: "fixed",
        portrait_asset_id: null,
      },
    });
    if (blocError) throw new Error(blocError.message);
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: guerrierId, user_id: joueuse.id, is_pc: true });
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("la fiche calcule les ressources officielles : Second souffle 3 au niveau 5, Fougue 1", async () => {
    const ctx = await resolveCharacterActionContext(client(joueuse), guerrierId, campaignId, "fr");
    const res = Object.fromEntries((ctx?.sheet.resources ?? []).map((r) => [r.key, r.max]));
    expect(res).toMatchObject({ "second-wind": 3, "action-surge": 1 });
  });

  it("Second souffle, joué par la joueuse hors combat : 1 usage, 1d10 + 5 PV rendus", async () => {
    // Le MJ met le Guerrier à 10 PV par le vrai chemin d'écriture (la ligne d'état n'existe pas encore pour une fiche neuve).
    await applyRuntimeStateChange(client(gm), {
      entityId: guerrierId, campaignId, patch: { hp: { current: 10, temp: 0 } }, note: "test V3.1-133", sessionId: null, actor: "gm", actorUserId: gm.id,
    });
    expect((await getEntityRuntimeState(client(gm), guerrierId, campaignId)).hp.current).toBe(10);

    const r = await activateFeature(client(joueuse), {
      entityId: guerrierId, campaignId, ruleKey: "fighter-second-wind", activationId: "second-wind", variantId: null,
      targetParticipantIds: [], callerId: joueuse.id, callerIsGm: false, locale: "fr",
    });
    if (!r.ok) throw new Error(r.reason);
    expect(r.used).toEqual({ "second-wind": 1 });

    const apres = await getEntityRuntimeState(client(gm), guerrierId, campaignId);
    expect(apres.resources["second-wind"]).toBe(1);
    // 10 PV + (1 à 10) + niveau de Guerrier 5.
    expect(apres.hp.current).toBeGreaterThanOrEqual(16);
    expect(apres.hp.current).toBeLessThanOrEqual(25);
  });

  it("Fougue : 1 usage, puis refusée faute d'usage restant", async () => {
    const base = { entityId: guerrierId, campaignId, ruleKey: "fighter-action-surge", activationId: "action-surge", variantId: null, targetParticipantIds: [], callerId: joueuse.id, callerIsGm: false, locale: "fr" as const };
    const r = await activateFeature(client(joueuse), base);
    if (!r.ok) throw new Error(r.reason);
    // `used` est le total des usages dépensés depuis le dernier repos (Second souffle compris).
    expect(r.used["action-surge"]).toBe(1);
    expect(await activateFeature(client(joueuse), base)).toMatchObject({ ok: false, reason: "not_enough_resource" });
  });

  it("la couverture se lit sur les fiches officielles, sans variante", async () => {
    const etat = async (k: string) => (await getRuleEntryForWorld(client(gm), worldId, k, "fr"))?.coverage?.state;
    expect(await etat("fighter-second-wind")).toBe("playable");
    expect(await etat("fighter-action-surge")).toBe("partial");
    expect(await etat("paladin-abjure-foes")).toBe("partial");
    expect(await etat("paladin-channel-divinity")).toBe("partial");
  });
});
