import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createEntity } from "./entities";
import { getCreatureCombat } from "./creatureCombat";
import { advanceCombatTurn, patchCombatParticipant, rollParticipantRecharges, undoLastCombatAction } from "./combats";
import { getCombatParticipantById } from "../repos/combats";
import type { Rng } from "../../core/dice/rng";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-79 — la fiche de créature « en combat » : ses instances dans
 * l'initiative en cours, pour le MJ seulement. Un brouillon n'est pas un
 * combat en cours ; un joueur ne reçoit rien.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("combat d'une fiche de créature (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let ownerClient: SupabaseClient;
  let playerClient: SupabaseClient;
  let ownerId: string;
  let playerId: string;
  let worldId: string;
  let campaignId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const [owner, player] = await Promise.all([getReusableTestAccount(admin, "owner"), getReusableTestAccount(admin, "player")]);
    ownerId = owner.id;
    ownerClient = owner.client;
    playerId = player.id;
    playerClient = player.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test creature", slug: `integration-test-crea-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    // Le joueur doit appartenir à une campagne du monde pour voir le niveau `players`.
    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");

    campaignId = campaign.id;
    const { error: memberError } = await admin
      .from("campaign_members")
      .insert({ campaign_id: campaign.id, user_id: playerId, role: "player" });
    if (memberError) throw new Error(memberError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("deux gobelins en combat : le MJ lit leurs instances ; un brouillon et un joueur ne voient rien", async () => {
    const gobelin = await createEntity(ownerClient, { worldId, createdBy: ownerId, name: "Gobelin", entityKind: "creature", aliases: [] });

    const { data: combat, error: combatError } = await admin
      .from("combats")
      .insert({ campaign_id: campaignId, name: "Embuscade", status: "draft" })
      .select("id")
      .single();
    if (combatError || !combat) throw new Error(combatError?.message ?? "creation combat echouee");
    const participant = (label: string, hp: number) => ({
      combat_id: combat.id,
      source_kind: "entity",
      entity_id: gobelin.id,
      label,
      hp_max: 7,
      hp_current: hp,
      conditions: label === "Gobelin 2" ? ["À terre"] : [],
    });
    const { error: partError } = await admin.from("combat_participants").insert([participant("Gobelin 1", 7), participant("Gobelin 2", 3)]);
    if (partError) throw new Error(partError.message);

    expect(await getCreatureCombat(ownerClient, { entityId: gobelin.id, userId: ownerId })).toBeNull();

    const { error: runError } = await admin.from("combats").update({ status: "running" }).eq("id", combat.id);
    if (runError) throw new Error(runError.message);

    const vuMj = await getCreatureCombat(ownerClient, { entityId: gobelin.id, userId: ownerId });
    expect(vuMj?.combatId).toBe(combat.id);
    expect(vuMj?.instances.map((i) => [i.label, i.hpCurrent, i.conditions])).toEqual(
      expect.arrayContaining([
        ["Gobelin 1", 7, []],
        ["Gobelin 2", 3, ["À terre"]],
      ])
    );
    expect(await getCreatureCombat(playerClient, { entityId: gobelin.id, userId: playerId })).toBeNull();

    // Chaque instance garde ses PV : toucher Gobelin 1 ne touche pas Gobelin 2
    // (une créature n'a pas d'état de jeu partagé, contrairement à un personnage).
    const g1 = vuMj?.instances.find((i) => i.label === "Gobelin 1");
    if (!g1) throw new Error("Gobelin 1 introuvable");
    await patchCombatParticipant(ownerClient, { participantId: g1.participantId, patch: { hpCurrent: 2 }, actorUserId: ownerId, note: "test" });
    const apres = await getCreatureCombat(ownerClient, { entityId: gobelin.id, userId: ownerId });
    expect(apres?.instances.find((i) => i.label === "Gobelin 1")?.hpCurrent).toBe(2);
    expect(apres?.instances.find((i) => i.label === "Gobelin 2")?.hpCurrent).toBe(3);
  });

  it("V3.1-129 : recharge d'une capacité par instance — dépensée chez Gobelin 1 seulement, d6 du serveur à 5 ou 6 pour la rendre prête, annulable", async () => {
    const dragonnet = await createEntity(ownerClient, { worldId, createdBy: ownerId, name: "Dragonnet", entityKind: "creature", aliases: [] });
    const { error: blocError } = await admin.from("blocks").insert({
      entity_id: dragonnet.id,
      block_type: "statblock",
      display: { label: "Créature", layout: "statblock" },
      data: {
        __v: 1, size: "Petite", creature_type: "dragon", ac: { value: 14 }, hp: { value: 10 }, speed: "9 m",
        abilities: { str: 10, dex: 12, con: 12, int: 6, wis: 10, cha: 10 },
        traits: [], reactions: [], legendary_actions: [],
        actions: [{ name: "Morsure", text: "+4 pour toucher." }, { name: "Souffle empoisonné (Recharge 5–6)", text: "Cône de 4,5 m." }],
      },
    });
    if (blocError) throw new Error(blocError.message);
    // Une séance ouverte : sans elle, rien n'est journalisé ni donc annulable (comme en jeu).
    const { data: seance, error: seanceError } = await admin.from("sessions").insert({ campaign_id: campaignId, started_at: new Date().toISOString() }).select("id").single();
    if (seanceError || !seance) throw new Error(seanceError?.message ?? "séance");
    const { data: combat, error: combatError } = await admin.from("combats").insert({ campaign_id: campaignId, name: "Nid", status: "running", session_id: seance.id }).select("id").single();
    if (combatError || !combat) throw new Error(combatError?.message ?? "combat");
    // Le combat d'avant est encore en cours : on le clôt pour que celui-ci soit « le » combat actif.
    await admin.from("combats").update({ status: "ended" }).eq("campaign_id", campaignId).neq("id", combat.id);
    const ligne = (label: string, ordre: number) => ({ combat_id: combat.id, source_kind: "entity", entity_id: dragonnet.id, label, hp_max: 10, hp_current: 10, initiative: 20 - ordre, display_order: ordre });
    const { data: lignes, error: partError } = await admin.from("combat_participants").insert([ligne("Dragonnet 1", 0), ligne("Dragonnet 2", 1)]).select("id, label");
    if (partError || !lignes) throw new Error(partError?.message ?? "participants");
    const d1 = lignes.find((l) => l.label === "Dragonnet 1")!.id;
    const d2 = lignes.find((l) => l.label === "Dragonnet 2")!.id;

    await patchCombatParticipant(ownerClient, { participantId: d1, patch: { resourcesUsed: { "souffle-empoisonne": 1 } }, actorUserId: ownerId, note: "Souffle" });
    const vu = await getCreatureCombat(ownerClient, { entityId: dragonnet.id, userId: ownerId });
    expect(vu?.instances.find((i) => i.participantId === d1)?.resourcesUsed).toEqual({ "souffle-empoisonne": 1 });
    expect(vu?.instances.find((i) => i.participantId === d2)?.resourcesUsed).toEqual({});

    const d6 = (face: number): Rng => ({ nextInt: () => face - 1 });
    const rate = await rollParticipantRecharges(ownerClient, { participant: (await getCombatParticipantById(ownerClient, d1))!, campaignId, actorUserId: ownerId, rng: d6(3) });
    expect(rate).toEqual([{ key: "souffle-empoisonne", name: "Souffle empoisonné", roll: 3, recharged: false }]);
    expect((await getCombatParticipantById(ownerClient, d1))?.resources_used).toEqual({ "souffle-empoisonne": 1 });

    const reussi = await rollParticipantRecharges(ownerClient, { participant: (await getCombatParticipantById(ownerClient, d1))!, campaignId, actorUserId: ownerId, rng: d6(5) });
    expect(reussi[0]).toMatchObject({ roll: 5, recharged: true });
    expect((await getCombatParticipantById(ownerClient, d1))?.resources_used).toEqual({});
    // Une capacité prête ne lance rien, et l'autre instance n'a jamais rien eu à lancer.
    expect(await rollParticipantRecharges(ownerClient, { participant: (await getCombatParticipantById(ownerClient, d2))!, campaignId, actorUserId: ownerId })).toEqual([]);

    // « Annuler » rend l'état d'avant la recharge.
    expect(await undoLastCombatAction(ownerClient, combat.id, ownerId)).toBe(true);
    expect((await getCombatParticipantById(ownerClient, d1))?.resources_used).toEqual({ "souffle-empoisonne": 1 });

    // Au début du tour de Dragonnet 1, le serveur lance le d6 lui-même : un jet de recharge est journalisé.
    await admin.from("combats").update({ round: 1, turn_index: 1 }).eq("id", combat.id);
    await advanceCombatTurn(ownerClient, { combatId: combat.id, actorUserId: ownerId });
    const { data: notes } = await admin.from("session_events").select("payload").eq("session_id", seance.id).eq("kind", "combat").order("seq", { ascending: false }).limit(5);
    expect((notes ?? []).some((n) => String((n.payload as { note?: string }).note).startsWith("Recharge (Dragonnet 1) : Souffle empoisonné d6 = "))).toBe(true);
  });
});
