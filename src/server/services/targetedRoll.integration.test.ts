import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { applyResolvedEffects, resolveTargetedRoll } from "./targetedRoll";
import { advanceCombatTurn, undoLastCombatAction } from "./combats";
import { getRuleEntryForWorld } from "./rules";
import { getOrOpenSessionForCampaign } from "./sessions";
import { playTurn } from "./turnLoop";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import { getEntityRuntimeState } from "./runtimeState";
import { putRuntimeState } from "../repos/runtimeState";
import type { TargetedRollInput } from "@/lib/combats/schemas";
import type { Json } from "@/src/types/database";

/**
 * V3.1-105 (ADR 0042) — « Cibler », contre la vraie base, depuis le compte du
 * MJ : touche, dégâts, états (Inconscient, jets contre la mort), soins
 * résolus par le moteur, appliqués et journalisés ; « Annuler » rend l'état
 * d'avant ; une créature à 0 PV sort de l'initiative. Les jets sont
 * aléatoires (serveur) : chaque test vérifie la branche tombée, jamais un
 * résultat supposé. Comptes du groupe fixe, monde supprimé à la fin.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("cibler : le cœur commun de résolution (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let gm: { id: string; client: SupabaseClient };
  let worldId: string;
  let worldSlug: string;
  let campaignId: string;
  let combatId: string;
  let sessionId: string;
  const pc: Record<string, string> = {};
  const p: Record<string, string> = {};

  async function participant(id: string) {
    const { data } = await admin.from("combat_participants").select("hp_current, conditions").eq("id", id).single();
    return data as { hp_current: number; conditions: string[] };
  }
  async function runtime(entityId: string) {
    const { data } = await admin.from("entity_runtime_state").select("state").eq("entity_id", entityId).eq("campaign_id", campaignId).maybeSingle();
    return (data?.state ?? null) as { hp: { current: number }; conditions: string[]; death_saves: { success: number; fail: number } } | null;
  }
  async function setHp(participantId: string, entityId: string | null, hp: number) {
    await admin.from("combat_participants").update({ hp_current: hp, conditions: [] }).eq("id", participantId);
    if (entityId) {
      // Pas d'upsert direct sur cette table (index sur une expression) : on lit, fusionne, réécrit.
      const state = await getEntityRuntimeState(admin, entityId, campaignId);
      await putRuntimeState(admin, {
        entityId,
        campaignId,
        state: { ...state, hp: { current: hp, temp: 0 }, conditions: [], death_saves: { success: 0, fail: 0 } } as unknown as Json,
      });
    }
  }
  const roll = (input: Omit<TargetedRollInput, "advantage" | "critical" | "secret"> & Partial<TargetedRollInput>) =>
    resolveTargetedRoll(gm.client, {
      campaignId,
      combatId,
      callerId: gm.id,
      locale: "fr",
      input: { advantage: "normal", critical: false, secret: false, ...input },
    });

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    gm = await getReusableTestAccount(admin, "gm");

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test cibler", slug: `integration-test-targeted-${Date.now()}`, owner_id: gm.id })
      .select("id, slug")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;
    worldSlug = world.slug;
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_51").eq("is_official_base", true).limit(1).single();
    if (!official) throw new Error("aucun ruleset SRD 5.1 officiel");
    await admin.from("worlds").update({ default_ruleset_id: official.id }).eq("id", worldId);
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test cibler", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;
    await admin.from("campaign_members").insert({ campaign_id: campaignId, user_id: gm.id, role: "gm" });

    // Brunhild, guerrière à l'épée courte ; Mirelle, clerc (Flamme sacrée, Rayon de feu).
    const sheets = [
      { key: "brunhild", name: "Brunhild", cls: "fighter", abilities: { str: 16, dex: 10, con: 12, int: 8, wis: 13, cha: 10 } },
      { key: "mirelle", name: "Mirelle", cls: "cleric", abilities: { str: 10, dex: 12, con: 12, int: 10, wis: 16, cha: 10 } },
    ];
    for (const s of sheets) {
      const { data: entity, error } = await admin
        .from("entities")
        .insert({ world_id: worldId, slug: s.key, name: s.name, entity_kind: "character", created_by: gm.id })
        .select("id")
        .single();
      if (error || !entity) throw new Error(error?.message ?? "creation entite echouee");
      pc[s.key] = entity.id;
      const blocks = [
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
        {
          entity_id: entity.id,
          block_type: "inventory",
          display: { label: "Inventaire", layout: "inventory" },
          data: { __v: 1, items: [{ id: "i1", ref: { kind: "rule", key: "shortsword" }, qty: 1, equipped: true }], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } },
          visibility_level: "players",
          created_by: gm.id,
        },
        ...(s.cls === "cleric"
          ? [
              {
                entity_id: entity.id,
                block_type: "spellcasting",
                display: { label: "Incantation", layout: "spellcasting" },
                data: {
                  __v: 1,
                  sources: [{ class: "cleric", ability: "wis" }],
                  known: [
                    { ref: { kind: "rule", key: "sacred-flame" }, origin: "granted" },
                    { ref: { kind: "rule", key: "fire-bolt" }, origin: "granted" },
                  ],
                  prepared: [],
                  slot_override: null,
                },
                visibility_level: "players",
                created_by: gm.id,
              },
            ]
          : []),
      ];
      const { error: blocksError } = await admin.from("blocks").insert(blocks);
      if (blocksError) throw new Error(blocksError.message);
      await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: entity.id, user_id: null, is_pc: true });
    }

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
        { ...base, source_kind: "entity", entity_id: pc.brunhild, rule_key: null, label: "Brunhild", initiative: 20, ac: 16, hp_max: 40, hp_current: 40, display_order: 1 },
        { ...base, source_kind: "entity", entity_id: pc.mirelle, rule_key: null, label: "Mirelle", initiative: 15, ac: 14, hp_max: 9, hp_current: 9, display_order: 2 },
        { ...base, source_kind: "statblock", entity_id: null, rule_key: "goblin", label: "Gobelin 1", initiative: 12, ac: 15, hp_max: 7, hp_current: 7, display_order: 3 },
        { ...base, source_kind: "statblock", entity_id: null, rule_key: "goblin", label: "Gobelin 2", initiative: 10, ac: 15, hp_max: 7, hp_current: 7, display_order: 4 },
      ])
      .select("id, label");
    if (rowsError || !rows) throw new Error(rowsError?.message ?? "creation participants echouee");
    for (const r of rows) p[r.label] = r.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("attaque à l'arme : verdict contre la CA, et une touche chaîne les dégâts", async () => {
    const result = await roll({ kind: "attack", actor: { kind: "character", entityId: pc.brunhild }, action: { kind: "weapon", itemId: "i1" }, targetId: p["Gobelin 1"] });
    if (!result.ok) throw new Error(result.reason);
    expect(["hit", "miss"]).toContain(result.verdict);
    // V3.1-38 (suite) : les dés de l'attaque, pour l'outil de dés (un d20 gardé, entre 1 et 20).
    expect(result.dice?.naturalD20).toBeGreaterThanOrEqual(1);
    expect(result.dice?.naturalD20).toBeLessThanOrEqual(20);
    expect(result.dice?.trace.length).toBeGreaterThan(0);
    if (result.verdict === "hit") {
      expect(result.chained).toMatchObject({ kind: "damage", targetId: p["Gobelin 1"], action: { kind: "weapon", itemId: "i1" } });
    } else {
      expect(result.chained).toBeNull();
    }
    // L'attaque seule ne blesse personne.
    expect((await participant(p["Gobelin 1"])).hp_current).toBe(7);
    const { data: event } = await admin.from("session_events").select("kind, payload").eq("id", result.rollEventId).single();
    expect(event?.kind).toBe("roll");
  });

  it("dégâts appliqués, journalisés, et « Annuler » rend l'état d'avant", async () => {
    const result = await roll({ kind: "damage", actor: { kind: "character", entityId: pc.brunhild }, action: { kind: "weapon", itemId: "i1" }, targetId: p["Gobelin 1"] });
    if (!result.ok) throw new Error(result.reason);
    expect(result.amount).toBeGreaterThanOrEqual(1);
    // Les dés des dégâts : leur total est le montant appliqué.
    expect(result.dice?.total).toBe(result.amount);
    const after = Math.max(0, 7 - result.amount!);
    expect((await participant(p["Gobelin 1"])).hp_current).toBe(after);
    expect(result.targetOutOfFight).toBe(after === 0);

    const { data: application } = await admin.from("session_events").select("payload").eq("session_id", sessionId).eq("kind", "rule_application");
    expect(application?.some((e) => (e.payload as { from_event?: string }).from_event === result.rollEventId)).toBe(true);

    expect(await undoLastCombatAction(gm.client, combatId, gm.id)).toBe(true);
    expect((await participant(p["Gobelin 1"])).hp_current).toBe(7);
  });

  it("un monstre frappe un PJ : à 0 PV il tombe Inconscient ; un critique à 0 PV coûte deux échecs, et « Annuler » les rend", async () => {
    // PV max 40 : aucun coup de gobelin (au plus 14 sur un critique) ne la tue net
    // (dégâts massifs) — le test ne dépend pas des dés.
    await setHp(p.Brunhild, pc.brunhild, 1);
    const goblin = { kind: "participant", participantId: p["Gobelin 2"] } as const;
    // Le nom d'action tel que l'écran du MJ le lit et l'envoie : traduit (V3.1-106).
    const fiche = await getRuleEntryForWorld(gm.client, worldId, "goblin", "fr");
    const actions = (fiche?.blocks.find((b) => b.blockType === "actions")?.data as { actions?: { name: string; damage?: unknown[] }[] } | undefined)?.actions ?? [];
    const nomCimeterre = actions.find((a) => (a.damage?.length ?? 0) > 0)?.name;
    if (!nomCimeterre) throw new Error("le gobelin n'a pas d'action à dégâts");
    const scimitar = { kind: "monster_action", name: nomCimeterre } as const;

    const first = await roll({ kind: "damage", actor: goblin, action: scimitar, targetId: p.Brunhild });
    if (!first.ok) throw new Error(first.reason);
    expect((await participant(p.Brunhild)).hp_current).toBe(0);
    expect((await participant(p.Brunhild)).conditions).toContain("unconscious");
    expect((await runtime(pc.brunhild))?.death_saves).toEqual({ success: 0, fail: 0 });
    // Un PJ à 0 PV reste dans l'initiative (jets contre la mort).
    expect(first.targetOutOfFight).toBe(false);

    const second = await roll({ kind: "damage", actor: goblin, action: scimitar, targetId: p.Brunhild, critical: true });
    if (!second.ok) throw new Error(second.reason);
    expect((await runtime(pc.brunhild))?.death_saves).toEqual({ success: 0, fail: 2 });

    expect(await undoLastCombatAction(gm.client, combatId, gm.id)).toBe(true);
    expect((await runtime(pc.brunhild))?.death_saves).toEqual({ success: 0, fail: 0 });

    // Le jet d'un monstre est enregistré et attribué (V3.1-89).
    const { data: rolls } = await admin.from("dice_rolls").select("detail").eq("campaign_id", campaignId).eq("rolled_by", "gm");
    expect(rolls?.some((r) => (r.detail as { kind?: string }).kind === "damage")).toBe(true);
  });

  it("soins par le cœur commun : un PJ relevé perd Inconscient et ses jets repartent à zéro", async () => {
    const outcome = await applyResolvedEffects(gm.client, {
      campaignId,
      callerId: gm.id,
      actor: null,
      scene: null,
      spend: null,
      effects: [{ action: "heal", who: `participant:${p.Brunhild}`, amount: 5 }],
      note: "Test — soins",
      fromEventId: null,
      combatId,
    });
    expect(outcome.changes.some((c) => c.includes("Brunhild"))).toBe(true);
    expect((await participant(p.Brunhild)).hp_current).toBe(5);
    expect((await participant(p.Brunhild)).conditions).not.toContain("unconscious");
    expect((await runtime(pc.brunhild))?.death_saves).toEqual({ success: 0, fail: 0 });
  });

  it("sort à sauvegarde : la sauvegarde est DEMANDÉE à la cible (V3.1-111), rien n'est appliqué tant qu'elle n'a pas répondu", async () => {
    await setHp(p["Gobelin 2"], null, 7);
    const result = await roll({ kind: "spell_save", actor: { kind: "character", entityId: pc.mirelle }, action: { kind: "spell", spellKey: "sacred-flame", slotLevel: 0 }, targetId: p["Gobelin 2"] });
    if (!result.ok) throw new Error(result.reason);
    expect(result.saveRequestId).not.toBeNull();
    expect(result.changes).toEqual([]);
    expect((await participant(p["Gobelin 2"])).hp_current).toBe(7);
    const { data: request } = await admin.from("save_requests").select("ability, dc, status, target_user_id, origin_roll_id").eq("id", result.saveRequestId!).single();
    // Clerc niveau 1, Sagesse 16 : DD 8 + 2 + 3. Un monstre : c'est le MJ qui répond.
    expect(request).toEqual({ ability: "dex", dc: 13, status: "pending", target_user_id: null, origin_roll_id: result.rollEventId });
  });

  it("attaque de sort : sur un échec, aucun dégât lancé ni appliqué", async () => {
    await setHp(p["Gobelin 2"], null, 7);
    const result = await roll({ kind: "spell_attack", actor: { kind: "character", entityId: pc.mirelle }, action: { kind: "spell", spellKey: "fire-bolt", slotLevel: 0 }, targetId: p["Gobelin 2"] });
    if (!result.ok) throw new Error(result.reason);
    if (result.verdict === "miss") {
      expect(result.amount).toBeNull();
      expect((await participant(p["Gobelin 2"])).hp_current).toBe(7);
    } else {
      expect(result.amount).toBeGreaterThanOrEqual(1);
      expect((await participant(p["Gobelin 2"])).hp_current).toBe(Math.max(0, 7 - result.amount!));
    }
    expect(result.chained).toBeNull();
  });

  it("une créature à 0 PV sort de l'initiative : le tour la saute", async () => {
    await setHp(p["Gobelin 1"], null, 0);
    await setHp(p["Gobelin 2"], null, 7);
    await admin.from("combats").update({ turn_index: 1, round: 1 }).eq("id", combatId);
    // Ordre : Brunhild (20), Mirelle (15), Gobelin 1 (12, à 0 PV), Gobelin 2 (10).
    const next = await advanceCombatTurn(gm.client, { combatId, actorUserId: gm.id });
    expect(next.turn_index).toBe(3);
  });

  it("le tour solo passe par le même cœur : une attaque qui touche blesse sa cible et journalise l'application", async () => {
    await setHp(p["Gobelin 2"], null, 7);
    const outcome = await playTurn(gm.client, {
      entityId: pc.brunhild,
      campaignId,
      callerId: gm.id,
      world: { id: worldId, slug: worldSlug },
      locale: "fr",
      text: "J'attaque le gobelin 2",
      corrected: false,
      choice: { kind: "weapon_attack", actionId: "i1", targetId: `participant:${p["Gobelin 2"]}`, advantage: "normal" },
    });
    if ("error" in outcome) throw new Error(outcome.error);
    const damage = outcome.record.detail.damage as { total: number } | null;
    const hpAfter = (await participant(p["Gobelin 2"])).hp_current;
    if (damage) {
      expect(hpAfter).toBe(Math.max(0, 7 - damage.total));
      expect(outcome.changes.some((line) => line.startsWith("Gobelin 2"))).toBe(true);
      const { data: application } = await admin.from("session_events").select("payload").eq("session_id", sessionId).eq("kind", "rule_application");
      expect(application?.some((e) => (e.payload as { from_event?: string }).from_event === outcome.record.eventId)).toBe(true);
    } else {
      expect(hpAfter).toBe(7);
    }
  });

  it("hors d'un combat en cours : refusé", async () => {
    await admin.from("combats").update({ status: "draft" }).eq("id", combatId);
    const result = await roll({ kind: "attack", actor: { kind: "character", entityId: pc.brunhild }, action: { kind: "weapon", itemId: "i1" }, targetId: p["Gobelin 2"] });
    expect(result).toEqual({ ok: false, reason: "not_running" });
  });
});
