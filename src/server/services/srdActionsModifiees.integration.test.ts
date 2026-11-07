import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { resolveCharacterActionContext } = await import("./characterActions");
const { loadSpellActivations } = await import("./spellActivations");
const { getRuleEntryForWorld } = await import("./rules");

/**
 * V3.1-167 — les actions modifiées du SRD, sur l'officiel APRÈS réimport :
 * ce que portent les fiches (attaques par action, actions en action bonus,
 * un sort de réaction jouable, Arme sacrée) et ce que dit la couverture.
 * Lecture seule des fiches : aucun combat, monde jetable.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("les actions modifiées du SRD (V3.1-167, integration, base reelle)", () => {
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
    const { data: world, error } = await admin.from("worlds").insert({ name: "Monde de test actions SRD", slug: `integration-test-actions-srd-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id }).select("id").single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await personnage("brom", "fighter", 11);
    await personnage("ombre", "rogue", 2);
    await personnage("mage", "wizard", 1, { known: ["shield-spell"] });
    await personnage("aldric", "paladin", 5, { subclass: "devotion" });
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("Guerrier 11 : trois attaques par action ; Paladin 5 : deux", async () => {
    expect((await fiche("brom")).sheet.attacksPerAction).toBe(3);
    expect((await fiche("aldric")).sheet.attacksPerAction).toBe(2);
  });

  it("Roublard 2 : Foncer, Se désengager, Se cacher en action bonus", async () => {
    expect((await fiche("ombre")).sheet.bonusActionOptions).toEqual(["dash", "disengage", "hide"]);
  });

  it("Magicien 1 : Bouclier est un sort jouable en réaction (emplacement de niveau 1, +5 CA contre le jet)", async () => {
    const blocs = await loadSpellActivations(client(), await fiche("mage"));
    const a = blocs["shield-spell"]?.activations[0];
    expect(a).toMatchObject({ cost: { action: "reaction", slot: { level: 1 } }, trigger: { roll: "attack", subject: "attack_against_self", when: "hit" } });
  });

  it("Paladin de la Dévotion 5 : Arme sacrée est une aptitude jouable (Conduit divin)", async () => {
    const arme = (await fiche("aldric")).sheet.features.find((f) => f.key === "devotion-sacred-weapon");
    expect(arme?.activation?.activations[0]?.cost.resources[0]?.key).toBe("channel-divinity");
  });

  it("la couverture se lit : l'armure « Bouclier » n'a reçu aucune brique, le sort est « Partielle »", async () => {
    const etat = async (k: string) => (await getRuleEntryForWorld(client(), worldId, k, "fr"))?.coverage?.state;
    expect(await etat("shield-spell")).toBe("partial");
    expect(await etat("shield")).not.toBe("partial");
    expect(await etat("devotion-sacred-weapon")).toBe("partial");
    expect(await etat("sorcerer-metamagic")).toBe("partial");
  });
});
