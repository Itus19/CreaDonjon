import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { resolveCharacterActionContext } = await import("./characterActions");
const { activateFeature } = await import("./featureActivation");

/**
 * V3.1-185 (ADR 0078) — les données du modèle du monde, sur l'officiel APRÈS
 * réimport : Forme sauvage, Compagnon sauvage, Imposition des mains (quantité
 * choisie), Rage persistante (regain), lumière de l'Arme sacrée. Hors combat,
 * écritures directes du MJ sur des fiches d'un monde jetable.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("les données du modèle du monde (V3.1-185, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  const ids: Record<string, string> = {};
  const client = () => gm.client as unknown as SupabaseClient<Database>;

  async function personnage(slug: string, classe: string, niveau: number, extra: { subclass?: string; known?: string[] } = {}) {
    const { data: e } = await admin.from("entities").insert({ world_id: worldId, slug, name: slug, entity_kind: "character", created_by: gm.id }).select("id").single();
    const blocs: Database["public"]["Tables"]["blocks"]["Insert"][] = [{
      entity_id: e!.id, block_type: "character", display: { label: "Personnage", layout: "character" }, created_by: gm.id, visibility_level: "players",
      data: { __v: 1, species: { kind: "rule", key: "human" }, background: null, classes: [{ class: { kind: "rule", key: classe }, level: niveau, subclass: extra.subclass ? { kind: "rule", key: extra.subclass } : null }], abilities: { method: "manual", base: { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 16 } }, choices: {}, hp_method: "fixed", portrait_asset_id: null } as unknown as Json,
    }];
    if (extra.known) {
      blocs.push({
        entity_id: e!.id, block_type: "spellcasting", display: { label: "Incantation", layout: "spellcasting" }, created_by: gm.id, visibility_level: "players",
        data: { __v: 1, sources: [{ class: classe, ability: "int" }], known: extra.known.map((k) => ({ ref: { kind: "rule", key: k }, origin: "granted" })), prepared: [], slot_override: null } as unknown as Json,
      });
    }
    const { error } = await admin.from("blocks").insert(blocs);
    if (error) throw new Error(error.message);
    ids[slug] = e!.id;
  }
  const fiche = async (slug: string) => (await resolveCharacterActionContext(client(), ids[slug], campaignId, "fr"))!;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    gm = await getReusableTestAccount(admin, "gm");
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const { data: world, error } = await admin.from("worlds").insert({ name: "Monde de test modèle du monde", slug: `integration-test-monde-185-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id }).select("id").single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await personnage("sylve", "druid", 2);
    await personnage("aldric", "paladin", 5, { subclass: "oath-of-devotion" });
    await personnage("grom", "barbarian", 15);
  }, 120000);

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  const activer = (slug: string, ruleKey: string, activationId: string, extra: { variantId?: string; amount?: number } = {}) =>
    activateFeature(client(), { entityId: ids[slug], campaignId, ruleKey, activationId, variantId: extra.variantId ?? null, targetParticipantIds: [], callerId: gm.id, callerIsGm: true, locale: "fr", ...(extra.amount !== undefined ? { amount: extra.amount } : {}) });

  it("Forme sauvage : deux utilisations au niveau 2, quatre formes proposées ; hors combat, l'utilisation se dépense", async () => {
    const f = (await fiche("sylve")).sheet.features.find((x) => x.key === "druid-wild-shape");
    expect(f?.resources?.[0]).toMatchObject({ key: "wild-shape" });
    expect(f?.activation?.activations[0]?.variants?.map((v) => v.id)).toEqual(["wild-shape-spider", "wild-shape-riding-horse", "wild-shape-wolf", "wild-shape-rat"]);
    const r = await activer("sylve", "druid-wild-shape", "wild-shape", { variantId: "wild-shape-wolf" });
    if (!r.ok) throw new Error(r.reason);
    expect(r.used).toMatchObject({ "wild-shape": 1 });
    // Compagnon sauvage dépense la même ressource.
    const c = await activer("sylve", "druid-wild-companion", "wild-companion", { variantId: "wild-companion-wild-shape" });
    if (!c.ok) throw new Error(c.reason);
    expect(c.used).toMatchObject({ "wild-shape": 2 });
  }, 120000);

  it("Imposition des mains : la quantité choisie se dépense de la réserve (5 × niveau), bornée", async () => {
    const r = await activer("aldric", "paladin-lay-on-hands", "lay-on-hands", { amount: 7 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.used).toMatchObject({ "lay-on-hands": 7 });
    expect(r.changes.join(" ")).toMatch(/PV/);
    expect(await activer("aldric", "paladin-lay-on-hands", "lay-on-hands", { amount: 26 })).toMatchObject({ ok: false });
  }, 120000);

  it("Arme sacrée : l'effet qui dure fait de son porteur une source de lumière (6 m vive, 6 m faible)", async () => {
    expect((await fiche("aldric")).sheet.light).toBeNull();
    const r = await activer("aldric", "devotion-sacred-weapon", "sacred-weapon");
    if (!r.ok) throw new Error(r.reason);
    expect((await fiche("aldric")).sheet.light).toEqual({ bright: 6, dim: 6 });
  }, 120000);

  it("Rage persistante : regagne toutes les utilisations de Rage, une fois par repos long", async () => {
    const rage = await activer("grom", "barbarian-rage", "rage");
    if (!rage.ok) throw new Error(rage.reason);
    expect(rage.used).toMatchObject({ rage: 1 });
    const p = await activer("grom", "barbarian-persistent-rage", "persistent-rage");
    if (!p.ok) throw new Error(p.reason);
    expect(p.used).toMatchObject({ rage: 0, "persistent-rage": 1 });
    expect(await activer("grom", "barbarian-persistent-rage", "persistent-rage")).toMatchObject({ ok: false });
  }, 120000);
});
