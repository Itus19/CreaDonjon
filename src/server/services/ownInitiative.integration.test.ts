import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { setMyInitiative } from "./ownInitiative";
import { beginCombat, endCombat, patchCombatParticipant, setCombatStatus } from "./combats";
import { getOrOpenSessionForCampaign } from "./sessions";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-103 (ADR 0040) — les jets d'initiative des joueurs, contre la vraie
 * base : une joueuse n'écrit que l'initiative de SON PJ, et seulement pendant
 * les jets ; la demande, le jet, la saisie du MJ et la fin sont journalisés.
 * Comptes du groupe fixe (docs/TESTS.md §2), monde supprimé à la fin.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("jets d'initiative des joueurs (integration, base reelle)", () => {
  let admin: SupabaseClient;
  const users: Record<string, { id: string; client: SupabaseClient }> = {};
  let worldId: string;
  let campaignId: string;
  let combatId: string;
  let sessionId: string;
  const participant: Record<string, string> = {};
  const pc: Record<string, string> = {};

  async function initiativeOf(id: string): Promise<number | null> {
    const { data } = await admin.from("combat_participants").select("initiative").eq("id", id).single();
    return data?.initiative ?? null;
  }

  async function combatEvents(): Promise<{ actor: string; note: string }[]> {
    const { data } = await admin.from("session_events").select("actor, payload, seq").eq("session_id", sessionId).eq("kind", "combat").order("seq");
    return (data ?? []).map((e) => ({ actor: e.actor as string, note: String((e.payload as { note?: unknown }).note ?? "") }));
  }

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const [gm, a, b] = await Promise.all([
      getReusableTestAccount(admin, "gm"),
      getReusableTestAccount(admin, "player"),
      getReusableTestAccount(admin, "playerB"),
    ]);
    users.gm = gm;
    users.a = a;
    users.b = b;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test jets d'initiative", slug: `integration-test-own-initiative-${Date.now()}`, owner_id: gm.id })
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
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset SRD 5.1 officiel");
    await admin.from("worlds").update({ default_ruleset_id: official.id }).eq("id", worldId);
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test jets d'initiative", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: a.id, role: "player" },
      { campaign_id: campaignId, user_id: b.id, role: "player" },
    ]);

    // Deux PJ, Dextérité 14 (modificateur +2).
    for (const [key, name, owner] of [["a", "Naivara", a.id], ["b", "Brunhild", b.id]] as const) {
      const { data: entity, error: entityError } = await admin
        .from("entities")
        .insert({ world_id: worldId, slug: `${key}-${Date.now()}`, name, entity_kind: "character", created_by: gm.id })
        .select("id")
        .single();
      if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
      const { error: blockError } = await admin.from("blocks").insert({
        entity_id: entity.id,
        block_type: "character",
        display: { label: "Personnage", layout: "character" },
        data: {
          __v: 1,
          species: { kind: "rule", key: "dwarf" },
          background: null,
          classes: [{ class: { kind: "rule", key: "fighter" }, level: 1, subclass: null }],
          abilities: { method: "manual", base: { str: 16, dex: 14, con: 12, int: 8, wis: 13, cha: 10 } },
          choices: {},
          hp_method: "fixed",
          portrait_asset_id: null,
        },
        visibility_level: "players",
        created_by: gm.id,
      });
      if (blockError) throw new Error(blockError.message);
      await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: entity.id, user_id: owner, is_pc: true });
      pc[key] = entity.id;
    }

    sessionId = await getOrOpenSessionForCampaign(gm.client, campaignId);
    const { data: combat, error: combatError } = await admin
      .from("combats")
      .insert({ campaign_id: campaignId, session_id: sessionId, name: "Embuscade", status: "draft" })
      .select("id")
      .single();
    if (combatError || !combat) throw new Error(combatError?.message ?? "creation combat echouee");
    combatId = combat.id;

    const base = { combat_id: combatId, rule_key: null, initiative: null, ac: 15, hp_max: 12, hp_current: 12, temp_hp: 0, is_ally: false, conditions: [] };
    const { data: rows, error: rowsError } = await admin
      .from("combat_participants")
      .insert([
        { ...base, source_kind: "entity", entity_id: pc.a, label: "Naivara", display_order: 1 },
        { ...base, source_kind: "entity", entity_id: pc.b, label: "Brunhild", display_order: 2 },
        { ...base, source_kind: "statblock", entity_id: null, rule_key: "goblin", label: "Gobelin", display_order: 3 },
      ])
      .select("id, label");
    if (rowsError || !rows) throw new Error(rowsError?.message ?? "creation participants echouee");
    for (const r of rows) participant[r.label] = r.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  const call = (who: "a" | "b", input: Parameters<typeof setMyInitiative>[1]["input"]) =>
    setMyInitiative(users[who].client, { campaignId, combatId, userId: users[who].id, locale: "fr", input });

  it("avant la demande du MJ : refusé, par le service comme par la fonction", async () => {
    expect(await call("a", { mode: "die", natural: 14, modifierIncluded: false })).toEqual({ ok: false, reason: "not_rolling" });
    const { data } = await users.a.client.rpc("set_own_initiative", { p_participant: participant.Naivara, p_value: 15 });
    expect(data).toBeNull();
    expect(await initiativeOf(participant.Naivara)).toBeNull();
  });

  it("pendant les jets : chacune son PJ, et rien d'autre", async () => {
    await setCombatStatus(users.gm.client, { combatId, status: "rolling", actorUserId: users.gm.id });

    // Vrai dé : le serveur ajoute la Dextérité (+2).
    expect(await call("a", { mode: "die", natural: 14, modifierIncluded: false })).toMatchObject({ ok: true, initiative: 16 });
    expect(await initiativeOf(participant.Naivara)).toBe(16);

    // Lancer : le serveur tire, le jet est enregistré et attribué (V3.1-89).
    const rolled = await call("b", { mode: "roll" });
    expect(rolled.ok).toBe(true);
    if (rolled.ok) {
      expect(rolled.initiative).toBeGreaterThanOrEqual(3);
      expect(rolled.initiative).toBeLessThanOrEqual(22);
      expect(await initiativeOf(participant.Brunhild)).toBe(rolled.initiative);
    }
    const { data: rolls } = await admin.from("dice_rolls").select("entity_id, detail").eq("campaign_id", campaignId);
    expect(rolls?.some((r) => r.entity_id === pc.b && (r.detail as { kind?: string }).kind === "check")).toBe(true);

    // Par la fonction, à la main : ni le PJ d'une autre, ni un adversaire, ni hors bornes.
    for (const target of [participant.Brunhild, participant.Gobelin]) {
      const { data } = await users.a.client.rpc("set_own_initiative", { p_participant: target, p_value: 30 });
      expect(data).toBeNull();
    }
    const { data: outOfRange } = await users.a.client.rpc("set_own_initiative", { p_participant: participant.Naivara, p_value: 41 });
    expect(outOfRange).toBeNull();
    expect(await initiativeOf(participant.Gobelin)).toBeNull();
    expect(await initiativeOf(participant.Naivara)).toBe(16);
  });

  it("une fois le combat commencé : plus d'écriture joueuse ; demande, jets, saisie du MJ et fin journalisés", async () => {
    await patchCombatParticipant(users.gm.client, {
      participantId: participant.Gobelin,
      patch: { initiative: 11 },
      actorUserId: users.gm.id,
      note: "Initiative de Gobelin : 11",
    });
    await beginCombat(users.gm.client, { combatId, actorUserId: users.gm.id });
    expect(await call("a", { mode: "die", natural: 20, modifierIncluded: false })).toEqual({ ok: false, reason: "not_rolling" });
    const { data } = await users.a.client.rpc("set_own_initiative", { p_participant: participant.Naivara, p_value: 22 });
    expect(data).toBeNull();
    await endCombat(users.gm.client, { combatId, actorUserId: users.gm.id });

    const events = await combatEvents();
    expect(events).toEqual(
      expect.arrayContaining([
        { actor: "gm", note: "Statut : Jets d'initiative" },
        { actor: "player", note: "Initiative de Naivara : 16" },
        { actor: "gm", note: "Initiative de Gobelin : 11" },
        { actor: "gm", note: "Statut : Commencé" },
        { actor: "gm", note: "Statut : Terminé" },
      ])
    );
    expect(events.filter((e) => e.actor === "player")).toHaveLength(2);
  });
});
