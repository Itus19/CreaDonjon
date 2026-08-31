import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { rollAbilityCheck, rollFreeformCheck, rollInitiativeCheck, rollSavingThrow, rollSkillCheck } from "./checkRolls";

/**
 * V2-M11 (Lot M, volet de lancer de des) : verifie contre la base reelle que
 * les 4 jets de fiche (test/competence/sauvegarde/initiative) et le jet libre
 * s'enchainent bout en bout — resolution de fiche reelle, modificateur
 * correct, verdict DD, clampage du jet cache par `isWorldAdmin`, et que la
 * RLS `dice_rolls_select` masque bien un jet cache a un simple joueur. Meme
 * motif que characterActions.integration.test.ts (fiche reelle, client admin
 * pour l'orchestration) et canEditEntityRls.integration.test.ts (clients
 * authentifies reels pour verifier la RLS elle-meme).
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est pas
 * configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("checkRolls (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let worldId: string;
  let rulesetId: string;
  let campaignId: string;
  let ownCharacterEntityId: string;
  let npcEntityId: string;

  const userIds: Record<string, string> = {};
  const clients: Record<string, SupabaseClient> = {};

  async function createProfile(key: string): Promise<{ id: string; client: SupabaseClient }> {
    const email = `integration-test-rolls-${key}-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? `creation ${key} echouee`);
    const client = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(signInError.message);
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const [gm, ownCharacterPlayer, plainPlayer] = await Promise.all([
      createProfile("gm"),
      createProfile("own-character-player"),
      createProfile("plain-player"),
    ]);
    userIds.gm = gm.id;
    clients.gm = gm.client;
    userIds.ownCharacterPlayer = ownCharacterPlayer.id;
    clients.ownCharacterPlayer = ownCharacterPlayer.client;
    userIds.plainPlayer = plainPlayer.id;
    clients.plainPlayer = plainPlayer.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test jets", slug: `integration-test-rolls-${Date.now()}`, owner_id: userIds.gm })
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

    // resolveCharacterActionContext resout le ruleset via la campagne quand
    // campaignId est fourni, mais via `worlds.default_ruleset_id` quand il
    // est nul (fiche vue hors campagne) — les deux chemins sont exerces ici.
    await admin.from("worlds").update({ default_ruleset_id: rulesetId }).eq("id", worldId);

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test jets", ruleset_id: rulesetId, mode: "campaign" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;

    const { error: membersError } = await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: userIds.gm, role: "gm" },
      { campaign_id: campaignId, user_id: userIds.ownCharacterPlayer, role: "player" },
      { campaign_id: campaignId, user_id: userIds.plainPlayer, role: "player" },
    ]);
    if (membersError) throw new Error(membersError.message);

    // Meme build (naine guerriere) que resolvedRuleset.integration.test.ts (V1-B4) :
    // Sagesse 13 (mod +1), maitrise +2 (niveau 1) -> perception attendue = +3.
    async function createCharacter(slug: string, name: string, createdBy: string) {
      const { data: entity, error: entityError } = await admin
        .from("entities")
        .insert({ world_id: worldId, slug, name, entity_kind: "character", created_by: createdBy })
        .select("id")
        .single();
      if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
      const { error: characterError } = await admin.from("blocks").insert({
        entity_id: entity.id,
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
        created_by: createdBy,
      });
      if (characterError) throw new Error(characterError.message);
      return entity.id as string;
    }

    ownCharacterEntityId = await createCharacter("brunhild-jets", "Brunhild", userIds.gm);
    npcEntityId = await createCharacter("pnj-jets", "Un PNJ", userIds.gm);

    const { error: claimError } = await admin
      .from("campaign_characters")
      .insert({ campaign_id: campaignId, entity_id: ownCharacterEntityId, user_id: userIds.ownCharacterPlayer, is_pc: true });
    if (claimError) throw new Error(claimError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    for (const id of Object.values(userIds)) await admin.auth.admin.deleteUser(id);
  });

  it("test de caracteristique : modificateur reel de la fiche (Force +3), aucun DD -> pas de verdict", async () => {
    const result = await rollAbilityCheck(admin, {
      entityId: ownCharacterEntityId,
      campaignId,
      callerId: userIds.ownCharacterPlayer,
      ability: "str",
      advantage: "normal",
      dc: null,
      hidden: false,
      locale: "fr",
    });
    if (!result.ok) throw new Error(`echec inattendu : ${result.reason}`);
    expect(result.roll.chips).toEqual([{ label: "Force", value: 3 }]);
    expect(result.roll.dc).toBeNull();
    expect(result.roll.verdict).toBeNull();
    expect(result.roll.total).toBeGreaterThanOrEqual(4); // 1 + 3
    expect(result.roll.total).toBeLessThanOrEqual(23); // 20 + 3
    expect(result.roll.recorded).toBe(true);
  });

  it("test de competence : Perception gouvernee par Sagesse (+1), DD fourni -> verdict coherent avec le total", async () => {
    const result = await rollSkillCheck(admin, {
      entityId: ownCharacterEntityId,
      campaignId,
      callerId: userIds.ownCharacterPlayer,
      skill: "perception",
      advantage: "normal",
      dc: 10,
      hidden: false,
      locale: "fr",
    });
    if (!result.ok) throw new Error(`echec inattendu : ${result.reason}`);
    // Le premier chip est toujours la caracteristique gouvernante (sheet.ts) ; un
    // second chip de maitrise/expertise ne s'ajoute que si la fiche l'a choisie
    // (non fixe ici, pas de choix de competence dans le fixture) — pas suppose.
    expect(result.roll.chips[0]).toEqual({ label: "Sagesse", value: 1 });
    expect(result.roll.what).toContain("Perception");
    expect(result.roll.verdict).toBe(result.roll.total >= 10 ? "success" : "fail");
  });

  it("sauvegarde et initiative : memes chips que la fiche derivee (Dexterite pour l'initiative)", async () => {
    const save = await rollSavingThrow(admin, {
      entityId: ownCharacterEntityId,
      campaignId,
      callerId: userIds.ownCharacterPlayer,
      ability: "con",
      advantage: "normal",
      dc: null,
      hidden: false,
      locale: "fr",
    });
    if (!save.ok) throw new Error(`echec inattendu : ${save.reason}`);
    expect(save.roll.chips.some((c) => c.label === "Constitution")).toBe(true);

    const init = await rollInitiativeCheck(admin, {
      entityId: ownCharacterEntityId,
      campaignId,
      callerId: userIds.ownCharacterPlayer,
      advantage: "normal",
      dc: null,
      hidden: false,
      locale: "fr",
    });
    if (!init.ok) throw new Error(`echec inattendu : ${init.reason}`);
    expect(init.roll.chips).toEqual([{ label: "Dexterite", value: 0 }]);
  });

  it("hors campagne (campaignId null) : jet non enregistre dans dice_rolls", async () => {
    const result = await rollAbilityCheck(admin, {
      entityId: ownCharacterEntityId,
      campaignId: null,
      callerId: userIds.ownCharacterPlayer,
      ability: "dex",
      advantage: "normal",
      dc: null,
      hidden: false,
      locale: "fr",
    });
    if (!result.ok) throw new Error(`echec inattendu : ${result.reason}`);
    expect(result.roll.recorded).toBe(false);
  });

  it("un joueur sans revendication ni octroi ne peut pas rouler pour une autre fiche (PNJ du MJ)", async () => {
    const result = await rollAbilityCheck(admin, {
      entityId: npcEntityId,
      campaignId,
      callerId: userIds.plainPlayer,
      ability: "str",
      advantage: "normal",
      dc: null,
      hidden: false,
      locale: "fr",
    });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  it("le MJ peut rouler pour un PNJ, et 'hidden' n'est honore que pour lui (clampe pour un joueur)", async () => {
    const gmRoll = await rollAbilityCheck(admin, {
      entityId: npcEntityId,
      campaignId,
      callerId: userIds.gm,
      ability: "wis",
      advantage: "normal",
      dc: null,
      hidden: true,
      locale: "fr",
    });
    if (!gmRoll.ok) throw new Error(`echec inattendu : ${gmRoll.reason}`);
    expect(gmRoll.roll.hidden).toBe(true);

    const playerAttemptHidden = await rollAbilityCheck(admin, {
      entityId: ownCharacterEntityId,
      campaignId,
      callerId: userIds.ownCharacterPlayer,
      ability: "wis",
      advantage: "normal",
      dc: null,
      hidden: true,
      locale: "fr",
    });
    if (!playerAttemptHidden.ok) throw new Error(`echec inattendu : ${playerAttemptHidden.reason}`);
    expect(playerAttemptHidden.roll.hidden).toBe(false); // jamais fait confiance au client, cote serveur

    // RLS dice_rolls_select : le jet cache du MJ existe reellement en base...
    const { data: allRolls, error } = await admin.from("dice_rolls").select("id, visibility_level").eq("campaign_id", campaignId);
    if (error) throw new Error(error.message);
    expect(allRolls!.some((r) => r.visibility_level === "gm")).toBe(true);

    // ...mais un simple joueur, avec sa propre session authentifiee, ne le voit pas.
    const { data: playerVisibleRolls, error: playerError } = await clients.plainPlayer
      .from("dice_rolls")
      .select("id, visibility_level")
      .eq("campaign_id", campaignId);
    if (playerError) throw new Error(playerError.message);
    expect(playerVisibleRolls!.every((r) => r.visibility_level === "public")).toBe(true);

    // Le MJ, lui, voit son propre jet cache.
    const { data: gmVisibleRolls, error: gmError } = await clients.gm
      .from("dice_rolls")
      .select("id, visibility_level")
      .eq("campaign_id", campaignId);
    if (gmError) throw new Error(gmError.message);
    expect(gmVisibleRolls!.some((r) => r.visibility_level === "gm")).toBe(true);
  });

  it("jet libre : n'importe quel membre peut en faire un, un pool vide est rejete", async () => {
    const result = await rollFreeformCheck(admin, {
      campaignId,
      callerId: userIds.plainPlayer,
      pool: { d6: 2, d4: 1 },
      who: "Joueur",
      hidden: false,
    });
    if (!result.ok) throw new Error(`echec inattendu : ${result.reason}`);
    expect(result.roll.expression).toContain("2d6");
    expect(result.roll.expression).toContain("1d4");
    expect(result.roll.total).toBeGreaterThanOrEqual(3); // 2 + 1
    expect(result.roll.total).toBeLessThanOrEqual(16); // 12 + 4

    const empty = await rollFreeformCheck(admin, {
      campaignId,
      callerId: userIds.plainPlayer,
      pool: {},
      who: "Joueur",
      hidden: false,
    });
    expect(empty).toEqual({ ok: false, reason: "invalid_pool" });
  });
});
