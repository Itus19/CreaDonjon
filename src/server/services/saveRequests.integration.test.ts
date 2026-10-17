import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveTargetedRoll } from "./targetedRoll";
import { answerSaveRequest } from "./saveRequests";
import { undoLastCombatAction } from "./combats";
import { getOrOpenSessionForCampaign } from "./sessions";
import { resolveCharacterActionContext } from "./characterActions";
import { getEntityRuntimeState } from "./runtimeState";
import { putRuntimeState } from "../repos/runtimeState";
import type { Json } from "@/src/types/database";
import { getSaveRequestById } from "../repos/saveRequests";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { TargetedRollInput } from "@/lib/combats/schemas";

/**
 * V3.1-111 (ADR 0044) — les sauvegardes demandées, contre la vraie base :
 * la restriction de cible refuse avant de lancer ; une sauvegarde imposée à
 * un PJ n'est lisible que de l'auteur (le MJ), du joueur de la cible et du
 * MJ ; la réponse donne un verdict, applique l'issue au nom de celui qui
 * répond, et la journalise. Les dés annoncés rendent chaque issue certaine.
 * Comptes du groupe fixe, monde supprimé à la fin.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("sauvegardes demandées (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let gm: { id: string; client: SupabaseClient };
  let playerA: { id: string; client: SupabaseClient };
  let playerB: { id: string; client: SupabaseClient };
  let worldId: string;
  let campaignId: string;
  let combatId: string;
  let sessionId: string;
  const pc: Record<string, string> = {};
  const p: Record<string, string> = {};
  /** Le maximum de PV de la fiche de Naivara : la ligne de combat et l'état de jeu partent de là. */
  let naivaraMax: number;

  async function participant(id: string) {
    const { data } = await admin.from("combat_participants").select("hp_current, conditions").eq("id", id).single();
    return data as { hp_current: number; conditions: string[] };
  }
  async function runtime(entityId: string) {
    const { data } = await admin.from("entity_runtime_state").select("state").eq("entity_id", entityId).eq("campaign_id", campaignId).maybeSingle();
    return (data?.state ?? null) as { hp: { current: number }; conditions: string[]; spell_slots_used: Record<string, number> } | null;
  }
  const cast = (spellKey: string, slotLevel: number, targetId: string) =>
    resolveTargetedRoll(gm.client, {
      campaignId,
      combatId,
      callerId: gm.id,
      locale: "fr",
      input: {
        kind: "spell_save",
        actor: { kind: "character", entityId: pc.mirelle },
        action: { kind: "spell", spellKey, slotLevel },
        targetId,
        advantage: "normal",
        critical: false,
        secret: false,
      } satisfies TargetedRollInput,
    });
  const answer = (who: { id: string; client: SupabaseClient }, requestId: string, natural: number) =>
    answerSaveRequest(who.client, { campaignId, requestId, callerId: who.id, locale: "fr", input: { mode: "die", natural, modifierIncluded: false } });

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, playerA, playerB] = await Promise.all([
      getReusableTestAccount(admin, "gm"),
      getReusableTestAccount(admin, "player"),
      getReusableTestAccount(admin, "playerB"),
    ]);

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test sauvegardes", slug: `integration-test-saves-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_51").eq("is_official_base", true).limit(1).single();
    if (!official) throw new Error("aucun ruleset SRD 5.1 officiel");
    await admin.from("worlds").update({ default_ruleset_id: official.id }).eq("id", worldId);
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test sauvegardes", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: playerA.id, role: "player" },
      { campaign_id: campaignId, user_id: playerB.id, role: "player" },
    ]);

    // Mirelle, clerc du MJ (Flamme sacrée, Charme-personne) ; Naivara, PJ de la joueuse A.
    const sheets = [
      { key: "mirelle", name: "Mirelle", cls: "cleric", owner: null, abilities: { str: 10, dex: 12, con: 12, int: 10, wis: 16, cha: 10 } },
      { key: "naivara", name: "Naivara", cls: "fighter", owner: playerA.id, abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 } },
    ];
    for (const s of sheets) {
      const { data: entity, error } = await admin
        .from("entities")
        .insert({ world_id: worldId, slug: s.key, name: s.name, entity_kind: "character", created_by: gm.id })
        .select("id")
        .single();
      if (error || !entity) throw new Error(error?.message ?? "creation entite echouee");
      pc[s.key] = entity.id;
      const blocks: Record<string, unknown>[] = [
        {
          entity_id: entity.id,
          block_type: "character",
          display: { label: "Personnage", layout: "character" },
          data: {
            __v: 1,
            species: { kind: "rule", key: "dwarf" },
            background: null,
            classes: [{ class: { kind: "rule", key: s.cls }, level: 1, subclass: null }],
            abilities: { method: "manual", base: s.abilities },
            choices: {},
            hp_method: "fixed",
            portrait_asset_id: null,
          },
          visibility_level: "players",
          created_by: gm.id,
        },
      ];
      if (s.cls === "cleric") {
        blocks.push({
          entity_id: entity.id,
          block_type: "spellcasting",
          display: { label: "Incantation", layout: "spellcasting" },
          data: {
            __v: 1,
            sources: [{ class: "cleric", ability: "wis" }],
            known: [
              { ref: { kind: "rule", key: "sacred-flame" }, origin: "granted" },
              { ref: { kind: "rule", key: "charm-person" }, origin: "granted" },
            ],
            prepared: [],
            slot_override: null,
          },
          visibility_level: "players",
          created_by: gm.id,
        });
      }
      const { error: blocksError } = await admin.from("blocks").insert(blocks);
      if (blocksError) throw new Error(blocksError.message);
      await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: entity.id, user_id: s.owner, is_pc: true });
    }

    const naivaraCtx = await resolveCharacterActionContext(admin, pc.naivara, campaignId, "fr");
    if (!naivaraCtx) throw new Error("fiche de Naivara introuvable");
    naivaraMax = naivaraCtx.sheet.hitPoints.max;
    const naivaraState = await getEntityRuntimeState(admin, pc.naivara, campaignId);
    await putRuntimeState(admin, {
      entityId: pc.naivara,
      campaignId,
      state: { ...naivaraState, hp: { current: naivaraMax, temp: 0 }, conditions: [] } as unknown as Json,
    });

    sessionId = await getOrOpenSessionForCampaign(gm.client, campaignId);
    const { data: combat, error: combatError } = await admin
      .from("combats")
      .insert({ campaign_id: campaignId, session_id: sessionId, name: "Embuscade", status: "running", round: 1, turn_index: 0 })
      .select("id")
      .single();
    if (combatError || !combat) throw new Error(combatError?.message ?? "creation combat echouee");
    combatId = combat.id;

    const base = { combat_id: combatId, temp_hp: 0, is_ally: false, conditions: [] };
    const { data: rows, error: rowsError } = await admin
      .from("combat_participants")
      .insert([
        { ...base, source_kind: "entity", entity_id: pc.mirelle, rule_key: null, label: "Mirelle", initiative: 15, ac: 14, hp_max: 9, hp_current: 9, display_order: 1 },
        { ...base, source_kind: "entity", entity_id: pc.naivara, rule_key: null, label: "Naivara", initiative: 12, ac: 16, hp_max: naivaraMax, hp_current: naivaraMax, display_order: 2 },
        { ...base, source_kind: "statblock", entity_id: null, rule_key: "goblin", label: "Gobelin", initiative: 10, ac: 15, hp_max: 7, hp_current: 7, display_order: 3 },
        { ...base, source_kind: "statblock", entity_id: null, rule_key: "zombie", label: "Zombie", initiative: 8, ac: 8, hp_max: 22, hp_current: 22, display_order: 4 },
      ])
      .select("id, label");
    if (rowsError || !rows) throw new Error(rowsError?.message ?? "creation participants echouee");
    for (const r of rows) p[r.label] = r.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("Charme-personne sur un mort-vivant : refusé avant de lancer, aucun emplacement dépensé", async () => {
    const result = await cast("charm-person", 1, p.Zombie);
    expect(result).toEqual({ ok: false, reason: "invalid_target", detail: { refusal: "creature_type_not_allowed", value: "undead" } });
    expect((await runtime(pc.mirelle))?.spell_slots_used?.["1"] ?? 0).toBe(0);
    const { count } = await admin.from("save_requests").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId);
    expect(count).toBe(0);
  });

  it("une sauvegarde imposée à un PJ n'est lisible que de l'auteur, du joueur de la cible et du MJ", async () => {
    const result = await cast("sacred-flame", 0, p.Naivara);
    if (!result.ok) throw new Error(result.reason);
    const requestId = result.saveRequestId!;

    expect((await getSaveRequestById(gm.client, requestId))?.target_user_id).toBe(playerA.id);
    expect(await getSaveRequestById(playerA.client, requestId)).not.toBeNull();
    expect(await getSaveRequestById(playerB.client, requestId)).toBeNull();

    // Une autre joueuse ne peut ni répondre, ni fabriquer une demande.
    expect(await answer(playerB, requestId, 20)).toEqual({ ok: false, reason: "not_found" });
    const { data: forged } = await playerB.client.rpc("answer_save_request", { p_request: requestId, p_natural: 20, p_total: 25 });
    expect(forged).toBeNull();
    const { error: insertError } = await playerB.client.from("save_requests").insert({
      campaign_id: campaignId,
      target_kind: "participant",
      target_id: p.Naivara,
      target_user_id: playerA.id,
      label: "Fausse demande",
      ability: "dex",
      dc: 30,
      effect: { on_fail: { damage: 100, conditions: [] }, on_success: { damage: 100, conditions: [] } },
    });
    expect(insertError).not.toBeNull();
    // Ni écrire la ligne de combat du PJ d'une autre.
    const { data: vitals } = await playerB.client.rpc("set_own_participant_vitals", { p_participant: p.Naivara, p_hp_current: 1, p_temp_hp: 0, p_conditions: [] });
    expect(vitals).toBeNull();
  });

  it("la joueuse répond pour son PJ : verdict, dégâts appliqués sur sa fiche et sa ligne de combat, journal, annulable par le MJ", async () => {
    const result = await cast("sacred-flame", 0, p.Naivara);
    if (!result.ok) throw new Error(result.reason);
    const { data: request } = await admin.from("save_requests").select("effect").eq("id", result.saveRequestId!).single();
    const damage = (request!.effect as { on_fail: { damage: number } }).on_fail.damage;

    // Un 1 annoncé (+1 de Dextérité) contre DD 13 : ratée.
    const answered = await answer(playerA, result.saveRequestId!, 1);
    expect(answered).toMatchObject({ ok: true, passed: false, natural: 1, total: 2 });
    expect((await runtime(pc.naivara))?.hp.current).toBe(Math.max(0, naivaraMax - damage));
    expect((await participant(p.Naivara)).hp_current).toBe(Math.max(0, naivaraMax - damage));

    const { data: row } = await admin.from("save_requests").select("status, answered_by, total").eq("id", result.saveRequestId!).single();
    expect(row).toEqual({ status: "answered", answered_by: playerA.id, total: 2 });
    expect(await answer(playerA, result.saveRequestId!, 20)).toEqual({ ok: false, reason: "not_pending" });

    const { data: events } = await admin.from("session_events").select("kind, actor, payload").eq("session_id", sessionId).in("kind", ["roll", "rule_application"]);
    expect(events?.some((e) => e.kind === "roll" && e.actor === "player" && (e.payload as { save_request?: { id: string } }).save_request?.id === result.saveRequestId)).toBe(true);
    expect(events?.some((e) => e.kind === "rule_application")).toBe(true);

    expect(await undoLastCombatAction(gm.client, combatId, gm.id)).toBe(true);
    expect((await participant(p.Naivara)).hp_current).toBe(naivaraMax);
    expect((await runtime(pc.naivara))?.hp.current).toBe(naivaraMax);
  });

  it("un état imposé : Charme-personne raté rend le PJ Charmé", async () => {
    const result = await cast("charm-person", 1, p.Naivara);
    if (!result.ok) throw new Error(result.reason);
    expect(await answer(playerA, result.saveRequestId!, 1)).toMatchObject({ ok: true, passed: false });
    expect((await runtime(pc.naivara))?.conditions).toContain("charmed");
    expect((await participant(p.Naivara)).conditions).toContain("charmed");
  });

  it("le MJ répond pour un monstre : une réussite sur Flamme sacrée ne blesse pas, un échec applique les dégâts", async () => {
    const passed = await cast("sacred-flame", 0, p.Gobelin);
    if (!passed.ok) throw new Error(passed.reason);
    expect(await answer(gm, passed.saveRequestId!, 20)).toMatchObject({ ok: true, passed: true });
    expect((await participant(p.Gobelin)).hp_current).toBe(7);

    const failed = await cast("sacred-flame", 0, p.Gobelin);
    if (!failed.ok) throw new Error(failed.reason);
    const { data: request } = await admin.from("save_requests").select("effect, target_user_id").eq("id", failed.saveRequestId!).single();
    expect(request?.target_user_id).toBeNull();
    const damage = (request!.effect as { on_fail: { damage: number } }).on_fail.damage;
    expect(await answer(gm, failed.saveRequestId!, 1)).toMatchObject({ ok: true, passed: false });
    expect((await participant(p.Gobelin)).hp_current).toBe(Math.max(0, 7 - damage));
  });
});
