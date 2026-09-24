import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { proposeIntentRequest, resolveIntentRequest } from "./turnIntent";
import { getEntityRuntimeState } from "./runtimeState";
import { getOrOpenSessionForCampaign } from "./sessions";
import { insertCombat, insertCombatParticipant, updateCombat } from "../repos/combats";
import { listSessionEvents } from "../repos/sessions";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3-B5 Phase 1 — verifie contre la base reelle le mecanisme « poser, puis
 * encaisser » : `proposeIntentRequest` fige une demande dans
 * `entity_runtime_state.pending_request` sans rien lancer, et
 * `resolveIntentRequest` recoit un nombre NU pour produire le meme
 * `ResolvedTurnRecord` qu'un tour immediat (V3-B1/B2), avec les memes
 * ecritures (`dice_rolls`, `session_events`).
 *
 * Meme fixture (nain guerrier, cimeterre — pardon, cimeterre en finesse) que
 * `characterActions.integration.test.ts` (V1-B5) : reprendre un cas dore
 * deja verifie coute moins cher que d'en inventer un nouveau.
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("V3-B5 — proposer puis encaisser (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let ownerId: string;
  let worldId: string;
  let worldSlug: string;
  let rulesetId: string;
  let entityId: string;
  let campaignId: string;
  let weaponItemId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    ownerId = (await getReusableTestAccount(admin, "owner")).id;

    worldSlug = `integration-test-pending-${Date.now()}`;
    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test demandes", slug: worldSlug, owner_id: ownerId })
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
      .insert({ world_id: worldId, slug: "brunhild-b5", name: "Brunhild", entity_kind: "character", created_by: ownerId })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    entityId = entity.id;

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
  });

  const common = () => ({
    entityId,
    campaignId,
    callerId: ownerId,
    world: { id: worldId, slug: worldSlug },
    locale: "fr" as const,
  });

  it("pose une demande de test de competence — rien de lance, seule la demande est ecrite", async () => {
    const outcome = await proposeIntentRequest(admin, {
      ...common(),
      text: "j'escalade le mur",
      corrected: false,
      choice: { kind: "skill_check", actionId: "athletics", targetId: null, advantage: "normal", dc: 12 },
    });
    if ("error" in outcome) throw new Error(`echec inattendu : ${outcome.error}`);
    expect(outcome.request.kind).toBe("skill_check");
    expect(outcome.request.die_max).toBe(20); // un test se lit sur un d20, jamais sur le de de l'arme
    expect(outcome.request.dc).toBe(12);

    const state = await getEntityRuntimeState(admin, entityId, campaignId);
    expect(state.pending_request).toEqual(outcome.request);
  });

  it("encaisse : total = naturel + modificateur FIGE a la pose, jet ecrit, demande effacee", async () => {
    const before = await getEntityRuntimeState(admin, entityId, campaignId);
    const pending = before.pending_request;
    if (!pending) throw new Error("aucune demande en attente — le test precedent aurait du en poser une");

    const outcome = await resolveIntentRequest(admin, { ...common(), natural: 14, origin: "a_la_main" });
    if ("error" in outcome) throw new Error(`echec inattendu : ${outcome.error}`);
    expect(outcome.chained).toBeNull();
    const check = outcome.record.detail.check as { total: number; dc: number | null; verdict: string | null };
    expect(check.total).toBe(14 + pending.modifier);
    expect(check.verdict).toBe(14 + pending.modifier >= 12 ? "success" : "fail");

    const after = await getEntityRuntimeState(admin, entityId, campaignId);
    expect(after.pending_request).toBeNull();

    const { data: rolls, error } = await admin.from("dice_rolls").select("*").eq("campaign_id", campaignId);
    if (error) throw new Error(error.message);
    expect(rolls).toHaveLength(1);
    expect(rolls![0].result).toBe(14 + pending.modifier);
    expect(rolls![0].rolled_by).toBe("player");
  });

  it("sans demande en attente, encaisser est refuse — jamais un jet invente", async () => {
    const outcome = await resolveIntentRequest(admin, { ...common(), natural: 10, origin: "a_la_main" });
    expect(outcome).toEqual({ error: "no_pending_request" });
  });

  it("un nombre hors bornes est refuse — 0 avant meme de lire la demande, 21 contre le plafond de la demande posee", async () => {
    // 0 est structurel (jamais un naturel valide) : refuse meme sans demande
    // en attente, ce que le test precedent vient justement de verifier.
    expect(await resolveIntentRequest(admin, { ...common(), natural: 0, origin: "a_la_main" })).toEqual({ error: "out_of_range" });

    const pose = await proposeIntentRequest(admin, {
      ...common(),
      text: "je tente un jet",
      corrected: false,
      choice: { kind: "ability_check", actionId: "dex", targetId: null, advantage: "normal", dc: null },
    });
    if ("error" in pose) throw new Error(`echec inattendu : ${pose.error}`);
    expect(pose.request.die_max).toBe(20);

    // 21 depasse le plafond de LA demande posee (un d20) — refuse contre
    // cette borne-la, jamais ramene a 20 en silence.
    expect(await resolveIntentRequest(admin, { ...common(), natural: 21, origin: "a_la_main" })).toEqual({ error: "out_of_range" });

    // La demande reste posee : un refus n'a rien consomme.
    const state = await getEntityRuntimeState(admin, entityId, campaignId);
    expect(state.pending_request?.action_id).toBe("dex");
  });

  it("une nouvelle demande remplace la precedente — et l'abandon est JOURNALISE, jamais silencieux", async () => {
    const first = await proposeIntentRequest(admin, {
      ...common(),
      text: "je tente ma chance",
      corrected: false,
      choice: { kind: "ability_check", actionId: "str", targetId: null, advantage: "normal", dc: 10 },
    });
    if ("error" in first) throw new Error(`echec inattendu : ${first.error}`);

    const second = await proposeIntentRequest(admin, {
      ...common(),
      text: "en fait, j'écoute plutôt",
      corrected: true,
      choice: { kind: "skill_check", actionId: "perception", targetId: null, advantage: "normal", dc: null },
    });
    if ("error" in second) throw new Error(`echec inattendu : ${second.error}`);

    const sessionId = await getOrOpenSessionForCampaign(admin, campaignId);
    const events = await listSessionEvents(admin, sessionId);
    const abandon = events
      .filter((e) => e.kind === "world_update")
      .find((e) => typeof (e.payload as { note?: string })?.note === "string" && (e.payload as { note: string }).note.includes("abandonnée"));
    expect(abandon, "aucun evenement ne consigne l'abandon de la premiere demande").toBeDefined();
    expect((abandon!.payload as { note: string }).note).toContain(first.request.what);

    // Nettoie pour les tests suivants : la demande de Perception reste posee.
    const state = await getEntityRuntimeState(admin, entityId, campaignId);
    expect(state.pending_request?.action_id).toBe("perception");
  });

  it("une attaque qui touche CHAINE une demande de degats, bornee au de de l'arme — pas a un d20", async () => {
    // La demande de Perception laissee par le test precedent n'a rien a
    // etre nettoyee explicitement : poser un nouveau choix la remplace,
    // c'est justement ce que le test precedent vient de verifier.
    const combat = await insertCombat(admin, { campaignId, sessionId: null, name: "Combat de test" });
    await updateCombat(admin, combat.id, { status: "running" });
    // CA 1 : le naturel encaisse touche TOUJOURS (1 a 20 + modificateur >= 1),
    // sans dependre d'un jet aleatoire — le naturel est fourni a la main ici.
    const participant = await insertCombatParticipant(admin, {
      combatId: combat.id,
      sourceKind: "custom",
      entityId: null,
      ruleKey: null,
      label: "Mannequin d'entrainement",
      ac: 1,
      hpMax: 10,
      hpCurrent: 10,
      isAlly: false,
      displayOrder: 0,
    });

    const attackPose = await proposeIntentRequest(admin, {
      ...common(),
      text: "j'attaque le mannequin",
      corrected: false,
      choice: { kind: "weapon_attack", actionId: weaponItemId, targetId: `participant:${participant.id}`, advantage: "normal" },
    });
    if ("error" in attackPose) throw new Error(`echec inattendu : ${attackPose.error}`);
    expect(attackPose.request.dc).toBe(1);
    expect(attackPose.request.die_max).toBe(20);

    // Coup normal (naturel 10, pas 20) : touche, chaine des degats bornes au
    // 1d6 du cimeterre — jamais 1-20.
    const attackResolved = await resolveIntentRequest(admin, { ...common(), natural: 10, origin: "a_la_main" });
    if ("error" in attackResolved) throw new Error(`echec inattendu : ${attackResolved.error}`);
    const attackDetail = attackResolved.record.detail as { verdict: string | null };
    expect(attackDetail.verdict).toBe("hit");
    expect(attackResolved.chained).not.toBeNull();
    expect(attackResolved.chained!.kind).toBe("weapon_damage");
    expect(attackResolved.chained!.die_max).toBe(6); // cimeterre : 1d6, pas critique

    const afterAttack = await getEntityRuntimeState(admin, entityId, campaignId);
    expect(afterAttack.pending_request).toEqual(attackResolved.chained);

    // Un naturel de 7 (au-dela du 1d6) est refuse : le plafond suit
    // vraiment le de de l'arme, pas un reste de 1-20.
    expect(await resolveIntentRequest(admin, { ...common(), natural: 7, origin: "a_la_main" })).toEqual({ error: "out_of_range" });

    const damageResolved = await resolveIntentRequest(admin, { ...common(), natural: 4, origin: "a_la_main" });
    if ("error" in damageResolved) throw new Error(`echec inattendu : ${damageResolved.error}`);
    expect(damageResolved.chained).toBeNull();
    const damageDetail = damageResolved.record.detail as { damage: { total: number } | null };
    expect(damageDetail.damage?.total).toBe(4 + attackResolved.chained!.modifier);

    const finalState = await getEntityRuntimeState(admin, entityId, campaignId);
    expect(finalState.pending_request).toBeNull();
  });

  it("un coup CRITIQUE double le plafond des degats chaines — jamais le modificateur", async () => {
    const combat = await insertCombat(admin, { campaignId, sessionId: null, name: "Combat de test (critique)" });
    await updateCombat(admin, combat.id, { status: "running" });
    const participant = await insertCombatParticipant(admin, {
      combatId: combat.id,
      sourceKind: "custom",
      entityId: null,
      ruleKey: null,
      label: "Second mannequin",
      ac: 1,
      hpMax: 10,
      hpCurrent: 10,
      isAlly: false,
      displayOrder: 0,
    });

    const pose = await proposeIntentRequest(admin, {
      ...common(),
      text: "j'attaque encore",
      corrected: false,
      choice: { kind: "weapon_attack", actionId: weaponItemId, targetId: `participant:${participant.id}`, advantage: "normal" },
    });
    if ("error" in pose) throw new Error(`echec inattendu : ${pose.error}`);

    const resolved = await resolveIntentRequest(admin, { ...common(), natural: 20, origin: "a_la_main" });
    if ("error" in resolved) throw new Error(`echec inattendu : ${resolved.error}`);
    expect(resolved.chained!.die_max).toBe(12); // 1d6 double, jamais le modificateur
    expect(resolved.chained!.modifier).toBe(3); // FOR +3 (finesse : max(3, 0)), inchange par le critique
    expect(resolved.chained!.critical).toBe(true);
  });
});
