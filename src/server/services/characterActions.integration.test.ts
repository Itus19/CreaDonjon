import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  castSpell,
  changeHp,
  getOrInitializeRuntimeState,
  resolveCharacterActionContext,
  rollWeaponAttack,
  rollWeaponDamage,
  takeLongRest,
} from "./characterActions";

/**
 * V1-B5 : verifie contre la base reelle que l'orchestration cablee dans
 * characterActions.ts (assemblage de fiche, arme resolue depuis le SRD,
 * jets serveur, ecriture dice_rolls/entity_runtime_state) fonctionne bout
 * en bout — pas seulement que chaque brique testee isolement (action.ts,
 * srdMapping.ts) est correcte. Reprend le nain guerrier de
 * resolvedRuleset.integration.test.ts (V1-B4), avec un cimeterre equipe
 * (finesse, comme le shortsword du fixture srdMapping.test.ts).
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("characterActions (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let ownerId: string;
  let worldId: string;
  let rulesetId: string;
  let entityId: string;
  let campaignId: string;
  let weaponItemId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const { data: user, error: userError } = await admin.auth.admin.createUser({
      email: `integration-test-actions-${Date.now()}@creadonjon.local`,
      password: `integration-test-${Date.now()}`,
      email_confirm: true,
    });
    if (userError || !user.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    ownerId = user.user.id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test actions", slug: `integration-test-actions-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("base_system", "dnd_srd_51")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset SRD 5.1 officiel en base");
    rulesetId = official.id;

    await admin.from("worlds").update({ default_ruleset_id: rulesetId }).eq("id", worldId);

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: rulesetId, mode: "solo" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "brunhild", name: "Brunhild", entity_kind: "character", created_by: ownerId })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    entityId = entity.id;

    // Meme build que le cas dore de resolvedRuleset.integration.test.ts (V1-B4).
    const { error: characterError } = await admin.from("blocks").insert({
      entity_id: entityId,
      block_type: "character",
      display: { label: "Personnage", layout: "character" },
      data: {
        __v: 1,
        species: { kind: "rule", key: "dwarf" },
        background: null,
        classes: [{ class: { kind: "rule", key: "fighter" }, level: 1, subclass: null }],
        abilities: { method: "manual", base: { str: 16, dex: 10, con: 12, int: 8, wis: 13, cha: 10 } },
        choices: {},
        hp_method: "fixed",
        portrait_asset_id: null,
      },
      visibility_level: "players",
      created_by: ownerId,
    });
    if (characterError) throw new Error(characterError.message);

    weaponItemId = "i1";
    const { error: inventoryError } = await admin.from("blocks").insert({
      entity_id: entityId,
      block_type: "inventory",
      display: { label: "Inventaire", layout: "inventory" },
      data: {
        __v: 1,
        items: [{ id: weaponItemId, ref: { kind: "rule", key: "shortsword" }, qty: 1, equipped: true }],
        containers: [],
        currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      },
      visibility_level: "players",
      created_by: ownerId,
    });
    if (inventoryError) throw new Error(inventoryError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
  });

  it("assemble une fiche derivee reelle et resout le cimeterre depuis le SRD", async () => {
    const ctx = await resolveCharacterActionContext(admin, entityId, null, "fr");
    expect(ctx).not.toBeNull();
    expect(ctx!.sheet.hitPoints.max).toBe(12); // meme cas dore que V1-B4
    expect(ctx!.sheet.abilities.str.mod).toBe(3);
    expect(ctx!.weaponByKey.shortsword).toMatchObject({ damageDice: "1d6", properties: expect.arrayContaining(["finesse"]) });
    expect(ctx!.hitDiceTotals).toEqual({ d10: 1 });
  });

  it("jet d'attaque hors campagne : non enregistre dans dice_rolls", async () => {
    const result = await rollWeaponAttack(admin, {
      entityId,
      campaignId: null,
      itemId: weaponItemId,
      advantage: "normal",
      locale: "fr",
    });
    if ("error" in result) throw new Error(`echec inattendu : ${result.error}`);
    expect(result.recorded).toBe(false);
    // FOR +3 (finesse : max(3,0)) + maitrise +2 = modificateur +5, total entre 6 et 25.
    expect(result.attack!.total).toBeGreaterThanOrEqual(6);
    expect(result.attack!.total).toBeLessThanOrEqual(25);
  });

  it("jet de degats hors campagne : formule de l'arme reelle, modificateur de Force", async () => {
    const result = await rollWeaponDamage(admin, {
      entityId,
      campaignId: null,
      itemId: weaponItemId,
      critical: false,
      versatile: false,
      locale: "fr",
    });
    if ("error" in result) throw new Error(`echec inattendu : ${result.error}`);
    // 1d6 + 3 (Force) : entre 4 et 9.
    expect(result.damage!.total).toBeGreaterThanOrEqual(4);
    expect(result.damage!.total).toBeLessThanOrEqual(9);
  });

  it("jet d'attaque EN campagne : enregistre reellement dans dice_rolls, avec une session ouverte a la volee", async () => {
    const result = await rollWeaponAttack(admin, {
      entityId,
      campaignId,
      itemId: weaponItemId,
      advantage: "advantage",
      locale: "fr",
    });
    if ("error" in result) throw new Error(`echec inattendu : ${result.error}`);
    expect(result.recorded).toBe(true);

    const { data: rolls, error } = await admin.from("dice_rolls").select("*").eq("campaign_id", campaignId);
    if (error) throw new Error(error.message);
    expect(rolls).toHaveLength(1);
    expect(rolls![0].rolled_by).toBe("player");
    expect(rolls![0].session_id).not.toBeNull();
    expect(rolls![0].result).toBe(result.attack!.total);

    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("id, ended_at")
      .eq("campaign_id", campaignId)
      .single();
    if (sessionError) throw new Error(sessionError.message);
    expect(session.ended_at).toBeNull();
  });

  it("initialise l'etat de jeu au premier acces (PV au maximum), puis reste stable", async () => {
    const ctx = await resolveCharacterActionContext(admin, entityId, campaignId, "fr");
    const first = await getOrInitializeRuntimeState(admin, ctx!);
    expect(first.state.hp.current).toBe(12);
    expect(first.state.hit_dice).toEqual({ d10: 1 });

    const second = await getOrInitializeRuntimeState(admin, ctx!);
    expect(second.state).toEqual(first.state); // pas de reinitialisation au second appel
  });

  it("repos long : restaure les PV au maximum et les emplacements de sort", async () => {
    await changeHp(admin, { entityId, campaignId, delta: -8, actorUserId: ownerId });
    const result = await takeLongRest(admin, { entityId, campaignId, actorUserId: ownerId, locale: "fr" });
    expect(result).toEqual({ ok: true });

    const ctx = await resolveCharacterActionContext(admin, entityId, campaignId, "fr");
    const state = await getOrInitializeRuntimeState(admin, ctx!);
    expect(state.state.hp.current).toBe(12);
    expect(state.state.spell_slots_used).toEqual({});
  });

  it("lancer un sort sur un personnage qui ne le connait pas est rejete", async () => {
    const result = await castSpell(admin, {
      entityId,
      campaignId,
      spellKey: "fireball",
      slotLevel: 3,
      critical: false,
      actorUserId: ownerId,
      locale: "fr",
    });
    expect(result).toEqual({ error: "item_not_found" });
  });
});
