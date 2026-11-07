import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { answerSaveRequest } = await import("./saveRequests");
const { rollAbilityCheck } = await import("./checkRolls");
const { answerRollWindow } = await import("./rollWindowResume");
const { resolveCharacterActionContext } = await import("./characterActions");
const { getEntityRuntimeState } = await import("./runtimeState");
const { insertSaveRequest } = await import("../repos/saveRequests");

/**
 * V3.1-163 (ADR 0075) — les réactions sur SON propre jet, hors combat, sur
 * l'officiel après réimport : Inflexible d'un Guerrier 9 sur une sauvegarde
 * demandée, Coup de chance d'un Roublard 20 sur un test. La joueuse est
 * l'autrice : sa réponse reprend aussitôt. Monde jetable, comptes réutilisés.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && process.env.ENGINE_SIGNING_KEY);

describe.skipIf(!hasCreds)("réagir sur son propre jet (V3.1-163, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let joueuse: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  const ids: Record<string, string> = {};
  const client = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;

  async function personnage(slug: string, species: string, classe: string, niveau: number) {
    const { data: e } = await admin.from("entities").insert({ world_id: worldId, slug, name: slug, entity_kind: "character", created_by: gm.id }).select("id").single();
    const { error } = await admin.from("blocks").insert({
      entity_id: e!.id,
      block_type: "character",
      display: { label: "Personnage", layout: "character" },
      created_by: gm.id,
      data: {
        __v: 1,
        species: { kind: "rule", key: species },
        background: null,
        classes: [{ class: { kind: "rule", key: classe }, level: niveau, subclass: null }],
        abilities: { method: "manual", base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
        choices: {},
        hp_method: "fixed",
        portrait_asset_id: null,
      } as unknown as Json,
    });
    if (error) throw new Error(error.message);
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: e!.id, user_id: joueuse.id, is_pc: true });
    ids[slug] = e!.id;
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test réactions sur soi", slug: `integration-test-reactions-soi-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id })
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
    await personnage("brom", "human", "fighter", 9);
    await personnage("vic", "human", "rogue", 20);
    await personnage("pip", "halfling", "rogue", 1);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("Inflexible : une sauvegarde demandée ratée ouvre la fenêtre ; « utiliser » relance avec + 9 et dépense l'usage", async () => {
    // DD 30 : la première sauvegarde rate toujours (une sauvegarde n'a pas de réussite automatique).
    const demande = await insertSaveRequest(client(gm), {
      campaignId, combatId: null, originRollId: null, targetKind: "entity", targetId: ids.brom, targetEntityId: ids.brom, targetUserId: joueuse.id,
      label: "Test · JS Sagesse DD 30", ability: "wis", dc: 30, effect: { on_fail: { damage: 0, conditions: [] }, on_success: { damage: 0, conditions: [] } } as unknown as Json,
    });
    const r = await answerSaveRequest(client(joueuse), { campaignId, requestId: demande.id, callerId: joueuse.id, locale: "fr", input: { mode: "roll" } });
    if (!r.ok || !r.rollWindowId) throw new Error(`fenêtre attendue : ${JSON.stringify(r)}`);
    expect((await admin.from("save_requests").select("status").eq("id", demande.id).single()).data!.status).toBe("pending");

    const reponse = await answerRollWindow(client(joueuse), { windowId: r.rollWindowId, index: 0, use: true, callerId: joueuse.id, locale: "fr" });
    if (!reponse.ok || reponse.resumed?.origin !== "save_request") throw new Error(`reprise attendue : ${JSON.stringify(reponse)}`);
    const fin = reponse.resumed.result;
    if (!fin.ok) throw new Error(fin.reason);
    // Relance : un nouveau d20 (1 à 20), + mod. SAG (+0), + 9. La maîtrise du Guerrier porte sur FOR et CON, pas SAG.
    expect(fin.total).toBeGreaterThanOrEqual(10);
    expect(fin.total).toBeLessThanOrEqual(29);
    expect((await getEntityRuntimeState(client(gm), ids.brom, campaignId)).resources.indomitable).toBe(1);
    expect((await admin.from("save_requests").select("status, total").eq("id", demande.id).single()).data).toEqual({ status: "answered", total: fin.total });
  });

  it("Coup de chance : un test raté devient un 20 ; l'usage est dépensé, et sans usage la fenêtre ne s'ouvre plus", async () => {
    // FOR 10 (+0), DD 20 : rate sauf 20 naturel (alors pas de fenêtre : on relance).
    let r = await rollAbilityCheck(client(joueuse), { entityId: ids.vic, campaignId, callerId: joueuse.id, advantage: "normal", dc: 20, hidden: false, locale: "fr", ability: "str" });
    for (let i = 0; i < 5 && r.ok && !r.roll.rollWindowId; i++) {
      r = await rollAbilityCheck(client(joueuse), { entityId: ids.vic, campaignId, callerId: joueuse.id, advantage: "normal", dc: 20, hidden: false, locale: "fr", ability: "str" });
    }
    if (!r.ok || !r.roll.rollWindowId) throw new Error("fenêtre attendue");
    expect(r.roll.recorded).toBe(false);
    const reponse = await answerRollWindow(client(joueuse), { windowId: r.roll.rollWindowId, index: 0, use: true, callerId: joueuse.id, locale: "fr" });
    if (!reponse.ok || reponse.resumed?.origin !== "sheet_check") throw new Error("reprise attendue");
    const fin = reponse.resumed.result;
    if (!fin.ok) throw new Error(fin.reason);
    expect(fin.roll.total).toBe(20);
    expect(fin.roll.verdict).toBe("success");
    expect(fin.roll.recorded).toBe(true);
    expect((await getEntityRuntimeState(client(gm), ids.vic, campaignId)).resources["stroke-of-luck"]).toBe(1);

    const encore = await rollAbilityCheck(client(joueuse), { entityId: ids.vic, campaignId, callerId: joueuse.id, advantage: "normal", dc: 20, hidden: false, locale: "fr", ability: "str" });
    if (!encore.ok) throw new Error(encore.reason);
    expect(encore.roll.rollWindowId).toBeUndefined();
  });

  it("Chance (halfelin) : le trait devient une aptitude jouable ; sans fenêtre (relance d'office)", async () => {
    const ctx = await resolveCharacterActionContext(client(gm), ids.pip, campaignId, "fr");
    const chance = ctx!.sheet.features.find((f) => f.key === "luck");
    expect(chance?.activation?.activations[0]?.trigger).toMatchObject({ natural: 1, automatic: true });
    // Ses modificateurs éventuels restent sur l'espèce : aucune aptitude « luck » n'en porte.
    expect(chance?.modifiers).toEqual([]);
    // La relance d'office elle-même est prouvée par le noyau (rollWindow.test.ts) ; ici, un jet ne s'arrête pas sur une fenêtre.
    const r = await rollAbilityCheck(client(joueuse), { entityId: ids.pip, campaignId, callerId: joueuse.id, advantage: "normal", dc: null, hidden: false, locale: "fr", ability: "str" });
    if (!r.ok) throw new Error(r.reason);
    expect(r.roll.rollWindowId).toBeUndefined();
  });

  it("Mots cinglants : l'aptitude de sous-classe arrive sur la fiche d'un Barde du Savoir 3, avec ses deux activations", async () => {
    await personnage("lyra", "human", "bard", 3);
    await admin.from("blocks").update({ data: { __v: 1, species: { kind: "rule", key: "human" }, background: null, classes: [{ class: { kind: "rule", key: "bard" }, level: 3, subclass: { kind: "rule", key: "lore" } }], abilities: { method: "manual", base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 } }, choices: {}, hp_method: "fixed", portrait_asset_id: null } as unknown as Json }).eq("entity_id", ids.lyra).eq("block_type", "character");
    const ctx = await resolveCharacterActionContext(client(gm), ids.lyra, campaignId, "fr");
    const mots = ctx!.sheet.features.find((f) => f.key === "lore-cutting-words");
    expect(mots?.activation?.activations.map((a) => a.id)).toEqual(["cutting-words-damage", "cutting-words-attack"]);
    expect(mots?.source).toBe("class:bard");
  });
});
