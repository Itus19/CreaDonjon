import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";
import { rollBonus } from "../../core/rules/sheet";

vi.mock("server-only", () => ({}));
const { resolveCharacterActionContext } = await import("./characterActions");
const { activateFeature } = await import("./featureActivation");
const { getRuleEntryForWorld } = await import("./rules");

/**
 * V3.1-158 — les règles du SRD que les valeurs calculées (ADR 0074) rendent
 * jouables, contre la base réelle APRÈS réimport : Défense sans armure
 * (Barbare, Moine), Critique amélioré, Rage, Aura de protection. Monde sur
 * l'officiel, sans variante ; jetable, comptes réutilisés.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

type Classe = { key: string; level: number; subclass?: string };

describe.skipIf(!hasCreds)("valeurs calculées du SRD (V3.1-158, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  const ids: Record<string, string> = {};
  const client = () => gm.client as unknown as SupabaseClient<Database>;

  async function personnage(slug: string, classe: Classe, abilities: Record<string, number>) {
    const { data: e } = await admin.from("entities").insert({ world_id: worldId, slug, name: slug, entity_kind: "character", created_by: gm.id }).select("id").single();
    ids[slug] = e!.id;
    const { error } = await admin.from("blocks").insert({
      entity_id: e!.id,
      block_type: "character",
      display: { label: "Personnage", layout: "character" },
      created_by: gm.id,
      data: {
        __v: 1,
        species: { kind: "rule", key: "human" },
        background: null,
        classes: [{ class: { kind: "rule", key: classe.key }, level: classe.level, subclass: classe.subclass ? { kind: "rule", key: classe.subclass } : null }],
        abilities: { method: "manual", base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...abilities } },
        choices: {},
        hp_method: "fixed",
        portrait_asset_id: null,
      } as unknown as Json,
    });
    if (error) throw new Error(error.message);
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: e!.id, user_id: gm.id, is_pc: true });
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    gm = await getReusableTestAccount(admin, "gm");
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test valeurs calculées", slug: `integration-test-valeurs-calculees-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert({ campaign_id: campaignId, user_id: gm.id, role: "gm" });
    await personnage("grom", { key: "barbarian", level: 9 }, { str: 16, dex: 14, con: 16 });
    await personnage("lin", { key: "monk", level: 5 }, { dex: 16, wis: 14 });
    await personnage("aela", { key: "fighter", level: 3, subclass: "champion" }, { str: 16 });
    await personnage("aldric", { key: "paladin", level: 6 }, { cha: 16 });
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  const fiche = async (slug: string) => (await resolveCharacterActionContext(client(), ids[slug], campaignId, "fr"))!.sheet;

  it("Défense sans armure : Barbare 10 + DEX + CON = 15 ; Moine 10 + DEX + SAG = 15", async () => {
    expect((await fiche("grom")).ac.value).toBe(15);
    expect((await fiche("lin")).ac.value).toBe(15);
  });

  it("Critique amélioré : 19 à l'arme pour le Champion", async () => {
    expect(rollBonus(await fiche("aela"), { roll: "attack", kind: "weapon" }).critRange).toBe(19);
  });

  it("Aura de protection : + 3 aux six sauvegardes du Paladin CHA 16", async () => {
    const s = await fiche("aldric");
    expect(s.savingThrows.str.mod).toBe(3);
    expect(s.savingThrows.dex.mod).toBe(3);
  });

  it("Rage : 1 usage, puis + 3 aux dégâts de Force (table du niveau 9) et l'avantage aux sauvegardes de Force", async () => {
    const avant = await fiche("grom");
    expect(avant.resources.find((r) => r.key === "rage")?.max).toBe(4);
    const r = await activateFeature(client(), {
      entityId: ids.grom, campaignId, ruleKey: "barbarian-rage", activationId: "rage", variantId: null,
      targetParticipantIds: [], callerId: gm.id, callerIsGm: true, locale: "fr",
    });
    if (!r.ok) throw new Error(r.reason);
    expect(r.used).toEqual({ rage: 1 });
    const apres = await fiche("grom");
    expect(rollBonus(apres, { roll: "damage", kind: "weapon", ability: "str" }).value).toBe(3);
    expect(rollBonus(apres, { roll: "damage", kind: "weapon", ability: "dex" }).value).toBe(0);
    expect(apres.savingThrows.str.rollState).toBe("advantage");
  });

  it("la couverture se lit sur les fiches officielles", async () => {
    const etat = async (k: string) => (await getRuleEntryForWorld(client(), worldId, k, "fr"))?.coverage?.state;
    expect(await etat("barbarian-unarmored-defense")).toBe("playable");
    expect(await etat("monk-unarmored-defense")).toBe("playable");
    expect(await etat("champion-improved-critical")).toBe("playable");
    expect(await etat("barbarian-rage")).toBe("partial");
    expect(await etat("paladin-aura-of-protection")).toBe("partial");
    expect(await etat("draconic-sorcery-elemental-affinity")).toBe("partial");
  });
});
