import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { resolveTargetedRoll } = await import("./targetedRoll");
const { answerRollWindow, resumeRollWindow } = await import("./rollWindowResume");
const { createRulesetVariant, getRuleEntryForWorld } = await import("./rules");

/**
 * V3.1-160 (ADR 0075) — le jet suspendu contre la base réelle : un gobelin
 * frappe une Roublarde 5 dont la variante déclare Esquive instinctive
 * (réaction, dégâts d'une attaque qui la vise, moitié). La fenêtre s'ouvre,
 * la joueuse répond, le MJ (auteur du jet) reprend ; la réaction est
 * comptée, la seconde attaque du round passe sans fenêtre. Monde, variante,
 * combat jetables ; comptes réutilisés.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && process.env.ENGINE_SIGNING_KEY);

describe.skipIf(!hasCreds)("le jet suspendu (V3.1-160, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let joueuse: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let variantId: string;
  let combatId: string;
  let lia: string;
  let liaLigne: string;
  let gobelin: string;
  let nomCimeterre: string;
  const client = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    variantId = (await createRulesetVariant(client(gm), { name: "Variante de test réactions", parentRulesetId: official!.id }))!.id;
    const { error: e1 } = await client(gm).rpc("upsert_ruleset_override", {
      p_ruleset_id: variantId,
      p_entry_key: "rogue-uncanny-dodge",
      p_block_type: "activation",
      p_action: "add_block",
      p_payload: {
        block_type: "activation",
        display: { label: "activation", layout: "key_values" },
        display_order: 900,
        data: {
          activations: [
            {
              id: "uncanny-dodge",
              label: { fr: "Esquive instinctive" },
              cost: { action: "reaction", resources: [] },
              targets: { kind: "self" },
              effects: [],
              variants: null,
              trigger: { on: "roll", roll: "damage", subject: "attack_against_self", when: "rolled" },
              roll_operations: [{ op: "damage_multiplier", factor: 0.5 }],
            },
          ],
          durable_effects: [],
        },
      } as unknown as Json,
      p_patch: null as unknown as Json,
      p_note: "test V3.1-160",
    });
    if (e1) throw new Error(e1.message);

    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test réactions", slug: `integration-test-reactions-${Date.now()}`, owner_id: gm.id, default_ruleset_id: variantId })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: variantId, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: joueuse.id, role: "player" },
    ]);
    const { data: pj } = await admin.from("entities").insert({ world_id: worldId, slug: "lia", name: "Lia", entity_kind: "character", created_by: gm.id }).select("id").single();
    lia = pj!.id;
    const { error: be } = await admin.from("blocks").insert({
      entity_id: lia,
      block_type: "character",
      display: { label: "Personnage", layout: "character" },
      created_by: gm.id,
      data: {
        __v: 1,
        species: { kind: "rule", key: "human" },
        background: null,
        classes: [{ class: { kind: "rule", key: "rogue" }, level: 5, subclass: null }],
        abilities: { method: "manual", base: { str: 10, dex: 16, con: 14, int: 12, wis: 10, cha: 10 } },
        choices: {},
        hp_method: "fixed",
        portrait_asset_id: null,
      },
    });
    if (be) throw new Error(be.message);
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: lia, user_id: joueuse.id, is_pc: true });
    const { data: seance } = await admin.from("sessions").insert({ campaign_id: campaignId, started_at: new Date().toISOString() }).select("id").single();
    const { data: combat } = await admin.from("combats").insert({ campaign_id: campaignId, name: "Embuscade", status: "running", session_id: seance!.id, round: 1, turn_index: 1 }).select("id").single();
    combatId = combat!.id;
    const { data: lignes } = await admin
      .from("combat_participants")
      .insert([
        { combat_id: combatId, source_kind: "entity", entity_id: lia, label: "Lia", initiative: 20, display_order: 0, hp_max: 100, hp_current: 100, ac: 14 },
        { combat_id: combatId, source_kind: "statblock", rule_key: "goblin-warrior", label: "Gobelin", initiative: 5, display_order: 1, hp_max: 10, hp_current: 10 },
      ])
      .select("id, label");
    liaLigne = lignes!.find((l) => l.label === "Lia")!.id;
    gobelin = lignes!.find((l) => l.label === "Gobelin")!.id;
    const fiche = await getRuleEntryForWorld(client(gm), worldId, "goblin-warrior", "fr");
    const actions = (fiche?.blocks.find((b) => b.blockType === "actions")?.data as { actions?: { name: string; damage?: unknown[] }[] } | undefined)?.actions ?? [];
    nomCimeterre = actions.find((a) => (a.damage?.length ?? 0) > 0)?.name ?? "";
    if (!nomCimeterre) throw new Error("le gobelin n'a pas d'action à dégâts");
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    if (variantId) await admin.from("rulesets").delete().eq("id", variantId);
  });

  const pv = async () => (await admin.from("combat_participants").select("hp_current").eq("id", liaLigne).single()).data!.hp_current!;
  const degats = () =>
    resolveTargetedRoll(client(gm), {
      campaignId,
      combatId,
      callerId: gm.id,
      locale: "fr",
      input: { kind: "damage", actor: { kind: "participant", participantId: gobelin }, action: { kind: "monster_action", name: nomCimeterre }, targetId: liaLigne, advantage: "normal", critical: false, secret: false },
    });

  it("dégâts d'un gobelin : la fenêtre s'ouvre, rien n'est appliqué ; la joueuse voit le total, pas de CA", async () => {
    const r = await degats();
    if (!r.ok) throw new Error(r.reason);
    expect(r.rollWindowId).not.toBeNull();
    expect(r.rollEventId).toBeNull();
    expect(await pv()).toBe(100);

    const { data: vue, error } = await client(joueuse).from("roll_windows").select("label, view, choices, status").eq("id", r.rollWindowId!).single();
    if (error) throw new Error(error.message);
    expect(vue.status).toBe("pending");
    expect((vue.choices as { user_id: string; label: string }[])[0]).toMatchObject({ user_id: joueuse.id, label: "Esquive instinctive" });
    expect(JSON.stringify(vue)).not.toMatch(/"ac"|"dc"/);
    // L'état figé n'est lisible par personne côté client.
    expect((await client(joueuse).schema("app_private" as never).from("roll_window_states").select("*")).data ?? null).toBeNull();
  });

  it("« utiliser » Esquive instinctive : moitié des dégâts à la reprise par le MJ, réaction comptée ; l'attaque suivante du round passe sans fenêtre", async () => {
    const { data: ouverte } = await admin.from("roll_windows").select("id, view").eq("campaign_id", campaignId).eq("status", "pending").single();
    const total = (ouverte!.view as { total: number }).total;

    const reponse = await answerRollWindow(client(joueuse), { windowId: ouverte!.id, index: 0, use: true, callerId: joueuse.id, locale: "fr" });
    expect(reponse).toMatchObject({ ok: true, closed: true, resumed: null });
    // Une joueuse ne reprend pas le jet du MJ.
    await expect(resumeRollWindow(client(joueuse), { windowId: ouverte!.id, campaignId, callerId: joueuse.id, locale: "fr" })).rejects.toThrow();

    const repris = await resumeRollWindow(client(gm), { windowId: ouverte!.id, campaignId, callerId: gm.id, locale: "fr" });
    if (!repris.ok) throw new Error(repris.reason);
    expect(repris.amount).toBe(Math.floor(total / 2));
    expect(await pv()).toBe(100 - Math.floor(total / 2));
    const { data: ligne } = await admin.from("combat_participants").select("turn_usage").eq("id", liaLigne).single();
    expect(ligne!.turn_usage).toEqual({ reaction_at: "1:1", once: {} });
    // Reprendre deux fois : refusé, rien ne s'applique deux fois.
    await expect(resumeRollWindow(client(gm), { windowId: ouverte!.id, campaignId, callerId: gm.id, locale: "fr" })).rejects.toThrow();

    const second = await degats();
    if (!second.ok) throw new Error(second.reason);
    expect(second.rollWindowId).toBeNull();
    expect(await pv()).toBe(100 - Math.floor(total / 2) - second.amount!);
  });

  it("une joueuse ne répond pas à la place d'une autre ligne, ni deux fois", async () => {
    await admin.from("combat_participants").update({ turn_usage: { reaction_at: null, once: {} } }).eq("id", liaLigne);
    const r = await degats();
    if (!r.ok || !r.rollWindowId) throw new Error("fenêtre attendue");
    expect(await answerRollWindow(client(joueuse), { windowId: r.rollWindowId, index: 3, use: true, callerId: joueuse.id, locale: "fr" })).toEqual({ ok: false, reason: "refused" });
    const passe = await answerRollWindow(client(joueuse), { windowId: r.rollWindowId, index: 0, use: false, callerId: joueuse.id, locale: "fr" });
    expect(passe).toMatchObject({ ok: true, closed: true });
    expect(await answerRollWindow(client(joueuse), { windowId: r.rollWindowId, index: 0, use: true, callerId: joueuse.id, locale: "fr" })).toEqual({ ok: false, reason: "refused" });
    const avant = await pv();
    const repris = await resumeRollWindow(client(gm), { windowId: r.rollWindowId, campaignId, callerId: gm.id, locale: "fr" });
    if (!repris.ok) throw new Error(repris.reason);
    expect(await pv()).toBe(avant - repris.amount!);
  });
});
