import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { rollWeaponAttack, rollWeaponDamage } = await import("./characterActions");
const { rollSavingThrow } = await import("./checkRolls");
const { insertFeatureEffect } = await import("../repos/activeEffects");
const { effectToRow, instantiateDurableEffect } = await import("../../core/rules/durableEffects");

/**
 * V3.1-156 (ADR 0074) — les jets lancent les dés de bonus de la fiche, contre
 * la base réelle : un Guerrier béni (effet qui dure : + 1d4 aux attaques et
 * aux sauvegardes) et une Rage (+ 2 aux dégâts d'une attaque de Force).
 * Monde jetable, comptes réutilisés.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

const D4 = { op: "dice", count: 1, faces: 4 };

describe.skipIf(!hasCreds)("dés de bonus et bonus de dégâts (V3.1-156, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let joueuse: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let entityId: string;
  const client = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;

  // Le vrai chemin d'un effet qui dure (instancié, puis rangé en ligne), comme le pose une activation.
  async function effet(label: string, modifiers: unknown[]) {
    const def = { id: label, label: { fr: label }, conditions: [], modifiers, duration: { unit: "minute", amount: 1 }, concentration: false, ends_on: [], token: null };
    const e = instantiateDurableEffect(def as never, { bearer: entityId, source: entityId, activationId: "test", round: null, currentTurn: null });
    const ligne = effectToRow(e, "test-v3.1-156");
    await insertFeatureEffect(client(gm), {
      campaignId,
      bearer: { entityId },
      label: ligne.label,
      sourceKey: ligne.source_key,
      modifiers: ligne.modifiers as unknown as Json,
      duration: ligne.duration as unknown as Json,
      payload: ligne.payload as unknown as Json,
    });
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test dés de bonus", slug: `integration-test-des-bonus-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id })
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
    entityId = pj!.id;
    const bloc = (block_type: string, data: unknown) => ({ entity_id: entityId, block_type, display: { label: block_type, layout: block_type }, data: data as Json, created_by: gm.id });
    const { error: e1 } = await admin.from("blocks").insert([
      bloc("character", {
        __v: 1,
        species: { kind: "rule", key: "human" },
        background: null,
        classes: [{ class: { kind: "rule", key: "fighter" }, level: 3, subclass: null }],
        abilities: { method: "manual", base: { str: 16, dex: 14, con: 14, int: 8, wis: 10, cha: 10 } },
        choices: {},
        hp_method: "fixed",
        portrait_asset_id: null,
      }),
      bloc("inventory", {
        __v: 1,
        items: [
          { id: "epee", ref: { kind: "rule", key: "longsword" }, qty: 1, equipped: true },
          { id: "arc", ref: { kind: "rule", key: "longbow" }, qty: 1, equipped: true },
        ],
        containers: [],
        currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      }),
    ]);
    if (e1) throw new Error(e1.message);
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: entityId, user_id: joueuse.id, is_pc: true });
    await effet("Bénédiction", [
      { target: "attack", op: "add", value: D4 },
      { target: "save", op: "add", value: D4 },
    ]);
    await effet("Rage", [{ target: "damage.weapon.str", op: "add", value: 2 }]);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("attaque bénie : 1d20 + bonus + 1d4, le d4 au détail", async () => {
    const r = await rollWeaponAttack(client(joueuse), { entityId, campaignId, itemId: "epee", advantage: "normal", locale: "fr" });
    if ("error" in r) throw new Error(r.error);
    expect(r.attack?.expression).toMatch(/1d20 \+ \{mod\} \+ 1d4/);
    expect(r.attack?.trace.some((t) => t.text.startsWith("1d4"))).toBe(true);
  });

  it("sauvegarde bénie : le d4 au jet enregistré", async () => {
    const r = await rollSavingThrow(client(joueuse), { entityId, campaignId, ability: "wis", advantage: "normal", dc: null, hidden: false, callerId: joueuse.id, locale: "fr" });
    if (!r.ok) throw new Error(r.reason);
    const { data } = await admin.from("dice_rolls").select("expression").eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(1).single();
    expect(data?.expression).toMatch(/1d4/);
  });

  it("Rage : + 2 aux dégâts de l'épée (Force), rien à l'arc (Dextérité)", async () => {
    const epee = await rollWeaponDamage(client(joueuse), { entityId, campaignId, itemId: "epee", critical: false, versatile: false, locale: "fr" });
    const arc = await rollWeaponDamage(client(joueuse), { entityId, campaignId, itemId: "arc", critical: false, versatile: false, locale: "fr" });
    if ("error" in epee || "error" in arc) throw new Error("jet refusé");
    const { data } = await admin.from("dice_rolls").select("context, detail").eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(2);
    const ctx = (data ?? []).map((d) => (d.context as { mod?: number }).mod);
    // Le plus récent est l'arc : DEX +2 seul ; l'épée : FOR +3 et Rage +2.
    expect(ctx).toEqual([2, 5]);
  });
});
